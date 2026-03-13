'use client'

import { useState, useMemo, useCallback } from 'react'
import type { GradeExpansionEntry } from '@/lib/types'
import {
  ALL_GRADES,
  gradesForConfig,
  defaultOpeningGrades,
  sortGrades,
  generateExpansionPlan,
  computeExpansionEnrollments,
} from '@/lib/gradeExpansion'

interface Props {
  gradeConfig: string
  maxClassSize: number
  initialOpeningGrades?: string[]
  initialBuildoutGrades?: string[]
  initialRetentionRate?: number
  initialPlan?: GradeExpansionEntry[]
  onChange: (data: {
    openingGrades: string[]
    buildoutGrades: string[]
    retentionRate: number
    plan: GradeExpansionEntry[]
    enrollments: { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[]
  }) => void
}

export default function GradeExpansionEditor({
  gradeConfig,
  maxClassSize,
  initialOpeningGrades,
  initialBuildoutGrades,
  initialRetentionRate,
  initialPlan,
  onChange,
}: Props) {
  const configGrades = gradesForConfig(gradeConfig)

  const [openingGrades, setOpeningGrades] = useState<string[]>(
    initialOpeningGrades && initialOpeningGrades.length > 0
      ? initialOpeningGrades
      : defaultOpeningGrades(gradeConfig)
  )
  const [buildoutGrades, setBuildoutGrades] = useState<string[]>(
    initialBuildoutGrades && initialBuildoutGrades.length > 0
      ? initialBuildoutGrades
      : configGrades
  )
  const [retentionRate, setRetentionRate] = useState(initialRetentionRate ?? 90)
  const [sectionsPerGrade, setSectionsPerGrade] = useState(
    initialPlan && initialPlan.length > 0 ? (initialPlan[0].sections || 2) : 2
  )
  const [studentsPerSection, setStudentsPerSection] = useState(
    initialPlan && initialPlan.length > 0 ? (initialPlan[0].students_per_section || maxClassSize) : maxClassSize
  )

  // Custom per-year/grade overrides
  const [planOverrides, setPlanOverrides] = useState<Map<string, { sections: number; students_per_section: number }>>(
    () => {
      const map = new Map()
      if (initialPlan) {
        for (const e of initialPlan) {
          map.set(`${e.year}-${e.grade_level}`, { sections: e.sections, students_per_section: e.students_per_section })
        }
      }
      return map
    }
  )

  const plan = useMemo(() => {
    const base = generateExpansionPlan(openingGrades, buildoutGrades, sectionsPerGrade, studentsPerSection)
    // Apply overrides
    return base.map((entry) => {
      const key = `${entry.year}-${entry.grade_level}`
      const override = planOverrides.get(key)
      if (override) {
        return { ...entry, sections: override.sections, students_per_section: override.students_per_section }
      }
      return entry
    })
  }, [openingGrades, buildoutGrades, sectionsPerGrade, studentsPerSection, planOverrides])

  const enrollments = useMemo(
    () => computeExpansionEnrollments(plan, retentionRate),
    [plan, retentionRate]
  )

  // Notify parent on changes
  const notifyChange = useCallback(() => {
    onChange({
      openingGrades: sortGrades(openingGrades),
      buildoutGrades: sortGrades(buildoutGrades),
      retentionRate,
      plan,
      enrollments,
    })
  }, [openingGrades, buildoutGrades, retentionRate, plan, enrollments, onChange])

  // Call onChange whenever computed data changes
  useMemo(() => {
    notifyChange()
  }, [notifyChange])

  function toggleGrade(grade: string, list: string[], setList: (g: string[]) => void) {
    if (list.includes(grade)) {
      setList(list.filter((g) => g !== grade))
    } else {
      setList([...list, grade])
    }
  }

  function updatePlanEntry(year: number, grade: string, field: 'sections' | 'students_per_section', value: number) {
    setPlanOverrides((prev) => {
      const next = new Map(prev)
      const key = `${year}-${grade}`
      const existing = next.get(key) || { sections: sectionsPerGrade, students_per_section: studentsPerSection }
      next.set(key, { ...existing, [field]: value })
      return next
    })
  }

  const years = Array.from(new Set(plan.map((e) => e.year))).sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      {/* Opening Grades */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Opening Grades (Year 1)
        </label>
        <p className="text-xs text-slate-400 mb-2">Which grade levels will you serve in your first year?</p>
        <div className="flex flex-wrap gap-1.5">
          {configGrades.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGrade(g, openingGrades, setOpeningGrades)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                openingGrades.includes(g)
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {g === 'K' ? 'K' : `Grade ${g}`}
            </button>
          ))}
        </div>
      </div>

