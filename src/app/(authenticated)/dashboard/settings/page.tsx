'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useScenario } from '@/lib/ScenarioContext'
import { createClient } from '@/lib/supabase/client'
import { calcTitleI, calcIDEA, calcLAP, calcTBIP, calcHiCap, calcSmallSchoolEnhancement, calcSmallSchoolEnhancementFromGrades, SMALL_SCHOOL_THRESHOLDS } from '@/lib/calculations'
import type { FinancialAssumptions, GradeExpansionEntry } from '@/lib/types'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'
import { REGIONALIZATION_FACTORS } from '@/lib/regionalization'
import GradeExpansionEditor from '@/components/GradeExpansionEditor'
import TeamSection from '@/components/settings/TeamSection'
import LogoUpload from '@/components/settings/LogoUpload'
import { usePermissions } from '@/hooks/usePermissions'
import { useStateConfig } from '@/contexts/StateConfigContext'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const COUNTY_KEYS = Object.keys(REGIONALIZATION_FACTORS)
const GRADE_CONFIGS = ['K-5', 'K-8', '6-8', '6-12', '9-12', 'K-12']

export default function SettingsPage() {
  const {
    schoolData: { schoolId, schoolName, profile, gradeExpansionPlan, loading, reload },
    assumptions,
  } = useScenario()
  const supabase = createClient()
  const { canEdit, canManageTeam, canResetSchool, canEditIdentity } = usePermissions()
  const { config: pathwayConfig } = useStateConfig()
  const isWaCharter = pathwayConfig.pathway === 'wa_charter'
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [name, setName] = useState(schoolName)
  const [region, setRegion] = useState(profile.region)
  const [openYear, setOpenYear] = useState(profile.planned_open_year)
  const [gradeConfig, setGradeConfig] = useState(profile.grade_config)
  const [pctFrl, setPctFrl] = useState(profile.pct_frl)
  const [pctIep, setPctIep] = useState(profile.pct_iep)
  const [pctEll, setPctEll] = useState(profile.pct_ell)
  const [pctHicap, setPctHicap] = useState(profile.pct_hicap)
  const [logoUrl, setLogoUrl] = useState<string | null>(profile.logo_url || null)

  const [fa, setFa] = useState<FinancialAssumptions>({ ...assumptions })

  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)

  // Grade expansion state
  const [expansionData, setExpansionData] = useState<{
    openingGrades: string[]
    buildoutGrades: string[]
    retentionRate: number
    plan: GradeExpansionEntry[]
    enrollments: { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[]
  } | null>(null)

  const handleExpansionChange = useCallback((data: {
    openingGrades: string[]
    buildoutGrades: string[]
    retentionRate: number
    plan: GradeExpansionEntry[]
    enrollments: { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[]
  }) => {
    setExpansionData(data)
  }, [])

  // Fetch current user ID for team section
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [supabase])

  // Enrollment is derived from expansion plan (read-only)
  const enrollY1 = expansionData?.enrollments.find((e) => e.year === 1)?.total ?? profile.target_enrollment_y1
  const enrollY2 = expansionData?.enrollments.find((e) => e.year === 2)?.total ?? profile.target_enrollment_y2
  const enrollY3 = expansionData?.enrollments.find((e) => e.year === 3)?.total ?? profile.target_enrollment_y3
  const enrollY4 = expansionData?.enrollments.find((e) => e.year === 4)?.total ?? profile.target_enrollment_y4
  const enrollY5 = expansionData?.enrollments.find((e) => e.year === 5)?.total ?? profile.target_enrollment_y5

  // Initialize from loaded data (runs once when loading finishes)
  const [initialized, setInitialized] = useState(false)
  if (!initialized && !loading && profile.school_id) {
    setName(schoolName)
    setRegion(profile.region)
    setOpenYear(profile.planned_open_year)
    setGradeConfig(profile.grade_config)
    setPctFrl(profile.pct_frl)
    setPctIep(profile.pct_iep)
    setPctEll(profile.pct_ell)
    setPctHicap(profile.pct_hicap)
    setLogoUrl(profile.logo_url || null)
    setFa({ ...DEFAULT_ASSUMPTIONS, ...(profile.financial_assumptions || {}) })
    setInitialized(true)
  }

  const regionFactor = fa.regionalization_factor || 1.0
  const grantPreview = useMemo(() => ({
    titleI: calcTitleI(enrollY1, pctFrl, fa.title_i_per_pupil),
    idea: calcIDEA(enrollY1, pctIep, fa.idea_per_pupil),
    lap: calcLAP(enrollY1, pctFrl, fa.lap_per_pupil),
    lapHighPoverty: Math.round(enrollY1 * (fa.lap_high_poverty_per_pupil || 374)),
    tbip: calcTBIP(enrollY1, pctEll, fa.tbip_per_pupil),
    hicap: calcHiCap(enrollY1, pctHicap, fa.hicap_per_pupil),
  }), [enrollY1, pctFrl, pctIep, pctEll, pctHicap, fa, regionFactor]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalGrants = grantPreview.titleI + grantPreview.idea + grantPreview.lap + grantPreview.lapHighPoverty + grantPreview.tbip + grantPreview.hicap

  function updateFa(field: keyof FinancialAssumptions, value: number | boolean) {
    setFa((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

    // Enforce pathway-level authorizer fee lock (e.g., WA Commission contract = 3%, non-negotiable).
    const faToSave: FinancialAssumptions = pathwayConfig.authorizer_fee_editable
      ? fa
      : { ...fa, authorizer_fee_pct: pathwayConfig.authorizer_fee * 100 }

    const profileUpdate: Record<string, unknown> = {
      region,
      planned_open_year: openYear,
      grade_config: gradeConfig,
      target_enrollment_y1: enrollY1,
      target_enrollment_y2: enrollY2,
      target_enrollment_y3: enrollY3,
      target_enrollment_y4: enrollY4,
      target_enrollment_y5: enrollY5,
      pct_frl: pctFrl,
      pct_iep: pctIep,
      pct_ell: pctEll,
      pct_hicap: pctHicap,
      financial_assumptions: faToSave,
    }

    if (expansionData) {
      profileUpdate.opening_grades = expansionData.openingGrades
      profileUpdate.buildout_grades = expansionData.buildoutGrades
      profileUpdate.retention_rate = expansionData.retentionRate
    }

    const [schoolRes, profileRes] = await Promise.all([
      supabase.from('schools').update({ name }).eq('id', schoolId),
      supabase.from('school_profiles').update(profileUpdate).eq('school_id', schoolId),
    ])

    // Save grade expansion plan rows
    if (expansionData && expansionData.plan.length > 0) {
      await supabase.from('grade_expansion_plan').delete().eq('school_id', schoolId)
      const rows = expansionData.plan.map((e) => ({
        school_id: schoolId,
        year: e.year,
        grade_level: e.grade_level,
        sections: e.sections,
        students_per_section: e.students_per_section,
        is_new_grade: e.is_new_grade,
      }))
      await supabase.from('grade_expansion_plan').insert(rows)
    }

    setSaving(false)
    if (schoolRes.error || profileRes.error) {
      setToast('Error saving changes. Please try again.')
      console.error('Settings save error:', schoolRes.error, profileRes.error)
    } else {
      setToast('Settings saved successfully.')
      await reload()
      setTimeout(() => setToast(null), 3000)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div className="max-w-3xl animate-fade-in">
      <h1 data-tour="settings-header" className="text-[28px] font-semibold text-slate-900 mb-6">Settings</h1>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium animate-slide-in-right ${
          toast.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast}
        </div>
      )}

      {!canEdit && (
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
          You have view-only access. Contact the school owner to request edit permissions.
        </div>
      )}

      {/* Section 1: School Profile */}
      <div data-tour="school-profile" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">School Profile</h2>
        {schoolId && (
          <LogoUpload
            schoolId={schoolId}
            schoolName={name}
            logoUrl={logoUrl}
            canEdit={canEditIdentity}
            onUpdate={(url) => setLogoUrl(url)}
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">School Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditIdentity}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
          {isWaCharter && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">WA County / Region</label>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value)
                  const factor = REGIONALIZATION_FACTORS[e.target.value]?.factor ?? 1.0
                  updateFa('regionalization_factor', factor)
                }}
                disabled={!canEditIdentity}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600"
              >
                <option value="">Select county...</option>
                {COUNTY_KEYS.map((key) => <option key={key} value={key}>{REGIONALIZATION_FACTORS[key].label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Planned Opening Year</label>
            <input
              type="number"
              value={openYear}
              onChange={(e) => setOpenYear(Number(e.target.value))}
              disabled={!canEditIdentity}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Grade Configuration</label>
            <select
              value={gradeConfig}
              onChange={(e) => setGradeConfig(e.target.value)}
              disabled={!canEditIdentity}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600"
            >
              <option value="">Select grades...</option>
              {GRADE_CONFIGS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section: Team Members (CEO only) */}
      {canManageTeam && schoolId && currentUserId && (
        <TeamSection schoolId={schoolId} currentUserId={currentUserId} />
      )}

      {/* Section 2: Enrollment & Demographics */}
      <div data-tour="enrollment-demographics" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Enrollment & Demographics</h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-2">
          {[
            { label: 'Year 1', value: enrollY1 },
            { label: 'Year 2', value: enrollY2 },
            { label: 'Year 3', value: enrollY3 },
            { label: 'Year 4', value: enrollY4 },
            { label: 'Year 5', value: enrollY5 },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{label} Enrollment</label>
              <input type="number" value={value} readOnly tabIndex={-1}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600 cursor-default" />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mb-6">Enrollment is calculated from your Grade Expansion Plan below.</p>

        <div className="space-y-4">
          {[
            { label: '% Free/Reduced Lunch', value: pctFrl, set: setPctFrl },
            { label: '% IEP', value: pctIep, set: setPctIep },
            { label: '% ELL', value: pctEll, set: setPctEll },
            { label: '% Highly Capable', value: pctHicap, set: setPctHicap },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                <span>{label}</span>
                <span>{value}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={1} value={value}
                onChange={(e) => set(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
          ))}
        </div>

        {/* Grant preview */}
        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Estimated Categorical Grants (Year 1)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Title I</span><span className="font-medium text-slate-700">{fmt(grantPreview.titleI)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">IDEA</span><span className="font-medium text-slate-700">{fmt(grantPreview.idea)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">LAP</span><span className="font-medium text-slate-700">{fmt(grantPreview.lap)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">LAP High Poverty</span><span className="font-medium text-slate-700">{fmt(grantPreview.lapHighPoverty)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">TBIP</span><span className="font-medium text-slate-700">{fmt(grantPreview.tbip)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">HiCap</span><span className="font-medium text-slate-700">{fmt(grantPreview.hicap)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600 font-semibold">Total</span><span className="font-bold text-slate-800">{fmt(totalGrants)}</span></div>
          </div>
        </div>
      </div>

      {/* Section: Grade Expansion Plan */}
      <div data-tour="grade-expansion" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Grade Expansion Plan</h2>
        <p className="text-xs text-slate-500 mb-4">
          Define which grade levels you open with and how you expand year over year. This produces cohort-based enrollment projections that authorizers find more credible than flat growth rates.
        </p>
        <GradeExpansionEditor
          gradeConfig={gradeConfig}
          maxClassSize={profile.max_class_size}
          initialOpeningGrades={profile.opening_grades || undefined}
          initialBuildoutGrades={profile.buildout_grades || undefined}
          initialRetentionRate={profile.retention_rate ?? undefined}
          initialPlan={gradeExpansionPlan}
          onChange={handleExpansionChange}
        />
      </div>

      {/* Section 3: Programs */}
      <div data-tour="programs-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Programs</h2>
        <p className="text-xs text-slate-500 mb-4">
          Toggle programs your school plans to offer. Enabling a program adds its line item to the Operations budget.
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <div className="text-sm font-medium text-slate-800">Food Service</div>
              <div className="text-xs text-slate-500">
                Adds {fmt(fa.food_service_per_student)}/student to operations.
                Schools with high FRL% may qualify for USDA NSLP reimbursement (CEP).
              </div>
            </div>
            <button
              onClick={() => updateFa('food_service_offered', !fa.food_service_offered)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                fa.food_service_offered ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                fa.food_service_offered ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <div className="text-sm font-medium text-slate-800">Transportation</div>
              <div className="text-xs text-slate-500">
                Adds {fmt(fa.transportation_per_student)}/student to operations.
                {isWaCharter && 'Required under RCW 28A.710.040 for WA charter schools.'}
              </div>
            </div>
            <button
              onClick={() => updateFa('transportation_offered', !fa.transportation_offered)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                fa.transportation_offered ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                fa.transportation_offered ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Section 4: Revenue Assumptions */}
      <div data-tour="revenue-assumptions" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Revenue Assumptions</h2>
        <p className="text-xs text-slate-500 mb-4">{isWaCharter ? 'Commission-aligned per-pupil rates. State apportionment uses AAFTE (Annual Average FTE).' : 'Revenue rates and escalation settings for your financial projections.'}</p>

        {/* Tuition settings for private/micro pathways */}
        {!isWaCharter && pathwayConfig.revenue_model === 'tuition' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Annual Tuition Per Student ($)</label>
              <input type="number" step={500} defaultValue={(profile as unknown as Record<string, unknown>).tuition_rate as number || pathwayConfig.tuition_rate_default || 0}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Financial Aid Discount (%)</label>
              <input type="number" step={1} min={0} max={100} defaultValue={((profile as unknown as Record<string, unknown>).financial_aid_pct as number || pathwayConfig.financial_aid_pct_default || 0) * 100}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Regular Ed per Pupil ($)</label>
            <input type="number" step={100} value={fa.regular_ed_per_pupil}
              onChange={(e) => { updateFa('regular_ed_per_pupil', Number(e.target.value)); updateFa('per_pupil_rate', Number(e.target.value)) }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">SPED Apportionment per Pupil ($)</label>
            <input type="number" step={100} value={fa.sped_per_pupil}
              onChange={(e) => updateFa('sped_per_pupil', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">Excess cost allocation per SPED student</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">State Special Ed per Pupil ($)</label>
            <input type="number" step={100} value={fa.state_sped_per_pupil}
              onChange={(e) => updateFa('state_sped_per_pupil', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">State safety net / BEA allocation per SPED student — largest SPED revenue source</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">LAP High Poverty per Student ($)</label>
            <input type="number" step={10} value={fa.lap_high_poverty_per_pupil}
              onChange={(e) => updateFa('lap_high_poverty_per_pupil', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">Flat per-student amount, not FRL-dependent</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Facilities per Pupil ($)</label>
            <input type="number" step={100} value={fa.facilities_per_pupil}
              onChange={(e) => updateFa('facilities_per_pupil', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">Usually $0 for WA charters</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Levy Equity per Student ($)</label>
            <input type="number" step={100} value={fa.levy_equity_per_student}
              onChange={(e) => updateFa('levy_equity_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">$0 — WA legislature has not reinstated levy equity funding</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Revenue COLA (%)</label>
            <input type="number" step={0.5} value={fa.revenue_cola_pct}
              onChange={(e) => updateFa('revenue_cola_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">Annual per-pupil rate escalation</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">AAFTE % of Headcount</label>
            <input type="number" step={1} min={80} max={100} value={fa.aafte_pct}
              onChange={(e) => updateFa('aafte_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">Typical: 95%. State revenue uses AAFTE, not headcount.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Regionalization Factor</label>
            <input type="number" step={0.001} min={1.0} max={1.3} value={fa.regionalization_factor}
              onChange={(e) => updateFa('regionalization_factor', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Set automatically from your county but can be overridden if you know your district&apos;s exact factor.
              Multiplies state per-pupil rates (Regular Ed, SPED, LAP, TBIP, HiCap).
            </p>
          </div>
        </div>
      </div>

      {/* Section 4a: Small School Enhancement Thresholds */}
      {(() => {
        const gep = gradeExpansionPlan
        const sseAmount = gep && gep.length > 0
          ? calcSmallSchoolEnhancement(gep, 1, fa.aafte_pct, fa.regular_ed_per_pupil, fa.regionalization_factor || 1.0, 1, fa.revenue_cola_pct)
          : calcSmallSchoolEnhancementFromGrades(profile.target_enrollment_y1, profile.opening_grades || [], fa.aafte_pct, fa.regular_ed_per_pupil, fa.regionalization_factor || 1.0)
        const qualifies = sseAmount > 0
        return (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Small School Enhancement Thresholds</h2>
            <p className="text-xs text-slate-500 mb-4">WA prototypical school funding model minimum AAFTE by grade band. Schools below these thresholds receive additional state funding.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">K-6 Minimum (Elementary)</label>
                <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600">{SMALL_SCHOOL_THRESHOLDS.k6} AAFTE</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">7-8 Minimum (Middle)</label>
                <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600">{SMALL_SCHOOL_THRESHOLDS.ms} AAFTE</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">9-12 Minimum (High)</label>
                <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600">{SMALL_SCHOOL_THRESHOLDS.hs} AAFTE</div>
              </div>
            </div>
            <div className={`rounded-lg px-4 py-3 text-sm ${qualifies ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
              {qualifies
                ? <>Your school <strong>qualifies</strong> for small school enhancement in Year 1 ({fmt(sseAmount)})</>
                : <>Your school <strong>does not qualify</strong> for small school enhancement in Year 1 — all grade bands exceed their minimums</>
              }
            </div>
          </div>
        )
      })()}

      {/* Section 4b: Expense Assumptions */}
      <div data-tour="expense-assumptions" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Expense Assumptions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Benefits Load (%)</label>
            <input type="number" step={1} value={fa.benefits_load_pct}
              onChange={(e) => updateFa('benefits_load_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Authorizer Fee (%)</label>
            {pathwayConfig.authorizer_fee_editable ? (
              <>
                <input type="number" step={0.5} value={fa.authorizer_fee_pct}
                  onChange={(e) => updateFa('authorizer_fee_pct', Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                <p className="text-[10px] text-slate-400 mt-0.5">Applied to state apportionment</p>
              </>
            ) : (
              <>
                <input type="number" value={(pathwayConfig.authorizer_fee * 100).toFixed(1)} disabled
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isWaCharter ? 'Fixed at 3% by WA Charter School Commission contract.' : 'Fixed by authorizer.'} Applied to state apportionment.
                </p>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Annual Salary Escalator (%)</label>
            <input type="number" step={0.1} value={fa.salary_escalator_pct}
              onChange={(e) => updateFa('salary_escalator_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Annual Operations Escalator (%)</label>
            <input type="number" step={0.1} value={fa.ops_escalator_pct}
              onChange={(e) => updateFa('ops_escalator_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Interest Rate on Cash (%)</label>
            <input type="number" step={0.5} value={fa.interest_rate_on_cash}
              onChange={(e) => updateFa('interest_rate_on_cash', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {/* Section 5: Operations Benchmarks */}
      <div data-tour="operations-benchmarks" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Operations Benchmarks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Supplies per Student ($)</label>
            <input type="number" step={10} value={fa.supplies_per_student}
              onChange={(e) => updateFa('supplies_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Contracted Services per Student ($)</label>
            <input type="number" step={10} value={fa.contracted_services_per_student}
              onChange={(e) => updateFa('contracted_services_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Technology per Student ($)</label>
            <input type="number" step={10} value={fa.technology_per_student}
              onChange={(e) => updateFa('technology_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Insurance Annual ($)</label>
            <input type="number" step={1000} value={fa.insurance_annual}
              onChange={(e) => updateFa('insurance_annual', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Contingency % of Total Expenses</label>
            <input type="number" step={0.5} value={fa.contingency_pct}
              onChange={(e) => updateFa('contingency_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Curriculum per Student ($)</label>
            <input type="number" step={50} value={fa.curriculum_per_student}
              onChange={(e) => updateFa('curriculum_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Professional Development per FTE ($)</label>
            <input type="number" step={100} value={fa.professional_development_per_fte}
              onChange={(e) => updateFa('professional_development_per_fte', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Food Service per Student ($)</label>
            <input type="number" step={50} value={fa.food_service_per_student}
              onChange={(e) => updateFa('food_service_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Transportation per Student ($)</label>
            <input type="number" step={50} value={fa.transportation_per_student}
              onChange={(e) => updateFa('transportation_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          {fa.food_service_offered && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Food Service Revenue per Student ($)</label>
              <input type="number" step={10} value={fa.food_service_revenue_per_pupil || 710}
                onChange={(e) => updateFa('food_service_revenue_per_pupil', Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              <p className="text-[10px] text-slate-400 mt-0.5">NSLP reimbursement estimate. Schools with 60%+ FRL may receive $750-$900/student.</p>
            </div>
          )}
          {fa.transportation_offered && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Transportation Revenue per Student ($)</label>
              <input type="number" step={10} value={fa.transportation_revenue_per_pupil || 560}
                onChange={(e) => updateFa('transportation_revenue_per_pupil', Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              <p className="text-[10px] text-slate-400 mt-0.5">State allocation estimate. Rural: $700-$1,000; urban: $500-$800.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Marketing per Student ($)</label>
            <input type="number" step={10} value={fa.marketing_per_student}
              onChange={(e) => updateFa('marketing_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fundraising Annual ($)</label>
            <input type="number" step={1000} value={fa.fundraising_annual}
              onChange={(e) => updateFa('fundraising_annual', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {canEdit && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      )}

      {/* Danger Zone — CEO only */}
      {canResetSchool && (
        <>
        <div className="mt-12 border border-red-200 rounded-xl p-6 bg-red-50/50">
          <h2 className="text-xs font-medium text-red-500 uppercase tracking-wide mb-2">Danger Zone</h2>
          <p className="text-sm text-slate-600 mb-4">
            Reset all school planning data and restart the onboarding process from scratch. Your account and school record will be preserved.
          </p>
          <button
            onClick={() => setShowResetModal(true)}
            className="px-5 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            Reset School &amp; Start Over
          </button>
        </div>

        {/* Reset confirmation modal */}
        {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Reset School Data</h3>
            <p className="text-sm text-slate-600 mb-4">
              This will permanently delete all your school&apos;s financial data and restart the onboarding process. This cannot be undone.
            </p>
            <p className="text-sm text-slate-700 mb-2">
              Type <span className="font-semibold">{schoolName}</span> to confirm:
            </p>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="School name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowResetModal(false); setResetConfirmText('') }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={resetConfirmText !== schoolName || resetting}
                onClick={async () => {
                  setResetting(true)
                  try {
                    const res = await fetch('/api/settings/reset-school', { method: 'POST' })
                    if (!res.ok) {
                      const body = await res.json()
                      throw new Error(body.error || 'Reset failed')
                    }
                    router.push('/onboarding')
                  } catch (err) {
                    setResetting(false)
                    setShowResetModal(false)
                    setResetConfirmText('')
                    setToast(`Error: ${err instanceof Error ? err.message : 'Reset failed'}`)
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetting...' : 'Permanently Reset'}
              </button>
            </div>
          </div>
        </div>
        )}
        </>
      )}
    </div>
  )
}
