import {
  calcRevenue,
  calcLevyEquity,
  calcAllGrants,
  calcBenefits,
  calcAuthorizerFee,
  PER_PUPIL_RATE,
  LEVY_EQUITY_RATE,
} from './calculations'
import type { SchoolProfile, StaffingPosition, BudgetProjection } from './types'

export interface BudgetSummary {
  totalRevenue: number
  totalPersonnel: number
  totalOperations: number
  totalExpenses: number
  netPosition: number
  reserveDays: number
  personnelPctRevenue: number
  breakEvenEnrollment: number
}

export function computeSummaryFromProjections(
  projections: BudgetProjection[],
  positions: StaffingPosition[]
): BudgetSummary {
  const totalRevenue = projections
    .filter((p) => p.is_revenue)
    .reduce((s, p) => s + p.amount, 0)
  const totalPersonnel = projections
    .filter((p) => !p.is_revenue && p.category === 'Personnel')
    .reduce((s, p) => s + p.amount, 0)
  const totalOperations = projections
    .filter((p) => !p.is_revenue && p.category === 'Operations')
    .reduce((s, p) => s + p.amount, 0)
  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = totalRevenue - totalExpenses
  const dailyExpense = totalExpenses / 365
  const reserveDays = dailyExpense > 0 ? Math.round(netPosition / dailyExpense) : 0
  const personnelPctRevenue = totalRevenue > 0 ? (totalPersonnel / totalRevenue) * 100 : 0

  // Break-even: find enrollment where revenue = expenses
  // Revenue scales linearly with enrollment; personnel is mostly fixed, ops partially scales
  // Simplification: solve (enrollment * perPupilTotal + grantEstimate) = totalExpenses
  // Approximate: use per-pupil revenue rate
  const perPupilRevenue = PER_PUPIL_RATE + LEVY_EQUITY_RATE
  const breakEvenEnrollment = perPupilRevenue > 0
    ? Math.ceil(totalExpenses / perPupilRevenue)
    : 0

  return {
    totalRevenue,
    totalPersonnel,
    totalOperations,
    totalExpenses,
    netPosition,
    reserveDays,
    personnelPctRevenue,
    breakEvenEnrollment,
  }
}

export interface ScenarioInputs {
  enrollment: number
  classSize: number
  leadTeacherSalary: number
  monthlyLease: number
  extraTeacher: boolean
}

export function computeScenario(
  inputs: ScenarioInputs,
  profile: SchoolProfile,
  basePositions: StaffingPosition[],
  baseProjections: BudgetProjection[]
): BudgetSummary {
  const { enrollment, classSize, leadTeacherSalary, monthlyLease, extraTeacher } = inputs

  // Revenue
  const apportionment = calcRevenue(enrollment)
  const levyEquity = calcLevyEquity(enrollment)
  const grants = calcAllGrants(enrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap)
  const totalRevenue = apportionment + levyEquity + grants.titleI + grants.idea + grants.lap + grants.tbip + grants.hicap

  // Personnel — scale certificated salaries proportionally
  const baseCertSalary = basePositions.find((p) => p.category === 'certificated')?.annual_salary || 58000
  const salaryRatio = leadTeacherSalary / baseCertSalary

  let totalPersonnel = 0
  for (const pos of basePositions) {
    const salary = pos.category === 'certificated'
      ? Math.round(pos.annual_salary * salaryRatio)
      : pos.annual_salary
    const cost = pos.fte * salary
    totalPersonnel += cost + calcBenefits(cost)
  }

  // Extra teacher
  if (extraTeacher) {
    const extra = leadTeacherSalary
    totalPersonnel += extra + calcBenefits(extra)
  }

  // Operations — rebuild from base projections but override facilities
  const baseOps = baseProjections.filter((p) => !p.is_revenue && p.category === 'Operations')
  let totalOperations = 0
  for (const op of baseOps) {
    if (op.line_item === 'Facilities') {
      totalOperations += monthlyLease * 12
    } else if (['Supplies & Materials', 'Contracted Services', 'Technology'].includes(op.line_item)) {
      // These are per-pupil — find the base enrollment to get rate
      const baseEnrollment = profile.target_enrollment_y1
      const perPupilRate = baseEnrollment > 0 ? op.amount / baseEnrollment : 0
      totalOperations += Math.round(perPupilRate * enrollment)
    } else if (op.line_item === 'Authorizer Fee') {
      totalOperations += calcAuthorizerFee(enrollment)
    } else {
      totalOperations += op.amount
    }
  }

  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = totalRevenue - totalExpenses
  const dailyExpense = totalExpenses / 365
  const reserveDays = dailyExpense > 0 ? Math.round(netPosition / dailyExpense) : 0
  const personnelPctRevenue = totalRevenue > 0 ? (totalPersonnel / totalRevenue) * 100 : 0
  const perPupilRevenue = PER_PUPIL_RATE + LEVY_EQUITY_RATE
  const breakEvenEnrollment = perPupilRevenue > 0 ? Math.ceil(totalExpenses / perPupilRevenue) : 0

  return {
    totalRevenue,
    totalPersonnel,
    totalOperations,
    totalExpenses,
    netPosition,
    reserveDays,
    personnelPctRevenue,
    breakEvenEnrollment,
  }
}

// OSPI monthly payment schedule
export const OSPI_SCHEDULE: Record<string, number> = {
  Sep: 0.09,
  Oct: 0.08,
  Nov: 0.05,
  Dec: 0.09,
  Jan: 0.085,
  Feb: 0.09,
  Mar: 0.09,
  Apr: 0.09,
  May: 0.05,
  Jun: 0.06,
  Jul: 0.125,
  Aug: 0.10,
}

export const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

export interface CashFlowMonth {
  month: string
  apportionmentPct: number
  apportionmentAmt: number
  otherRevenue: number
  totalInflow: number
  payroll: number
  otherExpenses: number
  netCashFlow: number
  cumulativeBalance: number
}

export function computeCashFlow(summary: BudgetSummary, apportionmentTotal: number): CashFlowMonth[] {
  const otherRevenueTotal = summary.totalRevenue - apportionmentTotal
  const monthlyOtherRevenue = Math.round(otherRevenueTotal / 12)
  const monthlyPayroll = Math.round(summary.totalPersonnel / 12)
  const monthlyOtherExpenses = Math.round(summary.totalOperations / 12)

  let cumulative = 0
  return MONTHS.map((month) => {
    const pct = OSPI_SCHEDULE[month]
    const apportionmentAmt = Math.round(apportionmentTotal * pct)
    const totalInflow = apportionmentAmt + monthlyOtherRevenue
    const netCashFlow = totalInflow - monthlyPayroll - monthlyOtherExpenses
    cumulative += netCashFlow
    return {
      month,
      apportionmentPct: pct,
      apportionmentAmt,
      otherRevenue: monthlyOtherRevenue,
      totalInflow,
      payroll: monthlyPayroll,
      otherExpenses: monthlyOtherExpenses,
      netCashFlow,
      cumulativeBalance: cumulative,
    }
  })
}
