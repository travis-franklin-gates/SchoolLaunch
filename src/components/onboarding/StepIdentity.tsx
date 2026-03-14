'use client'

import { useState, useMemo } from 'react'
import { ALL_GRADES, sortGrades, gradeIndex, deriveGradeConfig } from '@/lib/gradeExpansion'

const REGIONS = [
  'King County',
  'Pierce County',
  'Snohomish County',
  'Spokane County',
  'Clark County',
  'Other',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear + i)

interface Props {
  initialData: {
    schoolName: string
    region: string
    plannedOpenYear: number
    foundingGrades: string[]
    buildoutGrades: string[]
  }
  onNext: (data: {
    schoolName: string
    region: string
    plannedOpenYear: number
    foundingGrades: string[]
    buildoutGrades: string[]
    gradeConfig: string
  }) => void
}

export default function StepIdentity({ initialData, onNext }: Props) {
  const [schoolName, setSchoolName] = useState(initialData.schoolName)
  const [region, setRegion] = useState(initialData.region || REGIONS[0])
  const [plannedOpenYear, setPlannedOpenYear] = useState(initialData.plannedOpenYear || YEARS[0])
  const [foundingGrades, setFoundingGrades] = useState<string[]>(
    initialData.foundingGrades.length > 0 ? initialData.foundingGrades : []
  )
  const [buildoutGrades, setBuildoutGrades] = useState<string[]>(
    initialData.buildoutGrades.length > 0 ? initialData.buildoutGrades : []
  )
  const [touched, setTouched] = useState(false)

  const nameError = touched && schoolName.trim().length < 3 ? 'School name must be at least 3 characters' : null
  const gradesError = touched && foundingGrades.length === 0 ? 'Select at least one founding grade' : null
  const buildoutError = touched && buildoutGrades.length === 0 ? 'Select at least one build-out grade' : null

  function toggleFoundingGrade(grade: string) {
    setFoundingGrades((prev) => {
      const next = prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
      // Auto-add to buildout if not already there
      if (!prev.includes(grade)) {
        setBuildoutGrades((bo) => bo.includes(grade) ? bo : sortGrades([...bo, grade]))
      }
      return sortGrades(next)
    })
  }

  function toggleBuildoutGrade(grade: string) {
    setBuildoutGrades((prev) => {
      if (prev.includes(grade)) {
        // Don't allow removing a founding grade from buildout
        if (foundingGrades.includes(grade)) return prev
        return prev.filter((g) => g !== grade)
      }
      return sortGrades([...prev, grade])
    })
  }

  const summary = useMemo(() => {
    if (foundingGrades.length === 0 || buildoutGrades.length === 0) return null
    const sortedFounding = sortGrades(foundingGrades)
    const sortedBuildout = sortGrades(buildoutGrades)
    const fFirst = sortedFounding[0]
    const fLast = sortedFounding[sortedFounding.length - 1]
    const bFirst = sortedBuildout[0]
    const bLast = sortedBuildout[sortedBuildout.length - 1]
    const foundingLabel = fFirst === fLast ? fFirst : `${fFirst}–${fLast}`
    const buildoutLabel = bFirst === bLast ? bFirst : `${bFirst}–${bLast}`
    const expansionGrades = buildoutGrades.length - foundingGrades.length
    return {
      foundingLabel,
      buildoutLabel,
      foundingCount: foundingGrades.length,
      buildoutCount: buildoutGrades.length,
      expansionGrades,
    }
  }, [foundingGrades, buildoutGrades])

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (schoolName.trim().length < 3) return
    if (foundingGrades.length === 0 || buildoutGrades.length === 0) return
    onNext({
      schoolName: schoolName.trim(),
      region,
      plannedOpenYear,
      foundingGrades,
      buildoutGrades,
      gradeConfig: deriveGradeConfig(buildoutGrades),
    })
  }

  return (
    <form onSubmit={handleNext} className="space-y-6 max-w-xl">
      <p className="text-sm text-slate-500">
        Tell us about your school. This information shapes the financial model.
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">School Name *</label>
        <input
          type="text"
          value={schoolName}
          onChange={(e) => { setSchoolName(e.target.value); setTouched(true) }}
          className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 ${
            nameError ? 'border-red-300 bg-red-50' : 'border-slate-300'
          }`}
          placeholder="e.g., Cascade Academy"
        />
        {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">WA Region</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1">Region affects facility costs and demographic benchmarks</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Planned Opening Year</label>
        <select
          value={plannedOpenYear}
          onChange={(e) => setPlannedOpenYear(Number(e.target.value))}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}–{y + 1} School Year</option>
          ))}
        </select>
      </div>

      {/* Founding Grades */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Founding Grades *
          <span className="font-normal text-slate-400 ml-1">— grades you will serve in Year 1</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_GRADES.map((g) => {
            const selected = foundingGrades.includes(g)
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleFoundingGrade(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  selected
                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {g}
              </button>
            )
          })}
        </div>
        {gradesError && <p className="text-xs text-red-600 mt-1">{gradesError}</p>}
      </div>

      {/* Build-Out Grades */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Grades at Full Build-Out *
          <span className="font-normal text-slate-400 ml-1">— all grades you will eventually serve</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_GRADES.map((g) => {
            const selected = buildoutGrades.includes(g)
            const isFounding = foundingGrades.includes(g)
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleBuildoutGrade(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  selected
                    ? isFounding
                      ? 'border-teal-600 bg-teal-100 text-teal-800 cursor-default'
                      : 'border-teal-600 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
                title={isFounding ? 'Founding grade (included automatically)' : undefined}
              >
                {g}
                {isFounding && selected && (
                  <span className="ml-1 text-xs text-teal-500">F</span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 mt-1">Founding grades are pre-selected. Additional grades will be added during expansion years.</p>
        {buildoutError && <p className="text-xs text-red-600 mt-1">{buildoutError}</p>}
      </div>

      {/* Dynamic Summary */}
      {summary && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
          <p className="text-sm font-medium text-teal-800">
            Opening with {summary.foundingLabel} ({summary.foundingCount} {summary.foundingCount === 1 ? 'grade' : 'grades'})
            {' → '}
            Growing to {summary.buildoutLabel} ({summary.buildoutCount} {summary.buildoutCount === 1 ? 'grade' : 'grades'})
          </p>
          {summary.expansionGrades > 0 && (
            <p className="text-xs text-teal-600 mt-1">
              {summary.expansionGrades} {summary.expansionGrades === 1 ? 'grade' : 'grades'} added during expansion (Years 2–5)
            </p>
          )}
          {summary.expansionGrades === 0 && (
            <p className="text-xs text-teal-600 mt-1">
              No expansion — all grades served from Year 1
            </p>
          )}
        </div>
      )}

      <div className="pt-4">
        <button
          type="submit"
          className="bg-teal-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </form>
  )
}
