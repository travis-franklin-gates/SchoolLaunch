'use client'

import { useState, useMemo, useCallback } from 'react'
import { calcCommissionRevenue } from '@/lib/calculations'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'
import type { GrowthPreset, GradeExpansionEntry, EnrollmentMode } from '@/lib/types'
import { expansionToEnrollmentArray } from '@/lib/gradeExpansion'
import GradeExpansionEditor from '@/components/GradeExpansionEditor'

const GRADE_ENROLLMENT_DEFAULTS: Record<string, { classSize: number }> = {
  'K-5': { classSize: 24 },
  'K-8': { classSize: 24 },
  '6-8': { classSize: 25 },
  '9-12': { classSize: 28 },
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Props {
  initialData: {
    enrollmentY1: number
    maxClassSize: number
    enrollmentY2: number
    enrollmentY3: number
    enrollmentY4: number
    growthPreset: GrowthPreset
  }
  gradeConfig: string
  pctFrl: number
  pctIep: number
  pctEll: number
  pctHicap: number
  initialOpeningGrades?: string[]
  initialBuildoutGrades?: string[]
  initialRetentionRate?: number
  initialExpansionPlan?: GradeExpansionEntry[]
  onNext: (data: {
    enrollmentY1: number
    maxClassSize: number
    enrollmentY2: number
    enrollmentY3: number
    enrollmentY4: number
    growthPreset: GrowthPreset
    enrollmentMode: EnrollmentMode
    openingGrades?: string[]
    buildoutGrades?: string[]
    retentionRate?: number
    expansionPlan?: GradeExpansionEntry[]
  }) => void
  onBack: () => void
}

export default function StepEnrollment({
  initialData, gradeConfig, pctFrl, pctIep, pctEll, pctHicap,
  initialOpeningGrades, initialBuildoutGrades, initialRetentionRate, initialExpansionPlan,
  onNext, onBack,
}: Props) {
  const defaults = GRADE_ENROLLMENT_DEFAULTS[gradeConfig] || GRADE_ENROLLMENT_DEFAULTS['K-5']
  const [mode, setMode] = useState<EnrollmentMode>('grade_expansion')

  const [maxClassSize, setMaxClassSize] = useState(initialData.maxClassSize || defaults.classSize)

  // Grade expansion state
  const [expansionResult, setExpansionResult] = useState<{
    openingGrades: string[]
    buildoutGrades: string[]
    retentionRate: number
    plan: GradeExpansionEntry[]
    enrollments: { year: number; total: number }[]
  } | null>(null)

  const handleExpansionChange = useCallback((data: {
    openingGrades: string[]
    buildoutGrades: string[]
    retentionRate: number
    plan: GradeExpansionEntry[]
    enrollments: { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[]
  }) => {
    setExpansionResult(data)
    // Keep maxClassSize in sync with the plan's students_per_section
    if (data.plan.length > 0) {
      setMaxClassSize(data.plan[0].students_per_section)
    }
  }, [])

  // Derive enrollment numbers from expansion plan (source of truth)
  const expansionEnrollments = useMemo(() => {
    if (!expansionResult) return { y1: initialData.enrollmentY1, y2: initialData.enrollmentY2, y3: initialData.enrollmentY3, y4: initialData.enrollmentY4, y5: 0 }
    const find = (yr: number) => expansionResult.enrollments.find(e => e.year === yr)?.total || 0
    return { y1: find(1), y2: find(2), y3: find(3), y4: find(4), y5: find(5) }
  }, [expansionResult, initialData])

  const effectiveY1 = expansionEnrollments.y1

  // Total sections for Y1 = sum of sections across all Year 1 plan entries
  const sectionsY1 = expansionResult
    ? expansionResult.plan.filter(e => e.year === 1).reduce((sum, e) => sum + e.sections, 0)
    : Math.ceil(effectiveY1 / maxClassSize)

  const revenuePreview = useMemo(() => {
    const rev = calcCommissionRevenue(effectiveY1, pctFrl, pctIep, pctEll, pctHicap, DEFAULT_ASSUMPTIONS)
    const baseRevenue = rev.regularEd + rev.sped + rev.facilitiesRev + rev.levyEquity
    const totalGrants = rev.titleI + rev.idea + rev.lap + rev.tbip + rev.hicap
    return { baseRevenue, totalGrants, total: rev.total }
  }, [effectiveY1, pctFrl, pctIep, pctEll, pctHicap])

  function handleNext(e: React.FormEvent) {
    e.preventDefault()

    if (expansionResult) {
      const arr = expansionToEnrollmentArray(expansionResult.plan, expansionResult.retentionRate)
      onNext({
        enrollmentY1: arr[0],
        maxClassSize,
        enrollmentY2: arr[1],
        enrollmentY3: arr[2],
        enrollmentY4: arr[3],
        growthPreset: 'moderate',
        enrollmentMode: mode,
        openingGrades: expansionResult.openingGrades,
        buildoutGrades: expansionResult.buildoutGrades,
        retentionRate: expansionResult.retentionRate,
        expansionPlan: expansionResult.plan,
      })
    } else {
      onNext({
        enrollmentY1: expansionEnrollments.y1,
        maxClassSize,
        enrollmentY2: expansionEnrollments.y2,
        enrollmentY3: expansionEnrollments.y3,
        enrollmentY4: expansionEnrollments.y4,
        growthPreset: 'moderate',
        enrollmentMode: mode,
      })
    }
  }

  return (
    <form onSubmit={handleNext} className="space-y-6 max-w-2xl">
      <p className="text-sm text-slate-500">
        Enrollment drives nearly every financial metric. Choose your enrollment planning approach.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('grade_expansion')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'grade_expansion'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Grade Expansion Plan
        </button>
        <button
          type="button"
          onClick={() => setMode('simple')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'simple'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Enrollment Summary
        </button>
      </div>

      {mode === 'grade_expansion' ? (
        <>
          <div className="text-xs text-slate-400 italic">
            Grade expansion produces cohort-based projections that authorizers find more credible than flat growth rates.
          </div>

          <GradeExpansionEditor
            gradeConfig={gradeConfig}
            maxClassSize={maxClassSize}
            initialOpeningGrades={initialOpeningGrades}
            initialBuildoutGrades={initialBuildoutGrades}
            initialRetentionRate={initialRetentionRate}
            initialPlan={initialExpansionPlan}
            onChange={handleExpansionChange}
          />
        </>
      ) : (
        <>
          <div className="text-xs text-slate-400 italic">
            Enrollment targets are calculated from your Grade Expansion Plan. Switch to the Grade Expansion Plan tab to adjust which grades are added each year.
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Year 1', value: expansionEnrollments.y1 },
              { label: 'Year 2', value: expansionEnrollments.y2 },
              { label: 'Year 3', value: expansionEnrollments.y3 },
              { label: 'Year 4', value: expansionEnrollments.y4 },
              { label: 'Year 5', value: expansionEnrollments.y5 },
            ].map(({ label, value }) => (
              <div key={label}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <div className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold">
                  {value > 0 ? value : '—'}
                </div>
              </div>
            ))}
          </div>

          {expansionEnrollments.y1 === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              No enrollment data yet. Switch to the Grade Expansion Plan tab to configure your grade rollout.
            </div>
          )}
        </>
      )}

      {/* Revenue preview */}
      <div className="bg-slate-50 rounded-xl p-4 flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-slate-500">Sections Needed (Y1)</p>
          <p className="text-lg font-semibold text-slate-800">{sectionsY1}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Est. Base Revenue</p>
          <p className="text-lg font-semibold text-slate-800">{fmt(revenuePreview.baseRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Est. Grants</p>
          <p className="text-lg font-semibold text-slate-800">{fmt(revenuePreview.totalGrants)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Revenue</p>
          <p className="text-lg font-semibold text-teal-600">{fmt(revenuePreview.total)}</p>
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          className="bg-teal-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </form>
  )
}
