'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeMultiYearDetailed, computeCashFlow, computeFPFScorecard, type FPFScorecard } from '@/lib/budgetEngine'
import { buildSchoolContextString } from '@/lib/buildSchoolContext'
import Link from 'next/link'

interface AgentResult {
  id: string
  name: string
  icon: string
  subtitle: string
  status: 'strong' | 'needs_attention' | 'risk'
  summary: string
  actions: string[]
}

interface AdvisoryData {
  briefing: string
  agents: AgentResult[]
  generatedAt: string
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function reserveColor(days: number) {
  if (days >= 30) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
  if (days >= 21) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
}

function facilityColor(pct: number) {
  if (pct <= 12) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
  if (pct <= 15) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
}

const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  strong: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  needs_attention: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  risk: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
}

const STATUS_LABELS: Record<string, string> = {
  strong: 'Strong',
  needs_attention: 'Attention',
  risk: 'Risk',
}

function HealthTile({ label, value, subtitle, colorClass }: {
  label: string
  value: string
  subtitle?: string
  colorClass?: { bg: string; text: string; border: string }
}) {
  const bg = colorClass?.bg || 'bg-white'
  const text = colorClass?.text || 'text-slate-800'
  const border = colorClass?.border || 'border-l-slate-300'
  return (
    <div className={`${bg} bg-white border border-slate-200 ${border} border-l-4 rounded-xl p-5 shadow-sm`}>
      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">{label}</div>
      <div className={`text-[32px] leading-tight font-semibold tabular-nums ${text}`}>{value}</div>
      {subtitle && <div className={`text-xs mt-1.5 ${text} opacity-75`}>{subtitle}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const {
    schoolData: { schoolName, profile, positions, allPositions, projections, gradeExpansionPlan, loading },
    assumptions,
    baseSummary,
    scenario,
    scenarioInputs,
    scenarioSummary,
    isModified,
    currentSummary: current,
    baseApportionment,
    conservativeMode,
    conservativeSummary,
    setConservativeMode,
    updateScenario,
    resetScenario,
  } = useScenario()

  const hasExpansion = gradeExpansionPlan && gradeExpansionPlan.length > 0

  const [exporting, setExporting] = useState(false)
  const [commissionExporting, setCommissionExporting] = useState(false)
  const [advisory, setAdvisory] = useState<AdvisoryData | null>(null)
  const [advisoryLoading, setAdvisoryLoading] = useState(false)

  const multiYear = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, 0, gradeExpansionPlan, allPositions, profile.startup_funding),
    [profile, positions, allPositions, projections, assumptions, gradeExpansionPlan]
  )
  const cashFlowData = useMemo(
    () => computeCashFlow(baseSummary, baseApportionment, 0),
    [baseSummary, baseApportionment]
  )

  const startupFunding = profile.startup_funding?.reduce((s: number, f: { amount: number }) => s + f.amount, 0) || 0
  const preOpenCash = Math.round(startupFunding * 0.6)
  const scorecard = useMemo(
    () => computeFPFScorecard(multiYear, preOpenCash, conservativeMode),
    [multiYear, preOpenCash, conservativeMode]
  )

  const fetchAdvisory = useCallback(async () => {
    if (!schoolName || loading) return
    setAdvisoryLoading(true)
    try {
      const schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
      const res = await fetch('/api/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolContext }),
      })
      if (res.ok) {
        const data = await res.json()
        setAdvisory(data)
      }
    } catch (err) {
      console.error('Advisory fetch failed:', err)
    }
    setAdvisoryLoading(false)
  }, [schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard, loading])

  useEffect(() => {
    if (!advisory && !advisoryLoading && schoolName && !loading) {
      fetchAdvisory()
    }
  }, [advisory, advisoryLoading, schoolName, loading, fetchAdvisory])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  const rc = reserveColor(current.reserveDays)
  const surplusColor = current.netPosition >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
  const personnelColor = current.personnelPctRevenue < 72
    ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
    : current.personnelPctRevenue <= 78
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
    : current.personnelPctRevenue <= 80
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }

  const facilityCost = projections.find((p) => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 0
  const fc = facilityColor(current.facilityPct)

  const conservativeEnrollment = Math.floor(profile.target_enrollment_y1 * 0.9)

  const delta = (base: number, curr: number, unit: string, invert = false) => {
    if (!isModified && !conservativeMode) return null
    const diff = curr - base
    if (diff === 0) return null
    const arrow = (invert ? -diff : diff) > 0 ? '\u2191' : '\u2193'
    return `${arrow}${Math.abs(Math.round(diff))} ${unit} from base`
  }

  async function handleExport() {
    setExporting(true)
    try {
      let advisoryForPdf = advisory
      if (!advisoryForPdf) {
        const schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
        const advRes = await fetch('/api/advisory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolContext }),
        })
        if (advRes.ok) {
          advisoryForPdf = await advRes.json()
          setAdvisory(advisoryForPdf)
        }
      }

      const payload = {
        schoolName,
        profile,
        assumptions,
        positions,
        projections,
        baseSummary,
        conservativeSummary,
        cashFlow: cashFlowData,
        multiYear,
        advisory: advisoryForPdf || undefined,
      }

      const res = await fetch('/api/export/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        console.error('Export failed:', res.status)
        setExporting(false)
        return
      }

      const html = await res.text()
      const newTab = window.open('', '_blank')
      if (newTab) {
        newTab.document.write(html)
        newTab.document.close()
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
    setExporting(false)
  }

  async function handleCommissionExport() {
    setCommissionExporting(true)
    try {
      const payload = {
        schoolName,
        profile,
        assumptions,
        positions,
        projections,
        multiYear,
        gradeExpansionPlan,
        scorecard,
        startingCash: preOpenCash,
      }
      const res = await fetch('/api/export/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${schoolName.replace(/\s+/g, '_')}_Commission_Template.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Commission export failed:', err)
    }
    setCommissionExporting(false)
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold text-slate-900 mb-6">Overview</h1>

      {/* AI Briefing */}
      {advisoryLoading && !advisory ? (
        <div className="bg-white border-l-[3px] border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded animate-shimmer" />
            <div className="h-4 rounded w-44 animate-shimmer" />
          </div>
          <div className="space-y-2.5">
            <div className="h-3 rounded w-full animate-shimmer" />
            <div className="h-3 rounded w-full animate-shimmer" />
            <div className="h-3 rounded w-5/6 animate-shimmer" />
            <div className="h-3 rounded w-full mt-3 animate-shimmer" />
            <div className="h-3 rounded w-4/6 animate-shimmer" />
          </div>
        </div>
      ) : advisory ? (
        <div className="bg-white border-l-[3px] border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-6 shadow-sm animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Financial Advisor Briefing</span>
            </div>
            <button
              onClick={fetchAdvisory}
              disabled={advisoryLoading}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${advisoryLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          <div className="text-[15px] text-slate-700 leading-[1.7] whitespace-pre-line mb-4">
            {advisory.briefing}
          </div>

          {/* Agent status pills */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
            {advisory.agents.map((agent) => {
              const sc = STATUS_COLORS[agent.status] || STATUS_COLORS.needs_attention
              return (
                <span key={agent.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                  <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                  {agent.name.split(' ')[0]}
                </span>
              )
            })}
            <Link
              href="/dashboard/advisory"
              className="ml-auto text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors"
            >
              View Full Advisory Panel &rarr;
            </Link>
          </div>
          {advisory.generatedAt && (
            <div className="text-[11px] text-slate-400 mt-2">
              Last updated: {new Date(advisory.generatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      ) : null}

      {/* Commission FPF Scorecard */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm animate-fade-in-up stagger-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Commission Scorecard</h2>
          <div className="flex gap-4 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white" style={{ background: 'var(--navy-light)' }}>Stage 1</span> Years 1-2</span>
            <span className="inline-flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white" style={{ background: 'var(--navy-light)' }}>Stage 2</span> Years 3-5</span>
          </div>
        </div>
        <div className="overflow-x-auto sl-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-3 font-medium text-slate-400 uppercase tracking-wide text-[11px] min-w-[160px]">Measure</th>
                {[1, 3, 5].map((y) => (
                  <th key={y} className="text-center px-3 py-2 font-medium text-slate-400 uppercase tracking-wide text-[11px] min-w-[70px]">Year {y}</th>
                ))}
                <th className="text-center px-3 py-2 font-medium text-slate-400 uppercase tracking-wide text-[11px]">Target</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.measures.filter(m => m.name !== 'DSCR').map((m) => (
                <tr key={m.name} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3 text-slate-600 font-medium text-[13px]">{m.name}</td>
                  {[0, 2, 4].map((idx) => {
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
        <div className={`mt-3 px-4 py-2.5 rounded-lg text-xs font-medium ${
          scorecard.overallStatus === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : scorecard.overallStatus === 'yellow' ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {scorecard.overallMessage}
        </div>
      </div>

      {/* Conservative mode banner */}
      {conservativeMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          <strong>Conservative mode:</strong> Revenue calculated at 90% enrollment ({conservativeEnrollment} students).
          Expenses unchanged ({profile.target_enrollment_y1} students). This reflects the industry-recommended planning
          approach — budget for the revenue you&apos;re likely to receive, not the revenue you hope to receive.
        </div>
      )}

      {/* Health tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <HealthTile
          label="Year-End Reserve"
          value={`${current.reserveDays} days`}
          subtitle={delta(baseSummary.reserveDays, current.reserveDays, 'days') || (current.reserveDays >= 30 ? 'Meets Stage 1' : current.reserveDays >= 21 ? 'Approaches Stage 1' : 'Below Stage 1 minimum')}
          colorClass={rc}
        />
        <HealthTile
          label="Personnel % Revenue"
          value={`${current.personnelPctRevenue.toFixed(1)}%`}
          subtitle={delta(baseSummary.personnelPctRevenue, current.personnelPctRevenue, '%', true) || undefined}
          colorClass={personnelColor}
        />
        <HealthTile
          label="Year 1 Net"
          value={fmt(current.netPosition)}
          subtitle={delta(baseSummary.netPosition, current.netPosition, '') || undefined}
          colorClass={surplusColor}
        />
        <HealthTile
          label="Break-Even"
          value={`${current.breakEvenEnrollment}`}
          subtitle={delta(baseSummary.breakEvenEnrollment, current.breakEvenEnrollment, 'students', true) || `Target: ${profile.target_enrollment_y1}`}
        />
        <HealthTile
          label="Facility % Revenue"
          value={`${current.facilityPct.toFixed(1)}%`}
          subtitle={facilityCost > 0 ? `${fmt(facilityCost)}/yr` : undefined}
          colorClass={fc}
        />
      </div>

      {/* 90% enrollment sensitivity */}
      {!conservativeMode && baseSummary.reserveDays !== conservativeSummary.reserveDays && (
        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm text-slate-600">
          <strong>90% enrollment sensitivity:</strong> At {conservativeEnrollment} students,
          reserve days drop from {baseSummary.reserveDays} to{' '}
          <span className={conservativeSummary.reserveDays < 21 ? 'text-red-600 font-semibold' : conservativeSummary.reserveDays < 30 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
            {conservativeSummary.reserveDays} days
          </span>.
          {conservativeSummary.reserveDays < 30 && ' Toggle conservative mode below to plan for this scenario.'}
        </div>
      )}

      {/* Facility cost alert */}
      {current.facilityPct > 15 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700">
          <strong>Warning:</strong> Facility costs exceed 15% of projected revenue. Most lenders require
          facility costs below 15% for financing. The Charter School Commission may flag this during application review.
        </div>
      )}
      {current.facilityPct > 12 && current.facilityPct <= 15 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-700">
          Facility costs at {current.facilityPct.toFixed(1)}% of revenue — approaching the 15% maximum lenders and authorizers look for.
        </div>
      )}

      {/* Scenario panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Scenario Controls</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Opening Enrollment: <span className="tabular-nums">{scenarioInputs.enrollment}</span>
            </label>
            <input
              type="range"
              min={Math.round(profile.target_enrollment_y1 * 0.5)}
              max={Math.round(profile.target_enrollment_y1 * 1.5)}
              step={1}
              value={scenarioInputs.enrollment}
              onChange={(e) => updateScenario({ enrollment: Number(e.target.value) })}
              className="w-full"
              disabled={conservativeMode}
            />
            <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lead Teacher Salary</label>
            <input
              type="number"
              step={1000}
              value={scenarioInputs.leadTeacherSalary}
              onChange={(e) => updateScenario({ leadTeacherSalary: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Monthly Lease</label>
            <input
              type="number"
              step={500}
              value={scenarioInputs.monthlyLease}
              onChange={(e) => updateScenario({ monthlyLease: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">+1 FTE Teacher</label>
            <button
              onClick={() => updateScenario({ extraTeacher: !scenarioInputs.extraTeacher })}
              className={`mt-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scenarioInputs.extraTeacher
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {scenarioInputs.extraTeacher ? 'On' : 'Off'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Budget at 90%</label>
            <button
              onClick={() => {
                setConservativeMode(!conservativeMode)
                if (!conservativeMode) resetScenario()
              }}
              className={`mt-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                conservativeMode
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {conservativeMode ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {(isModified || conservativeMode) && (
          <button
            onClick={() => { resetScenario(); setConservativeMode(false) }}
            className="mt-4 text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
          >
            Reset to Base Case
          </button>
        )}
      </div>

      {/* Budget summary table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-sm">
        <table className="sl-table">
          <thead>
            <tr>
              <th></th>
              <th className="num">Base Case</th>
              {(isModified || conservativeMode) && <th className="num text-teal-600">{conservativeMode ? 'Conservative (90%)' : 'Scenario'}</th>}
              {(isModified || conservativeMode) && <th className="num">Delta</th>}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Operating Revenue', base: baseSummary.operatingRevenue, curr: current.operatingRevenue },
              ...(baseSummary.grantRevenue > 0 ? [
                { label: 'Startup Grants (Year 1)', base: baseSummary.grantRevenue, curr: current.grantRevenue },
                { label: 'Total Revenue', base: baseSummary.totalRevenue, curr: current.totalRevenue },
              ] : [
                { label: 'Total Revenue', base: baseSummary.totalRevenue, curr: current.totalRevenue },
              ]),
              { label: 'Total Personnel', base: baseSummary.totalPersonnel, curr: current.totalPersonnel },
              { label: 'Total Operations', base: baseSummary.totalOperations, curr: current.totalOperations },
              { label: 'Net Position', base: baseSummary.netPosition, curr: current.netPosition, bold: true },
              { label: 'Reserve Days', base: baseSummary.reserveDays, curr: current.reserveDays, bold: true, isDays: true },
            ].map((row) => {
              const diff = row.curr - row.base
              return (
                <tr key={row.label}>
                  <td className={row.bold ? 'font-semibold text-slate-800' : ''}>
                    {row.label}
                  </td>
                  <td className={`num ${row.bold ? 'font-semibold text-slate-800' : ''}`}>
                    {row.isDays ? `${row.base} days` : fmt(row.base)}
                  </td>
                  {(isModified || conservativeMode) && (
                    <td className={`num ${row.bold ? 'font-semibold' : ''} ${
                      row.isDays
                        ? (row.curr >= 30 ? 'text-emerald-600' : row.curr >= 21 ? 'text-amber-600' : 'text-red-600')
                        : row.label === 'Net Position'
                        ? (row.curr >= 0 ? 'text-emerald-600' : 'text-red-600')
                        : 'text-teal-600'
                    }`}>
                      {row.isDays ? `${row.curr} days` : fmt(row.curr)}
                    </td>
                  )}
                  {(isModified || conservativeMode) && (
                    <td className={`num text-sm ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {diff === 0 ? '—' : row.isDays ? `${diff > 0 ? '+' : ''}${diff}` : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Export buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {exporting ? 'Generating...' : 'Export Budget Narrative'}
        </button>
        <button
          onClick={handleCommissionExport}
          disabled={commissionExporting}
          className="px-5 py-2.5 bg-white text-teal-600 border border-teal-600 rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {commissionExporting ? 'Generating...' : 'Export for Commission'}
        </button>
      </div>
    </div>
  )
}
