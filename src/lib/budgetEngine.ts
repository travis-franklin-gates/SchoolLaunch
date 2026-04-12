import {
  calcRevenue,
  calcLevyEquity,
  calcAllGrants,
  calcBenefits,
  calcAuthorizerFee,
  calcCommissionRevenue,
  calcAuthorizerFeeCommission,
  calcSmallSchoolEnhancement,
  PER_PUPIL_RATE,
  LEVY_EQUITY_RATE,
} from './calculations'
import type { SchoolProfile, StaffingPosition, BudgetProjection, FinancialAssumptions, GradeExpansionEntry, StartupFundingSource } from './types'
import { DEFAULT_ASSUMPTIONS } from './types'

/** Minimal profile fields needed for live revenue calculation */
export interface RevenueProfile {
  target_enrollment_y1: number
  pct_frl: number
  pct_iep: number
  pct_ell: number
  pct_hicap: number
}

// --- Grant Revenue Utility ---

/** Get grant revenue for a specific year (1-5) from startup funding sources */
export function getGrantRevenueForYear(
  sources: StartupFundingSource[] | null | undefined,
  year: number,
): number {
  if (!sources || sources.length === 0) return 0
  let total = 0
  for (const src of sources) {
    // If explicit year allocations exist for this source, use them (even if 0)
    if (src.yearAllocations && year in src.yearAllocations) {
      total += src.yearAllocations[year] || 0
    } else if (src.selectedYears?.includes(year)) {
      // Evenly divide across selected years only if NO explicit allocations exist at all
      if (!src.yearAllocations || Object.keys(src.yearAllocations).length === 0) {
        const yearCount = src.selectedYears.length
        total += Math.round(src.amount / yearCount)
      }
      // Otherwise, explicit allocations exist but not for this year — $0
    }
  }
  return total
}

/** Get per-source grant allocations for a specific year */
export function getGrantAllocationsForYear(
  sources: StartupFundingSource[] | null | undefined,
  year: number,
): { source: string; amount: number; type: StartupFundingSource['type'] }[] {
  if (!sources || sources.length === 0) return []
  return sources.map((src) => {
    let amount = 0
    if (src.yearAllocations && year in src.yearAllocations) {
      amount = src.yearAllocations[year] || 0
    } else if (src.selectedYears?.includes(year)) {
      if (!src.yearAllocations || Object.keys(src.yearAllocations).length === 0) {
        const yearCount = src.selectedYears.length
        amount = Math.round(src.amount / yearCount)
      }
    }
    return { source: src.source, amount, type: src.type }
  }).filter((a) => a.amount > 0)
}
import { expansionToEnrollmentArray, computeExpansionEnrollments, teachersPerNewGrade } from './gradeExpansion'

// --- Year 0 Carry-Forward ---

/** Compute carry-forward from Year 0 into Year 1, matching the Multi-Year tab logic.
 *  Year 0 total = sum of Y0 allocations (or full amount for sources with no year selection).
 *  Pre-opening spend = actual transactions if any, else budgeted amounts.
 *  Carry-forward = year0Total - preOpeningSpend.
 */
export function computeCarryForward(profile: SchoolProfile): number {
  const sources: StartupFundingSource[] = profile.startup_funding || []
  const totalFunding = sources.reduce((s, f) => s + f.amount, 0)

  let year0Total = 0
  for (const src of sources) {
    if (src.selectedYears?.includes(0) && src.yearAllocations?.[0]) {
      year0Total += src.yearAllocations[0]
    } else if (!src.selectedYears || src.selectedYears.length === 0) {
      year0Total += src.amount
    }
  }
  if (year0Total === 0) year0Total = totalFunding

  const preOpenTransactions: { amount: number }[] = profile.pre_opening_transactions || []
  const preOpenActualSpend = preOpenTransactions.reduce((s, tx) => s + tx.amount, 0)
  const preOpenBudget = (profile.pre_opening_expenses || []).reduce((s, e: { budgeted: number }) => s + e.budgeted, 0)
  const preOpenExpenses = preOpenActualSpend > 0 ? preOpenActualSpend : preOpenBudget

  return year0Total - preOpenExpenses
}

