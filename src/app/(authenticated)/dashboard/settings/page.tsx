'use client'

import { useState, useMemo, useCallback } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { createClient } from '@/lib/supabase/client'
import { calcTitleI, calcIDEA, calcLAP, calcTBIP, calcHiCap } from '@/lib/calculations'
import type { FinancialAssumptions, GradeExpansionEntry } from '@/lib/types'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'
import GradeExpansionEditor from '@/components/GradeExpansionEditor'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const REGIONS = ['Puget Sound', 'Eastern WA', 'Southwest WA', 'Olympic Peninsula', 'Central WA']
const GRADE_CONFIGS = ['K-5', 'K-8', '6-8', '6-12', '9-12', 'K-12']

export default function SettingsPage() {
  const {
    schoolData: { schoolId, schoolName, profile, gradeExpansionPlan, loading, reload },
    assumptions,
  } = useScenario()
  const supabase = createClient()

  const [name, setName] = useState(schoolName)
  const [region, setRegion] = useState(profile.region)
  const [openYear, setOpenYear] = useState(profile.planned_open_year)
  const [gradeConfig, setGradeConfig] = useState(profile.grade_config)
  const [pctFrl, setPctFrl] = useState(profile.pct_frl)
  const [pctIep, setPctIep] = useState(profile.pct_iep)
  const [pctEll, setPctEll] = useState(profile.pct_ell)
  const [pctHicap, setPctHicap] = useState(profile.pct_hicap)

  const [fa, setFa] = useState<FinancialAssumptions>({ ...assumptions })

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
    setFa({ ...DEFAULT_ASSUMPTIONS, ...(profile.financial_assumptions || {}) })
    setInitialized(true)
  }

  const grantPreview = useMemo(() => ({
    titleI: calcTitleI(enrollY1, pctFrl),
    idea: calcIDEA(enrollY1, pctIep),
    lap: calcLAP(enrollY1, pctFrl),
    tbip: calcTBIP(enrollY1, pctEll),
    hicap: calcHiCap(enrollY1, pctHicap),
  }), [enrollY1, pctFrl, pctIep, pctEll, pctHicap])

  const totalGrants = grantPreview.titleI + grantPreview.idea + grantPreview.lap + grantPreview.tbip + grantPreview.hicap

  function updateFa(field: keyof FinancialAssumptions, value: number | boolean) {
    setFa((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

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
      financial_assumptions: fa,
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
      <h1 className="text-[28px] font-semibold text-slate-900 mb-6">Settings</h1>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium animate-slide-in-right ${
          toast.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast}
        </div>
      )}

      {/* Section 1: School Profile */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">School Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">School Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">WA Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Select region...</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Planned Opening Year</label>
            <input
              type="number"
              value={openYear}
              onChange={(e) => setOpenYear(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Grade Configuration</label>
            <select
              value={gradeConfig}
              onChange={(e) => setGradeConfig(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Select grades...</option>
              {GRADE_CONFIGS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Enrollment & Demographics */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
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
            <div className="flex justify-between"><span className="text-slate-500">TBIP</span><span className="font-medium text-slate-700">{fmt(grantPreview.tbip)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">HiCap</span><span className="font-medium text-slate-700">{fmt(grantPreview.hicap)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600 font-semibold">Total</span><span className="font-bold text-slate-800">{fmt(totalGrants)}</span></div>
          </div>
        </div>
      </div>

      {/* Section: Grade Expansion Plan */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
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
                Required under RCW 28A.710.040 for WA charter schools.
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Revenue Assumptions</h2>
        <p className="text-xs text-slate-500 mb-4">Commission-aligned per-pupil rates. State apportionment uses AAFTE (Annual Average FTE).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Regular Ed per Pupil ($)</label>
            <input type="number" step={100} value={fa.regular_ed_per_pupil}
              onChange={(e) => { updateFa('regular_ed_per_pupil', Number(e.target.value)); updateFa('per_pupil_rate', Number(e.target.value)) }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">SPED per Pupil ($)</label>
            <input type="number" step={100} value={fa.sped_per_pupil}
              onChange={(e) => updateFa('sped_per_pupil', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
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
        </div>
      </div>

      {/* Section 4b: Expense Assumptions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
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
            <input type="number" step={0.5} value={fa.authorizer_fee_pct}
              onChange={(e) => updateFa('authorizer_fee_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
            <p className="text-[10px] text-slate-400 mt-0.5">Applied to state apportionment</p>
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
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

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
