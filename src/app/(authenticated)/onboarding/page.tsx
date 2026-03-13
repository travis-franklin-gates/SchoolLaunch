'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcBenefits, calcTotalBaseRevenue, calcAllGrants } from '@/lib/calculations'
import StepIdentity from '@/components/onboarding/StepIdentity'
import StepEnrollment from '@/components/onboarding/StepEnrollment'
import StepDemographics from '@/components/onboarding/StepDemographics'
import StepStaffing, { buildDefaultPositions } from '@/components/onboarding/StepStaffing'
import StepOperations, { defaultOperationsData } from '@/components/onboarding/StepOperations'
import type { GrowthPreset, StartupFundingSource } from '@/lib/types'

const STEPS = [
  { label: 'School Identity', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { label: 'Enrollment', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'Demographics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Staffing', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { label: 'Operations', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

interface WizardData {
  schoolName: string
  region: string
  plannedOpenYear: number
  gradeConfig: string
  enrollmentY1: number
  enrollmentY2: number
  enrollmentY3: number
  enrollmentY4: number
  maxClassSize: number
  growthPreset: GrowthPreset
  pctFrl: number
  pctIep: number
  pctEll: number
  pctHicap: number
  positions: { key: string; title: string; category: 'certificated' | 'classified' | 'admin'; fte: number; salary: number }[]
  operations: {
    facilityMode: 'sqft' | 'flat'
    facilitySqft: number
    facilityCostPerSqft: number
    facilityMonthly: number
    suppliesPerPupil: number
    contractedPerPupil: number
    technologyPerPupil: number
    foodProgram: boolean
    insurance: number
    miscPct: number
  }
  startupFunding: StartupFundingSource[]
}

const initialWizardData: WizardData = {
  schoolName: '',
  region: 'King County',
  plannedOpenYear: new Date().getFullYear(),
  gradeConfig: 'K-5',
  enrollmentY1: 120,
  enrollmentY2: 0,
  enrollmentY3: 0,
  enrollmentY4: 0,
  maxClassSize: 22,
  growthPreset: 'moderate',
  pctFrl: 50,
  pctIep: 12,
  pctEll: 10,
  pctHicap: 5,
  positions: [],
  operations: defaultOperationsData,
  startupFunding: [],
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(initialWizardData)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Load existing data on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('school_id')
        .eq('user_id', user.id)
        .single()

      if (!roleData?.school_id) { setLoading(false); return }

      setSchoolId(roleData.school_id)

      // Load school name
      const { data: school } = await supabase
        .from('schools')
        .select('name')
        .eq('id', roleData.school_id)
        .single()

      // Load profile
      const { data: profile } = await supabase
        .from('school_profiles')
        .select('*')
        .eq('school_id', roleData.school_id)
        .single()

      if (profile?.onboarding_complete) {
        router.push('/dashboard')
        return
      }

      // Load existing staffing positions
      const { data: existingPositions } = await supabase
        .from('staffing_positions')
        .select('*')
        .eq('school_id', roleData.school_id)
        .eq('year', 1)

      if (school || profile) {
        setData((prev) => ({
          ...prev,
          schoolName: school?.name || prev.schoolName,
          region: profile?.region || prev.region,
          plannedOpenYear: profile?.planned_open_year || prev.plannedOpenYear,
          gradeConfig: profile?.grade_config || prev.gradeConfig,
          enrollmentY1: profile?.target_enrollment_y1 || prev.enrollmentY1,
          enrollmentY2: profile?.target_enrollment_y2 || prev.enrollmentY2,
          enrollmentY3: profile?.target_enrollment_y3 || prev.enrollmentY3,
          enrollmentY4: profile?.target_enrollment_y4 || prev.enrollmentY4,
          maxClassSize: profile?.max_class_size || prev.maxClassSize,
          pctFrl: profile?.pct_frl ?? prev.pctFrl,
          pctIep: profile?.pct_iep ?? prev.pctIep,
          pctEll: profile?.pct_ell ?? prev.pctEll,
          pctHicap: profile?.pct_hicap ?? prev.pctHicap,
          startupFunding: profile?.startup_funding || prev.startupFunding,
          positions: existingPositions && existingPositions.length > 0
            ? existingPositions.map((p, i) => ({
                key: `db-${i}`,
                title: p.title,
                category: p.category as 'certificated' | 'classified' | 'admin',
                fte: p.fte,
                salary: p.annual_salary,
              }))
            : prev.positions,
        }))
      }

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveStep1 = useCallback(async (stepData: { schoolName: string; region: string; plannedOpenYear: number; gradeConfig: string }) => {
    if (!schoolId) return
    setData((prev) => ({ ...prev, ...stepData }))

    await supabase.from('schools').update({ name: stepData.schoolName }).eq('id', schoolId)

    await supabase.from('school_profiles').upsert({
      school_id: schoolId,
      region: stepData.region,
      planned_open_year: stepData.plannedOpenYear,
      grade_config: stepData.gradeConfig,
    }, { onConflict: 'school_id' })

    setStep(1)
  }, [schoolId, supabase])

  const saveStep2 = useCallback(async (stepData: {
    enrollmentY1: number; maxClassSize: number;
    enrollmentY2: number; enrollmentY3: number; enrollmentY4: number;
    growthPreset: GrowthPreset
  }) => {
    if (!schoolId) return
    setData((prev) => ({ ...prev, ...stepData }))

    await supabase.from('school_profiles').upsert({
      school_id: schoolId,
      target_enrollment_y1: stepData.enrollmentY1,
      target_enrollment_y2: stepData.enrollmentY2,
      target_enrollment_y3: stepData.enrollmentY3,
      target_enrollment_y4: stepData.enrollmentY4,
      max_class_size: stepData.maxClassSize,
    }, { onConflict: 'school_id' })

    setStep(2)
  }, [schoolId, supabase])

  const saveStep3 = useCallback(async (stepData: { pctFrl: number; pctIep: number; pctEll: number; pctHicap: number }) => {
    if (!schoolId) return
    setData((prev) => ({ ...prev, ...stepData }))

    await supabase.from('school_profiles').upsert({
      school_id: schoolId,
      pct_frl: stepData.pctFrl,
      pct_iep: stepData.pctIep,
      pct_ell: stepData.pctEll,
      pct_hicap: stepData.pctHicap,
    }, { onConflict: 'school_id' })

    setStep(3)
  }, [schoolId, supabase])

  const saveStep4 = useCallback(async (positions: WizardData['positions']) => {
    if (!schoolId) return
    setData((prev) => ({ ...prev, positions }))

    // Delete old positions for year 1, then insert new
    await supabase.from('staffing_positions').delete().eq('school_id', schoolId).eq('year', 1)

    const rows = positions.map((p) => ({
      school_id: schoolId,
      year: 1,
      title: p.title,
      category: p.category,
      fte: p.fte,
      annual_salary: p.salary,
    }))

    if (rows.length > 0) {
      await supabase.from('staffing_positions').insert(rows)
    }

    setStep(4)
  }, [schoolId, supabase])

  const completeOnboarding = useCallback(async (opsData: WizardData['operations'], startupFunding: StartupFundingSource[]) => {
    if (!schoolId) return
    setSaving(true)
    setError(null)
    setData((prev) => ({ ...prev, operations: opsData, startupFunding }))

    try {
      // Save startup funding to profile
      await supabase.from('school_profiles').upsert({
        school_id: schoolId,
        startup_funding: startupFunding,
      }, { onConflict: 'school_id' })

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positions: data.positions,
          operations: opsData,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('[onboarding] completion failed:', err)
        setError(err.error || 'Failed to save budget data. Please try again.')
        setSaving(false)
        return
      }

      setCompleted(true)
      setSaving(false)
    } catch (e) {
      console.error('[onboarding] network error:', e)
      setError('Network error. Please check your connection and try again.')
      setSaving(false)
    }
  }, [schoolId, data.positions, supabase])

  // Calculate total personnel cost for operations step
  const totalPersonnelCost = data.positions.reduce((sum, p) => {
    const sal = p.fte * p.salary
    return sum + sal + calcBenefits(sal)
  }, 0)

  // Completion summary metrics
  const completionMetrics = useMemo(() => {
    const baseRevenue = calcTotalBaseRevenue(data.enrollmentY1)
    const grants = calcAllGrants(data.enrollmentY1, data.pctFrl, data.pctIep, data.pctEll, data.pctHicap)
    const totalGrants = grants.titleI + grants.idea + grants.lap + grants.tbip + grants.hicap
    const totalRevenue = baseRevenue + totalGrants
    const totalFte = data.positions.reduce((s, p) => s + p.fte, 0)
    const personnelPct = totalRevenue > 0 ? ((totalPersonnelCost / totalRevenue) * 100).toFixed(1) : '0'
    return { totalRevenue, totalPersonnelCost, totalFte, personnelPct }
  }, [data, totalPersonnelCost])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading your school data...</p>
        </div>
      </div>
    )
  }

  // Completion screen
  if (completed) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-[bounce_1s_ease-in-out]">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Your Budget is Ready!</h1>
          <p className="text-slate-500">
            {data.schoolName}&apos;s financial model has been built. Here&apos;s a quick snapshot.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Year 1 Revenue</p>
            <p className="text-lg font-bold text-slate-800">{fmt(completionMetrics.totalRevenue)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Personnel Cost</p>
            <p className="text-lg font-bold text-slate-800">{fmt(completionMetrics.totalPersonnelCost)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Total FTE</p>
            <p className="text-lg font-bold text-slate-800">{completionMetrics.totalFte.toFixed(1)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Personnel %</p>
            <p className={`text-lg font-bold ${
              Number(completionMetrics.personnelPct) > 85 ? 'text-red-600' : Number(completionMetrics.personnelPct) > 70 ? 'text-amber-600' : 'text-emerald-600'
            }`}>{completionMetrics.personnelPct}%</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">What happens next?</h3>
          <ul className="text-sm text-blue-700 space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">1.</span>
              <span>Explore your <strong>Dashboard</strong> to see revenue, staffing, operations, and cash flow projections</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">2.</span>
              <span>Run the <strong>Advisory Panel</strong> for expert analysis from 7 specialized financial agents</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">3.</span>
              <span>Export a professional <strong>Budget Narrative PDF</strong> for your authorizer application</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">4.</span>
              <span>Use <strong>Ask SchoolLaunch</strong> to get instant answers about WA charter finances</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="bg-blue-600 text-white px-10 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map(({ label, icon }, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    i < step
                      ? 'bg-blue-600 text-white'
                      : i === step
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {i < step ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                  )}
                </div>
                <span className={`text-xs mt-1.5 font-medium ${
                  i <= step ? 'text-blue-600' : 'text-slate-400'
                }`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-full -mt-5 mx-1 ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{STEPS[step].label}</h2>
          <span className="text-xs text-slate-400">Step {step + 1} of {STEPS.length}</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {step === 0 && (
        <StepIdentity
          initialData={{
            schoolName: data.schoolName,
            region: data.region,
            plannedOpenYear: data.plannedOpenYear,
            gradeConfig: data.gradeConfig,
          }}
          onNext={saveStep1}
        />
      )}

      {step === 1 && (
        <StepEnrollment
          initialData={{
            enrollmentY1: data.enrollmentY1,
            maxClassSize: data.maxClassSize,
            enrollmentY2: data.enrollmentY2,
            enrollmentY3: data.enrollmentY3,
            enrollmentY4: data.enrollmentY4,
            growthPreset: data.growthPreset,
          }}
          gradeConfig={data.gradeConfig}
          pctFrl={data.pctFrl}
          pctIep={data.pctIep}
          pctEll={data.pctEll}
          pctHicap={data.pctHicap}
          onNext={saveStep2}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <StepDemographics
          enrollment={data.enrollmentY1}
          region={data.region}
          initialData={{
            pctFrl: data.pctFrl,
            pctIep: data.pctIep,
            pctEll: data.pctEll,
            pctHicap: data.pctHicap,
          }}
          onNext={saveStep3}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepStaffing
          enrollment={data.enrollmentY1}
          maxClassSize={data.maxClassSize}
          gradeConfig={data.gradeConfig}
          pctFrl={data.pctFrl}
          pctIep={data.pctIep}
          pctEll={data.pctEll}
          pctHicap={data.pctHicap}
          initialPositions={data.positions}
          onNext={saveStep4}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <StepOperations
          enrollment={data.enrollmentY1}
          totalPersonnelCost={totalPersonnelCost}
          pctFrl={data.pctFrl}
          pctIep={data.pctIep}
          pctEll={data.pctEll}
          pctHicap={data.pctHicap}
          initialData={data.operations}
          startupFunding={data.startupFunding}
          onComplete={completeOnboarding}
          onBack={() => setStep(3)}
          saving={saving}
        />
      )}
    </div>
  )
}