export interface BudgetSummary {
  operatingRevenue: number
  grantRevenue: number
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
  assumptions?: FinancialAssumptions,
  grantRevenue: number = 0,
  revenueProfile?: RevenueProfile,
): BudgetSummary {
  const a = assumptions || DEFAULT_ASSUMPTIONS
  // Compute revenue live from profile demographics if available (avoids stale budget_projections)
  let operatingRevenue: number
  if (revenueProfile) {
    const rev = calcCommissionRevenue(
      revenueProfile.target_enrollment_y1,
      revenueProfile.pct_frl,
      revenueProfile.pct_iep,
      revenueProfile.pct_ell,
      revenueProfile.pct_hicap,
      a,
    )
    operatingRevenue = rev.total
  } else {
    operatingRevenue = projections
      .filter((p) => p.is_revenue)
      .reduce((s, p) => s + p.amount, 0)
  }
  const totalRevenue = operatingRevenue + grantRevenue
  // Compute personnel live from positions (source of truth) to avoid stale budget_projections
  const benefitsRate = a.benefits_load_pct / 100
  const totalPersonnel = positions.length > 0
    ? positions.reduce((s, p) => {
        const cost = p.fte * p.annual_salary
        return s + cost + calcBenefits(cost, benefitsRate)
      }, 0)
    : projections
        .filter((p) => !p.is_revenue && p.category === 'Personnel')
        .reduce((s, p) => s + p.amount, 0)
  const totalOperations = projections
    .filter((p) => !p.is_revenue && p.category === 'Operations')
    .reduce((s, p) => s + p.amount, 0)
  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = totalRevenue - totalExpenses
  const dailyExpense = totalExpenses / 365
  const reserveDays = dailyExpense > 0 ? Math.round(netPosition / dailyExpense) : 0
  // Personnel % uses operating revenue (excludes one-time grants) for sustainability assessment
  const personnelPctRevenue = operatingRevenue > 0 ? (totalPersonnel / operatingRevenue) * 100 : 0

  // Break-even: how many students needed to cover expenses from operating revenue alone
  // Uses actual per-pupil operating revenue (all sources), not just base apportionment rates
  const enrollment = revenueProfile?.target_enrollment_y1 || 0
  const perPupilRevenue = enrollment > 0 ? operatingRevenue / enrollment : 0
  const breakEvenEnrollment = perPupilRevenue > 0
    ? Math.ceil(totalExpenses / perPupilRevenue)
    : 0

  const facilityCost = projections
    .filter((p) => !p.is_revenue && p.subcategory === 'Facilities')
    .reduce((s, p) => s + p.amount, 0)
  // Facility % uses operating revenue for sustainability assessment
  const facilityPct = operatingRevenue > 0 ? (facilityCost / operatingRevenue) * 100 : 0

  return {
    operatingRevenue,
    grantRevenue,
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
  assumptions?: FinancialAssumptions,
  grantRevenue: number = 0,
): BudgetSummary {
  const a = assumptions || DEFAULT_ASSUMPTIONS
  const { enrollment, classSize, leadTeacherSalary, monthlyLease, extraTeacher } = inputs
  const benefitsRate = a.benefits_load_pct / 100
  const feeRate = a.authorizer_fee_pct / 100

  // Revenue — use Commission revenue structure
  const rev = calcCommissionRevenue(enrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, a)
  const operatingRevenue = rev.total
  const totalRevenue = operatingRevenue + grantRevenue

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
      const stateApport = rev.regularEd + rev.sped + rev.stateSped + rev.facilitiesRev
      totalOperations += calcAuthorizerFeeCommission(stateApport, feeRate)
    } else {
      totalOperations += op.amount
    }
  }

  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = totalRevenue - totalExpenses
  const dailyExpense = totalExpenses / 365
  const reserveDays = dailyExpense > 0 ? Math.round(netPosition / dailyExpense) : 0
  // Personnel % uses operating revenue (excludes one-time grants)
  const personnelPctRevenue = operatingRevenue > 0 ? (totalPersonnel / operatingRevenue) * 100 : 0
  // Break-even: how many students needed to cover expenses from operating revenue alone
  const perPupilRevenue = enrollment > 0 ? operatingRevenue / enrollment : 0
  const breakEvenEnrollment = perPupilRevenue > 0 ? Math.ceil(totalExpenses / perPupilRevenue) : 0
  const facilityPct = operatingRevenue > 0 ? ((monthlyLease * 12) / operatingRevenue) * 100 : 0

  return {
    operatingRevenue,
    grantRevenue,
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

  const baseTotalFte = basePositions.reduce((s, p) => s + p.fte, 0)
  const otherFte = baseTotalFte - y1TeacherFte - y1ParaFte - y1OfficeFte
  const totalTeachers = y1TeacherFte + additionalTeachers
  const totalParas = y1ParaFte + additionalParas
  const totalOffice = y1OfficeFte + additionalOffice

  return {
    teachers: totalTeachers,
    paras: totalParas,
    officeStaff: totalOffice,
    otherStaff: otherFte,
    totalPositions: totalTeachers + totalParas + totalOffice + otherFte,
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
    stateSped: number
    facilitiesRev: number
    levyEquity: number
    titleI: number
    idea: number
    lap: number
    lapHighPoverty: number
    tbip: number
    hicap: number
    foodServiceRev: number
    transportationRev: number
    smallSchoolEnhancement: number
    interestIncome: number
    grantRevenue: number
    operatingRevenue: number
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
    foodService: number
    transportation: number
    curriculum: number
    profDev: number
    marketing: number
    fundraising: number
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
  allPositions?: StaffingPosition[],
  startupFunding?: StartupFundingSource[] | null,
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

  // Year 1 base data from projections — ALL operational categories
  const y1Facilities = projections.find((p) => !p.is_revenue && p.subcategory === 'Facilities')?.amount || 0
  const y1Supplies = projections.find((p) => !p.is_revenue && p.subcategory === 'Supplies & Materials')?.amount || 0
  const y1Contracted = projections.find((p) => !p.is_revenue && p.subcategory === 'Contracted Services')?.amount || 0
  const y1Technology = projections.find((p) => !p.is_revenue && p.subcategory === 'Technology')?.amount || 0
  const y1Insurance = projections.find((p) => !p.is_revenue && p.subcategory === 'Insurance')?.amount || 0
  const y1FoodService = projections.find((p) => !p.is_revenue && p.subcategory === 'Food Service')?.amount || 0
  const y1Transportation = projections.find((p) => !p.is_revenue && p.subcategory === 'Transportation')?.amount || 0
  const y1Curriculum = projections.find((p) => !p.is_revenue && p.subcategory === 'Curriculum & Materials')?.amount || 0
  const y1ProfDev = projections.find((p) => !p.is_revenue && p.subcategory === 'Professional Development')?.amount || 0
  const y1Marketing = projections.find((p) => !p.is_revenue && p.subcategory === 'Marketing & Outreach')?.amount || 0
  const y1Fundraising = projections.find((p) => !p.is_revenue && p.subcategory === 'Fundraising')?.amount || 0

  let cumulativeNet = preOpeningNet
  const rows: MultiYearDetailedRow[] = []

  const interestRate = assumptions.interest_rate_on_cash / 100

  for (let y = 1; y <= 5; y++) {
    const enr = enrollments[y - 1] || enrollments[enrollments.length - 1] || enrollments[0]

    // Revenue — Commission-aligned with COLA
    const rev = calcCommissionRevenue(enr, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions, y)
    // Small School Enhancement — uses grade expansion plan for grade-band enrollment
    const smallSchoolEnhancement = hasExpansion
      ? calcSmallSchoolEnhancement(gradeExpansionPlan!, y, assumptions.aafte_pct, assumptions.regular_ed_per_pupil, assumptions.regionalization_factor || 1.0, y, assumptions.revenue_cola_pct)
      : 0
    // Interest income on prior year ending cash balance
    const priorCash = cumulativeNet
    const interestIncome = y === 1
      ? Math.round(Math.max(0, priorCash) * interestRate / 2) // half-year approximation
      : Math.round(Math.max(0, priorCash) * interestRate)
    // Grant revenue for this year from startup funding allocations
    const yearGrantRevenue = getGrantRevenueForYear(startupFunding, y)
    const operatingRevenue = rev.total + smallSchoolEnhancement + interestIncome // rev.total already includes foodServiceRev + transportationRev
    const totalRevenue = operatingRevenue + yearGrantRevenue
    // State apportionment = regularEd + sped + stateSped + facilitiesRev + smallSchoolEnhancement (for authorizer fee + OSPI cash flow)
    const stateApport = rev.regularEd + rev.sped + rev.stateSped + rev.facilitiesRev + smallSchoolEnhancement

    // Personnel — use year-specific positions if available, else auto-scale
    const yearPositions = allPositions?.filter((p) => p.year === y)
    const hasYearPositions = yearPositions && yearPositions.length > 0
    const positionsForYear = hasYearPositions ? yearPositions : positions

    const staffing = y === 1
      ? computeYear1Staffing(positions, benefitsRate)
      : hasYearPositions
        ? computeYear1Staffing(yearPositions, benefitsRate)
        : computeMultiYearPersonnel(enr, y, positions, enrollments[0], salaryEscalator, benefitsRate)

    let certCost = 0, classCost = 0, adminCost = 0, benefitsCost = 0, totalSalaries = 0
    if (hasYearPositions || y === 1) {
      // Use actual position data for this year
      const escalator = y === 1 ? 1 : Math.pow(salaryEscalator, y - 1)
      for (const pos of positionsForYear) {
        const salary = Math.round(pos.annual_salary * escalator)
        const cost = pos.fte * salary
        const ben = calcBenefits(cost, benefitsRate)
        if (pos.category === 'certificated') certCost += cost
        else if (pos.category === 'classified') classCost += cost
        else if (pos.category === 'admin') adminCost += cost
        benefitsCost += ben
      }
      totalSalaries = certCost + classCost + adminCost
    } else {
      // Scaled positions (legacy: no year-specific data)
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

    // Operations — all categories scaled appropriately
    const opsScale = Math.pow(opsEscalator, y - 1)
    const enrRatio = enrollments[0] > 0 ? enr / enrollments[0] : 1
    const facilities = Math.round(y1Facilities * opsScale)
    const supplies = Math.round(y1Supplies * enrRatio * opsScale)
    const contracted = Math.round(y1Contracted * enrRatio * opsScale)
    const technology = Math.round(y1Technology * enrRatio * opsScale)
    const authorizerFee = calcAuthorizerFeeCommission(stateApport, feeRate)
    const insurance = Math.round(y1Insurance * opsScale)
    const foodService = Math.round(y1FoodService * enrRatio * opsScale)
    const transportation = Math.round(y1Transportation * enrRatio * opsScale)
    const curriculum = Math.round(y1Curriculum * enrRatio * opsScale)
    const profDev = Math.round(y1ProfDev * opsScale) // scales with inflation, not enrollment
    const marketing = Math.round(y1Marketing * opsScale) // scales with inflation only
    const fundraising = Math.round(y1Fundraising * opsScale)
    const contingencyBase = totalPersonnel + facilities + supplies + contracted + technology + authorizerFee + insurance + foodService + transportation + curriculum + profDev + marketing + fundraising
    const contingency = Math.round(contingencyBase * (assumptions.contingency_pct / 100))
    const totalOperations = facilities + supplies + contracted + technology + authorizerFee + insurance + foodService + transportation + curriculum + profDev + marketing + fundraising + contingency

    const totalExpenses = totalPersonnel + totalOperations
    const net = totalRevenue - totalExpenses
    cumulativeNet += net
    const dailyExpense = totalExpenses / 365
    // Days of Cash = ending cash (cumulativeNet) / daily expenses
    const reserveDays = dailyExpense > 0 ? Math.round(cumulativeNet / dailyExpense) : 0

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
        stateSped: rev.stateSped,
        facilitiesRev: rev.facilitiesRev,
        levyEquity: rev.levyEquity,
        titleI: rev.titleI,
        idea: rev.idea,
        lap: rev.lap,
        lapHighPoverty: rev.lapHighPoverty,
        tbip: rev.tbip,
        hicap: rev.hicap,
        foodServiceRev: rev.foodServiceRev,
        transportationRev: rev.transportationRev,
        smallSchoolEnhancement,
        interestIncome,
        grantRevenue: yearGrantRevenue,
        operatingRevenue,
        total: totalRevenue,
        apportionment: rev.regularEd + rev.sped + rev.stateSped + rev.facilitiesRev + smallSchoolEnhancement,
      },
      personnel: {
        certificated: certCost,
        classified: classCost,
        admin: adminCost,
        benefits: benefitsCost,
        total: totalPersonnel,
        totalSalaries,
      },
      operations: { facilities, supplies, contracted, technology, authorizerFee, insurance, foodService, transportation, curriculum, profDev, marketing, fundraising, contingency, total: totalOperations },
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
  const teacherFte = teacherPositions.reduce((s, p) => s + p.fte, 0)
  const paraFte = paraPositions.reduce((s, p) => s + p.fte, 0)
  const officeFte = officePositions.reduce((s, p) => s + p.fte, 0)
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  return {
    teachers: teacherFte,
    paras: paraFte,
    officeStaff: officeFte,
    otherStaff: totalFte - teacherFte - paraFte - officeFte,
    totalPositions: totalFte,
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
  stage1Approaching?: string
  stage2Approaching?: string
  statuses: ('meets' | 'approaches' | 'does_not_meet' | 'na')[]
  note?: string // measure-specific annotation for the scorecard display
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

  // 1. Current Ratio — FPF: Current Assets / Current Liabilities (balance sheet)
  // Planning proxy: Ending Cash / (Total Expenses / 12) — months of expenses covered
  const currentRatioValues = multiYear.map((row, i) => {
    const monthlyExpenses = row.totalExpenses / 12
    return monthlyExpenses > 0 ? yearEndCash[i] / monthlyExpenses : 99
  })
  measures.push({
    name: 'Current Ratio',
    formula: 'Current Assets ÷ Current Liabilities',
    values: currentRatioValues.map(v => Math.round(v * 100) / 100),
    stage1Target: '≥ 1.0',
    stage2Target: '≥ 1.1',
    stage1Approaching: '0.9–0.99',
    stage2Approaching: '1.0–1.09',
    statuses: currentRatioValues.map((v, i) =>
      fpfStatus(v, i + 1, (val, stage) =>
        val >= (stage === 1 ? 1.0 : 1.1) ? 'meets'
          : val >= (stage === 1 ? 0.9 : 1.0) ? 'approaches'
          : 'does_not_meet'
      )
    ),
    note: 'Planning proxy: Ending Cash ÷ (Annual Expenses / 12). The Commission calculates this from audited balance sheet data.',
  })

  // 2. Unrestricted Days Cash — FPF: Unrestricted Cash / [(Total Expenses - Depreciation) / 365]
  // Depreciation is $0 in planning mode but formula structured to handle it
  const depreciation = 0 // no depreciation modeled in planning mode
  const daysOfCash = multiYear.map((row, i) => {
    const dailyExpense = (row.totalExpenses - depreciation) / 365
    return dailyExpense > 0 ? Math.round(yearEndCash[i] / dailyExpense) : 0
  })
  measures.push({
    name: 'Days of Cash',
    formula: 'Unrestricted Cash ÷ ((Expenses − Depreciation) / 365)',
    values: daysOfCash,
    stage1Target: '≥ 30 days',
    stage2Target: '≥ 60 days',
    stage1Approaching: '21–29',
    stage2Approaching: '30–59',
    statuses: daysOfCash.map((v, i) =>
      fpfStatus(v, i + 1, (val, stage) =>
        val >= (stage === 1 ? 30 : 60) ? 'meets'
          : val >= (stage === 1 ? 21 : 30) ? 'approaches'
          : 'does_not_meet'
      )
    ),
  })

  // 3. Total Margin — FPF: Net Income / Operating Revenue (excludes one-time startup grants)
  const totalMargin = multiYear.map(row =>
    row.revenue.operatingRevenue > 0 ? Math.round((row.net / row.revenue.operatingRevenue) * 1000) / 10 : 0
  )
  measures.push({
    name: 'Total Margin',
    formula: 'Net Income ÷ Operating Revenue',
    values: totalMargin,
    stage1Target: '≥ 0%',
    stage2Target: '≥ 0%',
    stage1Approaching: '-2% to 0%',
    stage2Approaching: '-2% to 0%',
    statuses: totalMargin.map((v, i) =>
      fpfStatus(v, i + 1, (val) =>
        val >= 0 ? 'meets' : val >= -2 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 4. Aggregated 3-Year Total Margin — FPF: Total 3-Year Net Income / Total 3-Year Operating Revenue
  const threeYearMargin: (number | null)[] = multiYear.map((_, i) => {
    if (i < 2) return null // N/A for Years 1-2 (need 3 years of data)
    const netSum = multiYear.slice(i - 2, i + 1).reduce((s, r) => s + r.net, 0)
    const revSum = multiYear.slice(i - 2, i + 1).reduce((s, r) => s + r.revenue.operatingRevenue, 0)
    return revSum > 0 ? Math.round((netSum / revSum) * 1000) / 10 : 0
  })
  measures.push({
    name: '3-Year Total Margin',
    formula: '(Y(n-2)+Y(n-1)+Yn Net) ÷ (Y(n-2)+Y(n-1)+Yn Revenue)',
    values: threeYearMargin,
    stage1Target: 'N/A',
    stage2Target: '> 0%',
    stage2Approaching: '-1.5% to 0%',
    statuses: threeYearMargin.map((v, i) =>
      v === null ? 'na' : fpfStatus(v, i + 1, (val) =>
        val > 0 ? 'meets' : val >= -1.5 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 5. Debt-to-Asset — FPF: Total Liabilities / Total Assets
  // No liabilities modeled in planning mode; ratio is 0.00
  measures.push({
    name: 'Debt-to-Asset',
    formula: 'Total Liabilities ÷ Total Assets',
    values: multiYear.map(() => 0),
    stage1Target: '< 0.90',
    stage2Target: '< 0.90',
    stage1Approaching: '0.90–1.0',
    stage2Approaching: '0.90–1.0',
    statuses: multiYear.map(() => 'meets'),
    note: 'No liabilities modeled. The Commission calculates this from audited balance sheet data.',
  })

  // 6. Debt Default — FPF: Binary (in default or not)
  // Pre-opening school with no debt = N/A
  measures.push({
    name: 'Debt Default',
    formula: 'In default of loan covenants?',
    values: multiYear.map(() => null),
    stage1Target: 'No default',
    stage2Target: 'No default',
    statuses: multiYear.map(() => 'na'),
    note: 'N/A — No debt modeled in planning mode.',
  })

  // 7. Cash Flow (one-year) — FPF: Year N Total Cash − Year (N−1) Total Cash
  // Year 1 is N/A per FPF (no prior operating year)
  const cashFlowValues: (number | null)[] = multiYear.map((_, i) => {
    if (i === 0) return null // Year 1: no prior operating year
    return yearEndCash[i] - yearEndCash[i - 1]
  })
  measures.push({
    name: 'Cash Flow',
    formula: 'Year-End Cash − Prior Year-End Cash',
    values: cashFlowValues,
    stage1Target: '> $0',
    stage2Target: '> $0',
    statuses: cashFlowValues.map((v, i) =>
      v === null ? 'na' : fpfStatus(v, i + 1, (val) =>
        val > 0 ? 'meets' : val >= -5000 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 8. Multi-Year Cash Flow — FPF: Year N Total Cash − Year (N−2) Total Cash (3-year span)
  // N/A for Years 1-2
  const threeYearCashFlow: (number | null)[] = multiYear.map((_, i) => {
    if (i < 2) return null // Need at least 3 years of data
    return yearEndCash[i] - yearEndCash[i - 2]
  })
  measures.push({
    name: 'Multi-Year Cash Flow',
    formula: 'Year N Cash − Year (N−2) Cash',
    values: threeYearCashFlow,
    stage1Target: 'N/A',
    stage2Target: '> $0',
    statuses: threeYearCashFlow.map((v, i) =>
      v === null ? 'na' : fpfStatus(v, i + 1, (val) =>
        val > 0 ? 'meets' : val >= -5000 ? 'approaches' : 'does_not_meet'
      )
    ),
  })

  // 9. Enrollment Variance — FPF: Actual Enrollment / Projected Enrollment
  // In planning mode, actual = projected = 100%
  const enrollmentVariance = multiYear.map(() =>
    conservativeMode ? 90 : 100
  )
  measures.push({
    name: 'Enrollment Variance',
    formula: 'Actual Enrollment ÷ Projected Enrollment',
    values: enrollmentVariance,
    stage1Target: '≥ 95%',
    stage2Target: '≥ 95%',
    stage1Approaching: '85–94%',
    stage2Approaching: '85–94%',
    statuses: enrollmentVariance.map((v, i) =>
      fpfStatus(v, i + 1, (val) =>
        val >= 95 ? 'meets' : val >= 85 ? 'approaches' : 'does_not_meet'
      )
    ),
    note: 'Informational — becomes meaningful when operating with actual enrollment data.',
  })

  // Overall assessment — skip purely informational/N/A measures
  const skipForOverall = new Set(['Debt Default', 'Enrollment Variance'])
  const stage1Issues: string[] = []
  const stage2Issues: string[] = []
  for (const m of measures) {
    if (skipForOverall.has(m.name)) continue
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
