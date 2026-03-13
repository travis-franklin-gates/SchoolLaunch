'use client'

import { useState, useMemo, useCallback } from 'react'
import { calcSections, calcEnrollmentGrowth, calcCommissionRevenue } from '@/lib/calculations'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'
import type { GrowthPreset, GradeExpansionEntry, EnrollmentMode } from '@/lib/types'
import { expansionToEnrollmentArray } from '@/lib/gradeExpansion'
import GradeExpansionEditor from '@/components/GradeExpansionEditor'

const GROWTH_RATES: Record<Exclude<GrowthPreset, 'manual'>, number> = {
  conservative: 5,
  moderate: 10,
  aggressive: 15,
}

const GROWTH_CONTEXT: Record<Exclude<GrowthPreset, 'manual'>, string> = {
  conservative: 'Safest for authorizer review. Recommended for first-time operators.',
  moderate: 'Common assumption for established charter networks expanding to WA.',
  aggressive: 'Requires strong waitlist evidence. Authorizers will scrutinize.',
}

const GRADE_ENROLLMENT_DEFAULTS: Record<string, { enrollment: number; classSize: number }> = {
  'K-5': { enrollment: 120, classSize: 22 },
  'K-8': { enrollment: 200, classSize: 24 },
  '6-8': { enrollment: 150, classSize: 25 },
  '9-12': { enrollment: 200, classSize: 28 },
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
  const hasInitialExpansion = initialExpansionPlan && initialExpansionPlan.length > 0
  const [mode, setMode] = useState<EnrollmentMode>(hasInitialExpansion ? 'grade_expansion' : 'simple')

  // Simple mode state
  const [enrollmentY1, setEnrollmentY1] = useState(initialData.enrollmentY1 || defaults.enrollment)
  const [maxClassSize, setMaxClassSize] = useState(initialData.maxClassSize || defaults.classSize)
  const [growthPreset, setGrowthPreset] = useState<GrowthPreset>(initialData.growthPreset || 'moderate')
  const [manualY2, setManualY2] = useState(initialData.enrollmentY2 || 0)
  const [manualY3, setManualY3] = useState(initialData.enrollmentY3 || 0)
  const [manualY4, setManualY4] = useState(initialData.enrollmentY4 || 0)

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
  }, [])

  const simpleEnrollments = useMemo(() => {
    if (growthPreset === 'manual') {
      return { y2: manualY2 || enrollmentY1, y3: manualY3 || enrollmentY1, y4: manualY4 || enrollmentY1 }
    }
    const rate = GROWTH_RATES[growthPreset]
    return {
      y2: calcEnrollmentGrowth(enrollmentY1, rate, 2),
      y3: calcEnrollmentGrowth(enrollmentY1, rate, 3),
      y4: calcEnrollmentGrowth(enrollmentY1, rate, 4),
    }
  }, [enrollmentY1, growthPreset, manualY2, manualY3, manualY4])

  // Use expansion enrollments if in expansion mode
  const effectiveY1 = mode === 'grade_expansion' && expansionResult
    ? (expansionResult.enrollments.find(e => e.year === 1)?.total || enrollmentY1)
    : enrollmentY1

  const sectionsY1 = calcSections(effectiveY1, maxClassSize)

  const revenuePreview = useMemo(() => {
    const rev = calcCommissionRevenue(effectiveY1, pctFrl, pctIep, pctEll, pctHicap, DEFAULT_ASSUMPTIONS)
    const baseRevenue = rev.regularEd + rev.sped + rev.facilitiesRev + rev.levyEquity
    const totalGrants = rev.titleI + rev.idea + rev.lap + rev.tbip + rev.hicap
    return { baseRevenue, totalGrants, total: rev.total }
  }, [effectiveY1, pctFrl, pctIep, pctEll, pctHicap])

  const enrollmentWarning = effectiveY1 < 80
    ? 'Below 80 students may not generate sufficient revenue to cover fixed costs.'
    : effectiveY1 > 500
    ? 'Large initial enrollment is unusual for a new charter. Authorizers may question this.'
    : null

  function handleNext(e: React.FormEvent) {
    e.preventDefault()

    if (mode === 'grade_expansion' && expansionResult) {
      const arr = expansionToEnrollmentArray(expansionResult.plan, expansionResult.retentionRate)
      onNext({
        enrollmentY1: arr[0],
        maxClassSize,
        enrollmentY2: arr[1],
        enrollmentY3: arr[2],
        enrollmentY4: arr[3],
        growthPreset,
        enrollmentMode: 'grade_expansion',
        openingGrades: expansionResult.openingGrades,
        buildoutGrades: expansionResult.buildoutGrades,
        retentionRate: expansionResult.retentionRate,
        expansionPlan: expansionResult.plan,
      })
    } else {
      onNext({
        enrollmentY1,
        maxClassSize,
        enrollmentY2: simpleEnrollments.y2,
        enrollmentY3: simpleEnrollments.y3,
        enrollmentY4: simpleEnrollments.y4,
        growthPreset,
        enrollmentMode: 'simple',
      })
    }
  }

  function selectPreset(preset: GrowthPreset) {
    setGrowthPreset(preset)
    if (preset === 'manual') {
      const rate = GROWTH_RATES.moderate
      setManualY2(calcEnrollmentGrowth(enrollmentY1, rate, 2))
      setManualY3(calcEnrollmentGrowth(enrollmentY1, rate, 3))
      setManualY4(calcEnrollmentGrowth(enrollmentY1, rate, 4))
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
              ? 'bg-white text-blue-700 shadow-sm'
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
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Simple Enrollment Targets
        </button>
      </div>

      {mode === 'grade_expansion' ? (
        <>
          <div className="text-xs text-slate-400 italic">
            Grade expansion produces cohort-based projections that authorizers find more credible than flat growth rates.
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Class Size</label>
            <input
              type="number"
              value={maxClassSize}
              onChange={(e) => setMaxClassSize(Number(e.target.value))}
              min={10}
              max={35}
              className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Enrollment Year 1</label>
              <input
                type="number"
                value={enrollmentY1}
                onChange={(e) => setEnrollmentY1(Number(e.target.value))}
                min={1}
                required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
              <p className="text-xs text-slate-400 mt-1">Default for {gradeConfig}: {defaults.enrollment}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Class Size</label>
              <input
                type="number"
                value={maxClassSize}
                onChange={(e) => setMaxClassSize(Number(e.target.value))}
                min={10}
                max={35}
                required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Year 2–4 Growth</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {(['conservative', 'moderate', 'aggressive', 'manual'] as GrowthPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                    growthPreset === preset
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {preset === 'manual' ? 'Manual' : `${preset.charAt(0).toUpperCase() + preset.slice(1)} +${GROWTH_RATES[preset]}%`}
                </button>
              ))}
            </div>
            {growthPreset !== 'manual' && (
              <p className="text-xs text-slate-500 mb-4 italic">{GROWTH_CONTEXT[growthPreset]}</p>
            )}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Year 2', value: simpleEnrollments.y2, manual: manualY2, setManual: setManualY2 },
                { label: 'Year 3', value: simpleEnrollments.y3, manual: manualY3, setManual: setManualY3 },
                { label: 'Year 4', value: simpleEnrollments.y4, manual: manualY4, setManual: setManualY4 },
              ].map(({ label, value, manual, setManual }) => (
                <div key={label}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  {growthPreset === 'manual' ? (
                    <input
                      type="number"
                      value={manual}
                      onChange={(e) => setManual(Number(e.target.value))}
                      min={1}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium">{value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {enrollmentWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-700">{enrollmentWarning}</p>
        </div>
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
          <p className="text-lg font-semibold text-blue-600">{fmt(revenuePreview.total)}</p>
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
          className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </form>
  )
}
