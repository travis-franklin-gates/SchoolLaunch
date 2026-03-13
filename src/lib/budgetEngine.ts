import {
  calcRevenue,
  calcLevyEquity,
  calcAllGrants,
  calcBenefits,
  calcAuthorizerFee,
  PER_PUPIL_RATE,
  LEVY_EQUITY_RATE,
} from './calculations'
import type { SchoolProfile, StaffingPosition, BudgetProjection, FinancialAssumptions } from './types'
import { DEFAULT_ASSUMPTIONS } from './types'

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
  positions: StaffingPosition[],
  assumptions?: FinancialAssumptions
): BudgetSummary {
  const a = assumptions || DEFAULT_ASSUMPTIONS
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

  const perPupilRevenue = a.per_pupil_rate + a.levy_equity_per_student
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
  baseProjections: BudgetProjection[],
  assumptions?: FinancialAssumptions
): BudgetSummary {
  const a = assumptions || DEFAULT_ASSUMPTIONS
  const { enrollment, classSize, leadTeacherSalary, monthlyLease, extraTeacher } = inputs
  const benefitsRate = a.benefits_load_pct / 100
  const feeRate = a.authorizer_fee_pct / 100

  // Revenue
  const apportionment = calcRevenue(enrollment, a.per_pupil_rate)
  const levyEquity = calcLevyEquity(enrollment, a.levy_equity_per_student)
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
    totalPersonnel += cost + calcBenefits(cost, benefitsRate)
  }

  // Extra teacher
  if (extraTeacher) {
    const extra = leadTeacherSalary
    totalPersonnel += extra + calcBenefits(extra, benefitsRate)
  }

  // Operations — rebuild from base projections but override facilities
  const baseOps = baseProjections.filter((p) => !p.is_revenue && p.category === 'Operations')
  let totalOperations = 0
  for (const op of baseOps) {
    if (op.subcategory === 'Facilities') {
      totalOperations += monthlyLease * 12
    } else if (['Supplies & Materials', 'Contracted Services', 'Technology'].includes(op.subcategory)) {
      const baseEnrollment = profile.target_enrollment_y1
      const perPupilRate = baseEnrollment > 0 ? op.amount / baseEnrollment : 0
      totalOperations += Math.round(perPupilRate * enrollment)
    } else if (op.subcategory === 'Authorizer Fee') {
      totalOperations += calcAuthorizerFee(enrollment, feeRate, a.per_pupil_rate)
    } else {
      totalOperations += op.amount
    }
  }

  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = totalRevenue - totalExpenses
  const dailyExpense = totalExpenses / 365
  const reserveDays = dailyExpense > 0 ? Math.round(netPosition / dailyExpense) : 0
  const personnelPctRevenue = totalRevenue > 0 ? (totalPersonnel / totalRevenue) * 100 : 0
  const perPupilRevenue = a.per_pupil_rate + a.levy_equity_per_student
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

// --- Multi-Year Personnel Scaling ---

export interface MultiYearStaffing {
  teachers: number
  paras: number
  officeStaff: number
  otherStaff: number
  totalPositions: number
  totalPersonnelCost: number
}

export function computeMultiYearPersonnel(
  enrollment: number,
  year: number,
  basePositions: StaffingPosition[],
  y1Enrollment: number,
  salaryEscalator: number,
  benefitsRate: number = 0.30,
): MultiYearStaffing {
  const escalator = Math.pow(salaryEscalator, year - 1)

  const teacherPositions = basePositions.filter(
    (p) => p.category === 'certificated' && /teacher/i.test(p.title)
  )
  const paraPositions = basePositions.filter((p) => /para/i.test(p.title))
  const officePositions = basePositions.filter((p) => /office/i.test(p.title))

  const y1TeacherFte = teacherPositions.reduce((s, p) => s + p.fte, 0)
  const y1ParaFte = paraPositions.reduce((s, p) => s + p.fte, 0)
  const y1OfficeFte = officePositions.reduce((s, p) => s + p.fte, 0)

  const studentsPerTeacher = y1TeacherFte > 0 ? y1Enrollment / y1TeacherFte : 24
  const requiredTeachers = Math.ceil(enrollment / studentsPerTeacher)
  const additionalTeachers = Math.max(0, requiredTeachers - y1TeacherFte)

  const additionalParas = (enrollment >= 150 && y1ParaFte < 3) ? Math.min(1, 3 - y1ParaFte) : 0
  const additionalOffice = (enrollment >= 200 && y1OfficeFte < 2) ? Math.min(1, 2 - y1OfficeFte) : 0

  let totalCost = 0
  for (const pos of basePositions) {
    const salary = Math.round(pos.annual_salary * escalator)
    const cost = pos.fte * salary
    totalCost += cost + calcBenefits(cost, benefitsRate)
  }

  const leadTeacherSalary = teacherPositions[0]?.annual_salary || 58000
  if (additionalTeachers > 0) {
    const newSalary = Math.round(leadTeacherSalary * escalator)
    const cost = additionalTeachers * newSalary
    totalCost += cost + calcBenefits(cost, benefitsRate)
  }

  if (additionalParas > 0) {
    const paraSalary = paraPositions[0]?.annual_salary || 35000
    const cost = additionalParas * Math.round(paraSalary * escalator)
    totalCost += cost + calcBenefits(cost, benefitsRate)
  }

  if (additionalOffice > 0) {
    const officeSalary = officePositions[0]?.annual_salary || 42000
    const cost = additionalOffice * Math.round(officeSalary * escalator)
    totalCost += cost + calcBenefits(cost, benefitsRate)
  }

  const otherCount = basePositions.length - teacherPositions.length - paraPositions.length - officePositions.length

  return {
    teachers: y1TeacherFte + additionalTeachers,
    paras: y1ParaFte + additionalParas,
    officeStaff: y1OfficeFte + additionalOffice,
    otherStaff: otherCount,
    totalPositions: basePositions.length + additionalTeachers + additionalParas + additionalOffice,
    totalPersonnelCost: totalCost,
  }
}

