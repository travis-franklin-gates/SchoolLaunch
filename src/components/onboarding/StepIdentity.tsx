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

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    onNext({ schoolName, region, plannedOpenYear, gradeConfig })
  }

  return (
    <form onSubmit={handleNext} className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
        <input
          type="text"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          placeholder="Enter school name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">WA Region</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Planned Opening Year</label>
        <select
          value={plannedOpenYear}
          onChange={(e) => setPlannedOpenYear(Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Grade Configuration</label>
        <select
          value={gradeConfig}
          onChange={(e) => setGradeConfig(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
        >
          {GRADE_CONFIGS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="pt-4">
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
