'use client'

import { useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeMultiYearDetailed, computeFPFScorecard, computeCarryForward } from '@/lib/budgetEngine'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export default function ScorecardPage() {
  const {
    schoolData: { profile, positions, allPositions, projections, gradeExpansionPlan, loading },
    assumptions,
  } = useScenario()

  const preOpenCash = useMemo(() => computeCarryForward(profile), [profile])

  const multiYear = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, preOpenCash, gradeExpansionPlan, allPositions, profile.startup_funding),
    [profile, positions, allPositions, projections, assumptions, gradeExpansionPlan, preOpenCash]
  )

  const scorecard = useMemo(
    () => computeFPFScorecard(multiYear, preOpenCash, false),
    [multiYear, preOpenCash]
  )

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold text-slate-900 mb-1">Commission Scorecard</h1>
      <p className="text-sm text-slate-500 mb-6">
        Financial Performance Framework assessment against WA Charter School Commission standards
      </p>

      {/* Overall status banner */}
      <div data-tour="scorecard-banner" className={`mb-6 px-5 py-3 rounded-xl text-sm font-medium ${
        scorecard.overallStatus === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : scorecard.overallStatus === 'yellow' ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}>
        {scorecard.overallMessage}
      </div>

      {/* Full scorecard table */}
      <div data-tour="scorecard-table" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Financial Performance Framework</h2>
          <div data-tour="scorecard-stages" className="flex gap-4 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white" style={{ background: 'var(--navy-light)' }}>Stage 1</span> Years 1-2</span>
            <span className="inline-flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white" style={{ background: 'var(--navy-light)' }}>Stage 2</span> Years 3-5</span>
          </div>
        </div>
        <div className="overflow-x-auto sl-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-3 font-medium text-slate-400 uppercase tracking-wide text-[11px] min-w-[160px]">Measure</th>
                {[1, 2, 3, 4, 5].map((y) => (
                  <th key={y} className="text-center px-3 py-2 font-medium text-slate-400 uppercase tracking-wide text-[11px] min-w-[70px]">Year {y}</th>
                ))}
                <th className="text-center px-3 py-2 font-medium text-slate-400 uppercase tracking-wide text-[11px]">Target</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.measures.filter(m => m.name !== 'DSCR').map((m) => (
                <tr key={m.name} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3 text-slate-600 font-medium text-[13px]">
                    {m.name}
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">{m.formula}</div>
                  </td>
                  {[0, 1, 2, 3, 4].map((idx) => {
                    const v = m.values[idx]
                    const s = m.statuses[idx]
                    const color = s === 'meets' ? 'bg-emerald-50 text-emerald-700'
                      : s === 'approaches' ? 'bg-amber-50 text-amber-600'
                      : s === 'does_not_meet' ? 'bg-rose-50 text-rose-600'
                      : 'bg-slate-50 text-slate-400'
                    const display = v === null ? 'N/A'
                      : m.name.includes('Margin') || m.name === 'Enrollment Variance' ? `${v}%`
                      : m.name === 'Cash Flow' || m.name === '3-Year Cash Flow' ? `$${Math.round(v as number / 1000)}K`
                      : m.name === 'Days of Cash' ? `${v}`
                      : typeof v === 'number' ? v.toFixed(2) : String(v)
                    return (
                      <td key={idx} className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium tabular-nums ${color}`}>{display}</span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2.5 text-center text-slate-400 text-[11px]">
                    {m.stage1Target === m.stage2Target ? m.stage1Target : `${m.stage1Target} / ${m.stage2Target}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-[11px]">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300" /> Meets standard</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" /> Approaches standard</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-300" /> Does not meet standard</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-300" /> Not applicable</span>
        </div>
      </div>

      {/* Explanatory note */}
      <p className="mt-4 text-xs text-slate-400 italic leading-relaxed">
        The WA Charter School Commission evaluates charter school financial health using the Financial Performance Framework (FPF).
        Stage 1 applies lower thresholds appropriate for startup schools in Years 1-2.
        Stage 2 applies mature school standards beginning in Year 3.
        Schools that consistently fail to meet standards may face increased oversight or intervention.
      </p>
    </div>
  )
}
