'use client'

import { useState, useEffect } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { calcBenefits } from '@/lib/calculations'
import { createClient } from '@/lib/supabase/client'
import { COMMISSION_POSITIONS, getCommissionPosition } from '@/lib/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Position {
  id: string
  title: string
  category: 'certificated' | 'classified' | 'admin'
  fte: number
  salary: number
  positionType: string
  classification: string
  benchmarkSalary: number
  driver: string
}

let nextId = 0
function tempId() { return `new-${++nextId}` }

function classificationToCategory(classification: string): 'certificated' | 'classified' | 'admin' {
  if (classification === 'Administrative') return 'admin'
  if (classification === 'Instructional') return 'certificated'
  return 'classified'
}

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string }> = {
  Administrative: { bg: 'bg-purple-50', text: 'text-purple-700' },
  Instructional: { bg: 'bg-blue-50', text: 'text-blue-700' },
  'Non-Instructional': { bg: 'bg-slate-100', text: 'text-slate-600' },
}

export default function StaffingPage() {
  const {
    schoolData: { schoolId, positions: dbPositions, projections, loading, reload },
    assumptions,
    isModified,
  } = useScenario()
  const [positions, setPositions] = useState<Position[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const supabase = createClient()
  const benefitsRate = assumptions.benefits_load_pct / 100

  useEffect(() => {
    if (dbPositions.length > 0) {
      setPositions(
        dbPositions.map((p) => {
          const cp = p.position_type ? getCommissionPosition(p.position_type) : undefined
          return {
            id: p.id || tempId(),
            title: p.title,
            category: p.category,
            fte: p.fte,
            salary: p.annual_salary,
            positionType: p.position_type || 'custom',
            classification: p.classification || cp?.classification || 'Administrative',
            benchmarkSalary: p.benchmark_salary || cp?.salary || 0,
            driver: p.driver || cp?.driver || 'fixed',
          }
        })
      )
    }
  }, [dbPositions])

  const totalRevenue = projections.filter((p) => p.is_revenue).reduce((s, p) => s + p.amount, 0)
  const totalSalaries = positions.reduce((sum, p) => sum + p.fte * p.salary, 0)
  const totalBenefits = positions.reduce((sum, p) => sum + calcBenefits(p.fte * p.salary, benefitsRate), 0)
  const totalPersonnel = totalSalaries + totalBenefits
  const personnelPct = totalRevenue > 0 ? (totalPersonnel / totalRevenue * 100).toFixed(1) : '0'

  function updatePosition(id: string, field: keyof Position, value: string | number) {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  function selectPositionType(id: string, type: string) {
    const cp = getCommissionPosition(type)
    if (!cp) return
    setPositions((prev) =>
      prev.map((p) => p.id === id ? {
        ...p,
        positionType: type,
        title: type === 'custom' ? p.title : cp.name,
        classification: cp.classification,
        category: classificationToCategory(cp.classification),
        benchmarkSalary: cp.salary,
        salary: cp.salary > 0 ? cp.salary : p.salary,
        driver: cp.driver,
      } : p)
    )
  }

  function addPosition() {
    setPositions((prev) => [
      ...prev,
      { id: tempId(), title: 'New Position', category: 'classified', fte: 1, salary: 45000, positionType: 'custom', classification: 'Administrative', benchmarkSalary: 0, driver: 'fixed' },
    ])
  }

  function removePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id))
  }

  async function save() {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

    const { error: delError } = await supabase
      .from('staffing_positions')
      .delete()
      .eq('school_id', schoolId)
      .eq('year', 1)

    if (delError) {
      console.error('Delete staffing failed:', delError)
      setSaving(false)
      setToast({ type: 'error', message: `Failed to save: ${delError.message}` })
      return
    }

    const rows = positions.map((p) => ({
      school_id: schoolId,
      year: 1,
      title: p.title,
      category: p.category,
      fte: p.fte,
      annual_salary: p.salary,
      position_type: p.positionType,
      driver: p.driver,
      classification: p.classification,
      benchmark_salary: p.benchmarkSalary,
    }))

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('staffing_positions').insert(rows)
      if (insertError) {
        console.error('Insert staffing failed:', insertError)
        setSaving(false)
        setToast({ type: 'error', message: `Failed to save positions: ${insertError.message}` })
        return
      }
    }

    // Update personnel projection
    const { error: projError } = await supabase.from('budget_projections')
      .update({ amount: totalPersonnel })
      .eq('school_id', schoolId)
      .eq('year', 1)
      .eq('subcategory', 'Total Personnel')

    if (projError) {
      console.error('Update personnel projection failed:', projError)
    }

    setSaving(false)
    setToast({ type: 'success', message: 'Staffing changes saved successfully.' })
    await reload()
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div>
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.message}
        </div>
      )}

      {isModified && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Scenario active — showing base case staffing. Adjust positions here to update the base case budget.
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Staffing</h1>
          <p className="text-sm text-slate-500 mt-1">Commission-aligned position types with OSPI/BLS salary benchmarks.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
            Number(personnelPct) < 72 ? 'bg-red-50 text-red-700' :
            Number(personnelPct) <= 78 ? 'bg-emerald-50 text-emerald-700' :
            Number(personnelPct) <= 80 ? 'bg-amber-50 text-amber-700' :
            'bg-red-50 text-red-700'
          }`}>
            Personnel: {personnelPct}% of Revenue
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Position Type</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Classification</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">FTE</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Salary</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Benefits ({assumptions.benefits_load_pct}%)</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Cost</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const cost = pos.fte * pos.salary
              const benefits = calcBenefits(cost, benefitsRate)
              const clsColor = CLASSIFICATION_COLORS[pos.classification] || CLASSIFICATION_COLORS['Non-Instructional']
              return (
                <tr key={pos.id} className="border-b border-slate-100">
                  <td className="px-4 py-2">
                    <select
                      value={pos.positionType}
                      onChange={(e) => selectPositionType(pos.id, e.target.value)}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm mb-1"
                    >
                      <optgroup label="Administrative">
                        {COMMISSION_POSITIONS.filter(cp => cp.classification === 'Administrative').map(cp => (
                          <option key={cp.type} value={cp.type}>{cp.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Instructional">
                        {COMMISSION_POSITIONS.filter(cp => cp.classification === 'Instructional').map(cp => (
                          <option key={cp.type} value={cp.type}>{cp.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Non-Instructional">
                        {COMMISSION_POSITIONS.filter(cp => cp.classification === 'Non-Instructional').map(cp => (
                          <option key={cp.type} value={cp.type}>{cp.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    {pos.positionType === 'custom' && (
                      <input
                        value={pos.title}
                        onChange={(e) => updatePosition(pos.id, 'title', e.target.value)}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                        placeholder="Custom position name"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${clsColor.bg} ${clsColor.text}`}>
                      {pos.classification}
                    </span>
                    {pos.driver !== 'fixed' && (
                      <span className="block text-[10px] text-slate-400 mt-0.5">{pos.driver.replace(/_/g, ' ')}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={pos.fte}
                      onChange={(e) => updatePosition(pos.id, 'fte', Number(e.target.value))}
                      className="w-16 text-right border border-slate-200 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step={1000}
                      value={pos.salary}
                      onChange={(e) => updatePosition(pos.id, 'salary', Number(e.target.value))}
                      className="w-28 text-right border border-slate-200 rounded px-2 py-1 text-sm"
                    />
                    {pos.benchmarkSalary > 0 && (
                      <div className="text-[10px] text-slate-400 text-right mt-0.5">Benchmark: {fmt(pos.benchmarkSalary)}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">{fmt(benefits)}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">{fmt(cost + benefits)}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removePosition(pos.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-4 py-2 text-slate-600 font-medium" colSpan={3}>Total Salaries</td>
              <td className="px-4 py-2 text-right font-medium text-slate-800" colSpan={1}>{fmt(totalSalaries)}</td>
              <td colSpan={3}></td>
            </tr>
            <tr className="bg-slate-50">
              <td className="px-4 py-2 text-slate-600 font-medium" colSpan={3}>Taxes & Benefits ({assumptions.benefits_load_pct}%)</td>
              <td className="px-4 py-2 text-right font-medium text-slate-800" colSpan={1}>{fmt(totalBenefits)}</td>
              <td colSpan={3}></td>
            </tr>
            <tr className="bg-slate-50 border-t border-slate-300">
              <td className="px-4 py-3 font-bold text-slate-800" colSpan={5}>Total Compensation</td>
              <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(totalPersonnel)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex gap-3">
        <button
          onClick={addPosition}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          + Add Position
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
