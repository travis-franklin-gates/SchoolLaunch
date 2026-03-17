'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeMultiYearDetailed, computeCashFlow, computeFPFScorecard, computeCarryForward, type FPFScorecard } from '@/lib/budgetEngine'
import { buildSchoolContextString } from '@/lib/buildSchoolContext'
import { createClient } from '@/lib/supabase/client'
import type { AdvisoryCache } from '@/lib/types'
import Link from 'next/link'

type AdvisoryData = AdvisoryCache

/** Simple hash of key financial metrics to detect model changes */
function computeDataHash(revenue: number, personnel: number, operations: number, enrollment: number, staffCount: number): string {
  return `r:${Math.round(revenue)}|p:${Math.round(personnel)}|o:${Math.round(operations)}|e:${enrollment}|s:${Math.round(staffCount * 10) / 10}`
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
    schoolData: { schoolId, schoolName, profile, positions, allPositions, projections, gradeExpansionPlan, loading },
    assumptions,
    baseSummary,
    baseApportionment,
    conservativeSummary,
  } = useScenario()

  const hasExpansion = gradeExpansionPlan && gradeExpansionPlan.length > 0

  const [briefingExpanded, setBriefingExpanded] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [commissionExporting, setCommissionExporting] = useState(false)
  const [advisory, setAdvisory] = useState<AdvisoryData | null>(null)
  const [advisoryLoading, setAdvisoryLoading] = useState(false)
  const [modelChanged, setModelChanged] = useState(false)
  const advisoryInitRef = useRef(false)
  const supabase = createClient()

  // Carry-forward from Year 0 — same computation as Multi-Year tab
  const preOpenCash = useMemo(() => computeCarryForward(profile), [profile])

  const multiYear = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, preOpenCash, gradeExpansionPlan, allPositions, profile.startup_funding),
    [profile, positions, allPositions, projections, assumptions, gradeExpansionPlan, preOpenCash]
  )
  const cashFlowData = useMemo(
    () => computeCashFlow(baseSummary, baseApportionment, preOpenCash),
    [baseSummary, baseApportionment, preOpenCash]
  )

  const scorecard = useMemo(
    () => computeFPFScorecard(multiYear, preOpenCash, false),
    [multiYear, preOpenCash]
  )

  // Compute current data hash for change detection
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const currentDataHash = useMemo(
    () => computeDataHash(baseSummary.operatingRevenue, baseSummary.totalPersonnel, baseSummary.totalOperations, profile.target_enrollment_y1, totalFte),
    [baseSummary.operatingRevenue, baseSummary.totalPersonnel, baseSummary.totalOperations, profile.target_enrollment_y1, totalFte]
  )

  // Save advisory to DB cache
  const saveAdvisoryCache = useCallback(async (data: AdvisoryData) => {
    if (!schoolId) return
    const cache: AdvisoryCache = { ...data, dataHash: currentDataHash }
    await supabase
      .from('school_profiles')
      .update({ advisory_cache: cache })
      .eq('school_id', schoolId)
  }, [schoolId, currentDataHash, supabase])

  // Fetch fresh advisory from API and cache it
  const fetchAdvisory = useCallback(async () => {
    if (!schoolName || loading) return
    setAdvisoryLoading(true)
    setModelChanged(false)
    try {
      const schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
      const res = await fetch('/api/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolContext }),
      })
      if (res.ok) {
        const data = await res.json() as AdvisoryData
        data.dataHash = currentDataHash
        setAdvisory(data)
        await saveAdvisoryCache(data)
      }
    } catch (err) {
      console.error('Advisory fetch failed:', err)
    }
    setAdvisoryLoading(false)
  }, [schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard, loading, currentDataHash, saveAdvisoryCache])

  // Load cached advisory on mount; auto-generate only on first visit (no cache)
  useEffect(() => {
    if (loading || advisoryInitRef.current) return
    advisoryInitRef.current = true

    const cached = profile.advisory_cache
    if (cached && cached.briefing) {
      setAdvisory(cached)
      // Check if the model has changed since the cached briefing
      if (cached.dataHash && cached.dataHash !== currentDataHash) {
        setModelChanged(true)
      }
    } else {
      // First visit — no cached briefing, auto-generate
      fetchAdvisory()
    }
  }, [loading, profile.advisory_cache, currentDataHash, fetchAdvisory])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  // Days of Cash: use scorecard Y1 value (matches Multi-Year tab and Commission Scorecard)
  const daysOfCash = scorecard.measures.find(m => m.name === 'Days of Cash')?.values[0] ?? 0
  const rc = reserveColor(daysOfCash)
  const surplusColor = baseSummary.netPosition >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
  const personnelColor = baseSummary.personnelPctRevenue < 72
    ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
    : baseSummary.personnelPctRevenue <= 78
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
    : baseSummary.personnelPctRevenue <= 80
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }

  const facilityCost = projections.find((p) => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 0
  const fc = facilityColor(baseSummary.facilityPct)

  // Break-even color coding
  const breakEvenColor = baseSummary.breakEvenEnrollment > profile.target_enrollment_y1
    ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
    : baseSummary.breakEvenEnrollment >= profile.target_enrollment_y1 * 0.9
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' }
    : { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }

  const breakEvenSubtitle = baseSummary.breakEvenEnrollment > profile.target_enrollment_y1
    ? `Above target (${profile.target_enrollment_y1}) | Operating only`
    : `Target: ${profile.target_enrollment_y1} | Operating only`

  const conservativeEnrollment = Math.floor(profile.target_enrollment_y1 * 0.9)

  // School identity info
  const openingGrades = profile.opening_grades?.join(', ') || profile.grade_config?.split('-')[0] || ''
  const buildoutGrades = profile.buildout_grades?.length
    ? `${profile.buildout_grades[0]}-${profile.buildout_grades[profile.buildout_grades.length - 1]}`
    : profile.grade_config || ''

  // 5-year trajectory data from budget engine (same as Multi-Year tab and Scorecard)
  const daysOfCashAllYears = scorecard.measures.find(m => m.name === 'Days of Cash')?.values || []

  async function handleExport() {
    setExporting(true)
    try {
      let advisoryForPdf = advisory
      if (!advisoryForPdf) {
        // Try generating a fresh one for the export
        const schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
        const advRes = await fetch('/api/advisory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolContext }),
        })
        if (advRes.ok) {
          advisoryForPdf = await advRes.json()
          setAdvisory(advisoryForPdf)
          if (advisoryForPdf) await saveAdvisoryCache(advisoryForPdf)
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

  // Extract first sentence of briefing for collapsed preview
  const briefingPreview = advisory?.briefing
    ? advisory.briefing.split(/(?<=[.!?])\s/)[0] || advisory.briefing.slice(0, 200)
    : ''

  return (
    <div className="animate-fade-in">
      {/* 1. School Identity Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold text-slate-900">{schoolName || 'Overview'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {openingGrades && `${openingGrades} Opening ${profile.planned_open_year || ''}`}
          {buildoutGrades && ` \u2192 ${buildoutGrades} at Full Build-Out`}
          {profile.target_enrollment_y1 > 0 && ` | ${profile.target_enrollment_y1} Students Year 1`}
          {profile.region && ` | ${profile.region}`}
        </p>
      </div>

      {/* 2. Health tiles */}
      <div data-tour="health-tiles" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <HealthTile
          label="Days of Cash"
          value={`${daysOfCash} days`}
          subtitle={daysOfCash >= 60 ? 'Meets Stage 2' : daysOfCash >= 30 ? 'Meets Stage 1' : daysOfCash >= 21 ? 'Approaches Stage 1' : 'Below Stage 1 minimum'}
          colorClass={rc}
        />
        <HealthTile
          label="Personnel % Revenue"
          value={`${baseSummary.personnelPctRevenue.toFixed(1)}%`}
          colorClass={personnelColor}
        />
        <HealthTile
          label="Year 1 Net"
          value={fmt(baseSummary.netPosition)}
          colorClass={surplusColor}
        />
        <HealthTile
          label="Break-Even"
          value={`${baseSummary.breakEvenEnrollment}`}
          subtitle={breakEvenSubtitle}
          colorClass={breakEvenColor}
        />
        <HealthTile
          label="Facility % Revenue"
          value={`${baseSummary.facilityPct.toFixed(1)}%`}
          subtitle={facilityCost > 0 ? `${fmt(facilityCost)}/yr` : undefined}
          colorClass={fc}
        />
      </div>

      {/* 3. Commission Scorecard summary banner */}
      <div className={`mb-4 px-5 py-3 rounded-xl text-sm font-medium ${
        scorecard.overallStatus === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : scorecard.overallStatus === 'yellow' ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}>
        {scorecard.overallMessage}
      </div>

      {/* 4. 90% enrollment sensitivity */}
      {(() => {
        const conservativeDaysOfCash = conservativeSummary.totalExpenses > 0
          ? Math.round((preOpenCash + conservativeSummary.netPosition) / (conservativeSummary.totalExpenses / 365))
          : 0
        return daysOfCash !== conservativeDaysOfCash ? (
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm text-slate-600">
            <strong>90% enrollment sensitivity:</strong> At {conservativeEnrollment} students,
            days of cash drop from {daysOfCash} to{' '}
            <span className={conservativeDaysOfCash < 21 ? 'text-red-600 font-semibold' : conservativeDaysOfCash < 30 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
              {conservativeDaysOfCash} days
            </span>.
          </div>
        ) : null
      })()}

      {/* 5. Facility cost warning */}
      {baseSummary.facilityPct > 15 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700">
          <strong>Warning:</strong> Facility costs exceed 15% of projected revenue. Most lenders require
          facility costs below 15% for financing. The Charter School Commission may flag this during application review.
        </div>
      )}
      {baseSummary.facilityPct > 12 && baseSummary.facilityPct <= 15 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-700">
          Facility costs at {baseSummary.facilityPct.toFixed(1)}% of revenue — approaching the 15% maximum lenders and authorizers look for.
        </div>
      )}

      {/* 6. Financial Advisor Briefing — collapsed by default */}
      {advisoryLoading && !advisory ? (
        <div data-tour="ai-briefing" className="bg-white border-l-[3px] border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded animate-shimmer" />
            <div className="h-4 rounded w-44 animate-shimmer" />
          </div>
          <div className="space-y-2.5">
            <div className="h-3 rounded w-full animate-shimmer" />
            <div className="h-3 rounded w-full animate-shimmer" />
            <div className="h-3 rounded w-5/6 animate-shimmer" />
          </div>
        </div>
      ) : advisory ? (
        <div data-tour="ai-briefing" className="bg-white border-l-[3px] border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          {/* Header row with agent pills, refresh, timestamp */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Financial Advisor Briefing</span>
              {/* Agent status pills — always visible */}
              <div className="hidden sm:flex items-center gap-1.5 ml-3">
                {advisory.agents.map((agent) => {
                  const sc = STATUS_COLORS[agent.status] || STATUS_COLORS.needs_attention
                  return (
                    <span key={agent.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {agent.name.split(' ')[0]}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {advisory.generatedAt && (
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {new Date(advisory.generatedAt).toLocaleString()}
                </span>
              )}
              <button
                onClick={fetchAdvisory}
                disabled={advisoryLoading}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${advisoryLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {advisoryLoading ? 'Generating...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Model changed banner */}
          {modelChanged && !advisoryLoading && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center justify-between">
              <span>Your financial model has changed since the last briefing.</span>
              <button onClick={fetchAdvisory} className="font-medium text-amber-800 hover:text-amber-900 underline ml-2">
                Click Refresh for updated analysis
              </button>
            </div>
          )}

          {/* Preview (first sentence) — always visible */}
          <div className={`text-sm text-slate-700 leading-relaxed ${advisoryLoading ? 'opacity-50' : ''}`}>
            {briefingExpanded ? (
              <div className="whitespace-pre-line">{advisory.briefing}</div>
            ) : (
              <p>{briefingPreview}</p>
            )}
          </div>

          {/* Expand/collapse toggle */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setBriefingExpanded(!briefingExpanded)}
              className="text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors flex items-center gap-1"
            >
              {briefingExpanded ? 'Collapse Briefing' : 'Read Full Briefing'}
              <svg className={`w-3.5 h-3.5 transition-transform ${briefingExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <Link
              href="/dashboard/advisory"
              className="text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors"
            >
              View Full Advisory Panel &rarr;
            </Link>
          </div>
        </div>
      ) : null}

      {/* 7. Commission FPF Scorecard (full table) */}
      <div data-tour="scorecard" className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
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
      </div>

      {/* 8. 5-Year Trajectory */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">5-Year Trajectory</th>
              {multiYear.map((y) => (
                <th key={y.year} className={`text-center px-4 py-2.5 font-semibold text-slate-600 text-xs min-w-[90px] ${y.year === 1 ? 'bg-teal-50/60' : ''}`}>
                  Year {y.year}
                  {y.year === 1 && <span className="block text-[9px] font-medium text-teal-600 mt-0.5">Current</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-5 py-2.5 text-slate-600">Enrollment</td>
              {multiYear.map((y) => (
                <td key={y.year} className={`px-4 py-2.5 text-center tabular-nums text-slate-700 font-medium ${y.year === 1 ? 'bg-teal-50/30' : ''}`}>
                  {y.enrollment}
                </td>
              ))}
            </tr>
            {hasExpansion && (
              <tr className="border-b border-slate-100">
                <td className="px-5 py-2.5 text-slate-600">Grades Served</td>
                {multiYear.map((y) => {
                  const grades = y.expansionDetail?.grades
                  const display = grades?.length
                    ? grades.length === 1 ? grades[0] : `${grades[0]}\u2013${grades[grades.length - 1]}`
                    : '\u2014'
                  return (
                    <td key={y.year} className={`px-4 py-2.5 text-center text-xs text-slate-600 ${y.year === 1 ? 'bg-teal-50/30' : ''}`}>
                      {display}
                    </td>
                  )
                })}
              </tr>
            )}
            <tr className="border-b border-slate-100">
              <td className="px-5 py-2.5 text-slate-600">Net Position</td>
              {multiYear.map((y) => (
                <td key={y.year} className={`px-4 py-2.5 text-center tabular-nums font-medium ${y.net >= 0 ? 'text-emerald-600' : 'text-red-600'} ${y.year === 1 ? 'bg-teal-50/30' : ''}`}>
                  {fmt(y.net)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-2.5 text-slate-600">Reserve Days</td>
              {multiYear.map((y, i) => {
                const days = daysOfCashAllYears[i] ?? 0
                const color = days >= 60 ? 'text-emerald-600' : days >= 30 ? 'text-amber-600' : 'text-red-600'
                return (
                  <td key={y.year} className={`px-4 py-2.5 text-center tabular-nums font-medium ${color} ${y.year === 1 ? 'bg-teal-50/30' : ''}`}>
                    {days}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 9. Base Case table — Year 1 budget summary */}
      <div data-tour="budget-summary" className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-5 py-3 font-semibold text-slate-600"></th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Year 1 Base Case</th>
            </tr>
          </thead>
          <tbody>
            {/* REVENUE section */}
            <tr className="bg-slate-50/60">
              <td colSpan={2} className="px-5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Revenue</td>
            </tr>
            <BudgetRow label="Operating Revenue" value={baseSummary.operatingRevenue} />
            {baseSummary.grantRevenue > 0 && (
              <BudgetRow label="Startup Grants (Year 1)" value={baseSummary.grantRevenue} />
            )}
            <BudgetRow label="Total Revenue" value={baseSummary.totalRevenue} bold borderTop />

            {/* EXPENSES section */}
            <tr className="bg-slate-50/60">
              <td colSpan={2} className="px-5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Expenses</td>
            </tr>
            <BudgetRow label="Total Personnel" value={baseSummary.totalPersonnel} />
            <BudgetRow label="Total Operations" value={baseSummary.totalOperations} />
            <BudgetRow label="Total Expenses" value={baseSummary.totalExpenses} bold borderTop />

            {/* BOTTOM LINE section */}
            <tr className="border-t-2 border-slate-300 bg-slate-50/30">
              <td colSpan={2} className="px-5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bottom Line</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-5 py-3 font-semibold text-slate-800">Net Position</td>
              <td className={`px-5 py-3 text-right font-semibold tabular-nums ${baseSummary.netPosition >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(baseSummary.netPosition)}</td>
            </tr>
            <tr>
              <td className="px-5 py-3 font-semibold text-slate-800">Days of Cash</td>
              <td className={`px-5 py-3 text-right font-semibold tabular-nums ${daysOfCash >= 60 ? 'text-emerald-600' : daysOfCash >= 30 ? 'text-amber-600' : 'text-red-600'}`}>{daysOfCash} days</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 10. Export buttons */}
      <div data-tour="export-buttons" className="flex flex-col sm:flex-row gap-3">
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

/** Reusable row for the sectioned budget table */
function BudgetRow({ label, value, bold, borderTop }: {
  label: string
  value: number
  bold?: boolean
  borderTop?: boolean
}) {
  return (
    <tr className={`border-b border-slate-100 ${borderTop ? 'border-t border-t-slate-200' : ''}`}>
      <td className={`px-5 py-2.5 ${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</td>
      <td className={`px-5 py-2.5 text-right tabular-nums ${bold ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{fmt(value)}</td>
    </tr>
  )
}
