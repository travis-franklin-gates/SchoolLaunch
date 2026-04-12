'use client'

import type { GenericHealthScorecard } from '@/lib/budgetEngine'

interface Props {
  scorecard: GenericHealthScorecard
}

const STATUS_COLORS = {
  green: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  yellow: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  red: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
}

export default function GenericScorecard({ scorecard }: Props) {
  const { measures, overallStatus, overallMessage } = scorecard
  const colors = STATUS_COLORS[overallStatus]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'var(--font-heading-var)' }}>
          Financial Health Scorecard
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Key financial metrics assessed against universal school health benchmarks
        </p>
      </div>

      {/* Overall status banner */}
      <div className={`${colors.bg} rounded-xl p-4 flex items-start gap-3`}>
        <div className={`w-3 h-3 ${colors.dot} rounded-full mt-1 flex-shrink-0`} />
        <div>
          <p className={`text-sm font-semibold ${colors.text}`}>
            {overallStatus === 'green' ? 'Healthy' : overallStatus === 'yellow' ? 'Watch' : 'Concern'}
          </p>
          <p className={`text-sm ${colors.text} mt-0.5`}>{overallMessage}</p>
        </div>
      </div>

      {/* Metrics table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Metric</th>
              {[1, 2, 3, 4, 5].map(y => (
                <th key={y} className="text-center px-3 py-3 font-semibold text-slate-600">Year {y}</th>
              ))}
              <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs">Benchmarks</th>
            </tr>
          </thead>
          <tbody>
            {measures.filter(m => m.applicable).map((measure) => (
              <tr key={measure.name} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{measure.name}</td>
                {measure.values.map((v) => {
                  const cellColors = STATUS_COLORS[v.status]
                  return (
                    <td key={v.year} className="text-center px-3 py-3">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold ${cellColors.bg} ${cellColors.text}`}>
                        {v.formatted}
                      </span>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-xs text-slate-400">
                  <div className="space-y-0.5">
                    <div><span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1" />{measure.healthy}</div>
                    <div><span className="inline-block w-2 h-2 bg-amber-500 rounded-full mr-1" />{measure.watch}</div>
                    <div><span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />{measure.concern}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* About section */}
      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">About This Scorecard</summary>
        <div className="mt-2 space-y-2 pl-4">
          <p>This scorecard projects your school&apos;s financial health against universal benchmarks used by school financial analysts and accreditation bodies.</p>
          <p>Green indicates healthy performance. Yellow suggests areas to monitor. Red highlights metrics that need attention before finalizing your financial plan.</p>
          <p>These are planning-stage estimates. Actual performance may vary based on enrollment, revenue timing, and expense management.</p>
        </div>
      </details>
    </div>
  )
}
