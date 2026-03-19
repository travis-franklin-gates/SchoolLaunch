'use client'

import { useState, useMemo } from 'react'
import { calcCommissionRevenue } from '@/lib/calculations'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'

const REGIONAL_DEFAULTS: Record<string, { frl: number; iep: number; ell: number; hicap: number }> = {
  'King County': { frl: 35, iep: 14, ell: 15, hicap: 7 },
  'Pierce County': { frl: 50, iep: 13, ell: 10, hicap: 5 },
  'Snohomish County': { frl: 40, iep: 13, ell: 12, hicap: 6 },
  'Spokane County': { frl: 55, iep: 14, ell: 8, hicap: 4 },
  'Clark County': { frl: 45, iep: 13, ell: 9, hicap: 5 },
  'Other': { frl: 50, iep: 13, ell: 10, hicap: 5 },
}

interface Props {
  enrollment: number
  region: string
  initialData: {
    pctFrl: number
    pctIep: number
    pctEll: number
    pctHicap: number
  }
  onNext: (data: { pctFrl: number; pctIep: number; pctEll: number; pctHicap: number }) => void
  onBack: () => void
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function StepDemographics({ enrollment, region, initialData, onNext, onBack }: Props) {
  const [pctFrl, setPctFrl] = useState(initialData.pctFrl ?? 50)
  const [pctIep, setPctIep] = useState(initialData.pctIep ?? 12)
  const [pctEll, setPctEll] = useState(initialData.pctEll ?? 10)
  const [pctHicap, setPctHicap] = useState(initialData.pctHicap ?? 5)
  const [showRegionalHint, setShowRegionalHint] = useState(false)

  const regionDefaults = REGIONAL_DEFAULTS[region] || REGIONAL_DEFAULTS['Other']

  const rev = useMemo(
    () => calcCommissionRevenue(enrollment, pctFrl, pctIep, pctEll, pctHicap, DEFAULT_ASSUMPTIONS),
    [enrollment, pctFrl, pctIep, pctEll, pctHicap]
  )

  const grants = { titleI: rev.titleI, idea: rev.idea, lap: rev.lap, tbip: rev.tbip, hicap: rev.hicap }
  const totalGrants = grants.titleI + grants.idea + grants.lap + grants.tbip + grants.hicap
  const baseRevenue = rev.regularEd + rev.sped + rev.facilitiesRev + rev.levyEquity
  const totalRevenue = rev.total
  const grantPct = totalRevenue > 0 ? ((totalGrants / totalRevenue) * 100).toFixed(1) : '0'

  function applyRegionalDefaults() {
    setPctFrl(regionDefaults.frl)
    setPctIep(regionDefaults.iep)
    setPctEll(regionDefaults.ell)
    setPctHicap(regionDefaults.hicap)
    setShowRegionalHint(false)
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    onNext({ pctFrl, pctIep, pctEll, pctHicap })
  }

  const titleIWarning = pctFrl > 0 && pctFrl <= 40
  const highIep = pctIep > 18

  return (
    <form onSubmit={handleNext} className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500 max-w-md">
          Student demographics determine categorical grant eligibility. Use your community assessment data or start with regional averages.
        </p>
        <button
          type="button"
          onClick={() => setShowRegionalHint(!showRegionalHint)}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap ml-4"
        >
          Use {region} defaults
        </button>
      </div>

      {showRegionalHint && (
        <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
          <p className="text-sm text-teal-800 mb-2">
            Regional averages for <span className="font-medium">{region}</span>:
          </p>
          <div className="grid grid-cols-4 gap-3 text-xs text-teal-700 mb-3">
            <div>FRL: {regionDefaults.frl}%</div>
            <div>IEP: {regionDefaults.iep}%</div>
            <div>ELL: {regionDefaults.ell}%</div>
            <div>HiCap: {regionDefaults.hicap}%</div>
          </div>
          <button
            type="button"
            onClick={applyRegionalDefaults}
            className="text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Apply These Defaults
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <SliderField
            label="Free/Reduced Lunch"
            value={pctFrl}
            onChange={setPctFrl}
            min={0}
            max={100}
            regional={regionDefaults.frl}
          />
          <SliderField
            label="Students with IEPs"
            value={pctIep}
            onChange={setPctIep}
            min={0}
            max={100}
            regional={regionDefaults.iep}
          />
          <SliderField
            label="English Language Learners"
            value={pctEll}
            onChange={setPctEll}
            min={0}
            max={60}
            regional={regionDefaults.ell}
          />
          <SliderField
            label="Highly Capable"
            value={pctHicap}
            onChange={setPctHicap}
            min={0}
            max={15}
            regional={regionDefaults.hicap}
          />
        </div>

        <div>
          <div className="bg-slate-50 rounded-xl p-5 sticky top-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Estimated Categorical Grant Awards</h3>
            <p className="text-xs text-slate-400 mb-4">Based on {enrollment} students</p>
            <div className="space-y-3">
              <GrantRow label="Title I" value={grants.titleI} note={pctFrl <= 40 ? '(requires >40% FRL)' : undefined} />
              <GrantRow label="IDEA (Special Education)" value={grants.idea} />
              <GrantRow label="LAP (Learning Assistance)" value={grants.lap} />
              <GrantRow label="TBIP (Bilingual)" value={grants.tbip} />
              <GrantRow label="Highly Capable" value={grants.hicap} />
              <div className="border-t border-slate-200 pt-3 mt-3">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Total Estimated Grants</span>
                  <span>{fmt(totalGrants)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Grants = {grantPct}% of total revenue
                </p>
              </div>
            </div>

            {/* Compliance callouts */}
            {titleIWarning && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700">
                  FRL at {pctFrl}% — just below the 40% Title I threshold. A small increase unlocks {fmt(Math.round(enrollment * (pctFrl / 100) * 880))}.
                </p>
              </div>
            )}
            {highIep && (
              <div className="mt-4 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                <p className="text-xs text-teal-700">
                  IEP at {pctIep}% — above typical ({regionDefaults.iep}%). Budget for additional special education staff and contracted services.
                </p>
              </div>
            )}

            <p className="text-xs text-slate-400 mt-4 italic">These are estimates only. Actual awards vary.</p>
          </div>
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

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  regional,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  regional: number
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-semibold text-slate-800">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-600"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min}%</span>
        <span className="text-slate-400">Regional avg: {regional}%</span>
        <span>{max}%</span>
      </div>
    </div>
  )
}

function GrantRow({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-600">
        {label}
        {note && <span className="text-xs text-slate-400 ml-1">{note}</span>}
      </span>
      <span className={`font-medium ${value > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
        {fmt(value)}
      </span>
    </div>
  )
}
