'use client'

import { useState, useMemo, useEffect } from 'react'
import type { GradeExpansionEntry } from '@/lib/types'
import {
  gradesForConfig,
  defaultOpeningGrades,
  sortGrades,
  generateExpansionPlan,
  defaultYearNewGrades,
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

  // Per-year new grade assignments (editable by user)
  const [yearNewGrades, setYearNewGrades] = useState<Map<number, string[]>>(() => {
    if (initialPlan && initialPlan.length > 0) {
      // Extract from existing plan
      const map = new Map<number, string[]>()
      for (const entry of initialPlan) {
        if (entry.is_new_grade) {
          const existing = map.get(entry.year) || []
          existing.push(entry.grade_level)
          map.set(entry.year, sortGrades(existing))
        }
      }
      return map
    }
    const initOpening = initialOpeningGrades && initialOpeningGrades.length > 0
      ? initialOpeningGrades
      : defaultOpeningGrades(gradeConfig)
    const initBuildout = initialBuildoutGrades && initialBuildoutGrades.length > 0
      ? initialBuildoutGrades
      : configGrades
    return defaultYearNewGrades(initOpening, initBuildout)
  })

  // Custom per-year/grade overrides (sections, students_per_section)
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
    const base = generateExpansionPlan(openingGrades, buildoutGrades, sectionsPerGrade, studentsPerSection, yearNewGrades)
    return base.map((entry) => {
      const key = `${entry.year}-${entry.grade_level}`
      const override = planOverrides.get(key)
      if (override) {
        return { ...entry, sections: override.sections, students_per_section: override.students_per_section }
      }
      return entry
    })
  }, [openingGrades, buildoutGrades, sectionsPerGrade, studentsPerSection, yearNewGrades, planOverrides])

  const enrollments = useMemo(
    () => computeExpansionEnrollments(plan, retentionRate),
    [plan, retentionRate]
  )

  // Grades available to assign (in buildout, not in opening, not yet assigned to any year)
  const unassignedGrades = useMemo(() => {
    const openSet = new Set(openingGrades)
    const assigned = new Set<string>()
    for (const grades of yearNewGrades.values()) {
      for (const g of grades) assigned.add(g)
    }
    return sortGrades(buildoutGrades.filter((g) => !openSet.has(g) && !assigned.has(g)))
  }, [openingGrades, buildoutGrades, yearNewGrades])

  // Notify parent on changes
  useEffect(() => {
    onChange({
      openingGrades: sortGrades(openingGrades),
      buildoutGrades: sortGrades(buildoutGrades),
      retentionRate,
      plan,
      enrollments,
    })
  }, [openingGrades, buildoutGrades, retentionRate, plan, enrollments, onChange])

  function toggleOpeningGrade(grade: string) {
    const newList = openingGrades.includes(grade)
      ? openingGrades.filter((g) => g !== grade)
      : [...openingGrades, grade]
    setOpeningGrades(newList)
    setYearNewGrades(defaultYearNewGrades(newList, buildoutGrades))
  }

  function toggleBuildoutGrade(grade: string) {
    const newList = buildoutGrades.includes(grade)
      ? buildoutGrades.filter((g) => g !== grade)
      : [...buildoutGrades, grade]
    setBuildoutGrades(newList)
    setYearNewGrades(defaultYearNewGrades(openingGrades, newList))
  }

  function toggleYearGrade(year: number, grade: string) {
    setYearNewGrades((prev) => {
      const next = new Map(prev)
      const current = next.get(year) || []
      if (current.includes(grade)) {
        // Remove from this year
        next.set(year, current.filter((g) => g !== grade))
      } else {
        // Remove from any other year first
        for (const [y, grades] of next) {
          if (y !== year && grades.includes(grade)) {
            next.set(y, grades.filter((g) => g !== grade))
          }
        }
        next.set(year, sortGrades([...current, grade]))
      }
      return next
    })
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
              onClick={() => toggleOpeningGrade(g)}
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
              onClick={() => toggleBuildoutGrade(g)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                buildoutGrades.includes(g)
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : openingGrades.includes(g)
                  ? 'border-teal-300 bg-teal-50/50 text-teal-500'
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
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Expansion Timeline</h3>
        <p className="text-xs text-slate-400 mb-3">Click grade badges in the &ldquo;New Grades&rdquo; column to customize which grades are added each year.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Year</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Grades Served</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">New Grades</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">New Students</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600 font-bold">Total Students</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => {
                const yearAssigned = yearNewGrades.get(e.year) || []
                return (
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
                      {e.year === 1 ? (
                        <span className="text-slate-400 text-xs">Opening</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {/* Grades assigned to this year — teal, clickable to remove */}
                          {yearAssigned.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => toggleYearGrade(e.year, g)}
                              className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700 border border-teal-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer"
                              title={`Remove grade ${g} from Year ${e.year}`}
                            >
                              +{g}
                            </button>
                          ))}
                          {/* Unassigned grades — gray outline, clickable to add */}
                          {unassignedGrades.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => toggleYearGrade(e.year, g)}
                              className="px-2 py-0.5 rounded text-xs font-medium bg-white text-slate-400 border border-dashed border-slate-300 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
                              title={`Add grade ${g} to Year ${e.year}`}
                            >
                              {g}
                            </button>
                          ))}
                          {yearAssigned.length === 0 && unassignedGrades.length === 0 && (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-teal-600 font-medium">
                      {e.newGrade > 0 ? `+${e.newGrade}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                      {e.total}
                    </td>
                  </tr>
                )
              })}
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
                  .map((entry, idx) => (
                    <tr key={`${year}-${entry.grade_level}`} className={`border-b border-slate-100 ${entry.is_new_grade ? 'bg-teal-50/50' : ''}`}>
                      <td className="px-2 py-1.5 text-slate-600">{idx === 0 ? `Year ${year}` : ''}</td>
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
                          onChange={(ev) => updatePlanEntry(year, entry.grade_level, 'sections', Number(ev.target.value))}
                          className="w-14 text-center border border-slate-200 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          min={10}
                          max={35}
                          value={entry.students_per_section}
                          onChange={(ev) => updatePlanEntry(year, entry.grade_level, 'students_per_section', Number(ev.target.value))}
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