// --- Multi-Year Detailed Breakdown ---

export interface MultiYearDetailedRow {
  year: number
  enrollment: number
  revenue: {
    apportionment: number
    levyEquity: number
    titleI: number
    idea: number
    lap: number
    tbip: number
    hicap: number
    total: number
  }
  personnel: {
    certificated: number
    classified: number
    admin: number
    benefits: number
    total: number
  }
  operations: {
    facilities: number
    supplies: number
    contracted: number
    technology: number
    authorizerFee: number
    insurance: number
    contingency: number
    total: number
  }
  totalExpenses: number
  net: number
  cumulativeNet: number
  reserveDays: number
  staffing: MultiYearStaffing
}

export function computeMultiYearDetailed(
  profile: SchoolProfile,
  positions: StaffingPosition[],
  projections: BudgetProjection[],
  assumptions: FinancialAssumptions,
  preOpeningNet: number,
): MultiYearDetailedRow[] {
  const enrollments = [
    profile.target_enrollment_y1,
    profile.target_enrollment_y2,
    profile.target_enrollment_y3,
    profile.target_enrollment_y4,
  ]
  const salaryEscalator = 1 + assumptions.salary_escalator_pct / 100
  const opsEscalator = 1 + assumptions.ops_escalator_pct / 100
  const benefitsRate = assumptions.benefits_load_pct / 100
  const feeRate = assumptions.authorizer_fee_pct / 100

  // Year 1 base data from projections
  const y1Facilities = projections.find((p) => !p.is_revenue && p.subcategory === 'Facilities')?.amount || 0
  const y1Supplies = projections.find((p) => !p.is_revenue && p.subcategory === 'Supplies & Materials')?.amount || 0
  const y1Contracted = projections.find((p) => !p.is_revenue && p.subcategory === 'Contracted Services')?.amount || 0
  const y1Technology = projections.find((p) => !p.is_revenue && p.subcategory === 'Technology')?.amount || 0
  const y1Insurance = projections.find((p) => !p.is_revenue && p.subcategory === 'Insurance')?.amount || 0
  const y1Contingency = projections.find((p) => !p.is_revenue && p.subcategory === 'Misc/Contingency')?.amount || 0

  let cumulativeNet = preOpeningNet
  const rows: MultiYearDetailedRow[] = []

  for (let y = 1; y <= 4; y++) {
    const enr = enrollments[y - 1] || enrollments[0]

    // Revenue
    const apportionment = calcRevenue(enr, assumptions.per_pupil_rate)
    const levyEquity = calcLevyEquity(enr, assumptions.levy_equity_per_student)
    const grants = calcAllGrants(enr, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap)
    const totalRevenue = apportionment + levyEquity + grants.titleI + grants.idea + grants.lap + grants.tbip + grants.hicap

    // Personnel
    const staffing = y === 1
      ? computeYear1Staffing(positions)
      : computeMultiYearPersonnel(enr, y, positions, enrollments[0], salaryEscalator, benefitsRate)

    let certCost = 0, classCost = 0, adminCost = 0, benefitsCost = 0
    if (y === 1) {
      // Use actual position data
      for (const pos of positions) {
        const cost = pos.fte * pos.annual_salary
        const ben = calcBenefits(cost, benefitsRate)
        if (pos.category === 'certificated') certCost += cost
        else if (pos.category === 'classified') classCost += cost
        else if (pos.category === 'admin') adminCost += cost
        benefitsCost += ben
      }
    } else {
      // Scaled positions
      const escalator = Math.pow(salaryEscalator, y - 1)
      const teacherPositions = positions.filter(p => p.category === 'certificated' && /teacher/i.test(p.title))
      const additionalTeachers = staffing.teachers - teacherPositions.reduce((s, p) => s + p.fte, 0)

      for (const pos of positions) {
        const salary = Math.round(pos.annual_salary * escalator)
        const cost = pos.fte * salary
        if (pos.category === 'certificated') certCost += cost
        else if (pos.category === 'classified') classCost += cost
        else if (pos.category === 'admin') adminCost += cost
        benefitsCost += calcBenefits(cost, benefitsRate)
      }
      // Additional teachers
      if (additionalTeachers > 0) {
        const leadSalary = teacherPositions[0]?.annual_salary || 58000
        const cost = additionalTeachers * Math.round(leadSalary * escalator)
        certCost += cost
        benefitsCost += calcBenefits(cost, benefitsRate)
      }
      // Additional paras
      const paraPositions = positions.filter(p => /para/i.test(p.title))
      const y1ParaFte = paraPositions.reduce((s, p) => s + p.fte, 0)
      const additionalParas = (enr >= 150 && y1ParaFte < 3) ? Math.min(1, 3 - y1ParaFte) : 0
      if (additionalParas > 0) {
        const cost = additionalParas * Math.round((paraPositions[0]?.annual_salary || 35000) * escalator)
        classCost += cost
        benefitsCost += calcBenefits(cost, benefitsRate)
      }
      // Additional office
      const officePositions = positions.filter(p => /office/i.test(p.title))
      const y1OfficeFte = officePositions.reduce((s, p) => s + p.fte, 0)
      const additionalOffice = (enr >= 200 && y1OfficeFte < 2) ? Math.min(1, 2 - y1OfficeFte) : 0
      if (additionalOffice > 0) {
        const cost = additionalOffice * Math.round((officePositions[0]?.annual_salary || 42000) * escalator)
        classCost += cost
        benefitsCost += calcBenefits(cost, benefitsRate)
      }
    }
    const totalPersonnel = certCost + classCost + adminCost + benefitsCost

    // Operations
    const opsScale = Math.pow(opsEscalator, y - 1)
    const enrRatio = enrollments[0] > 0 ? enr / enrollments[0] : 1
    const facilities = Math.round(y1Facilities * opsScale)
    const supplies = Math.round(y1Supplies * enrRatio * opsScale)
    const contracted = Math.round(y1Contracted * enrRatio * opsScale)
    const technology = Math.round(y1Technology * enrRatio * opsScale)
    const authorizerFee = calcAuthorizerFee(enr, feeRate, assumptions.per_pupil_rate)
    const insurance = Math.round(y1Insurance * opsScale)
    const contingencyBase = totalPersonnel + facilities + supplies + contracted + technology + authorizerFee + insurance
    const contingency = Math.round(contingencyBase * (assumptions.contingency_pct / 100))
    const totalOperations = facilities + supplies + contracted + technology + authorizerFee + insurance + contingency

    const totalExpenses = totalPersonnel + totalOperations
    const net = totalRevenue - totalExpenses
    cumulativeNet += net
    const dailyExpense = totalExpenses / 365
    const reserveDays = dailyExpense > 0 ? Math.round(net / dailyExpense) : 0

    rows.push({
      year: y,
      enrollment: enr,
      revenue: { apportionment, levyEquity, titleI: grants.titleI, idea: grants.idea, lap: grants.lap, tbip: grants.tbip, hicap: grants.hicap, total: totalRevenue },
      personnel: { certificated: certCost, classified: classCost, admin: adminCost, benefits: benefitsCost, total: totalPersonnel },
      operations: { facilities, supplies, contracted, technology, authorizerFee, insurance, contingency, total: totalOperations },
      totalExpenses,
      net,
      cumulativeNet,
      reserveDays,
      staffing,
    })
  }

  return rows
}

