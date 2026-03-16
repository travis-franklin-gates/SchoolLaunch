'use client'

import { useState, useEffect } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { calcAuthorizerFee } from '@/lib/calculations'
import { createClient } from '@/lib/supabase/client'
import type { FinancialAssumptions } from '@/lib/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface OpsRow {
  lineItem: string
  amount: number
  group: string
  /** The per-unit rate (per student or per FTE) — null for items without a rate */
  rate: number | null
  /** Whether the rate is per FTE (true) or per student (false) */
  perFte: boolean
  /** The assumptions key to sync the rate to */
  rateKey: keyof FinancialAssumptions | null
}

/** Maps line items to their per-pupil assumption key and whether it's per-FTE */
const RATE_MAP: Record<string, { key: keyof FinancialAssumptions; perFte: boolean }> = {
  'Supplies & Materials': { key: 'supplies_per_student', perFte: false },
  'Contracted Services': { key: 'contracted_services_per_student', perFte: false },
  'Technology': { key: 'technology_per_student', perFte: false },
  'Curriculum & Materials': { key: 'curriculum_per_student', perFte: false },
  'Professional Development': { key: 'professional_development_per_fte', perFte: true },
  'Marketing & Outreach': { key: 'marketing_per_student', perFte: false },
  'Food Service': { key: 'food_service_per_student', perFte: false },
  'Transportation': { key: 'transportation_per_student', perFte: false },
}

const GROUP_ORDER = [
  'Facilities & Occupancy',
  'Instructional',
  'Student Services',
  'Administrative',
  'Other',
]

function getGroup(lineItem: string): string {
  switch (lineItem) {
    case 'Facilities':
    case 'Insurance':
      return 'Facilities & Occupancy'
    case 'Supplies & Materials':
    case 'Technology':
    case 'Curriculum & Materials':
    case 'Professional Development':
      return 'Instructional'
    case 'Food Service':
    case 'Transportation':
      return 'Student Services'
    case 'Contracted Services':
    case 'Authorizer Fee':
    case 'Marketing & Outreach':
    case 'Fundraising':
      return 'Administrative'
    default:
      return 'Other'
  }
}

