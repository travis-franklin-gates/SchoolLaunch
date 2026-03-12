'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  calcTotalBaseRevenue,
  calcRevenue,
  calcLevyEquity,
  calcAllGrants,
  calcBenefits,
  calcAuthorizerFee,
  PER_PUPIL_RATE,
} from '@/lib/calculations'
import StepIdentity from '@/components/onboarding/StepIdentity'
import StepEnrollment from '@/components/onboarding/StepEnrollment'
import StepDemographics from '@/components/onboarding/StepDemographics'
import StepStaffing, { buildDefaultPositions } from '@/components/onboarding/StepStaffing'
import StepOperations, { defaultOperationsData } from '@/components/onboarding/StepOperations'
import type { GrowthPreset } from '@/lib/types'

const STEPS = ['School Identity', 'Enrollment Plan', 'Demographics', 'Staffing Plan', 'Operations Budget']

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
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(initialWizardData)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
        }))
      }

      setLoading(false)
    }
    load()
  }, [])

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
      benefits_rate: 0.30,
      total_cost: Math.round(p.fte * p.salary * 1.3),
    }))

    if (rows.length > 0) {
      await supabase.from('staffing_positions').insert(rows)
    }

    setStep(4)
  }, [schoolId, supabase])

  const completeOnboarding = useCallback(async (opsData: WizardData['operations']) => {
    if (!schoolId) return
    setSaving(true)

    const finalData = { ...data, operations: opsData }
    const enrollment = finalData.enrollmentY1

    // Calculate all revenue lines
    const apportionment = calcRevenue(enrollment)
    const levyEquity = calcLevyEquity(enrollment)
    const grants = calcAllGrants(enrollment, finalData.pctFrl, finalData.pctIep, finalData.pctEll, finalData.pctHicap)

    // Calculate operations costs
    const facilityCost = opsData.facilityMode === 'sqft'
      ? opsData.facilitySqft * opsData.facilityCostPerSqft
      : opsData.facilityMonthly * 12
    const supplies = opsData.suppliesPerPupil * enrollment
    const contracted = opsData.contractedPerPupil * enrollment
    const technology = opsData.technologyPerPupil * enrollment
    const authorizerFee = calcAuthorizerFee(enrollment)
    const insurance = opsData.insurance

    // Personnel total
    let totalPersonnel = 0
    for (const p of finalData.positions) {
      const sal = p.fte * p.salary
      totalPersonnel += sal + calcBenefits(sal)
    }

    const subtotalExpenses = totalPersonnel + facilityCost + supplies + contracted + technology + authorizerFee + insurance
    const misc = Math.round(subtotalExpenses * (opsData.miscPct / 100))

    // Delete existing projections and scenario for year 1
    await supabase.from('budget_projections').delete().eq('school_id', schoolId).eq('year', 1)
    await supabase.from('scenarios').delete().eq('school_id', schoolId).eq('is_base_case', true)

    // Create base scenario
    await supabase.from('scenarios').insert({
      school_id: schoolId,
      name: 'Base Case',
      is_base_case: true,
      assumptions: {
        enrollment: finalData.enrollmentY1,
        maxClassSize: finalData.maxClassSize,
        pctFrl: finalData.pctFrl,
        pctIep: finalData.pctIep,
        pctEll: finalData.pctEll,
        pctHicap: finalData.pctHicap,
        operations: opsData,
        growthPreset: finalData.growthPreset,
        enrollmentY2: finalData.enrollmentY2,
        enrollmentY3: finalData.enrollmentY3,
        enrollmentY4: finalData.enrollmentY4,
      },
    })

    // Build projection rows
    const projections = [
      // Revenue
      { school_id: schoolId, year: 1, category: 'Revenue', line_item: 'State Apportionment', amount: apportionment, is_revenue: true },
      { school_id: schoolId, year: 1, category: 'Revenue', line_item: 'Levy Equity', amount: levyEquity, is_revenue: true },
      { school_id: schoolId, year: 1, category: 'Revenue', line_item: 'Title I', amount: grants.titleI, is_revenue: true },
      { school_id: schoolId, year: 1, category: 'Revenue', line_item: 'IDEA', amount: grants.idea, is_revenue: true },
      { school_id: schoolId, year: 1, category: 'Revenue', line_item: 'LAP', amount: grants.lap, is_revenue: true },
      { school_id: schoolId, year: 1, category: 'Revenue', line_item: 'TBIP', amount: grants.tbip, is_revenue: true },
      { school_id: schoolId, year: 1, category: 'Revenue', line_item: 'HiCap', amount: grants.hicap, is_revenue: true },
      // Expenses
      { school_id: schoolId, year: 1, category: 'Personnel', line_item: 'Total Personnel', amount: totalPersonnel, is_revenue: false },
      { school_id: schoolId, year: 1, category: 'Operations', line_item: 'Facilities', amount: facilityCost, is_revenue: false },
      { school_id: schoolId, year: 1, category: 'Operations', line_item: 'Supplies & Materials', amount: supplies, is_revenue: false },
      { school_id: schoolId, year: 1, category: 'Operations', line_item: 'Contracted Services', amount: contracted, is_revenue: false },
      { school_id: schoolId, year: 1, category: 'Operations', line_item: 'Technology', amount: technology, is_revenue: false },
      { school_id: schoolId, year: 1, category: 'Operations', line_item: 'Authorizer Fee', amount: authorizerFee, is_revenue: false },
      { school_id: schoolId, year: 1, category: 'Operations', line_item: 'Insurance', amount: insurance, is_revenue: false },
      { school_id: schoolId, year: 1, category: 'Operations', line_item: 'Misc/Contingency', amount: misc, is_revenue: false },
    ]

    await supabase.from('budget_projections').insert(projections)

    // Mark onboarding complete
    await supabase.from('school_profiles').upsert({
      school_id: schoolId,
      onboarding_complete: true,
    }, { onConflict: 'school_id' })

    setSaving(false)
    router.push('/dashboard')
  }, [schoolId, data, supabase, router])

  // Calculate total personnel cost for operations step
  const totalPersonnelCost = data.positions.reduce((sum, p) => {
    const sal = p.fte * p.salary
    return sum + sal + calcBenefits(sal)
  }, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < step
                    ? 'bg-blue-600 text-white'
                    : i === step
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i < step ? '\u2713' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        <h2 className="text-xl font-bold text-slate-800">{STEPS[step]}</h2>
      </div>

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
          onNext={saveStep2}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <StepDemographics
          enrollment={data.enrollmentY1}
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
          pctIep={data.pctIep}
          initialPositions={data.positions}
          onNext={saveStep4}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <StepOperations
          enrollment={data.enrollmentY1}
          totalPersonnelCost={totalPersonnelCost}
          initialData={data.operations}
          onComplete={completeOnboarding}
          onBack={() => setStep(3)}
          saving={saving}
        />
      )}
    </div>
  )
}
