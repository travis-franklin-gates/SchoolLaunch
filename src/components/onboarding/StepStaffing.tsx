'use client'

import { useState, useMemo } from 'react'
import { calcBenefits, calcTotalBaseRevenue } from '@/lib/calculations'
import type { StaffingPosition } from '@/lib/types'

interface LocalPosition {
  key: string
  title: string
  category: 'certificated' | 'classified' | 'admin'
  fte: number
  salary: number
}

interface Props {
  enrollment: number
  maxClassSize: number
  pctIep: number
  initialPositions: LocalPosition[]
  onNext: (positions: LocalPosition[]) => void
  onBack: () => void
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

let keyCounter = 0
function nextKey() {
  return `pos-${++keyCounter}`
}

export function buildDefaultPositions(enrollment: number, maxClassSize: number, pctIep: number): LocalPosition[] {
  const teachers = Math.ceil(enrollment / maxClassSize)
  const paras = Math.max(1, Math.ceil((enrollment * pctIep / 100) / 10))

  return [
    ...Array.from({ length: teachers }, (_, i) => ({
      key: nextKey(),
      title: `Teacher ${i + 1}`,
      category: 'certificated' as const,
      fte: 1.0,
      salary: 58000,
    })),
    {
      key: nextKey(),
      title: 'Principal',
      category: 'admin' as const,
      fte: 1.0,
      salary: 95000,
    },
    {
      key: nextKey(),
      title: 'Office Manager',
      category: 'classified' as const,
      fte: 1.0,
      salary: 52000,
    },
    ...Array.from({ length: paras }, (_, i) => ({
      key: nextKey(),
      title: `Paraeducator ${paras > 1 ? i + 1 : ''}`.trim(),
      category: 'classified' as const,
      fte: 1.0,
      salary: 38000,
    })),
  ]
}

export default function StepStaffing({ enrollment, maxClassSize, pctIep, initialPositions, onNext, onBack }: Props) {
  const [positions, setPositions] = useState<LocalPosition[]>(
    initialPositions.length > 0 ? initialPositions : buildDefaultPositions(enrollment, maxClassSize, pctIep)
  )

  const totalRevenue = calcTotalBaseRevenue(enrollment)

  const totals = useMemo(() => {
    let totalPersonnel = 0
    for (const p of positions) {
      const salary = p.fte * p.salary
      totalPersonnel += salary + calcBenefits(salary)
    }
    return {
      totalPersonnel,
      pctOfRevenue: totalRevenue > 0 ? (totalPersonnel / totalRevenue) * 100 : 0,
    }
  }, [positions, totalRevenue])

  function updatePosition(key: string, field: keyof LocalPosition, value: string | number) {
    setPositions((prev) =>
      prev.map((p) => (p.key === key ? { ...p, [field]: value } : p))
    )
  }

  function removePosition(key: string) {
    setPositions((prev) => prev.filter((p) => p.key !== key))
  }

  function addPosition() {
    setPositions((prev) => [
      ...prev,
      { key: nextKey(), title: 'New Position', category: 'classified', fte: 1.0, salary: 45000 },
    ])
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    onNext(positions)
  }

  return (
    <form onSubmit={handleNext} className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 pr-3 font-medium text-slate-600">Position Title</th>
              <th className="text-left py-2 pr-3 font-medium text-slate-600">Category</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-600">FTE</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-600">Annual Salary</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-600">Benefits (30%)</th>
              <th className="text-right py-2 pr-3 font-medium text-slate-600">Total Cost</th>
              <th className="py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const effectiveSalary = p.fte * p.salary
              const benefits = calcBenefits(effectiveSalary)
              const total = effectiveSalary + benefits
              return (
                <tr key={p.key} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={p.title}
                      onChange={(e) => updatePosition(p.key, 'title', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={p.category}
                      onChange={(e) => updatePosition(p.key, 'category', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="certificated">Certificated</option>
                      <option value="classified">Classified</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      value={p.fte}
                      onChange={(e) => updatePosition(p.key, 'fte', Number(e.target.value))}
                      min={0.1}
                      max={2}
                      step={0.1}
                      className="w-20 px-2 py-1 border border-slate-200 rounded text-right text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      value={p.salary}
                      onChange={(e) => updatePosition(p.key, 'salary', Number(e.target.value))}
                      min={0}
                      step={1000}
                      className="w-28 px-2 py-1 border border-slate-200 rounded text-right text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-500">{fmt(benefits)}</td>
                  <td className="py-2 pr-3 text-right font-medium text-slate-800">{fmt(total)}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removePosition(p.key)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none"
                      title="Remove position"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addPosition}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + Add Position
      </button>

      <div className="bg-slate-50 rounded-xl p-4 flex gap-8">
        <div>
          <p className="text-xs text-slate-500">Total Personnel Cost</p>
          <p className="text-lg font-semibold text-slate-800">{fmt(totals.totalPersonnel)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Personnel as % of Revenue</p>
          <p className={`text-lg font-semibold ${totals.pctOfRevenue > 85 ? 'text-red-600' : totals.pctOfRevenue > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
            {totals.pctOfRevenue.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Revenue (est.)</p>
          <p className="text-lg font-semibold text-slate-800">{fmt(totalRevenue)}</p>
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
