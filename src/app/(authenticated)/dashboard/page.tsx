'use client'

import { useScenario } from '@/lib/ScenarioContext'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function reserveColor(days: number) {
  if (days >= 60) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
  if (days >= 30) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
}

function HealthTile({ label, value, subtitle, colorClass }: {
  label: string
  value: string
  subtitle?: string
  colorClass?: { bg: string; text: string; border: string }
}) {
  const bg = colorClass?.bg || 'bg-white'
  const text = colorClass?.text || 'text-slate-800'
  const border = colorClass?.border || 'border-slate-200'
  return (
    <div className={`${bg} ${border} border rounded-xl p-5`}>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${text}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const {
    schoolData: { profile, loading },
    baseSummary,
    scenario,
    scenarioInputs,
    scenarioSummary,
    isModified,
    currentSummary: current,
    updateScenario,
    resetScenario,
  } = useScenario()

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  const rc = reserveColor(current.reserveDays)
  const surplusColor = current.netPosition >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  const personnelColor = current.personnelPctRevenue <= 70
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : current.personnelPctRevenue <= 80
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }

  const delta = (base: number, curr: number, unit: string, invert = false) => {
    if (!isModified) return null
    const diff = curr - base
    if (diff === 0) return null
    const arrow = (invert ? -diff : diff) > 0 ? '\u2191' : '\u2193'
    return `${arrow}${Math.abs(Math.round(diff))} ${unit} from base`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Overview</h1>

      {/* Health tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HealthTile
          label="Year-End Reserve"
          value={`${current.reserveDays} days`}
          subtitle={delta(baseSummary.reserveDays, current.reserveDays, 'days') || undefined}
          colorClass={rc}
        />
        <HealthTile
          label="Personnel % of Revenue"
          value={`${current.personnelPctRevenue.toFixed(1)}%`}
          subtitle={delta(baseSummary.personnelPctRevenue, current.personnelPctRevenue, '%', true) || undefined}
          colorClass={personnelColor}
        />
        <HealthTile
          label="Year 1 Surplus/Deficit"
          value={fmt(current.netPosition)}
          subtitle={delta(baseSummary.netPosition, current.netPosition, '') || undefined}
          colorClass={surplusColor}
        />
        <HealthTile
          label="Break-Even Enrollment"
          value={`${current.breakEvenEnrollment} students`}
          subtitle={delta(baseSummary.breakEvenEnrollment, current.breakEvenEnrollment, 'students', true) || undefined}
        />
      </div>

      {/* Scenario panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Scenario Controls</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Opening Enrollment: {scenarioInputs.enrollment}
            </label>
            <input
              type="range"
              min={Math.round(profile.target_enrollment_y1 * 0.5)}
              max={Math.round(profile.target_enrollment_y1 * 1.5)}
              step={1}
              value={scenarioInputs.enrollment}
              onChange={(e) => updateScenario({ enrollment: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{Math.round(profile.target_enrollment_y1 * 0.5)}</span>
              <span>{Math.round(profile.target_enrollment_y1 * 1.5)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class Size Cap</label>
            <input
              type="number"
              min={15}
              max={30}
              value={scenarioInputs.classSize}
              onChange={(e) => updateScenario({ classSize: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lead Teacher Salary</label>
            <input
              type="number"
              step={1000}
              value={scenarioInputs.leadTeacherSalary}
              onChange={(e) => updateScenario({ leadTeacherSalary: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Monthly Lease</label>
            <input
              type="number"
              step={500}
              value={scenarioInputs.monthlyLease}
              onChange={(e) => updateScenario({ monthlyLease: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">+1 FTE Teacher</label>
            <button
              onClick={() => updateScenario({ extraTeacher: !scenarioInputs.extraTeacher })}
              className={`mt-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scenarioInputs.extraTeacher
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {scenarioInputs.extraTeacher ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {isModified && (
          <button
            onClick={resetScenario}
            className="mt-4 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Reset to Base Case
          </button>
        )}
      </div>

      {/* Budget summary table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 font-semibold text-slate-600"></th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Base Case</th>
              {isModified && <th className="text-right px-6 py-3 font-semibold text-blue-600">Scenario</th>}
              {isModified && <th className="text-right px-6 py-3 font-semibold text-slate-500">Delta</th>}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Total Revenue', base: baseSummary.totalRevenue, curr: scenarioSummary.totalRevenue },
              { label: 'Total Personnel', base: baseSummary.totalPersonnel, curr: scenarioSummary.totalPersonnel },
              { label: 'Total Operations', base: baseSummary.totalOperations, curr: scenarioSummary.totalOperations },
              { label: 'Net Position', base: baseSummary.netPosition, curr: scenarioSummary.netPosition, bold: true },
              { label: 'Reserve Days', base: baseSummary.reserveDays, curr: scenarioSummary.reserveDays, bold: true, isDays: true },
            ].map((row) => {
              const diff = row.curr - row.base
              return (
                <tr key={row.label} className="border-b border-slate-100 last:border-0">
                  <td className={`px-6 py-3 ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {row.label}
                  </td>
                  <td className={`px-6 py-3 text-right ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {row.isDays ? `${row.base} days` : fmt(row.base)}
                  </td>
                  {isModified && (
                    <td className={`px-6 py-3 text-right ${row.bold ? 'font-semibold' : ''} ${
                      row.isDays
                        ? (row.curr >= 60 ? 'text-emerald-600' : row.curr >= 30 ? 'text-amber-600' : 'text-red-600')
                        : row.label === 'Net Position'
                        ? (row.curr >= 0 ? 'text-emerald-600' : 'text-red-600')
                        : 'text-blue-600'
                    }`}>
                      {row.isDays ? `${row.curr} days` : fmt(row.curr)}
                    </td>
                  )}
                  {isModified && (
                    <td className={`px-6 py-3 text-right text-sm ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {diff === 0 ? '—' : row.isDays ? `${diff > 0 ? '+' : ''}${diff}` : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
