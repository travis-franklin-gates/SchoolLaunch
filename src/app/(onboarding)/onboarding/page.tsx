'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcBenefits, calcCommissionRevenue, calcSmallSchoolEnhancementFromGrades } from '@/lib/calculations'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'
import StepIdentity from '@/components/onboarding/StepIdentity'
import StepEnrollment from '@/components/onboarding/StepEnrollment'
import StepDemographics from '@/components/onboarding/StepDemographics'
import StepStaffing from '@/components/onboarding/StepStaffing'
import StepOperations, { defaultOperationsData, getDefaultOperationsData } from '@/components/onboarding/StepOperations'
import type { GrowthPreset, StartupFundingSource, GradeExpansionEntry, EnrollmentMode } from '@/lib/types'
import type { Pathway } from '@/lib/stateConfig'
import { getStateConfig } from '@/lib/stateConfig'

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
  enrollmentY5: number
  maxClassSize: number
  growthPreset: GrowthPreset
  pctFrl: number
  pctIep: number
  pctEll: number
  pctHicap: number
  positions: { key: string; title: string; category: 'certificated' | 'classified' | 'admin'; fte: number; salary: number; positionType?: string; classification?: string; driver?: string }[]
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
  enrollmentMode: EnrollmentMode
  openingGrades: string[]
  buildoutGrades: string[]
  retentionRate: number
  expansionPlan: GradeExpansionEntry[]
  // Generic pathway fields
  state: string
  schoolType: 'charter' | 'private' | 'micro'
  pathway: Pathway
  fiscalYearStartMonth: number
  tuitionRate: number
  financialAidPct: number
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
  enrollmentY5: 0,
  maxClassSize: 24,
  growthPreset: 'moderate',
  pctFrl: 50,
  pctIep: 12,
  pctEll: 10,
  pctHicap: 5,
  positions: [],
  operations: defaultOperationsData,
  startupFunding: [],
  enrollmentMode: 'simple' as EnrollmentMode,
  openingGrades: [],
  buildoutGrades: [],
  retentionRate: 100,
  expansionPlan: [],
  // Generic pathway fields — default to WA charter
  state: 'WA',
  schoolType: 'charter',
  pathway: 'wa_charter',
  fiscalYearStartMonth: 9,
  tuitionRate: 0,
  financialAidPct: 0,
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function OnboardingPage() {
  const [step, setStep] = useState(-1) // -1 = welcome screen
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

      // Load school name and pathway fields
      const { data: school } = await supabase
        .from('schools')
        .select('name, pathway, state, school_type')
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

      // Load existing staffing positions and grade expansion plan
      const [{ data: existingPositions }, { data: existingExpansion }] = await Promise.all([
        supabase.from('staffing_positions').select('*').eq('school_id', roleData.school_id).eq('year', 1),
        supabase.from('grade_expansion_plan').select('*').eq('school_id', roleData.school_id).order('year').order('grade_level'),
      ])

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
          enrollmentY5: profile?.target_enrollment_y5 || prev.enrollmentY5,
          maxClassSize: profile?.max_class_size || prev.maxClassSize,
          pctFrl: profile?.pct_frl ?? prev.pctFrl,
          pctIep: profile?.pct_iep ?? prev.pctIep,
          pctEll: profile?.pct_ell ?? prev.pctEll,
          pctHicap: profile?.pct_hicap ?? prev.pctHicap,
          startupFunding: profile?.startup_funding || prev.startupFunding,
          openingGrades: profile?.opening_grades || prev.openingGrades,
          buildoutGrades: profile?.buildout_grades || prev.buildoutGrades,
          retentionRate: profile?.retention_rate ?? prev.retentionRate,
          enrollmentMode: (existingExpansion && existingExpansion.length > 0 ? 'grade_expansion' : prev.enrollmentMode) as EnrollmentMode,
          expansionPlan: existingExpansion && existingExpansion.length > 0
            ? existingExpansion.map((e: Record<string, unknown>) => ({
                year: e.year as number,
                grade_level: e.grade_level as string,
                sections: e.sections as number,
                students_per_section: e.students_per_section as number,
                is_new_grade: e.is_new_grade as boolean,
              }))
            : prev.expansionPlan,
          positions: existingPositions && existingPositions.length > 0
            ? existingPositions.map((p, i) => ({
                key: `db-${i}`,
                title: p.title,
                category: p.category as 'certificated' | 'classified' | 'admin',
                fte: p.fte,
                salary: p.annual_salary,
              }))
            : prev.positions,
          // Pathway fields from schools table
          state: school?.state || prev.state,
          schoolType: (school?.school_type as 'charter' | 'private' | 'micro') || prev.schoolType,
          pathway: (school?.pathway as Pathway) || prev.pathway,
          fiscalYearStartMonth: profile?.fiscal_year_start_month || prev.fiscalYearStartMonth,
        }))
      }

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveStep1 = useCallback(async (stepData: {
    schoolName: string; region: string; plannedOpenYear: number;
    foundingGrades: string[]; buildoutGrades: string[]; gradeConfig: string;
    regionalizationFactor: number;
    state: string; schoolType: 'charter' | 'private' | 'micro';
    pathway: Pathway; fiscalYearStartMonth: number
  }) => {
    if (!schoolId) return
    // Set tuition/aid defaults from config when pathway is tuition-based
    const stepConfig = getStateConfig(stepData.pathway)
    const tuitionDefaults = stepConfig.revenue_model === 'tuition'
      ? { tuitionRate: stepConfig.tuition_rate_default ?? 0, financialAidPct: stepConfig.financial_aid_pct_default ?? 0 }
      : {}
    setData((prev) => ({
      ...prev,
      schoolName: stepData.schoolName,
      region: stepData.region,
      plannedOpenYear: stepData.plannedOpenYear,
      gradeConfig: stepData.gradeConfig,
      openingGrades: stepData.foundingGrades,
      buildoutGrades: stepData.buildoutGrades,
      state: stepData.state,
      schoolType: stepData.schoolType,
      pathway: stepData.pathway,
      fiscalYearStartMonth: stepData.fiscalYearStartMonth,
      ...tuitionDefaults,
    }))

    // Update schools table with pathway fields
    await supabase.from('schools').update({
      name: stepData.schoolName,
      pathway: stepData.pathway,
      state: stepData.state,
      school_type: stepData.schoolType,
    }).eq('id', schoolId)

    // Read existing financial_assumptions to merge regionalization_factor
    const { data: existingProfile } = await supabase
      .from('school_profiles')
      .select('financial_assumptions')
      .eq('school_id', schoolId)
      .single()

    const existingFa = existingProfile?.financial_assumptions || {}
    const updatedFa = { ...existingFa, regionalization_factor: stepData.regionalizationFactor }

    await supabase.from('school_profiles').upsert({
      school_id: schoolId,
      region: stepData.region,
      planned_open_year: stepData.plannedOpenYear,
      grade_config: stepData.gradeConfig,
      opening_grades: stepData.foundingGrades,
      buildout_grades: stepData.buildoutGrades,
      financial_assumptions: updatedFa,
      fiscal_year_start_month: stepData.fiscalYearStartMonth,
    }, { onConflict: 'school_id' })

    setStep(1)
  }, [schoolId, supabase])

  const saveStep2 = useCallback(async (stepData: {
    enrollmentY1: number; maxClassSize: number;
    enrollmentY2: number; enrollmentY3: number; enrollmentY4: number; enrollmentY5: number;
    growthPreset: GrowthPreset
    enrollmentMode: EnrollmentMode
    openingGrades?: string[]
    buildoutGrades?: string[]
    retentionRate?: number
    expansionPlan?: GradeExpansionEntry[]
    tuitionRate?: number
    financialAidPct?: number
  }) => {
    if (!schoolId) return
    setData((prev) => ({
      ...prev,
      ...stepData,
      openingGrades: stepData.openingGrades || prev.openingGrades,
      buildoutGrades: stepData.buildoutGrades || prev.buildoutGrades,
      retentionRate: stepData.retentionRate ?? prev.retentionRate,
      expansionPlan: stepData.expansionPlan || prev.expansionPlan,
      enrollmentMode: stepData.enrollmentMode,
      tuitionRate: stepData.tuitionRate ?? prev.tuitionRate,
      financialAidPct: stepData.financialAidPct ?? prev.financialAidPct,
    }))

    const profileUpdate: Record<string, unknown> = {
      school_id: schoolId,
      target_enrollment_y1: stepData.enrollmentY1,
      target_enrollment_y2: stepData.enrollmentY2,
      target_enrollment_y3: stepData.enrollmentY3,
      target_enrollment_y4: stepData.enrollmentY4,
      target_enrollment_y5: stepData.enrollmentY5,
      max_class_size: stepData.maxClassSize,
    }

    // Save tuition data for private/micro pathways
    if (stepData.tuitionRate != null) profileUpdate.tuition_rate = stepData.tuitionRate
    if (stepData.financialAidPct != null) profileUpdate.financial_aid_pct = stepData.financialAidPct

    if (stepData.enrollmentMode === 'grade_expansion' && stepData.openingGrades) {
      profileUpdate.opening_grades = stepData.openingGrades
      profileUpdate.buildout_grades = stepData.buildoutGrades
      profileUpdate.retention_rate = stepData.retentionRate
    }

    await supabase.from('school_profiles').upsert(profileUpdate, { onConflict: 'school_id' })

    // Save grade expansion plan if in expansion mode
    if (stepData.enrollmentMode === 'grade_expansion' && stepData.expansionPlan && stepData.expansionPlan.length > 0) {
      await supabase.from('grade_expansion_plan').delete().eq('school_id', schoolId)
      const rows = stepData.expansionPlan.map((e) => ({
        school_id: schoolId,
        year: e.year,
        grade_level: e.grade_level,
        sections: e.sections,
        students_per_section: e.students_per_section,
        is_new_grade: e.is_new_grade,
      }))
      await supabase.from('grade_expansion_plan').insert(rows)
    }

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

  const skipDemographics = useCallback(() => {
    // Leave demographics at 0 and advance to staffing
    setData((prev) => ({ ...prev, pctFrl: 0, pctIep: 0, pctEll: 0, pctHicap: 0 }))
    setStep(3)
  }, [])

  const saveStep4 = useCallback(async (positions: WizardData['positions']) => {
    if (!schoolId) return
    setData((prev) => ({ ...prev, positions }))

    // Delete old positions for year 1, then insert new
    await supabase.from('staffing_positions').delete().eq('school_id', schoolId).eq('year', 1)

    const rows = positions.map((p, i) => ({
      school_id: schoolId,
      year: 1,
      title: p.title,
      category: p.category,
      fte: p.fte,
      annual_salary: p.salary,
      position_type: p.positionType || null,
      driver: p.driver || null,
      classification: p.classification || null,
      sort_order: i,
    }))

    if (rows.length > 0) {
      await supabase.from('staffing_positions').insert(rows)
    }

    setStep(4)
  }, [schoolId, supabase])

  const completeOnboarding = useCallback(async (opsData: WizardData['operations'], startupFunding: StartupFundingSource[], customRevenue?: { key: string; label: string; amount: number }[]) => {
    if (!schoolId) return
    setSaving(true)
    setError(null)
    setData((prev) => ({ ...prev, operations: opsData, startupFunding }))

    try {
      // Save startup funding and custom revenue lines to profile
      const profileUpdate: Record<string, unknown> = {
        school_id: schoolId,
        startup_funding: startupFunding,
      }
      if (customRevenue) {
        profileUpdate.custom_revenue_lines = customRevenue
      }
      await supabase.from('school_profiles').upsert(profileUpdate, { onConflict: 'school_id' })

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

  // Derive Y1 sections from expansion plan (sectionsPerGrade × openingGrades)
  const sectionsY1 = data.expansionPlan.length > 0
    ? data.expansionPlan.filter(e => e.year === 1).reduce((sum, e) => sum + e.sections, 0)
    : Math.ceil(data.enrollmentY1 / data.maxClassSize)

  // Pathway config
  const pathwayConfig = getStateConfig(data.pathway)

  // Calculate total personnel cost for operations step — pathway-aware benefits
  const totalPersonnelCost = data.positions.reduce((sum, p) => {
    const sal = p.fte * p.salary
    return sum + sal + Math.round(sal * pathwayConfig.benefits_load)
  }, 0)

  // Completion summary metrics — pathway-aware
  const completionMetrics = useMemo(() => {
    let totalRevenue: number
    if (pathwayConfig.revenue_model === 'tuition') {
      totalRevenue = data.enrollmentY1 * data.tuitionRate * (1 - data.financialAidPct)
    } else {
      const sse = calcSmallSchoolEnhancementFromGrades(
        data.enrollmentY1,
        data.openingGrades || [],
        DEFAULT_ASSUMPTIONS.aafte_pct,
        DEFAULT_ASSUMPTIONS.regular_ed_per_pupil,
        DEFAULT_ASSUMPTIONS.regionalization_factor || 1.0,
      )
      const rev = calcCommissionRevenue(data.enrollmentY1, data.pctFrl, data.pctIep, data.pctEll, data.pctHicap, DEFAULT_ASSUMPTIONS, 1, sse)
      totalRevenue = rev.total
    }
    const totalFte = data.positions.reduce((s, p) => s + p.fte, 0)
    const personnelPct = totalRevenue > 0 ? ((totalPersonnelCost / totalRevenue) * 100).toFixed(1) : '0'
    return { totalRevenue, totalPersonnelCost, totalFte, personnelPct }
  }, [data, totalPersonnelCost, pathwayConfig])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
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

        <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-teal-800 mb-2">What happens next?</h3>
          <ul className="text-sm text-teal-700 space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">1.</span>
              <span>Explore your <strong>Dashboard</strong> to see revenue, staffing, operations, and cash flow projections</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">2.</span>
              <span>Run the <strong>Advisory Panel</strong> for expert analysis from {data.pathway === 'wa_charter' ? '7' : '5'} specialized financial agents</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">3.</span>
              <span>Export a professional <strong>{data.pathway === 'wa_charter' ? 'Budget Narrative PDF' : 'Financial Plan PDF'}</strong> for your {data.pathway === 'wa_charter' ? 'authorizer application' : 'planning and presentations'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 mt-0.5">4.</span>
              <span>Use <strong>Ask SchoolLaunch</strong> to get instant answers about {data.pathway === 'wa_charter' ? 'WA charter finances' : 'your school finances'}</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => {
            // Set sessionStorage flag as backup (in case query param gets stripped)
            sessionStorage.setItem('onboarding_just_completed', 'true')
            router.push('/dashboard?onboarding=complete')
          }}
          className="bg-teal-600 text-white px-10 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors text-lg"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  // Welcome screen (pre-step)
  if (step === -1) {
    return (
      <div>
        {/* Progress stepper — all inactive */}
        <div className="mb-8 max-w-xl mx-auto px-2 sm:px-0">
          <div className="flex items-start">
            {STEPS.map(({ label, icon }, i) => (
              <div key={label} className="flex items-start flex-1 last:flex-initial min-w-0">
                <div className="flex flex-col items-center w-14 sm:w-[72px] flex-shrink-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-slate-200 text-slate-400">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-[11px] mt-1 sm:mt-1.5 font-medium text-center leading-tight text-slate-400" style={{ fontFamily: 'var(--font-heading-var)' }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-0.5 flex-1 mt-4 sm:mt-[18px] bg-slate-200" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Welcome content */}
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-2" style={{ fontFamily: 'var(--font-heading-var)' }}>
            Welcome to SchoolLaunch
          </h1>
          <p className="text-lg text-slate-500 mb-6">
            Let&apos;s build your school&apos;s financial model
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            In the next few minutes, you&apos;ll set up the foundation of your {data.pathway === 'wa_charter' ? 'charter school' : pathwayConfig.display_name.toLowerCase()}&apos;s financial plan.
            We&apos;ll walk you through five steps: your school identity, enrollment plan, student demographics,
            staffing, and operations. Every answer you provide generates a {data.pathway === 'wa_charter' ? 'Commission-aligned' : 'comprehensive'} financial model
            that you can refine on your dashboard.
          </p>
          <p className="text-xs text-slate-400 mb-8">
            You can change any of these answers later in Settings.
          </p>
          <button
            onClick={() => setStep(0)}
            className="bg-teal-600 text-white px-10 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors text-lg"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8 max-w-xl mx-auto px-2 sm:px-0">
        <div className="flex items-start mb-6">
          {STEPS.map(({ label, icon }, i) => (
            <div key={label} className="flex items-start flex-1 last:flex-initial min-w-0">
              <div className="flex flex-col items-center w-14 sm:w-[72px] flex-shrink-0">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    i < step
                      ? 'bg-teal-600 text-white'
                      : i === step
                      ? 'bg-white ring-[3px] ring-teal-600 animate-pulse'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {i < step ? (
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${i === step ? 'text-teal-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                  )}
                </div>
                <span className={`text-[10px] sm:text-[11px] mt-1 sm:mt-1.5 font-medium text-center leading-tight ${
                  i <= step ? 'text-teal-600' : 'text-slate-400'
                }`} style={{ fontFamily: 'var(--font-heading-var)' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mt-4 sm:mt-[18px] ${i < step ? 'bg-teal-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <h2 className="text-[24px] font-semibold text-slate-900" style={{ fontFamily: 'var(--font-heading-var)' }}>{STEPS[step].label}</h2>
          <p className="text-[15px] text-slate-400 mt-1">Step {step + 1} of {STEPS.length}</p>
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
            foundingGrades: data.openingGrades,
            buildoutGrades: data.buildoutGrades,
            state: data.state,
            schoolType: data.schoolType,
            fiscalYearStartMonth: data.fiscalYearStartMonth,
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
            tuitionRate: data.tuitionRate,
            financialAidPct: data.financialAidPct * 100,
          }}
          gradeConfig={data.gradeConfig}
          pctFrl={data.pctFrl}
          pctIep={data.pctIep}
          pctEll={data.pctEll}
          pctHicap={data.pctHicap}
          pathway={data.pathway}
          initialOpeningGrades={data.openingGrades.length > 0 ? data.openingGrades : undefined}
          initialBuildoutGrades={data.buildoutGrades.length > 0 ? data.buildoutGrades : undefined}
          initialRetentionRate={data.retentionRate}
          initialExpansionPlan={data.expansionPlan.length > 0 ? data.expansionPlan : undefined}
          onNext={saveStep2}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <StepDemographics
          enrollment={data.enrollmentY1}
          region={data.region}
          openingGrades={data.openingGrades}
          initialData={{
            pctFrl: data.pctFrl,
            pctIep: data.pctIep,
            pctEll: data.pctEll,
            pctHicap: data.pctHicap,
          }}
          pathway={data.pathway}
          onNext={saveStep3}
          onSkip={skipDemographics}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepStaffing
          enrollment={data.enrollmentY1}
          maxClassSize={data.maxClassSize}
          sectionsY1={sectionsY1}
          gradeConfig={data.gradeConfig}
          pctFrl={data.pctFrl}
          pctIep={data.pctIep}
          pctEll={data.pctEll}
          pctHicap={data.pctHicap}
          pathway={data.pathway}
          tuitionRate={data.tuitionRate}
          financialAidPct={data.financialAidPct}
          openingGrades={data.openingGrades}
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
          pathway={data.pathway}
          openingGrades={data.openingGrades}
          tuitionRate={data.tuitionRate}
          financialAidPct={data.financialAidPct}
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
