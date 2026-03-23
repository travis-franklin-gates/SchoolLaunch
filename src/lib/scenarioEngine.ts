import type { SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry, FinancialAssumptions, StartupFundingSource } from './types'
import { getAssumptions } from './types'
import { computeMultiYearDetailed, computeFPFScorecard, computeCarryForward, type MultiYearDetailedRow, type FPFScorecard } from './budgetEngine'

export interface ScenarioAssumptions {
  enrollment_fill_rate: number    // 0.70 to 1.00
  per_pupil_funding_adjustment: number  // -0.10 to +0.05
  personnel_cost_adjustment: number     // -0.10 to +0.15
  facility_cost_monthly: number         // $0 to $50,000
  startup_capital: number               // $0 to $1,000,000
}

export interface ScenarioYearResult {
  enrollment: number
  total_revenue: number
  total_personnel: number
  total_operations: number
  total_expenses: number
  net_position: number
  beginning_cash: number
  ending_cash: number
  reserve_days: number
  personnel_pct: number
  total_margin: number
  current_ratio: number
  break_even_enrollment: number
  fpf_current_ratio: string
  fpf_days_cash: string
  fpf_enrollment_variance: string
  fpf_total_margin: string
}

export interface ScenarioResults {
  years: Record<string, ScenarioYearResult>
}