export default function OperationsPage() {
  const {
    schoolData: { schoolId, profile, projections, positions, loading, reload },
    assumptions,
    currentSummary,
    isModified,
  } = useScenario()
  const [rows, setRows] = useState<OpsRow[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  // Local overrides for per-pupil rates (synced to settings on save)
  const [rateOverrides, setRateOverrides] = useState<Partial<Record<keyof FinancialAssumptions, number>>>({})
  const supabase = createClient()

  const enrollment = profile.target_enrollment_y1
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)

  /** Get the effective rate for a line item (override or assumption default) */
  function getRate(lineItem: string): number | null {
    const mapping = RATE_MAP[lineItem]
    if (!mapping) return null
    if (rateOverrides[mapping.key] !== undefined) return rateOverrides[mapping.key] as number
    return assumptions[mapping.key] as number
  }

  function getBenchmarkText(lineItem: string): string {
    const mapping = RATE_MAP[lineItem]
    if (!mapping) {
      if (lineItem === 'Facilities') return 'Varies by market'
      if (lineItem === 'Insurance') return `$${assumptions.insurance_annual.toLocaleString()}/yr typical`
      if (lineItem === 'Authorizer Fee') return `${assumptions.authorizer_fee_pct}% of state apportionment`
      if (lineItem === 'Misc/Contingency') return `${assumptions.contingency_pct}% of total expenses typical`
      if (lineItem === 'Fundraising') return `$${assumptions.fundraising_annual.toLocaleString()}/yr`
      return ''
    }
    const rate = getRate(lineItem) || 0
    const unit = mapping.perFte ? 'FTE' : 'student'
    const base = mapping.perFte ? totalFte : enrollment
    return `$${rate}/${unit} = ${fmt(rate * base)}`
  }

  useEffect(() => {
    const opsProjections = projections.filter((p) => !p.is_revenue && p.category === 'Operations')
    const existingItems = new Set(opsProjections.map((p) => p.subcategory))

    const baseRows: OpsRow[] = opsProjections.map((p) => {
      const mapping = RATE_MAP[p.subcategory]
      const base = mapping?.perFte ? totalFte : enrollment
      const effectiveRate = mapping ? (assumptions[mapping.key] as number) : null
      return {
        lineItem: p.subcategory,
        amount: p.amount,
        group: getGroup(p.subcategory),
        rate: effectiveRate,
        perFte: mapping?.perFte || false,
        rateKey: mapping?.key || null,
      }
    })

    // Add expanded line items if they don't exist in projections
    const expandedItems: { lineItem: string; amount: number }[] = [
      { lineItem: 'Curriculum & Materials', amount: assumptions.curriculum_per_student * enrollment },
      { lineItem: 'Professional Development', amount: assumptions.professional_development_per_fte * totalFte },
      { lineItem: 'Marketing & Outreach', amount: assumptions.marketing_per_student * enrollment },
      { lineItem: 'Fundraising', amount: assumptions.fundraising_annual },
    ]

    if (assumptions.food_service_offered) {
      expandedItems.push({ lineItem: 'Food Service', amount: assumptions.food_service_per_student * enrollment })
    }
    if (assumptions.transportation_offered) {
      expandedItems.push({ lineItem: 'Transportation', amount: assumptions.transportation_per_student * enrollment })
    }

    for (const item of expandedItems) {
      if (!existingItems.has(item.lineItem)) {
        const mapping = RATE_MAP[item.lineItem]
        baseRows.push({
          lineItem: item.lineItem,
          amount: item.amount,
          group: getGroup(item.lineItem),
          rate: mapping ? (assumptions[mapping.key] as number) : null,
          perFte: mapping?.perFte || false,
          rateKey: mapping?.key || null,
        })
      }
    }

    baseRows.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
    setRows(baseRows)
  }, [projections, enrollment, totalFte, assumptions])

  function updateAmount(idx: number, amount: number) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r
      // Back-calculate the rate from the new amount
      const mapping = RATE_MAP[r.lineItem]
      if (mapping) {
        const base = mapping.perFte ? totalFte : enrollment
        const newRate = base > 0 ? Math.round(amount / base) : 0
        setRateOverrides((o) => ({ ...o, [mapping.key]: newRate }))
        return { ...r, amount, rate: newRate }
      }
      return { ...r, amount }
    }))
  }

  function updateRate(idx: number, newRate: number) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r
      const mapping = RATE_MAP[r.lineItem]
      if (!mapping) return r
      const base = mapping.perFte ? totalFte : enrollment
      const newAmount = Math.round(newRate * base)
      setRateOverrides((o) => ({ ...o, [mapping.key]: newRate }))
      return { ...r, amount: newAmount, rate: newRate }
    }))
  }

  const totalOps = rows.reduce((s, r) => s + r.amount, 0)
  const facilityPct = currentSummary.facilityPct

  async function save() {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

    let hadError = false

    // Save operations projections
    for (const row of rows) {
      const { data: existing } = await supabase
        .from('budget_projections')
        .select('id')
        .eq('school_id', schoolId)
        .eq('year', 1)
        .eq('subcategory', row.lineItem)
        .eq('is_revenue', false)

      if (existing && existing.length > 0) {
        const { error } = await supabase.from('budget_projections')
          .update({ amount: row.amount })
          .eq('school_id', schoolId)
          .eq('year', 1)
          .eq('subcategory', row.lineItem)
          .eq('is_revenue', false)
        if (error) { console.error(`Update ${row.lineItem} failed:`, error); hadError = true }
      } else {
        const { error } = await supabase.from('budget_projections').insert({
          school_id: schoolId,
          year: 1,
          category: 'Operations',
          subcategory: row.lineItem,
          amount: row.amount,
          is_revenue: false,
        })
        if (error) { console.error(`Insert ${row.lineItem} failed:`, error); hadError = true }
      }
    }

    // Sync rate overrides to financial_assumptions in school_profiles
    if (Object.keys(rateOverrides).length > 0) {
      const merged = { ...(profile.financial_assumptions || {}), ...rateOverrides }
      const { error } = await supabase
        .from('school_profiles')
        .update({ financial_assumptions: merged })
        .eq('school_id', schoolId)
      if (error) { console.error('Failed to save assumptions:', error); hadError = true }
    }

    setSaving(false)
    if (hadError) {
      setToast({ type: 'error', message: 'Some operations failed to save. Check console for details.' })
    } else {
      setToast({ type: 'success', message: 'Operations saved successfully.' })
      setRateOverrides({})
      await reload()
      setTimeout(() => setToast(null), 3000)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  // Group rows
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    rows: rows.filter((r) => r.group === group),
    subtotal: rows.filter((r) => r.group === group).reduce((s, r) => s + r.amount, 0),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold text-slate-900">Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Non-personnel expenses for Year 1. Edit per-unit rates or totals — changes sync to Settings on save.</p>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium animate-slide-in-right ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.message}
        </div>
      )}

      {isModified && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
          Scenario active — showing base case operations. Adjust amounts here to update the base case budget.
        </div>
      )}

      {/* Facility % of Revenue indicator */}
      <div className={`mb-4 rounded-lg px-4 py-3 text-sm border ${
        facilityPct > 15
          ? 'bg-red-50 border-red-200 text-red-700'
          : facilityPct > 12
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
      }`}>
        <span className="font-semibold">Facility Cost:</span> {facilityPct.toFixed(1)}% of revenue
        {facilityPct > 15 && ' — Exceeds 15% threshold. Consider renegotiating lease or finding alternative space.'}
        {facilityPct > 12 && facilityPct <= 15 && ' — Approaching 15% threshold. Monitor closely.'}
        {facilityPct <= 12 && ' — Within healthy range (< 12%).'}
      </div>

      {/* Food Service note */}
      {assumptions.food_service_offered && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
          <strong>Food Service:</strong> If 100% of students qualify for free meals, your school may be eligible for the Community Eligibility Provision (CEP),
          which provides USDA NSLP reimbursement that can offset food service costs. Update demographics in Settings.
        </div>
      )}

      {/* Transportation note */}
      {assumptions.transportation_offered && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
          <strong>Transportation:</strong> WA charter schools must provide transportation services under RCW 28A.710.040.
          Document your transportation plan in your charter application. Consider contracted vs. in-house options.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
        <div className="overflow-x-auto sl-scroll">
          <table className="w-full text-sm sl-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Expense</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Rate</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide hidden sm:table-cell">Benchmark</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <GroupSection
                  key={g.group}
                  group={g.group}
                  rows={g.rows}
                  subtotal={g.subtotal}
                  allRows={rows}
                  updateAmount={updateAmount}
                  updateRate={updateRate}
                  getBenchmarkText={getBenchmarkText}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td className="px-6 py-3 font-bold text-slate-800" colSpan={3}>Total Operations</td>
                <td className="px-6 py-3 text-right font-bold text-slate-800 num">{fmt(totalOps)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}

function GroupSection({
  group,
  rows,
  subtotal,
  allRows,
  updateAmount,
  updateRate,
  getBenchmarkText,
}: {
  group: string
  rows: OpsRow[]
  subtotal: number
  allRows: OpsRow[]
  updateAmount: (idx: number, amount: number) => void
  updateRate: (idx: number, rate: number) => void
  getBenchmarkText: (lineItem: string) => string
}) {
  return (
    <>
      <tr className="bg-slate-100 border-b border-slate-200 section-header">
        <td className="px-6 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide" colSpan={4}>
          {group}
        </td>
      </tr>
      {rows.map((row) => {
        const globalIdx = allRows.indexOf(row)
        const isReadOnly = row.lineItem === 'Authorizer Fee'
        const hasRate = row.rateKey !== null
        const unit = row.perFte ? '/FTE' : '/student'
        return (
          <tr key={row.lineItem} className="border-b border-slate-100">
            <td className="px-6 py-3 font-medium text-slate-800">{row.lineItem}</td>
            <td className="px-6 py-3">
              {hasRate ? (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    step={10}
                    min={0}
                    value={row.rate ?? 0}
                    onChange={(e) => updateRate(globalIdx, Number(e.target.value))}
                    className="w-16 text-right border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <span className="text-slate-400 text-xs">{unit}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">{getBenchmarkText(row.lineItem).split('=')[0] || '—'}</span>
              )}
            </td>
            <td className="px-6 py-3 text-xs text-slate-500 hidden sm:table-cell">{getBenchmarkText(row.lineItem)}</td>
            <td className="px-6 py-3 text-right">
              {isReadOnly ? (
                <span className="text-slate-500 num">{fmt(row.amount)}</span>
              ) : (
                <input
                  type="number"
                  step={1000}
                  value={row.amount}
                  onChange={(e) => updateAmount(globalIdx, Number(e.target.value))}
                  className="w-32 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              )}
            </td>
          </tr>
        )
      })}
      <tr className="border-b border-slate-200 bg-slate-50/50">
        <td className="px-6 py-2 font-semibold text-slate-700 text-xs" colSpan={3}>Subtotal: {group}</td>
        <td className="px-6 py-2 text-right font-semibold text-slate-700 text-xs num">{fmt(subtotal)}</td>
      </tr>
    </>
  )
}
