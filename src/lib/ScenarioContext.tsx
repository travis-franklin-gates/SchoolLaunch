'use client'

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import { useSchoolData, type SchoolData } from '@/lib/useSchoolData'
import {
  computeSummaryFromProjections,
  computeScenario,
  getGrantRevenueForYear,
  stateApportionmentBase,
  type ScenarioInputs,
  type BudgetSummary,
} from '@/lib/budgetEngine'
import { calcCommissionRevenue, calcSmallSchoolEnhancement, calcSmallSchoolEnhancementFromGrades } from '@/lib/calculations'
import type { FinancialAssumptions } from '@/lib/types'
import { getAssumptions } from '@/lib/types'

export interface ScenarioContextType {
  schoolData: SchoolData
  assumptions: FinancialAssumptions
  baseSummary: BudgetSummary
  scenario: ScenarioInputs | null
  scenarioInputs: ScenarioInputs
  scenarioSummary: BudgetSummary
  isModified: boolean
  currentSummary: BudgetSummary
  baseApportionment: number
  scenarioApportionment: number
  conservativeMode: boolean
  conservativeSummary: BudgetSummary
  setConservativeMode: (on: boolean) => void
  updateScenario: (partial: Partial<ScenarioInputs>) => void
  resetScenario: () => void
}

const ScenarioContext = createContext<ScenarioContextType | null>(null)

export function useScenario(): ScenarioContextType {
  const ctx = useContext(ScenarioContext)
  if (!ctx) throw new Error('useScenario must be used within ScenarioProvider')
  return ctx
}

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const schoolData = useSchoolData()
  const { profile, positions, projections, gradeExpansionPlan } = schoolData

  const assumptions = useMemo(() => getAssumptions(profile.financial_assumptions), [profile.financial_assumptions])

  // Year 1 grant revenue from startup funding allocations
  const y1GrantRevenue = useMemo(
    () => getGrantRevenueForYear(profile.startup_funding, 1),
    [profile.startup_funding]
  )

  const baseSummary = useMemo(
    () => computeSummaryFromProjections(projections, positions, assumptions, y1GrantRevenue, profile),
    [projections, positions, assumptions, y1GrantRevenue, profile]
  )

  const baseFacilities = projections.find((p) => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 0
  const baseMonthlyLease = Math.round(baseFacilities / 12)
  const baseCertSalary = positions.find((p) => p.category === 'certificated')?.annual_salary || 58000

  const [scenario, setScenario] = useState<ScenarioInputs | null>(null)
  const [conservativeMode, setConservativeMode] = useState(false)

  const baseInputs: ScenarioInputs = useMemo(() => ({
    enrollment: profile.target_enrollment_y1,
    classSize: profile.max_class_size,
    leadTeacherSalary: baseCertSalary,
    monthlyLease: baseMonthlyLease,
    extraTeacher: false,
  }), [profile.target_enrollment_y1, profile.max_class_size, baseCertSalary, baseMonthlyLease])

  const scenarioInputs = scenario || baseInputs

  const scenarioSummary = useMemo(
    () => computeScenario(scenarioInputs, profile, positions, projections, assumptions, y1GrantRevenue),
    [scenarioInputs, profile, positions, projections, assumptions, y1GrantRevenue]
  )

  // Conservative mode: 90% enrollment for revenue, 100% for expenses
  const conservativeSummary = useMemo(() => {
    const conservativeEnrollment = Math.floor(profile.target_enrollment_y1 * 0.9)
    const conservativeInputs: ScenarioInputs = {
      ...baseInputs,
      enrollment: conservativeEnrollment,
    }
    // Use computeScenario with reduced enrollment — this reduces BOTH revenue AND per-pupil ops
    // But we want expenses at 100%. So compute revenue at 90%, expenses at base.
    const reducedSummary = computeScenario(conservativeInputs, profile, positions, projections, assumptions, y1GrantRevenue)
    // Override: keep expenses from base, only use revenue from reduced enrollment
    const totalExpenses = baseSummary.totalExpenses
    const netPosition = reducedSummary.totalRevenue - totalExpenses
    const dailyExpense = totalExpenses / 365
    const reserveDays = dailyExpense > 0 ? Math.round(netPosition / dailyExpense) : 0
    return {
      ...reducedSummary,
      totalPersonnel: baseSummary.totalPersonnel,
      totalOperations: baseSummary.totalOperations,
      totalExpenses,
      netPosition,
      reserveDays,
      personnelPctRevenue: reducedSummary.operatingRevenue > 0 ? (baseSummary.totalPersonnel / reducedSummary.operatingRevenue) * 100 : 0,
      breakEvenEnrollment: baseSummary.breakEvenEnrollment,
      facilityPct: reducedSummary.operatingRevenue > 0 ? (baseFacilities / reducedSummary.operatingRevenue) * 100 : 0,
    }
  }, [profile, positions, projections, assumptions, baseInputs, baseSummary, baseFacilities, y1GrantRevenue])

  const isModified = scenario !== null

  const baseRev = calcCommissionRevenue(profile.target_enrollment_y1, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions)
  const baseSSE = gradeExpansionPlan && gradeExpansionPlan.length > 0
    ? calcSmallSchoolEnhancement(gradeExpansionPlan, 1, assumptions.aafte_pct, assumptions.regular_ed_per_pupil, assumptions.regionalization_factor || 1.0, 1, assumptions.revenue_cola_pct)
    : calcSmallSchoolEnhancementFromGrades(profile.target_enrollment_y1, profile.opening_grades || [], assumptions.aafte_pct, assumptions.regular_ed_per_pupil, assumptions.regionalization_factor || 1.0)
  const baseApportionment = stateApportionmentBase(baseRev, baseSSE)
  const scenarioRev = calcCommissionRevenue(scenarioInputs.enrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions)
  const scenarioSSE = (() => {
    if (gradeExpansionPlan && gradeExpansionPlan.length > 0) {
      const ratio = profile.target_enrollment_y1 > 0 ? scenarioInputs.enrollment / profile.target_enrollment_y1 : 1
      const scaledPlan = gradeExpansionPlan.map(e => ({ ...e, students_per_section: Math.round(e.students_per_section * ratio) }))
      return calcSmallSchoolEnhancement(scaledPlan, 1, assumptions.aafte_pct, assumptions.regular_ed_per_pupil, assumptions.regionalization_factor || 1.0, 1, assumptions.revenue_cola_pct)
    }
    return calcSmallSchoolEnhancementFromGrades(scenarioInputs.enrollment, profile.opening_grades || [], assumptions.aafte_pct, assumptions.regular_ed_per_pupil, assumptions.regionalization_factor || 1.0)
  })()
  const scenarioApportionment = stateApportionmentBase(scenarioRev, scenarioSSE)

  function updateScenario(partial: Partial<ScenarioInputs>) {
    setScenario((prev) => ({
      ...(prev || baseInputs),
      ...partial,
    }))
  }

  function resetScenario() {
    setScenario(null)
  }

  const currentSummary = conservativeMode
    ? conservativeSummary
    : isModified
      ? scenarioSummary
      : baseSummary

  const value: ScenarioContextType = {
    schoolData,
    assumptions,
    baseSummary,
    scenario,
    scenarioInputs,
    scenarioSummary,
    isModified,
    currentSummary,
    baseApportionment,
    scenarioApportionment,
    conservativeMode,
    conservativeSummary,
    setConservativeMode,
    updateScenario,
    resetScenario,
  }

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
}
