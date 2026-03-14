'use client'

import { useState, useMemo } from 'react'
import { calcCommissionRevenue, calcAuthorizerFeeCommission } from '@/lib/calculations'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'
import type { StartupFundingSource } from '@/lib/types'

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
  pctFrl: number
  pctIep: number
  pctEll: number
  pctHicap: number
  initialData: OperationsData
  startupFunding: StartupFundingSource[]
  onComplete: (data: OperationsData, funding: StartupFundingSource[]) => void
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

const DEFAULT_STARTUP_SOURCES: StartupFundingSource[] = [
  { source: 'Federal CSP Grant', amount: 0, type: 'grant', status: 'projected' },
]

let fundingKeyCounter = 0
function nextFundingKey() {
  return `fund-${++fundingKeyCounter}`
}

interface FundingRow extends StartupFundingSource {
  key: string
}

export default function StepOperations({
  enrollment,
  totalPersonnelCost,
  pctFrl,
  pctIep,
  pctEll,
  pctHicap,
  initialData,
  startupFunding,
  onComplete,
  onBack,
  saving,
}: Props) {
  // Only expose facility mode, facility inputs, and food program to the user.
  // All other fields keep their defaults silently.
  const [facilityMode, setFacilityMode] = useState(initialData.facilityMode)
  const [facilitySqft, setFacilitySqft] = useState(initialData.facilitySqft)
  const [facilityCostPerSqft, setFacilityCostPerSqft] = useState(initialData.facilityCostPerSqft)
  const [facilityMonthly, setFacilityMonthly] = useState(initialData.facilityMonthly)
  const [foodProgram, setFoodProgram] = useState(initialData.foodProgram)

  const [funding, setFunding] = useState<FundingRow[]>(
    (startupFunding.length > 0 ? startupFunding : DEFAULT_STARTUP_SOURCES).map((f) => ({
      ...f,
      key: nextFundingKey(),
    }))
  )

  const rev = calcCommissionRevenue(enrollment, pctFrl, pctIep, pctEll, pctHicap, DEFAULT_ASSUMPTIONS)
  const stateApport = rev.regularEd + rev.sped + rev.facilitiesRev
  const authorizerFee = calcAuthorizerFeeCommission(stateApport)
  const totalRevenue = rev.total

  const costs = useMemo(() => {
    const facility = facilityMode === 'sqft'
      ? facilitySqft * facilityCostPerSqft
      : facilityMonthly * 12
    const supplies = defaultOperationsData.suppliesPerPupil * enrollment
    const contracted = defaultOperationsData.contractedPerPupil * enrollment
    const technology = defaultOperationsData.technologyPerPupil * enrollment
    const insurance = defaultOperationsData.insurance
    const subtotal = facility + supplies + contracted + technology + authorizerFee + insurance + totalPersonnelCost
    const misc = Math.round(subtotal * (defaultOperationsData.miscPct / 100))
    return { facility, supplies, contracted, technology, authorizerFee, insurance, misc }
  }, [facilityMode, facilitySqft, facilityCostPerSqft, facilityMonthly, enrollment, authorizerFee, totalPersonnelCost])

  const totalOps = costs.facility + costs.supplies + costs.contracted + costs.technology + costs.authorizerFee + costs.insurance + costs.misc
  const totalExpenses = totalPersonnelCost + totalOps
  const netPosition = totalRevenue - totalExpenses
  const totalStartup = funding.reduce((s, f) => s + f.amount, 0)
  const facilityPct = totalRevenue > 0 ? ((costs.facility / totalRevenue) * 100).toFixed(1) : '0'

  function updateFunding(key: string, field: keyof StartupFundingSource, value: string | number) {
    setFunding((prev) =>
      prev.map((f) => (f.key === key ? { ...f, [field]: value } : f))
    )
  }

  function removeFunding(key: string) {
    setFunding((prev) => prev.filter((f) => f.key !== key))
  }

  function addFunding() {
    setFunding((prev) => [
      ...prev,
      { key: nextFundingKey(), source: '', amount: 0, type: 'grant', status: 'projected' },
    ])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Build full OperationsData including silent defaults
    const fullData: OperationsData = {
      facilityMode,
      facilitySqft,
      facilityCostPerSqft,
      facilityMonthly,
      suppliesPerPupil: defaultOperationsData.suppliesPerPupil,
      contractedPerPupil: defaultOperationsData.contractedPerPupil,
      technologyPerPupil: defaultOperationsData.technologyPerPupil,
      foodProgram,
      insurance: defaultOperationsData.insurance,
      miscPct: defaultOperationsData.miscPct,
    }
    const cleanFunding: StartupFundingSource[] = funding
      .filter((f) => f.source.trim() || f.amount > 0)
      .map(({ source, amount, type, status }) => ({ source, amount, type, status }))
    onComplete(fullData, cleanFunding)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <p className="text-sm text-slate-500">
        Set your facility lease and startup funding. We&apos;ll fill in standard operations costs automatically.
      </p>

      {/* Facilities */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Facilities</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFacilityMode('sqft')}
              className={`text-xs px-3 py-1 rounded-lg ${facilityMode === 'sqft' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Sq Footage
            </button>
            <button
              type="button"
              onClick={() => setFacilityMode('flat')}
              className={`text-xs px-3 py-1 rounded-lg ${facilityMode === 'flat' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Flat Monthly
            </button>
          </div>
        </div>

        {facilityMode === 'sqft' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Square Footage</label>
              <input
                type="number"
                value={facilitySqft}
                onChange={(e) => setFacilitySqft(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">$/sqft/yr</label>
              <input
                type="number"
                value={facilityCostPerSqft}
                onChange={(e) => setFacilityCostPerSqft(Number(e.target.value))}
                step={0.5}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Monthly Lease Amount</label>
            <input
              type="number"
              value={facilityMonthly}
              onChange={(e) => setFacilityMonthly(Number(e.target.value))}
              step={500}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-400">Annual: {fmt(costs.facility)}</p>
          <p className="text-xs text-slate-400">Facility = {facilityPct}% of revenue</p>
        </div>
        {Number(facilityPct) > 15 && (
          <p className="text-xs text-amber-600 mt-1">Above 15% of revenue — consider negotiating terms or exploring co-location.</p>
        )}
      </div>

      {/* Food program */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <input
          type="checkbox"
          id="foodProgram"
          checked={foodProgram}
          onChange={(e) => setFoodProgram(e.target.checked)}
          className="w-4 h-4 accent-teal-600"
        />
        <div>
          <label htmlFor="foodProgram" className="text-sm font-medium text-slate-700">Food Program</label>
          <p className="text-xs text-slate-400">If enabled, assumes net neutral (federal reimbursement offsets cost)</p>
        </div>
      </div>

      {/* Startup Funding */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Startup Funding (Year 0)</h3>
        <p className="text-xs text-slate-400 mb-4">Pre-opening grants, donations, and loans that fund startup costs before revenue arrives.</p>

        <div className="space-y-3">
          {funding.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <input
                type="text"
                value={f.source}
                onChange={(e) => updateFunding(f.key, 'source', e.target.value)}
                placeholder="Source name"
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={f.amount}
                  onChange={(e) => updateFunding(f.key, 'amount', Number(e.target.value))}
                  step={5000}
                  className="w-28 px-2 py-1.5 border border-slate-200 rounded text-sm text-right text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <select
                value={f.type}
                onChange={(e) => updateFunding(f.key, 'type', e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="grant">Grant</option>
                <option value="donation">Donation</option>
                <option value="debt">Debt</option>
                <option value="other">Other</option>
              </select>
              <select
                value={f.status}
                onChange={(e) => updateFunding(f.key, 'status', e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="received">Received</option>
                <option value="pledged">Pledged</option>
                <option value="applied">Applied</option>
                <option value="projected">Projected</option>
              </select>
              <button
                type="button"
                onClick={() => removeFunding(f.key)}
                className="text-red-400 hover:text-red-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addFunding}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium mt-3"
        >
          + Add Funding Source
        </button>
        {totalStartup > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
            <span className="text-sm font-medium text-slate-700">Total Startup Funding</span>
            <span className="text-sm font-semibold text-slate-800">{fmt(totalStartup)}</span>
          </div>
        )}
      </div>

      {/* Defaults note */}
      <p className="text-xs text-slate-400 italic">
        Operations costs like supplies, technology, insurance, and contingency use regional benchmarks. You can customize these on your dashboard.
      </p>

      {/* Live Financial Summary */}
      <div className="bg-slate-800 rounded-xl p-5 text-white">
        <h3 className="text-sm font-semibold mb-4 uppercase tracking-wide text-slate-300">Year 1 Financial Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400">Total Revenue</p>
            <p className="text-lg font-semibold">{fmt(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Personnel</p>
            <p className="text-lg font-semibold">{fmt(totalPersonnelCost)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Operations</p>
            <p className="text-lg font-semibold">{fmt(totalOps)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Expenses</p>
            <p className="text-lg font-semibold">{fmt(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Net Position</p>
            <p className={`text-lg font-semibold ${netPosition >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(netPosition)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Startup Funding</p>
            <p className="text-lg font-semibold text-blue-400">{fmt(totalStartup)}</p>
          </div>
        </div>
        {netPosition < 0 && (
          <p className="text-xs text-amber-300 mt-3">
            Negative net position is common for Year 1. Startup funding of {fmt(Math.abs(netPosition))}+ is recommended to cover the gap.
          </p>
        )}
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
          className="bg-teal-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Building Your Budget...
            </>
          ) : (
            'Complete Onboarding'
          )}
        </button>
      </div>
    </form>
  )
}