function computeYear1Staffing(positions: StaffingPosition[]): MultiYearStaffing {
  const teacherPositions = positions.filter(p => p.category === 'certificated' && /teacher/i.test(p.title))
  const paraPositions = positions.filter(p => /para/i.test(p.title))
  const officePositions = positions.filter(p => /office/i.test(p.title))
  const otherCount = positions.length - teacherPositions.length - paraPositions.length - officePositions.length
  const totalCost = positions.reduce((s, p) => {
    const cost = p.fte * p.annual_salary
    return s + cost + calcBenefits(cost)
  }, 0)
  return {
    teachers: teacherPositions.reduce((s, p) => s + p.fte, 0),
    paras: paraPositions.reduce((s, p) => s + p.fte, 0),
    officeStaff: officePositions.reduce((s, p) => s + p.fte, 0),
    otherStaff: otherCount,
    totalPositions: positions.length,
    totalPersonnelCost: totalCost,
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

export function computeCashFlow(summary: BudgetSummary, apportionmentTotal: number, startingBalance: number = 0): CashFlowMonth[] {
  const otherRevenueTotal = summary.totalRevenue - apportionmentTotal
  const monthlyOtherRevenue = Math.round(otherRevenueTotal / 12)
  const monthlyPayroll = Math.round(summary.totalPersonnel / 12)
  const monthlyOtherExpenses = Math.round(summary.totalOperations / 12)

  let cumulative = startingBalance
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
