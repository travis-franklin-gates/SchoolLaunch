'use client'

import { useState, useMemo } from 'react'
import { calcSections, calcEnrollmentGrowth } from '@/lib/calculations'
import type { GrowthPreset } from '@/lib/types'

const GROWTH_RATES: Record<Exclude<GrowthPreset, 'manual'>, number> = {
  conservative: 5,
  moderate: 10,
  aggressive: 15,
}

interface Props {
  initialData: {
    enrollmentY1: number
    maxClassSize: number
    enrollmentY2: number
    enrollmentY3: number
    enrollmentY4: number
    growthPreset: GrowthPreset
  }
  onNext: (data: {
    enrollmentY1: number
    maxClassSize: number
    enrollmentY2: number
    enrollmentY3: number
    enrollmentY4: number
    growthPreset: GrowthPreset
  }) => void
  onBack: () => void
}

export default function StepEnrollment({ initialData, onNext, onBack }: Props) {
  const [enrollmentY1, setEnrollmentY1] = useState(initialData.enrollmentY1 || 120)
  const [maxClassSize, setMaxClassSize] = useState(initialData.maxClassSize || 22)
  const [growthPreset, setGrowthPreset] = useState<GrowthPreset>(initialData.growthPreset || 'moderate')
  const [manualY2, setManualY2] = useState(initialData.enrollmentY2 || 0)
  const [manualY3, setManualY3] = useState(initialData.enrollmentY3 || 0)
  const [manualY4, setManualY4] = useState(initialData.enrollmentY4 || 0)

  const enrollments = useMemo(() => {
    if (growthPreset === 'manual') {
      return {
        y2: manualY2 || enrollmentY1,
        y3: manualY3 || enrollmentY1,
        y4: manualY4 || enrollmentY1,
      }
    }
    const rate = GROWTH_RATES[growthPreset]
    return {
      y2: calcEnrollmentGrowth(enrollmentY1, rate, 2),
      y3: calcEnrollmentGrowth(enrollmentY1, rate, 3),
      y4: calcEnrollmentGrowth(enrollmentY1, rate, 4),
    }
  }, [enrollmentY1, growthPreset, manualY2, manualY3, manualY4])

  const sectionsY1 = calcSections(enrollmentY1, maxClassSize)

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    onNext({
      enrollmentY1,
      maxClassSize,
      enrollmentY2: enrollments.y2,
      enrollmentY3: enrollments.y3,
      enrollmentY4: enrollments.y4,
      growthPreset,
    })
  }

  function selectPreset(preset: GrowthPreset) {
    setGrowthPreset(preset)
    if (preset === 'manual') {
      const rate = GROWTH_RATES.moderate
      setManualY2(calcEnrollmentGrowth(enrollmentY1, rate, 2))
      setManualY3(calcEnrollmentGrowth(enrollmentY1, rate, 3))
      setManualY4(calcEnrollmentGrowth(enrollmentY1, rate, 4))
    }
  }

  return (
    <form onSubmit={handleNext} className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Target Enrollment Year 1</label>
        <input
          type="number"
          value={enrollmentY1}
          onChange={(e) => setEnrollmentY1(Number(e.target.value))}
          min={1}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Max Class Size</label>
        <input
          type="number"
          value={maxClassSize}
          onChange={(e) => setMaxClassSize(Number(e.target.value))}
          min={10}
          max={35}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
        />
      </div>

      <div className="bg-blue-50 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-800">
          Estimated sections needed: <span className="font-semibold">{sectionsY1}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">Year 2-4 Growth</label>
        <div className="flex gap-2 mb-4">
          {(['conservative', 'moderate', 'aggressive', 'manual'] as GrowthPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => selectPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                growthPreset === preset
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {preset === 'manual' ? 'Manual' : `${preset.charAt(0).toUpperCase() + preset.slice(1)} +${GROWTH_RATES[preset]}%`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year 2</label>
            {growthPreset === 'manual' ? (
              <input
                type="number"
                value={manualY2}
                onChange={(e) => setManualY2(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                {enrollments.y2}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year 3</label>
            {growthPreset === 'manual' ? (
              <input
                type="number"
                value={manualY3}
                onChange={(e) => setManualY3(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                {enrollments.y3}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year 4</label>
            {growthPreset === 'manual' ? (
              <input
                type="number"
                value={manualY4}
                onChange={(e) => setManualY4(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            ) : (
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                {enrollments.y4}
              </div>
            )}
          </div>
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
