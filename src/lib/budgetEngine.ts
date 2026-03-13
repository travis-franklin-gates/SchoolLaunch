import {
  calcRevenue,
  calcLevyEquity,
  calcAllGrants,
  calcBenefits,
  calcAuthorizerFee,
  calcCommissionRevenue,
  calcAuthorizerFeeCommission,
  PER_PUPIL_RATE,
  LEVY_EQUITY_RATE,
} from './calculations'
import type { SchoolProfile, StaffingPosition, BudgetProjection, FinancialAssumptions, GradeExpansionEntry } from './types'
import { DEFAULT_ASSUMPTIONS } from './types'
import { expansionToEnrollmentArray, computeExpansionEnrollments, teachersPerNewGrade } from './gradeExpansion'

export interface BudgetSummary {
  totalRevenue: number
  totalPersonnel: number
  totalOperations: number
  totalExpenses: number
  netPosition: number
  reserveDays: number
  personnelPctRevenue: number
  breakEvenEnrollment: number
  facilityPct: number
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

  // Break-even uses Commission revenue per pupil (AAFTE-adjusted)
  const aaftePct = a.aafte_pct / 100
  const perPupilRevenue = (a.regular_ed_per_pupil + a.levy_equity_per_student) * aaftePct
  const breakEvenEnrollment = perPupilRevenue > 0
    ? Math.ceil(totalExpenses / perPupilRevenue)
    : 0

  const facilityCost = projections
    .filter((p) => !p.is_revenue && p.subcategory === 'Facilities')
    .reduce((s, p) => s + p.amount, 0)
  const facilityPct = totalRevenue > 0 ? (facilityCost / totalRevenue) * 100 : 0

  return {
    totalRevenue,
    totalPersonnel,
    totalOperations,
    totalExpenses,
    netPosition,
    reserveDays,
    personnelPctRevenue,
    breakEvenEnrollment,
    facilityPct,
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

  // Revenue — use Commission revenue structure
  const rev = calcCommissionRevenue(enrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, a)
  const totalRevenue = rev.total

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
      // Fee on state apportionment (regularEd + sped + facilities)
      const stateApport = rev.regularEd + rev.sped + rev.facilitiesRev
      totalOperations += calcAuthorizerFeeCommission(stateApport, feeRate)
    } else {
      totalOperations += op.amount
    }
  }

  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = totalRevenue - totalExpenses
  const dailyExpense = totalExpenses / 365
  const reserveDays = dailyExpense > 0 ? Math.round(netPosition / dailyExpense) : 0
  const personnelPctRevenue = totalRevenue > 0 ? (totalPersonnel / totalRevenue) * 100 : 0
  const aaftePct = a.aafte_pct / 100
  const perPupilRevenue = (a.regular_ed_per_pupil + a.levy_equity_per_student) * aaftePct
  const breakEvenEnrollment = perPupilRevenue > 0 ? Math.ceil(totalExpenses / perPupilRevenue) : 0
  const facilityPct = totalRevenue > 0 ? ((monthlyLease * 12) / totalRevenue) * 100 : 0

  return {
    totalRevenue,
    totalPersonnel,
    totalOperations,
    totalExpenses,
    netPosition,
    reserveDays,
    personnelPctRevenue,
    breakEvenEnrollment,
    facilityPct,
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
  totalSalaries: number
  totalBenefits: number
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

  let totalSalaries = 0
  let totalBenefits = 0
  for (const pos of basePositions) {
    const salary = Math.round(pos.annual_salary * escalator)
    const cost = pos.fte * salary
    totalSalaries += cost
    totalBenefits += calcBenefits(cost, benefitsRate)
  }

  const leadTeacherSalary = teacherPositions[0]?.annual_salary || 58000
  if (additionalTeachers > 0) {
    const newSalary = Math.round(leadTeacherSalary * escalator)
    const cost = additionalTeachers * newSalary
    totalSalaries += cost
    totalBenefits += calcBenefits(cost, benefitsRate)
  }

  if (additionalParas > 0) {
    const paraSalary = paraPositions[0]?.annual_salary || 35000
    const cost = additionalParas * Math.round(paraSalary * escalator)
    totalSalaries += cost
    totalBenefits += calcBenefits(cost, benefitsRate)
  }

  if (additionalOffice > 0) {
    const officeSalary = officePositions[0]?.annual_salary || 42000
    const cost = additionalOffice * Math.round(officeSalary * escalator)
    totalSalaries += cost
    totalBenefits += calcBenefits(cost, benefitsRate)
  }

  const otherCount = basePositions.length - teacherPositions.length - paraPositions.length - officePositions.length

  return {
    teachers: y1TeacherFte + additionalTeachers,
    paras: y1ParaFte + additionalParas,
    officeStaff: y1OfficeFte + additionalOffice,
    otherStaff: otherCount,
    totalPositions: basePositions.length + additionalTeachers + additionalParas + additionalOffice,
    totalPersonnelCost: totalSalaries + totalBenefits,
    totalSalaries,
    totalBenefits,
  }
}

