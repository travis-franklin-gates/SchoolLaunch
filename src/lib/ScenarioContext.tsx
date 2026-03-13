'use client'

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import { useSchoolData, type SchoolData } from '@/lib/useSchoolData'
import {
  computeSummaryFromProjections,
  computeScenario,
  type ScenarioInputs,
  type BudgetSummary,
} from '@/lib/budgetEngine'
import { calcRevenue } from '@/lib/calculations'
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
  const { profile, positions, projections } = schoolData

  const assumptions = useMemo(() => getAssumptions(profile.financial_assumptions), [profile.financial_assumptions])

  const baseSummary = useMemo(
    () => computeSummaryFromProjections(projections, positions, assumptions),
    [projections, positions, assumptions]
  )

  const baseFacilities = projections.find((p) => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 0
  const baseMonthlyLease = Math.round(baseFacilities / 12)
  const baseCertSalary = positions.find((p) => p.category === 'certificated')?.annual_salary || 58000

  const [scenario, setScenario] = useState<ScenarioInputs | null>(null)

  const baseInputs: ScenarioInputs = useMemo(() => ({
    enrollment: profile.target_enrollment_y1,
    classSize: profile.max_class_size,
    leadTeacherSalary: baseCertSalary,
    monthlyLease: baseMonthlyLease,
    extraTeacher: false,
  }), [profile.target_enrollment_y1, profile.max_class_size, baseCertSalary, baseMonthlyLease])

  const scenarioInputs = scenario || baseInputs

  const scenarioSummary = useMemo(
    () => computeScenario(scenarioInputs, profile, positions, projections, assumptions),
    [scenarioInputs, profile, positions, projections, assumptions]
  )

  const isModified = scenario !== null

  const baseApportionment = calcRevenue(profile.target_enrollment_y1, assumptions.per_pupil_rate)
  const scenarioApportionment = calcRevenue(scenarioInputs.enrollment, assumptions.per_pupil_rate)

  function updateScenario(partial: Partial<ScenarioInputs>) {
    setScenario((prev) => ({
      ...(prev || baseInputs),
      ...partial,
    }))
  }

  function resetScenario() {
    setScenario(null)
  }

  const currentSummary = isModified ? scenarioSummary : baseSummary

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
    updateScenario,
    resetScenario,
  }

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
}