      {/* Buildout Grades */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Full Buildout Grades
        </label>
        <p className="text-xs text-slate-400 mb-2">Which grade levels will you serve when fully grown?</p>
        <div className="flex flex-wrap gap-1.5">
          {configGrades.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGrade(g, buildoutGrades, setBuildoutGrades)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                buildoutGrades.includes(g)
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : openingGrades.includes(g)
                  ? 'border-blue-300 bg-teal-50/50 text-teal-500'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {g === 'K' ? 'K' : `Grade ${g}`}
            </button>
          ))}
        </div>
      </div>

      {/* Global defaults */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Sections per Grade</label>
          <input
            type="number"
            min={1}
            max={6}
            value={sectionsPerGrade}
            onChange={(e) => setSectionsPerGrade(Number(e.target.value))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Students per Section</label>
          <input
            type="number"
            min={10}
            max={35}
            value={studentsPerSection}
            onChange={(e) => setStudentsPerSection(Number(e.target.value))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Retention Rate: {retentionRate}%
          </label>
          <input
            type="range"
            min={70}
            max={100}
            value={retentionRate}
            onChange={(e) => setRetentionRate(Number(e.target.value))}
            className="w-full accent-teal-600 mt-2"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>70%</span>
            <span>WA average: 85–92%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Expansion Timeline Table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Expansion Timeline</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Year</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Grades Served</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">New Grades</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Returning</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">New Grade</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600 font-bold">Total Students</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.year} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-700">Year {e.year}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {e.grades.map((g) => (
                      <span
                        key={g}
                        className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1 ${
                          e.newGrades.includes(g)
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {g}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.newGrades.length > 0 ? (
                      <span className="text-teal-600 font-medium text-xs">
                        +{e.newGrades.join(', ')}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {e.year === 1 ? '—' : e.returning}
                  </td>
                  <td className="px-3 py-2.5 text-right text-teal-600 font-medium">
                    {e.year === 1 ? e.total : (e.newGrade > 0 ? `+${e.newGrade}` : '—')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                    {e.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-year grade detail (expandable) */}
      <details className="text-sm">
        <summary className="text-xs font-medium text-teal-600 cursor-pointer hover:text-teal-800">
          Edit sections per grade by year
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-2 py-1.5 font-medium text-slate-500">Year</th>
                <th className="text-left px-2 py-1.5 font-medium text-slate-500">Grade</th>
                <th className="text-center px-2 py-1.5 font-medium text-slate-500">Sections</th>
                <th className="text-center px-2 py-1.5 font-medium text-slate-500">Students/Section</th>
                <th className="text-right px-2 py-1.5 font-medium text-slate-500">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) =>
                plan
                  .filter((e) => e.year === year)
                  .map((entry) => (
                    <tr key={`${year}-${entry.grade_level}`} className={`border-b border-slate-100 ${entry.is_new_grade ? 'bg-teal-50/50' : ''}`}>
                      <td className="px-2 py-1.5 text-slate-600">{entry.grade_level === plan.filter(e => e.year === year)[0]?.grade_level ? `Year ${year}` : ''}</td>
                      <td className="px-2 py-1.5">
                        <span className={`${entry.is_new_grade ? 'text-teal-700 font-medium' : 'text-slate-600'}`}>
                          {entry.grade_level === 'K' ? 'K' : entry.grade_level}
                          {entry.is_new_grade && <span className="text-[10px] ml-1 text-teal-500">NEW</span>}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={entry.sections}
                          onChange={(e) => updatePlanEntry(year, entry.grade_level, 'sections', Number(e.target.value))}
                          className="w-14 text-center border border-slate-200 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min={10}
                          max={35}
                          value={entry.students_per_section}
                          onChange={(e) => updatePlanEntry(year, entry.grade_level, 'students_per_section', Number(e.target.value))}
                          className="w-14 text-center border border-slate-200 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-700 font-medium">
                        {entry.sections * entry.students_per_section}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
