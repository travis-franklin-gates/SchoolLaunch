'use client'

import { useState } from 'react'

const REGIONS = [
  'King County',
  'Pierce County',
  'Snohomish County',
  'Spokane County',
  'Clark County',
  'Other',
]

const GRADE_CONFIGS = ['K-5', 'K-8', '6-8', '9-12']

const GRADE_CONFIG_TIPS: Record<string, { desc: string; typical: string; note: string }> = {
  'K-5': {
    desc: 'Elementary school serving kindergarten through 5th grade',
    typical: 'Typical enrollment: 100–300 students, 5–12 teachers',
    note: 'Most common WA charter model. Strong demand in urban/suburban areas.',
  },
  'K-8': {
    desc: 'Full primary school serving kindergarten through 8th grade',
    typical: 'Typical enrollment: 200–500 students, 10–20 teachers',
    note: 'Longer student retention but requires middle school staffing and curriculum.',
  },
  '6-8': {
    desc: 'Middle school serving grades 6 through 8',
    typical: 'Typical enrollment: 150–400 students, 8–16 teachers',
    note: 'Less common for charters. Requires subject-specific certificated staff.',
  },
  '9-12': {
    desc: 'High school serving grades 9 through 12',
    typical: 'Typical enrollment: 200–600 students, 12–25 teachers',
    note: 'Higher per-pupil costs. Requires counseling, electives, and lab facilities.',
  },
}

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear + i)

interface Props {
  initialData: {
    schoolName: string
    region: string
    plannedOpenYear: number
    gradeConfig: string
  }
  onNext: (data: { schoolName: string; region: string; plannedOpenYear: number; gradeConfig: string }) => void
}

export default function StepIdentity({ initialData, onNext }: Props) {
  const [schoolName, setSchoolName] = useState(initialData.schoolName)
  const [region, setRegion] = useState(initialData.region || REGIONS[0])
  const [plannedOpenYear, setPlannedOpenYear] = useState(initialData.plannedOpenYear || YEARS[0])
  const [gradeConfig, setGradeConfig] = useState(initialData.gradeConfig || GRADE_CONFIGS[0])
  const [touched, setTouched] = useState(false)

  const nameError = touched && schoolName.trim().length < 3 ? 'School name must be at least 3 characters' : null

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (schoolName.trim().length < 3) return
    onNext({ schoolName: schoolName.trim(), region, plannedOpenYear, gradeConfig })
  }

  const tip = GRADE_CONFIG_TIPS[gradeConfig]

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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Grade Configuration</label>
        <div className="grid grid-cols-2 gap-2">
          {GRADE_CONFIGS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGradeConfig(g)}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                gradeConfig === g
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {tip && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
          <p className="text-sm font-medium text-teal-800 mb-1">{tip.desc}</p>
          <p className="text-xs text-teal-600">{tip.typical}</p>
          <p className="text-xs text-teal-600 mt-1">{tip.note}</p>
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
