'use client'

import { useState, useEffect } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { calcAuthorizerFee } from '@/lib/calculations'
import { createClient } from '@/lib/supabase/client'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface OpsRow {
  lineItem: string
  amount: number
  perPupilBenchmark: string
  group: string
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
      return 'Facilities & Occupancy'
    case 'Insurance':
      return 'Facilities & Occupancy'
    case 'Supplies & Materials':
      return 'Instructional'
    case 'Technology':
      return 'Instructional'
    case 'Curriculum & Materials':
      return 'Instructional'
    case 'Professional Development':
      return 'Instructional'
    case 'Food Service':
      return 'Student Services'
    case 'Transportation':
      return 'Student Services'
    case 'Contracted Services':
      return 'Administrative'
    case 'Authorizer Fee':
      return 'Administrative'
    case 'Marketing & Outreach':
      return 'Administrative'
    case 'Fundraising':
      return 'Administrative'
    case 'Misc/Contingency':
      return 'Other'
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
  const supabase = createClient()

  const enrollment = profile.target_enrollment_y1
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)

  useEffect(() => {
    const opsProjections = projections.filter((p) => !p.is_revenue && p.category === 'Operations')
    const existingItems = new Set(opsProjections.map((p) => p.subcategory))

    const baseRows: OpsRow[] = opsProjections.map((p) => ({
      lineItem: p.subcategory,
      amount: p.amount,
      perPupilBenchmark: getPerPupilBenchmark(p.subcategory, enrollment, totalFte),
      group: getGroup(p.subcategory),
    }))

    // Add expanded line items if they don't exist in projections
    const expandedItems = [
      { lineItem: 'Curriculum & Materials', amount: assumptions.curriculum_per_student * enrollment },
      { lineItem: 'Professional Development', amount: assumptions.professional_development_per_fte * totalFte },
      { lineItem: 'Marketing & Outreach', amount: assumptions.marketing_per_student * enrollment },
      { lineItem: 'Fundraising', amount: assumptions.fundraising_annual },
    ]

    // Conditionally add food service and transportation
    if (assumptions.food_service_offered) {
      expandedItems.push({
        lineItem: 'Food Service',
        amount: assumptions.food_service_per_student * enrollment,
      })
    }
    if (assumptions.transportation_offered) {
      expandedItems.push({
        lineItem: 'Transportation',
        amount: assumptions.transportation_per_student * enrollment,
      })
    }

    for (const item of expandedItems) {
      if (!existingItems.has(item.lineItem)) {
        baseRows.push({
          lineItem: item.lineItem,
          amount: item.amount,
          perPupilBenchmark: getPerPupilBenchmark(item.lineItem, enrollment, totalFte),
          group: getGroup(item.lineItem),
        })
      }
    }

    // Sort by group order
    baseRows.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
    setRows(baseRows)
  }, [projections, enrollment, totalFte, assumptions])

  function getPerPupilBenchmark(lineItem: string, enr: number, fte: number): string {
    const benchmarks: Record<string, string> = {
      'Facilities': 'Varies by market',
      'Supplies & Materials': `$${assumptions.supplies_per_student}/student = ${fmt(assumptions.supplies_per_student * enr)}`,
      'Contracted Services': `$${assumptions.contracted_services_per_student}/student = ${fmt(assumptions.contracted_services_per_student * enr)}`,
      'Technology': `$${assumptions.technology_per_student}/student = ${fmt(assumptions.technology_per_student * enr)}`,
      'Authorizer Fee': `${assumptions.authorizer_fee_pct}% of state apportionment`,
      'Insurance': `$${assumptions.insurance_annual.toLocaleString()}/yr typical`,
      'Misc/Contingency': `${assumptions.contingency_pct}% of total expenses typical`,
      'Curriculum & Materials': `$${assumptions.curriculum_per_student}/student = ${fmt(assumptions.curriculum_per_student * enr)}`,
      'Professional Development': `$${assumptions.professional_development_per_fte}/FTE = ${fmt(assumptions.professional_development_per_fte * fte)}`,
      'Food Service': `$${assumptions.food_service_per_student}/student = ${fmt(assumptions.food_service_per_student * enr)}`,
      'Transportation': `$${assumptions.transportation_per_student}/student = ${fmt(assumptions.transportation_per_student * enr)}`,
      'Marketing & Outreach': `$${assumptions.marketing_per_student}/student = ${fmt(assumptions.marketing_per_student * enr)}`,
      'Fundraising': `$${assumptions.fundraising_annual.toLocaleString()}/yr`,
    }
    return benchmarks[lineItem] || ''
  }

  function updateAmount(idx: number, amount: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount } : r)))
  }

  const totalOps = rows.reduce((s, r) => s + r.amount, 0)
  const facilityPct = currentSummary.facilityPct

  async function save() {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

    let hadError = false
    for (const row of rows) {
      // Check if this projection already exists
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
        if (error) {
          console.error(`Update ${row.lineItem} failed:`, error)
          hadError = true
        }
      } else {
        const { error } = await supabase.from('budget_projections').insert({
          school_id: schoolId,
          year: 1,
          category: 'Operations',
          subcategory: row.lineItem,
          amount: row.amount,
          is_revenue: false,
        })
        if (error) {
          console.error(`Insert ${row.lineItem} failed:`, error)
          hadError = true
        }
      }
    }

    setSaving(false)
    if (hadError) {
      setToast({ type: 'error', message: 'Some operations failed to save. Check console for details.' })
    } else {
      setToast({ type: 'success', message: 'Operations saved successfully.' })
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Non-personnel expenses for Year 1, organized by category. Per-pupil benchmarks shown for reference.</p>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.message}
        </div>
      )}

      {isModified && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
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
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          <strong>Food Service:</strong> If 100% of students qualify for free meals, your school may be eligible for the Community Eligibility Provision (CEP),
          which provides USDA NSLP reimbursement that can offset food service costs. Update demographics in Settings.
        </div>
      )}

      {/* Transportation note */}
      {assumptions.transportation_offered && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          <strong>Transportation:</strong> WA charter schools must provide transportation services under RCW 28A.710.040.
          Document your transportation plan in your charter application. Consider contracted vs. in-house options.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Expense</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Benchmark</th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Amount</th>
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
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-6 py-3 font-bold text-slate-800" colSpan={2}>Total Operations</td>
              <td className="px-6 py-3 text-right font-bold text-slate-800">{fmt(totalOps)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
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
}: {
  group: string
  rows: OpsRow[]
  subtotal: number
  allRows: OpsRow[]
  updateAmount: (idx: number, amount: number) => void
}) {
  return (
    <>
      <tr className="bg-slate-100 border-b border-slate-200">
        <td className="px-6 py-2 font-semibold text-xs text-slate-600 uppercase tracking-wide" colSpan={3}>
          {group}
        </td>
      </tr>
      {rows.map((row) => {
        const globalIdx = allRows.indexOf(row)
        const isReadOnly = row.lineItem === 'Authorizer Fee'
        return (
          <tr key={row.lineItem} className="border-b border-slate-100">
            <td className="px-6 py-3 font-medium text-slate-800">{row.lineItem}</td>
            <td className="px-6 py-3 text-xs text-slate-500">{row.perPupilBenchmark}</td>
            <td className="px-6 py-3 text-right">
              {isReadOnly ? (
                <span className="text-slate-500">{fmt(row.amount)}</span>
              ) : (
                <input
                  type="number"
                  step={1000}
                  value={row.amount}
                  onChange={(e) => updateAmount(globalIdx, Number(e.target.value))}
                  className="w-32 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </td>
          </tr>
        )
      })}
      <tr className="border-b border-slate-200 bg-slate-50/50">
        <td className="px-6 py-2 font-semibold text-slate-700 text-xs" colSpan={2}>Subtotal: {group}</td>
        <td className="px-6 py-2 text-right font-semibold text-slate-700 text-xs">{fmt(subtotal)}</td>
      </tr>
    </>
  )
}
