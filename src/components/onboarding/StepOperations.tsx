'use client'

import { useState, useMemo } from 'react'
import { calcAuthorizerFee, calcRevenue } from '@/lib/calculations'

interface OperationsData {
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

interface Props {
  enrollment: number
  totalPersonnelCost: number
  initialData: OperationsData
  onComplete: (data: OperationsData) => void
  onBack: () => void
  saving: boolean
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export const defaultOperationsData: OperationsData = {
  facilityMode: 'flat',
  facilitySqft: 15000,
  facilityCostPerSqft: 18,
  facilityMonthly: 15000,
  suppliesPerPupil: 200,
  contractedPerPupil: 150,
  technologyPerPupil: 180,
  foodProgram: false,
  insurance: 18000,
  miscPct: 2,
}

export default function StepOperations({ enrollment, totalPersonnelCost, initialData, onComplete, onBack, saving }: Props) {
  const [data, setData] = useState<OperationsData>(initialData)

  const apportionment = calcRevenue(enrollment)
  const authorizerFee = calcAuthorizerFee(enrollment)

  const costs = useMemo(() => {
    const facility = data.facilityMode === 'sqft'
      ? data.facilitySqft * data.facilityCostPerSqft
      : data.facilityMonthly * 12
    const supplies = data.suppliesPerPupil * enrollment
    const contracted = data.contractedPerPupil * enrollment
    const technology = data.technologyPerPupil * enrollment
    const subtotal = facility + supplies + contracted + technology + authorizerFee + data.insurance + totalPersonnelCost
    const misc = Math.round(subtotal * (data.miscPct / 100))
    return { facility, supplies, contracted, technology, authorizerFee, insurance: data.insurance, misc }
  }, [data, enrollment, authorizerFee, totalPersonnelCost])

  const totalOps = costs.facility + costs.supplies + costs.contracted + costs.technology + costs.authorizerFee + costs.insurance + costs.misc

  function update<K extends keyof OperationsData>(key: K, value: OperationsData[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onComplete(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Facilities */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Facilities</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update('facilityMode', 'sqft')}
              className={`text-xs px-3 py-1 rounded-lg ${data.facilityMode === 'sqft' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Sq Footage
            </button>
            <button
              type="button"
              onClick={() => update('facilityMode', 'flat')}
              className={`text-xs px-3 py-1 rounded-lg ${data.facilityMode === 'flat' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Flat Monthly
            </button>
          </div>
        </div>

        {data.facilityMode === 'sqft' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Square Footage</label>
              <input
                type="number"
                value={data.facilitySqft}
                onChange={(e) => update('facilitySqft', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">$/sqft/yr</label>
              <input
                type="number"
                value={data.facilityCostPerSqft}
                onChange={(e) => update('facilityCostPerSqft', Number(e.target.value))}
                step={0.5}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Monthly Lease Amount</label>
            <input
              type="number"
              value={data.facilityMonthly}
              onChange={(e) => update('facilityMonthly', Number(e.target.value))}
              step={500}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
        <p className="text-xs text-slate-400 mt-2">Annual: {fmt(costs.facility)}</p>
      </div>

      {/* Per-pupil items */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PerPupilField
          label="Supplies & Materials"
          value={data.suppliesPerPupil}
          onChange={(v) => update('suppliesPerPupil', v)}
          benchmark={200}
          enrollment={enrollment}
        />
        <PerPupilField
          label="Contracted Services"
          value={data.contractedPerPupil}
          onChange={(v) => update('contractedPerPupil', v)}
          benchmark={150}
          enrollment={enrollment}
          note="SpEd may be higher"
        />
        <PerPupilField
          label="Technology"
          value={data.technologyPerPupil}
          onChange={(v) => update('technologyPerPupil', v)}
          benchmark={180}
          enrollment={enrollment}
        />
      </div>

      {/* Food program */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <input
          type="checkbox"
          id="foodProgram"
          checked={data.foodProgram}
          onChange={(e) => update('foodProgram', e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
        <div>
          <label htmlFor="foodProgram" className="text-sm font-medium text-slate-700">Food Program</label>
          <p className="text-xs text-slate-400">If enabled, assumes net neutral (federal reimbursement offsets cost)</p>
        </div>
      </div>

      {/* Authorizer fee */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-slate-700">Authorizer Fee (3%)</p>
            <p className="text-xs text-slate-400">3% of state apportionment ({fmt(apportionment)})</p>
          </div>
          <p className="text-sm font-semibold text-slate-800">{fmt(costs.authorizerFee)}</p>
        </div>
      </div>

      {/* Insurance */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Insurance (Annual)</label>
        <input
          type="number"
          value={data.insurance}
          onChange={(e) => update('insurance', Number(e.target.value))}
          step={1000}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-xs"
        />
      </div>

      {/* Misc */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Misc/Contingency (% of total expenses)</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={data.miscPct}
            onChange={(e) => update('miscPct', Number(e.target.value))}
            min={0}
            max={10}
            step={0.5}
            className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-500">= {fmt(costs.misc)}</span>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs text-slate-500">Total Operations Cost</p>
        <p className="text-lg font-semibold text-slate-800">{fmt(totalOps)}</p>
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
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Complete Onboarding'}
        </button>
      </div>
    </form>
  )
}

function PerPupilField({
  label,
  value,
  onChange,
  benchmark,
  enrollment,
  note,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  benchmark: number
  enrollment: number
  note?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={10}
          className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-slate-400 text-sm whitespace-nowrap">/pupil</span>
      </div>
      <p className="text-xs text-slate-400 mt-1">
        Benchmark: ${benchmark}/pupil | Total: {fmt(value * enrollment)}
      </p>
      {note && <p className="text-xs text-slate-400 italic">{note}</p>}
    </div>
  )
}
