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
}

export default function OperationsPage() {
  const {
    schoolData: { schoolId, profile, projections, loading },
    assumptions,
    isModified,
  } = useScenario()
  const [rows, setRows] = useState<OpsRow[]>([])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const enrollment = profile.target_enrollment_y1

  useEffect(() => {
    const opsProjections = projections.filter((p) => !p.is_revenue && p.category === 'Operations')
    if (opsProjections.length > 0) {
      setRows(
        opsProjections.map((p) => ({
          lineItem: p.subcategory,
          amount: p.amount,
          perPupilBenchmark: getPerPupilBenchmark(p.subcategory, enrollment),
        }))
      )
    }
  }, [projections, enrollment])

  function getPerPupilBenchmark(lineItem: string, enr: number): string {
    const benchmarks: Record<string, string> = {
      'Facilities': 'Varies by market',
      'Supplies & Materials': `$${assumptions.supplies_per_student}/student = ${fmt(assumptions.supplies_per_student * enr)}`,
      'Contracted Services': `$${assumptions.contracted_services_per_student}/student = ${fmt(assumptions.contracted_services_per_student * enr)}`,
      'Technology': `$${assumptions.technology_per_student}/student = ${fmt(assumptions.technology_per_student * enr)}`,
      'Authorizer Fee': `${assumptions.authorizer_fee_pct}% of state apportionment`,
      'Insurance': `$${assumptions.insurance_annual.toLocaleString()}/yr typical`,
      'Misc/Contingency': `${assumptions.contingency_pct}% of total expenses typical`,
    }
    return benchmarks[lineItem] || ''
  }

  function updateAmount(idx: number, amount: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount } : r)))
  }

  const totalOps = rows.reduce((s, r) => s + r.amount, 0)

  async function save() {
    if (!schoolId) return
    setSaving(true)
    for (const row of rows) {
      await supabase.from('budget_projections')
        .update({ amount: row.amount })
        .eq('school_id', schoolId)
        .eq('year', 1)
        .eq('subcategory', row.lineItem)
        .eq('is_revenue', false)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Non-personnel expenses for Year 1. Per-pupil benchmarks shown for reference.</p>
        </div>
      </div>

      {isModified && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Scenario active — showing base case operations. Adjust amounts here to update the base case budget.
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
            {rows.map((row, idx) => {
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
                        onChange={(e) => updateAmount(idx, Number(e.target.value))}
                        className="w-32 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </td>
                </tr>
              )
            })}
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
