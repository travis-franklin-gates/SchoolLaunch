'use client'

import { useState, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { createClient } from '@/lib/supabase/client'
import { calcTitleI, calcIDEA, calcLAP, calcTBIP, calcHiCap } from '@/lib/calculations'
import type { FinancialAssumptions } from '@/lib/types'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const REGIONS = ['Puget Sound', 'Eastern WA', 'Southwest WA', 'Olympic Peninsula', 'Central WA']
const GRADE_CONFIGS = ['K-5', 'K-8', '6-8', '6-12', '9-12', 'K-12']

export default function SettingsPage() {
  const {
    schoolData: { schoolId, schoolName, profile, loading, reload },
    assumptions,
  } = useScenario()
  const supabase = createClient()

  const [name, setName] = useState(schoolName)
  const [region, setRegion] = useState(profile.region)
  const [openYear, setOpenYear] = useState(profile.planned_open_year)
  const [gradeConfig, setGradeConfig] = useState(profile.grade_config)
  const [enrollY1, setEnrollY1] = useState(profile.target_enrollment_y1)
  const [enrollY2, setEnrollY2] = useState(profile.target_enrollment_y2)
  const [enrollY3, setEnrollY3] = useState(profile.target_enrollment_y3)
  const [enrollY4, setEnrollY4] = useState(profile.target_enrollment_y4)
  const [pctFrl, setPctFrl] = useState(profile.pct_frl)
  const [pctIep, setPctIep] = useState(profile.pct_iep)
  const [pctEll, setPctEll] = useState(profile.pct_ell)
  const [pctHicap, setPctHicap] = useState(profile.pct_hicap)

  const [fa, setFa] = useState<FinancialAssumptions>({ ...assumptions })

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Initialize from loaded data (runs once when loading finishes)
  const [initialized, setInitialized] = useState(false)
  if (!initialized && !loading && profile.school_id) {
    setName(schoolName)
    setRegion(profile.region)
    setOpenYear(profile.planned_open_year)
    setGradeConfig(profile.grade_config)
    setEnrollY1(profile.target_enrollment_y1)
    setEnrollY2(profile.target_enrollment_y2)
    setEnrollY3(profile.target_enrollment_y3)
    setEnrollY4(profile.target_enrollment_y4)
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

  function updateFa(field: keyof FinancialAssumptions, value: number) {
    setFa((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

    const [schoolRes, profileRes] = await Promise.all([
      supabase.from('schools').update({ name }).eq('id', schoolId),
      supabase.from('school_profiles').update({
        region,
        planned_open_year: openYear,
        grade_config: gradeConfig,
        target_enrollment_y1: enrollY1,
        target_enrollment_y2: enrollY2,
        target_enrollment_y3: enrollY3,
        target_enrollment_y4: enrollY4,
        pct_frl: pctFrl,
        pct_iep: pctIep,
        pct_ell: pctEll,
        pct_hicap: pctHicap,
        financial_assumptions: fa,
      }).eq('school_id', schoolId),
    ])

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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast}
        </div>
      )}

      {/* Section 1: School Profile */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">School Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">School Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">WA Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Grade Configuration</label>
            <select
              value={gradeConfig}
              onChange={(e) => setGradeConfig(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select grades...</option>
              {GRADE_CONFIGS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Enrollment & Demographics */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Enrollment & Demographics</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year 1 Enrollment</label>
            <input type="number" value={enrollY1} onChange={(e) => setEnrollY1(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year 2 Enrollment</label>
            <input type="number" value={enrollY2} onChange={(e) => setEnrollY2(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year 3 Enrollment</label>
            <input type="number" value={enrollY3} onChange={(e) => setEnrollY3(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year 4 Enrollment</label>
            <input type="number" value={enrollY4} onChange={(e) => setEnrollY4(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

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
                className="w-full accent-blue-600"
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

      {/* Section 3: Financial Assumptions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Financial Assumptions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Per-Pupil Funding Rate ($)</label>
            <input type="number" step={100} value={fa.per_pupil_rate}
              onChange={(e) => updateFa('per_pupil_rate', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Levy Equity per Student ($)</label>
            <input type="number" step={100} value={fa.levy_equity_per_student}
              onChange={(e) => updateFa('levy_equity_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Benefits Load (%)</label>
            <input type="number" step={1} value={fa.benefits_load_pct}
              onChange={(e) => updateFa('benefits_load_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Authorizer Fee (%)</label>
            <input type="number" step={0.5} value={fa.authorizer_fee_pct}
              onChange={(e) => updateFa('authorizer_fee_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Annual Salary Escalator (%)</label>
            <input type="number" step={0.1} value={fa.salary_escalator_pct}
              onChange={(e) => updateFa('salary_escalator_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Annual Operations Escalator (%)</label>
            <input type="number" step={0.1} value={fa.ops_escalator_pct}
              onChange={(e) => updateFa('ops_escalator_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* Section 4: Operations Benchmarks */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Operations Benchmarks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Supplies per Student ($)</label>
            <input type="number" step={10} value={fa.supplies_per_student}
              onChange={(e) => updateFa('supplies_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Contracted Services per Student ($)</label>
            <input type="number" step={10} value={fa.contracted_services_per_student}
              onChange={(e) => updateFa('contracted_services_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Technology per Student ($)</label>
            <input type="number" step={10} value={fa.technology_per_student}
              onChange={(e) => updateFa('technology_per_student', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Insurance Annual ($)</label>
            <input type="number" step={1000} value={fa.insurance_annual}
              onChange={(e) => updateFa('insurance_annual', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Contingency % of Total Expenses</label>
            <input type="number" step={0.5} value={fa.contingency_pct}
              onChange={(e) => updateFa('contingency_pct', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
