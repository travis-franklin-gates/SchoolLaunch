'use client'

import { useState, useMemo } from 'react'
import { calcAllGrants } from '@/lib/calculations'

interface Props {
  enrollment: number
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

export default function StepDemographics({ enrollment, initialData, onNext, onBack }: Props) {
  const [pctFrl, setPctFrl] = useState(initialData.pctFrl || 50)
  const [pctIep, setPctIep] = useState(initialData.pctIep || 12)
  const [pctEll, setPctEll] = useState(initialData.pctEll || 10)
  const [pctHicap, setPctHicap] = useState(initialData.pctHicap || 5)

  const grants = useMemo(
    () => calcAllGrants(enrollment, pctFrl, pctIep, pctEll, pctHicap),
    [enrollment, pctFrl, pctIep, pctEll, pctHicap]
  )

  const totalGrants = grants.titleI + grants.idea + grants.lap + grants.tbip + grants.hicap

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    onNext({ pctFrl, pctIep, pctEll, pctHicap })
  }

  return (
    <form onSubmit={handleNext} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <SliderField
            label="Free/Reduced Lunch"
            value={pctFrl}
            onChange={setPctFrl}
            min={0}
            max={100}
          />
          <SliderField
            label="Students with IEPs"
            value={pctIep}
            onChange={setPctIep}
            min={0}
            max={30}
          />
          <SliderField
            label="English Language Learners"
            value={pctEll}
            onChange={setPctEll}
            min={0}
            max={40}
          />
          <SliderField
            label="Highly Capable"
            value={pctHicap}
            onChange={setPctHicap}
            min={0}
            max={15}
          />
        </div>

        <div className="bg-slate-50 rounded-xl p-5">
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
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 italic">These are estimates only. Actual awards vary.</p>
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
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Next
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
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
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
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min}%</span>
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
