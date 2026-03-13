'use client'

import { useState, useMemo } from 'react'
import { calcBenefits, calcCommissionRevenue } from '@/lib/calculations'
import { DEFAULT_ASSUMPTIONS } from '@/lib/types'

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
  gradeConfig: string
  pctFrl: number
  pctIep: number
  pctEll: number
  pctHicap: number
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

export function buildDefaultPositions(enrollment: number, maxClassSize: number, gradeConfig: string, pctIep: number, pctEll: number): LocalPosition[] {
  const teachers = Math.ceil(enrollment / maxClassSize)
  const paras = Math.max(1, Math.ceil((enrollment * pctIep / 100) / 10))
  const isSecondary = gradeConfig === '6-8' || gradeConfig === '9-12'
  const isLarge = enrollment > 250

  const positions: LocalPosition[] = []

  // Teachers
  for (let i = 0; i < teachers; i++) {
    positions.push({
      key: nextKey(),
      title: isSecondary ? `Subject Teacher ${i + 1}` : `Teacher ${i + 1}`,
      category: 'certificated',
      fte: 1.0,
      salary: isSecondary ? 62000 : 58000,
    })
  }

  // Special education teacher if IEP > 10%
  if (pctIep > 10) {
    positions.push({
      key: nextKey(),
      title: 'Special Education Teacher',
      category: 'certificated',
      fte: 1.0,
      salary: 62000,
    })
  }

  // ELL teacher if ELL > 10%
  if (pctEll > 10) {
    positions.push({
      key: nextKey(),
      title: 'ELL Teacher',
      category: 'certificated',
      fte: pctEll > 20 ? 1.0 : 0.5,
      salary: 60000,
    })
  }

  // Admin
  positions.push({
    key: nextKey(),
    title: 'Principal',
    category: 'admin',
    fte: 1.0,
    salary: 95000,
  })

  if (isLarge || gradeConfig === 'K-8') {
    positions.push({
      key: nextKey(),
      title: 'Assistant Principal',
      category: 'admin',
      fte: 1.0,
      salary: 80000,
    })
  }

  // Classified
  positions.push({
    key: nextKey(),
    title: 'Office Manager',
    category: 'classified',
    fte: 1.0,
    salary: 52000,
  })

  for (let i = 0; i < paras; i++) {
    positions.push({
      key: nextKey(),
      title: `Paraeducator ${paras > 1 ? i + 1 : ''}`.trim(),
      category: 'classified',
      fte: 1.0,
      salary: 38000,
    })
  }

  // Counselor for secondary or 200+ students
  if (isSecondary || enrollment >= 200) {
    positions.push({
      key: nextKey(),
      title: isSecondary ? 'School Counselor' : 'Counselor',
      category: 'certificated',
      fte: enrollment >= 300 ? 1.0 : 0.5,
      salary: 65000,
    })
  }

  return positions
}

export default function StepStaffing({ enrollment, maxClassSize, gradeConfig, pctFrl, pctIep, pctEll, pctHicap, initialPositions, onNext, onBack }: Props) {
  const [positions, setPositions] = useState<LocalPosition[]>(
    initialPositions.length > 0 ? initialPositions : buildDefaultPositions(enrollment, maxClassSize, gradeConfig, pctIep, pctEll)
  )

  const rev = calcCommissionRevenue(enrollment, pctFrl, pctIep, pctEll, pctHicap, DEFAULT_ASSUMPTIONS)
  const totalRevenue = rev.total

  const totals = useMemo(() => {
    let totalPersonnel = 0
    let totalFte = 0
    for (const p of positions) {
      const salary = p.fte * p.salary
      totalPersonnel += salary + calcBenefits(salary)
      totalFte += p.fte
    }
    const pctOfRevenue = totalRevenue > 0 ? (totalPersonnel / totalRevenue) * 100 : 0
    const studentTeacherRatio = (() => {
      const teacherFte = positions.filter(p => p.category === 'certificated').reduce((s, p) => s + p.fte, 0)
      return teacherFte > 0 ? Math.round(enrollment / teacherFte) : 0
    })()
    return { totalPersonnel, totalFte, pctOfRevenue, studentTeacherRatio }
  }, [positions, totalRevenue, enrollment])

  const healthColor = totals.pctOfRevenue > 85
    ? 'text-red-600'
    : totals.pctOfRevenue > 70
    ? 'text-amber-600'
    : 'text-emerald-600'

  const healthLabel = totals.pctOfRevenue > 85
    ? 'Above target — reduce positions or increase revenue'
    : totals.pctOfRevenue > 70
    ? 'Within typical range (70–85%)'
    : 'Below typical — room for additional hires'

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

  function resetDefaults() {
    setPositions(buildDefaultPositions(enrollment, maxClassSize, gradeConfig, pctIep, pctEll))
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    onNext(positions)
  }

  return (
    <form onSubmit={handleNext} className="space-y-6">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500 max-w-lg">
          We pre-populated positions based on your enrollment, grade config, and demographics. Adjust titles, FTE, and salaries as needed.
        </p>
        <button
          type="button"
          onClick={resetDefaults}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap ml-4"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Financial health bar */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-slate-500">Total Personnel Cost</p>
            <p className="text-lg font-semibold text-slate-800">{fmt(totals.totalPersonnel)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Personnel % of Revenue</p>
            <p className={`text-lg font-semibold ${healthColor}`}>
              {totals.pctOfRevenue.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total FTE</p>
            <p className="text-lg font-semibold text-slate-800">{totals.totalFte.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Student:Teacher Ratio</p>
            <p className="text-lg font-semibold text-slate-800">{totals.studentTeacherRatio}:1</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Est. Total Revenue</p>
            <p className="text-lg font-semibold text-slate-800">{fmt(totalRevenue)}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totals.pctOfRevenue > 85 ? 'bg-red-500' : totals.pctOfRevenue > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(totals.pctOfRevenue, 100)}%` }}
            />
          </div>
          <p className={`text-xs mt-1 ${healthColor}`}>{healthLabel}</p>
        </div>
      </div>

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
                <tr key={p.key} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={p.title}
                      onChange={(e) => updatePosition(p.key, 'title', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      value={p.category}
                      onChange={(e) => updatePosition(p.key, 'category', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded text-right text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      value={p.salary}
                      onChange={(e) => updatePosition(p.key, 'salary', Number(e.target.value))}
                      min={0}
                      step={1000}
                      className="w-28 px-2 py-1.5 border border-slate-200 rounded text-right text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </form>
  )
}
