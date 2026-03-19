'use client'

import React, { useState, useMemo, useEffect } from 'react'
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
  const retentionRate = 100

  // Default students per section (used for new grades that have no override)
  const [defaultStudentsPerSection, setDefaultStudentsPerSection] = useState(
    initialPlan && initialPlan.length > 0 ? (initialPlan[0].students_per_section || maxClassSize) : maxClassSize
  )

  // Per-year new grade assignments (editable by user)
  const [yearNewGrades, setYearNewGrades] = useState<Map<number, string[]>>(() => {
    if (initialPlan && initialPlan.length > 0) {
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
    // Default sections = 1 for new plans
    const defaultSections = initialPlan && initialPlan.length > 0 ? (initialPlan[0].sections || 1) : 1
    const base = generateExpansionPlan(openingGrades, buildoutGrades, defaultSections, defaultStudentsPerSection, yearNewGrades)
    return base.map((entry) => {
      const key = `${entry.year}-${entry.grade_level}`
      const override = planOverrides.get(key)
      if (override) {
        return { ...entry, sections: override.sections, students_per_section: override.students_per_section }
      }
      return entry
    })
  }, [openingGrades, buildoutGrades, defaultStudentsPerSection, yearNewGrades, planOverrides, initialPlan])

  const enrollments = useMemo(
    () => computeExpansionEnrollments(plan, retentionRate),
    [plan, retentionRate]
  )

  // For each year, compute which buildout grades are NOT yet served
  const availableByYear = useMemo(() => {
    const map = new Map<number, string[]>()
    const served = new Set(openingGrades)
    for (let year = 2; year <= 5; year++) {
      const priorNew = yearNewGrades.get(year - 1) || []
      for (const g of priorNew) served.add(g)
      const thisYearAssigned = new Set(yearNewGrades.get(year) || [])
      const available = sortGrades(buildoutGrades.filter((g) => !served.has(g) && !thisYearAssigned.has(g)))
      map.set(year, available)
    }
    return map
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
        next.set(year, current.filter((g) => g !== grade))
      } else {
        next.set(year, sortGrades([...current, grade]))
      }
      return next
    })
  }

  function updatePlanEntry(year: number, grade: string, field: 'sections' | 'students_per_section', value: number) {
    setPlanOverrides((prev) => {
      const next = new Map(prev)
      const key = `${year}-${grade}`
      const entry = plan.find((e) => e.year === year && e.grade_level === grade)
      const existing = next.get(key) || {
        sections: entry?.sections || 1,
        students_per_section: entry?.students_per_section || defaultStudentsPerSection,
      }
      next.set(key, { ...existing, [field]: value })
      return next
    })
  }

  const years = Array.from(new Set(plan.map((e) => e.year))).sort((a, b) => a - b)

  // Founding grades config for the per-grade table
  const foundingEntries = plan.filter((e) => e.year === 1)
  const foundingTotal = foundingEntries.reduce((s, e) => s + e.sections * e.students_per_section, 0)
  const foundingSections = foundingEntries.reduce((s, e) => s + e.sections, 0)

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

      {/* Per-Grade Founding Configuration */}
      {foundingEntries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Year 1 Grade Configuration</h3>
          <p className="text-xs text-slate-400 mb-3">Set sections and class size for each founding grade.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Grade</th>
                  <th className="text-center px-3 py-2 font-semibold text-slate-600">Sections</th>
                  <th className="text-center px-3 py-2 font-semibold text-slate-600">Students / Section</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-600">Students</th>
                </tr>
              </thead>
              <tbody>
                {foundingEntries.map((entry) => (
                  <tr key={entry.grade_level} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      {entry.grade_level === 'K' ? 'Kindergarten' : `Grade ${entry.grade_level}`}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <select
                        value={entry.sections}
                        onChange={(e) => updatePlanEntry(1, entry.grade_level, 'sections', Number(e.target.value))}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="number"
                        min={10}
                        max={35}
                        value={entry.students_per_section}
                        onChange={(e) => updatePlanEntry(1, entry.grade_level, 'students_per_section', Number(e.target.value))}
                        className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                      {entry.sections * entry.students_per_section}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-3 py-2 font-bold text-slate-700">Total Year 1</td>
                  <td className="px-3 py-2 text-center font-semibold text-slate-600">{foundingSections}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{foundingTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Expansion Timeline — unified per-grade detail */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Grade Expansion Plan</h3>
        <p className="text-xs text-slate-400 mb-3">
          Full plan by year. Click grade badges to customize which grades are added each year. Edit sections and class size per grade.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Grade</th>
                <th className="text-center px-3 py-2 font-semibold text-slate-600">Sections</th>
                <th className="text-center px-3 py-2 font-semibold text-slate-600">Students/Section</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Students</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Year Added</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const yearEntries = plan.filter((e) => e.year === year)
                const yearTotal = yearEntries.reduce((s, e) => s + e.sections * e.students_per_section, 0)
                const yearAssigned = yearNewGrades.get(year) || []

                return (
                  <React.Fragment key={year}>
                    {/* Year header row */}
                    <tr className="bg-slate-50/60 border-b border-slate-200">
                      <td colSpan={3} className="px-3 py-2 font-bold text-slate-700 text-xs uppercase tracking-wide">
                        Year {year}
                        {year > 1 && (
                          <span className="ml-2 font-normal normal-case tracking-normal">
                            {/* New grade toggle badges */}
                            {yearAssigned.map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => toggleYearGrade(year, g)}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700 border border-teal-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer ml-1"
                                title={`Remove grade ${g} from Year ${year}`}
                              >
                                +{g}
                              </button>
                            ))}
                            {(availableByYear.get(year) || []).map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => toggleYearGrade(year, g)}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-white text-slate-400 border border-dashed border-slate-300 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer ml-1"
                                title={`Add grade ${g} to Year ${year}`}
                              >
                                {g}
                              </button>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-800 text-xs">{yearTotal} students</td>
                      <td className="px-3 py-2"></td>
                    </tr>
                    {/* Per-grade rows */}
                    {yearEntries.map((entry) => (
                      <tr key={`${year}-${entry.grade_level}`} className={`border-b border-slate-100 ${entry.is_new_grade ? 'bg-teal-50/40' : ''}`}>
                        <td className="px-3 py-2 pl-6">
                          <span className={entry.is_new_grade ? 'text-teal-700 font-medium' : 'text-slate-600'}>
                            {entry.grade_level === 'K' ? 'K' : `Grade ${entry.grade_level}`}
                            {entry.is_new_grade && <span className="text-[10px] ml-1.5 text-teal-500 font-semibold">NEW</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={entry.sections}
                            onChange={(e) => updatePlanEntry(year, entry.grade_level, 'sections', Number(e.target.value))}
                            className="border border-slate-200 rounded px-1.5 py-1 text-xs text-center bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            {[1, 2, 3, 4].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={10}
                            max={35}
                            value={entry.students_per_section}
                            onChange={(e) => updatePlanEntry(year, entry.grade_level, 'students_per_section', Number(e.target.value))}
                            className="w-14 text-center border border-slate-200 rounded px-1.5 py-1 text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 font-medium">
                          {entry.sections * entry.students_per_section}
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-xs">
                          {entry.is_new_grade ? `Year ${year}` : 'Year 1'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