// --- Multi-Year Detailed Breakdown ---

export interface MultiYearDetailedRow {
  year: number
  enrollment: number
  aafte: number
  revenue: {
    regularEd: number
    sped: number
    facilitiesRev: number
    levyEquity: number
    titleI: number
    idea: number
    lap: number
    tbip: number
    hicap: number
    interestIncome: number
    total: number
    // Legacy aliases
    apportionment: number
  }
  personnel: {
    certificated: number
    classified: number
    admin: number
    benefits: number
    total: number
    totalSalaries: number
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
  expansionDetail?: {
    returning: number
    newGrade: number
    grades: string[]
    newGrades: string[]
  }
}

export function computeMultiYearDetailed(
  profile: SchoolProfile,
  positions: StaffingPosition[],
  projections: BudgetProjection[],
  assumptions: FinancialAssumptions,
  preOpeningNet: number,
  gradeExpansionPlan?: GradeExpansionEntry[],
): MultiYearDetailedRow[] {
  // Use grade expansion enrollments if available, else fall back to flat profile targets
  const hasExpansion = gradeExpansionPlan && gradeExpansionPlan.length > 0
  const retentionRate = profile.retention_rate ?? 90
  const expansionEnrollments = hasExpansion
    ? expansionToEnrollmentArray(gradeExpansionPlan!, retentionRate)
    : null
  const expansionDetails = hasExpansion
    ? computeExpansionEnrollments(gradeExpansionPlan!, retentionRate)
    : null

  const enrollments = expansionEnrollments || [
    profile.target_enrollment_y1,
    profile.target_enrollment_y2,
    profile.target_enrollment_y3,
    profile.target_enrollment_y4,
    profile.target_enrollment_y5 || profile.target_enrollment_y4,
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

  let cumulativeNet = preOpeningNet
  const rows: MultiYearDetailedRow[] = []

  const interestRate = assumptions.interest_rate_on_cash / 100

  for (let y = 1; y <= 5; y++) {
    const enr = enrollments[y - 1] || enrollments[enrollments.length - 1] || enrollments[0]

    // Revenue — Commission-aligned with COLA
    const rev = calcCommissionRevenue(enr, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions, y)
    // Interest income on prior year ending cash balance
    const priorCash = cumulativeNet
    const interestIncome = y === 1
      ? Math.round(Math.max(0, priorCash) * interestRate / 2) // half-year approximation
      : Math.round(Math.max(0, priorCash) * interestRate)
    const totalRevenue = rev.total + interestIncome
    // State apportionment = regularEd + sped + facilitiesRev (for authorizer fee)
    const stateApport = rev.regularEd + rev.sped + rev.facilitiesRev

    // Personnel
    const staffing = y === 1
      ? computeYear1Staffing(positions, benefitsRate)
      : computeMultiYearPersonnel(enr, y, positions, enrollments[0], salaryEscalator, benefitsRate)

    let certCost = 0, classCost = 0, adminCost = 0, benefitsCost = 0, totalSalaries = 0
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
      totalSalaries = certCost + classCost + adminCost
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
      // Additional teachers — use grade expansion data if available
      let effectiveAdditionalTeachers = additionalTeachers
      if (hasExpansion && expansionDetails) {
        const yearDetail = expansionDetails.find((d) => d.year === y)
        if (yearDetail && yearDetail.newGrades.length > 0) {
          const gradeBasedTeachers = yearDetail.newGrades.reduce((sum, grade) => {
            const gradeEntry = gradeExpansionPlan!.find((e) => e.year === y && e.grade_level === grade)
            return sum + teachersPerNewGrade(grade, gradeEntry?.sections || 2)
          }, 0)
          effectiveAdditionalTeachers = Math.max(additionalTeachers, gradeBasedTeachers)
        }
      }
      if (effectiveAdditionalTeachers > 0) {
        const leadSalary = teacherPositions[0]?.annual_salary || 58000
        const cost = effectiveAdditionalTeachers * Math.round(leadSalary * escalator)
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
      totalSalaries = certCost + classCost + adminCost
    }
    const totalPersonnel = certCost + classCost + adminCost + benefitsCost

    // Operations
    const opsScale = Math.pow(opsEscalator, y - 1)
    const enrRatio = enrollments[0] > 0 ? enr / enrollments[0] : 1
    const facilities = Math.round(y1Facilities * opsScale)
    const supplies = Math.round(y1Supplies * enrRatio * opsScale)
    const contracted = Math.round(y1Contracted * enrRatio * opsScale)
    const technology = Math.round(y1Technology * enrRatio * opsScale)
    const authorizerFee = calcAuthorizerFeeCommission(stateApport, feeRate)
    const insurance = Math.round(y1Insurance * opsScale)
    const contingencyBase = totalPersonnel + facilities + supplies + contracted + technology + authorizerFee + insurance
    const contingency = Math.round(contingencyBase * (assumptions.contingency_pct / 100))
    const totalOperations = facilities + supplies + contracted + technology + authorizerFee + insurance + contingency

    const totalExpenses = totalPersonnel + totalOperations
    const net = totalRevenue - totalExpenses
    cumulativeNet += net
    const dailyExpense = totalExpenses / 365
    const reserveDays = dailyExpense > 0 ? Math.round(net / dailyExpense) : 0

    const expansionDetail = expansionDetails
      ? expansionDetails.find((d) => d.year === y)
      : undefined

    rows.push({
      year: y,
      enrollment: enr,
      aafte: rev.aafte,
      revenue: {
        regularEd: rev.regularEd,
        sped: rev.sped,
        facilitiesRev: rev.facilitiesRev,
        levyEquity: rev.levyEquity,
        titleI: rev.titleI,
        idea: rev.idea,
        lap: rev.lap,
        tbip: rev.tbip,
        hicap: rev.hicap,
        interestIncome,
        total: totalRevenue,
        apportionment: rev.regularEd + rev.sped + rev.facilitiesRev,
      },
      personnel: {
        certificated: certCost,
        classified: classCost,
        admin: adminCost,
        benefits: benefitsCost,
        total: totalPersonnel,
        totalSalaries,
      },
      operations: { facilities, supplies, contracted, technology, authorizerFee, insurance, contingency, total: totalOperations },
      totalExpenses,
      net,
      cumulativeNet,
      reserveDays,
      staffing,
      expansionDetail: expansionDetail ? {
        returning: expansionDetail.returning,
        newGrade: expansionDetail.newGrade,
        grades: expansionDetail.grades,
        newGrades: expansionDetail.newGrades,
      } : undefined,
    })
  }

  return rows
}

function computeYear1Staffing(positions: StaffingPosition[], benefitsRate: number = 0.30): MultiYearStaffing {
  const teacherPositions = positions.filter(p => p.category === 'certificated' && /teacher/i.test(p.title))
  const paraPositions = positions.filter(p => /para/i.test(p.title))
  const officePositions = positions.filter(p => /office/i.test(p.title))
  const otherCount = positions.length - teacherPositions.length - paraPositions.length - officePositions.length
  let totalSalaries = 0
  let totalBenefits = 0
  for (const p of positions) {
    const cost = p.fte * p.annual_salary
    totalSalaries += cost
    totalBenefits += calcBenefits(cost, benefitsRate)
  }
  return {
    teachers: teacherPositions.reduce((s, p) => s + p.fte, 0),
    paras: paraPositions.reduce((s, p) => s + p.fte, 0),
    officeStaff: officePositions.reduce((s, p) => s + p.fte, 0),
    otherStaff: otherCount,
    totalPositions: positions.length,
    totalPersonnelCost: totalSalaries + totalBenefits,
    totalSalaries,
    totalBenefits,
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

// --- Commission Financial Performance Framework (FPF) Scorecard ---

export interface FPFMeasure {
  name: string
  formula: string
  values: (number | null)[] // one per year (5)
  stage1Target: string
  stage2Target: string
  statuses: ('meets' | 'approaches' | 'does_not_meet' | 'na')[]
}

export interface FPFScorecard {
  measures: FPFMeasure[]
  overallStatus: 'green' | 'yellow' | 'red'
  overallMessage: string
}

function fpfStatus(
  value: number | null,
  year: number,
  check: (v: number, stage: 1 | 2) => 'meets' | 'approaches' | 'does_not_meet',
): 'meets' | 'approaches' | 'does_not_meet' | 'na' {
  if (value === null) return 'na'
  const stage = year <= 2 ? 1 : 2
  return check(value, stage)
}

export function computeFPFScorecard(
  multiYear: MultiYearDetailedRow[],
  startingCash: number,
  conservativeMode: boolean,
): FPFScorecard {
  // Build year-end cash balances
  const yearEndCash: number[] = []
  let cash = startingCash
  for (const row of multiYear) {
    cash += row.net
    yearEndCash.push(cash)
  }

  const measures: FPFMeasure[] = []

  // 1. Current Ratio: (Starting Cash + Revenue) / Expenses for Y1; cumulative net proxy for Y2+
  const currentRatioValues = multiYear.map((row, i) => {
    if (i === 0) {
      const assets = startingCash + row.revenue.total
      return row.totalExpenses > 0 ? assets / row.totalExpenses : 99
    }
    const assets = yearEndCash[i]
    // Approximate current liabilities as ~1/12 of annual expenses
    const liabilities = row.totalExpenses / 12
    return liabilities > 0 ? Math.max(0, assets) / liabilities : 99
  })
  measures.push({
    name: 'Current Ratio',
    formula: 'Current Assets ÷ Current Liabilities',
    values: currentRatioValues.map(v => Math.round(v * 100) / 100),
    stage1Target: '≥1.0',
    stage2Target: '≥1.1',
    statuses: currentRatioValues.map((v, i) =>
      fpfStatus(v, i + 1, (val, stage) =>
        val >= (stage === 1 ? 1.0 : 1.1) ? 'meets'
          : val >= (stage === 1 ? 0.8 : 0.88) ? 'approaches'
          : 'does_not_meet'
      )
    ),
  })

  // 2. Days of Cash
  const daysOfCash = multiYear.map((row, i) => {
    const dailyExpense = row.totalExpenses / 365
    return dailyExpense > 0 ? Math.round(yearEndCash[i] / dailyExpense) : 0
  })
  measures.push({
    name: 'Days of Cash',
    formula: 'Unrestricted Cash ÷ (Total Expenses / 365)',
    values: daysOfCash,
    stage1Target: '≥30',
    stage2Target: '≥60',
    statuses: daysOfCash.map((v, i) =>
      fpfStatus(v, i + 1, (val, stage) =>
        val >= (stage === 1 ? 30 : 60) ? 'meets'
          : val >= (stage === 1 ? 24 : 48) ? 'approaches'
          : 'does_not_meet'
      )
    ),
  })

  // 3. Total Margin
  const totalMargin = multiYear.map(row =>
    row.revenue.total > 0 ? Math.round((row.net / row.revenue.total) * 1000) / 10 : 0
  )
  measures.push({
    name: 'Total Margin',
    formula: 'Net Income ÷ Total Revenue',
    values: totalMargin,
    stage1Target: '≥0%',
    stage2Target: '≥0%',
    statuses: totalMargin.map((v, i) =>
      fpfStatus(v, i + 1, (val) =>
        val >= 0 ? 'meets' : val >= -2 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 4. 3-Year Total Margin
  const threeYearMargin: (number | null)[] = multiYear.map((_, i) => {
    if (i < 2) return null
    const netSum = multiYear.slice(i - 2, i + 1).reduce((s, r) => s + r.net, 0)
    const revSum = multiYear.slice(i - 2, i + 1).reduce((s, r) => s + r.revenue.total, 0)
    return revSum > 0 ? Math.round((netSum / revSum) * 1000) / 10 : 0
  })
  measures.push({
    name: '3-Year Total Margin',
    formula: '3-Year Net Income ÷ 3-Year Revenue',
    values: threeYearMargin,
    stage1Target: 'N/A',
    stage2Target: '>0%',
    statuses: threeYearMargin.map((v, i) =>
      v === null ? 'na' : fpfStatus(v, i + 1, (val) =>
        val > 0 ? 'meets' : val >= -1 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 5. Debt-to-Asset (no debt modeling yet, show 0)
  measures.push({
    name: 'Debt-to-Asset',
    formula: 'Total Liabilities ÷ Total Assets',
    values: multiYear.map(() => 0),
    stage1Target: '<0.90',
    stage2Target: '<0.90',
    statuses: multiYear.map(() => 'meets'),
  })

  // 6. Cash Flow (year-over-year change)
  const cashFlowValues = multiYear.map((_, i) => {
    if (i === 0) return yearEndCash[0] - startingCash
    return yearEndCash[i] - yearEndCash[i - 1]
  })
  measures.push({
    name: 'Cash Flow',
    formula: 'Year-End Cash − Prior Year-End Cash',
    values: cashFlowValues,
    stage1Target: '>0',
    stage2Target: '>0',
    statuses: cashFlowValues.map((v, i) =>
      fpfStatus(v, i + 1, (val) =>
        val > 0 ? 'meets' : val >= -5000 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 7. 3-Year Cash Flow
  const threeYearCashFlow: (number | null)[] = multiYear.map((_, i) => {
    if (i < 2) return null
    return yearEndCash[i] - (i >= 3 ? yearEndCash[i - 3] : startingCash)
  })
  measures.push({
    name: '3-Year Cash Flow',
    formula: 'Year-End Cash − (Year-3) End Cash',
    values: threeYearCashFlow,
    stage1Target: 'N/A',
    stage2Target: '>0',
    statuses: threeYearCashFlow.map((v, i) =>
      v === null ? 'na' : fpfStatus(v, i + 1, (val) =>
        val > 0 ? 'meets' : val >= -5000 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 8. Enrollment Variance
  const enrollmentVariance = multiYear.map(() =>
    conservativeMode ? 90 : 100
  )
  measures.push({
    name: 'Enrollment Variance',
    formula: 'Actual ÷ Projected',
    values: enrollmentVariance,
    stage1Target: '≥95%',
    stage2Target: '≥95%',
    statuses: enrollmentVariance.map((v, i) =>
      fpfStatus(v, i + 1, (val) =>
        val >= 95 ? 'meets' : val >= 85 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 9. DSCR (no debt = N/A)
  measures.push({
    name: 'DSCR',
    formula: '(Net Income + Depreciation + Interest) ÷ Debt Service',
    values: multiYear.map(() => null),
    stage1Target: 'N/A (no debt)',
    stage2Target: '≥1.1',
    statuses: multiYear.map(() => 'na'),
  })

  // Overall assessment
  const stage1Issues: string[] = []
  const stage2Issues: string[] = []
  for (const m of measures) {
    for (let i = 0; i < Math.min(2, m.statuses.length); i++) {
      if (m.statuses[i] === 'does_not_meet') {
        if (!stage1Issues.includes(m.name)) stage1Issues.push(m.name)
      }
    }
    for (let i = 2; i < m.statuses.length; i++) {
      if (m.statuses[i] === 'does_not_meet') {
        if (!stage2Issues.includes(m.name)) stage2Issues.push(m.name)
      }
    }
  }

  let overallStatus: 'green' | 'yellow' | 'red'
  let overallMessage: string

  if (stage1Issues.length === 0 && stage2Issues.length === 0) {
    overallStatus = 'green'
    overallMessage = 'Your model meets all Stage 1 standards for Years 1-2 and all Stage 2 standards for Years 3-5.'
  } else if (stage1Issues.length === 0) {
    overallStatus = 'yellow'
    overallMessage = `Your model meets Stage 1 standards but does not yet meet Stage 2 for: ${stage2Issues.join(', ')}.`
  } else {
    overallStatus = 'red'
    overallMessage = `Your model does not meet Stage 1 standards for: ${stage1Issues.join(', ')} — address before submitting.`
  }

  return { measures, overallStatus, overallMessage }
}