export function computeScenarioProjections(
  profile: SchoolProfile,
  positions: StaffingPosition[],
  allPositions: StaffingPosition[],
  projections: BudgetProjection[],
  gradeExpansionPlan: GradeExpansionEntry[],
  levers: ScenarioAssumptions,
): { results: ScenarioResults; multiYear: MultiYearDetailedRow[]; scorecard: FPFScorecard } {
  const assumptions = getAssumptions(profile.financial_assumptions)

  // Apply lever 1: Enrollment Fill Rate — scale all enrollment targets
  const adjustedProfile: SchoolProfile = {
    ...profile,
    target_enrollment_y1: Math.round(profile.target_enrollment_y1 * levers.enrollment_fill_rate),
    target_enrollment_y2: Math.round(profile.target_enrollment_y2 * levers.enrollment_fill_rate),
    target_enrollment_y3: Math.round(profile.target_enrollment_y3 * levers.enrollment_fill_rate),
    target_enrollment_y4: Math.round(profile.target_enrollment_y4 * levers.enrollment_fill_rate),
    target_enrollment_y5: Math.round((profile.target_enrollment_y5 || profile.target_enrollment_y4) * levers.enrollment_fill_rate),
  }

  // Apply lever 1 to grade expansion plan
  const adjustedExpansion: GradeExpansionEntry[] = gradeExpansionPlan.map(e => ({
    ...e,
    students_per_section: Math.round(e.students_per_section * levers.enrollment_fill_rate),
  }))

  // Apply lever 2: Per-Pupil Funding Adjustment — adjust state revenue rates
  const adjustedAssumptions: FinancialAssumptions = {
    ...assumptions,
    regular_ed_per_pupil: Math.round(assumptions.regular_ed_per_pupil * (1 + levers.per_pupil_funding_adjustment)),
    sped_per_pupil: Math.round(assumptions.sped_per_pupil * (1 + levers.per_pupil_funding_adjustment)),
    facilities_per_pupil: Math.round(assumptions.facilities_per_pupil * (1 + levers.per_pupil_funding_adjustment)),
  }

  // Apply lever 4: Facility Cost — override the facility projection
  const adjustedProjections: BudgetProjection[] = projections.map(p => {
    if (p.subcategory === 'Facilities' && !p.is_revenue) {
      return { ...p, amount: levers.facility_cost_monthly * 12 }
    }
    return p
  })

  // Apply lever 3: Personnel Cost Adjustment — adjust all position salaries
  const adjustPersonnel = (pos: StaffingPosition[]): StaffingPosition[] =>
    pos.map(p => ({
      ...p,
      annual_salary: Math.round(p.annual_salary * (1 + levers.personnel_cost_adjustment)),
    }))

  const adjustedPositions = adjustPersonnel(positions)
  const adjustedAllPositions = adjustPersonnel(allPositions)

  // Apply lever 5: Startup Capital — override carry-forward
  // The startup capital replaces the computed carry-forward
  const preOpenCash = levers.startup_capital

  // Compute multi-year projections using the existing engine
  const adjustedProfileWithAssumptions: SchoolProfile = {
    ...adjustedProfile,
    financial_assumptions: adjustedAssumptions,
  }

  const multiYear = computeMultiYearDetailed(
    adjustedProfileWithAssumptions,
    adjustedPositions,
    adjustedProjections,
    adjustedAssumptions,
    preOpenCash,
    adjustedExpansion.length > 0 ? adjustedExpansion : undefined,
    adjustedAllPositions,
    profile.startup_funding,
  )

  const scorecard = computeFPFScorecard(multiYear, preOpenCash, false)

  // Build results object
  const years: Record<string, ScenarioYearResult> = {}
  for (let i = 0; i < multiYear.length; i++) {
    const r = multiYear[i]
    const y = String(i + 1)
    const daysOfCash = scorecard.measures.find(m => m.name === 'Days of Cash')?.values[i] ?? r.reserveDays
    const currentRatio = scorecard.measures.find(m => m.name === 'Current Ratio')?.values[i] ?? 0
    const totalMargin = scorecard.measures.find(m => m.name === 'Total Margin')?.values[i] ?? 0

    const beginCash = r.cumulativeNet - r.net
    const endCash = r.cumulativeNet
    const operatingRevenue = r.revenue.operatingRevenue
    const personnelPct = operatingRevenue > 0 ? (r.personnel.total / operatingRevenue) * 100 : 0
    const perPupilRev = r.enrollment > 0 ? r.revenue.total / r.enrollment : 0
    const breakEven = perPupilRev > 0 ? Math.ceil(r.totalExpenses / perPupilRev) : 0

    // FPF status from scorecard
    const fpfCurrentRatio = scorecard.measures.find(m => m.name === 'Current Ratio')?.statuses[i] || 'na'
    const fpfDaysCash = scorecard.measures.find(m => m.name === 'Days of Cash')?.statuses[i] || 'na'
    const fpfTotalMargin = scorecard.measures.find(m => m.name === 'Total Margin')?.statuses[i] || 'na'

    years[y] = {
      enrollment: r.enrollment,
      total_revenue: r.revenue.total,
      total_personnel: r.personnel.total,
      total_operations: r.operations.total,
      total_expenses: r.totalExpenses,
      net_position: r.net,
      beginning_cash: beginCash,
      ending_cash: endCash,
      reserve_days: daysOfCash as number,
      personnel_pct: Math.round(personnelPct * 10) / 10,
      total_margin: totalMargin as number,
      current_ratio: currentRatio as number,
      break_even_enrollment: breakEven,
      fpf_current_ratio: fpfCurrentRatio,
      fpf_days_cash: fpfDaysCash,
      fpf_enrollment_variance: 'meets', // scenario enrollment = budget
      fpf_total_margin: fpfTotalMargin,
    }
  }

  return { results: { years }, multiYear, scorecard }
}

export function getDefaultScenarioAssumptions(
  profile: SchoolProfile,
): { conservative: ScenarioAssumptions; base: ScenarioAssumptions; optimistic: ScenarioAssumptions } {
  const carryForward = computeCarryForward(profile)
  const facilityAmount = 15000 // Will be overridden by actual data in seed route

  return {
    conservative: {
      enrollment_fill_rate: 0.80,
      per_pupil_funding_adjustment: -0.05,
      personnel_cost_adjustment: 0.05,
      facility_cost_monthly: Math.round(facilityAmount * 1.10),
      startup_capital: Math.round(carryForward * 0.75),
    },
    base: {
      enrollment_fill_rate: 0.90,
      per_pupil_funding_adjustment: 0.0,
      personnel_cost_adjustment: 0.0,
      facility_cost_monthly: facilityAmount,
      startup_capital: carryForward,
    },
    optimistic: {
      enrollment_fill_rate: 0.95,
      per_pupil_funding_adjustment: 0.0,
      personnel_cost_adjustment: -0.03,
      facility_cost_monthly: Math.round(facilityAmount * 0.95),
      startup_capital: Math.round(carryForward * 1.25),
    },
  }
}
