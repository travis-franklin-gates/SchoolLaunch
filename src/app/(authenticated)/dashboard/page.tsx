'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeMultiYearDetailed, computeCashFlow, computeFPFScorecard, computeCarryForward, computeGenericProjections, computeGenericHealthScorecard, type FPFScorecard } from '@/lib/budgetEngine'
import { useStateConfig } from '@/contexts/StateConfigContext'
import { buildSchoolContextString, buildAgentContextString, computeAdvisoryHash } from '@/lib/buildSchoolContext'
import { createClient } from '@/lib/supabase/client'
import type { AdvisoryCache } from '@/lib/types'
import { REGIONALIZATION_FACTORS } from '@/lib/regionalization'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import SchoolLogo from '@/components/SchoolLogo'

type AdvisoryData = AdvisoryCache


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
  const { role } = usePermissions()
  const { config: pathwayConfig } = useStateConfig()
  const isWaCharter = pathwayConfig.pathway === 'wa_charter'

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
    () => isWaCharter
      ? computeMultiYearDetailed(profile, positions, projections, assumptions, preOpenCash, gradeExpansionPlan, allPositions, profile.startup_funding)
      : computeGenericProjections(profile, positions, projections, pathwayConfig, preOpenCash, gradeExpansionPlan, allPositions, profile.startup_funding),
    [profile, positions, allPositions, projections, assumptions, gradeExpansionPlan, preOpenCash, isWaCharter, pathwayConfig]
  )
  const cashFlowData = useMemo(
    () => computeCashFlow(baseSummary, baseApportionment, preOpenCash),
    [baseSummary, baseApportionment, preOpenCash]
  )

  const scorecard = useMemo(
    () => computeFPFScorecard(multiYear, preOpenCash, false),
    [multiYear, preOpenCash]
  )

  const genericScorecard = useMemo(() => {
    if (isWaCharter) return null
    const profileExt = profile as unknown as Record<string, unknown>
    return computeGenericHealthScorecard(multiYear, preOpenCash, pathwayConfig, profileExt.tuition_rate as number | undefined, profileExt.financial_aid_pct as number | undefined)
  }, [multiYear, preOpenCash, isWaCharter, pathwayConfig, profile])

  // Compute current data hash for change detection
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const currentDataHash = useMemo(
    () => computeAdvisoryHash(baseSummary.operatingRevenue, baseSummary.totalPersonnel, baseSummary.totalOperations, profile.target_enrollment_y1, totalFte),
    [baseSummary.operatingRevenue, baseSummary.totalPersonnel, baseSummary.totalOperations, profile.target_enrollment_y1, totalFte]
  )

  // Save advisory to DB cache
  const saveAdvisoryCache = useCallback(async (data: AdvisoryData) => {
    if (!schoolId) return
    const cache: AdvisoryCache = { ...data, dataHash: currentDataHash }
    const { error } = await supabase
      .from('school_profiles')
      .update({ advisory_cache: cache })
      .eq('school_id', schoolId)
    console.log('[overview] Saved to Supabase:', error ? `FAILED: ${error.message}` : 'success')
  }, [schoolId, currentDataHash, supabase])

  // Fetch fresh advisory from API and cache it
  const fetchAdvisory = useCallback(async () => {
    if (!schoolName || loading) return
    setAdvisoryLoading(true)
    setModelChanged(false)
    try {
      const schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
      const agentContext = buildAgentContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
      const res = await fetch('/api/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolContext, agentContext }),
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

  // Load cached advisory on mount — query Supabase directly for latest cache
  useEffect(() => {
    if (loading || !schoolId || advisoryInitRef.current) return
    advisoryInitRef.current = true

    async function loadCachedAdvisory() {
      const { data } = await supabase
        .from('school_profiles')
        .select('advisory_cache')
        .eq('school_id', schoolId)
        .single()

      const cached = data?.advisory_cache as AdvisoryCache | null
      if (cached && cached.briefing) {
        console.log('[overview] Cache loaded from Supabase: yes, hash match:', cached.dataHash === currentDataHash)
        console.log('[overview] Decision: serving cached')
        setAdvisory(cached)
        if (cached.dataHash && cached.dataHash !== currentDataHash) {
          setModelChanged(true)
        }
      } else {
        console.log('[overview] Cache loaded from Supabase: no')
        console.log('[overview] Decision: generating fresh (reason: no cache)')
        fetchAdvisory()
      }
    }
    loadCachedAdvisory()
  }, [loading, schoolId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  // Non-CEO users viewing a school that hasn't finished onboarding
  if (!profile.onboarding_complete && role && role !== 'school_ceo') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">School Setup in Progress</h2>
          <p className="text-sm text-slate-500">
            This school hasn&apos;t completed the initial setup yet. The school owner needs to finish onboarding before you can access the dashboard.
          </p>
        </div>
      </div>
    )
  }

  // Days of Cash: use scorecard Y1 value (matches Multi-Year tab and Commission Scorecard)
  const daysOfCash = scorecard.measures.find(m => m.name === 'Days of Cash')?.values[0] ?? 0
  const rc = reserveColor(daysOfCash)
  // Use multiYear Y1 as single source of truth (matches Multi-Year tab, Trajectory, and AI briefing)
  const y1Net = multiYear.length > 0 ? multiYear[0].net : baseSummary.netPosition
  const y1Revenue = multiYear.length > 0 ? multiYear[0].revenue.total : baseSummary.totalRevenue
  const y1Personnel = multiYear.length > 0 ? multiYear[0].personnel.total : baseSummary.totalPersonnel
  const y1Operations = multiYear.length > 0 ? multiYear[0].operations.total : baseSummary.totalOperations
  const y1Expenses = multiYear.length > 0 ? multiYear[0].totalExpenses : baseSummary.totalExpenses
  // Personnel % uses baseSummary.operatingRevenue (excludes interest & grants) — single source of truth
  // shared with Staffing tab badge and AI briefing context
  const personnelPctRevenue = baseSummary.operatingRevenue > 0 ? (y1Personnel / baseSummary.operatingRevenue) * 100 : 0
  const personnelColor = personnelPctRevenue < 72
    ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
    : personnelPctRevenue <= 78
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
    : personnelPctRevenue <= 80
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }

  const facilityCost = projections.find((p) => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 0
  const fc = facilityColor(baseSummary.facilityPct)

  // Ending Cash Y1 (same as Multi-Year tab: cumulativeNet includes carry-forward)
  const endingCashY1 = multiYear.length > 0 ? multiYear[0].cumulativeNet : y1Net
  const endingCashColor = endingCashY1 >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }

  // Total Margin % = Net Income / Operating Revenue (excludes one-time startup grants)
  const y1OperatingRevenue = multiYear.length > 0 ? multiYear[0].revenue.operatingRevenue : baseSummary.operatingRevenue
  const totalMarginPct = y1OperatingRevenue > 0 ? (y1Net / y1OperatingRevenue) * 100 : 0
  const totalMarginColor = totalMarginPct >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' }
    : totalMarginPct >= -5
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' }
  const totalMarginSubtitle = isWaCharter
    ? (totalMarginPct >= 0 ? 'Meets Stage 2' : totalMarginPct >= -5 ? 'Meets Stage 1' : 'Below Stage 1')
    : (totalMarginPct > 5 ? 'Healthy' : totalMarginPct >= 0 ? 'Watch' : 'Needs attention')

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
        const agentContext = buildAgentContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
        const advRes = await fetch('/api/advisory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolContext, agentContext }),
        })
        if (advRes.ok) {
          advisoryForPdf = await advRes.json()
          setAdvisory(advisoryForPdf)
          if (advisoryForPdf) await saveAdvisoryCache(advisoryForPdf)
        }
      }

      // Fetch scenarios for export if they exist
      const { data: scenarioData } = await supabase
        .from('scenarios')
        .select('name, assumptions, results, ai_analysis')
        .eq('school_id', schoolId)
        .eq('scenario_type', 'engine')
        .order('name')

      const payload = {
        schoolName,
        pathway: pathwayConfig.pathway,
        profile,
        assumptions,
        positions,
        projections,
        baseSummary,
        conservativeSummary,
        cashFlow: cashFlowData,
        multiYear,
        scorecard: isWaCharter ? scorecard : genericScorecard,
        advisory: advisoryForPdf || undefined,
        scenarios: scenarioData && scenarioData.length > 0 ? scenarioData : undefined,
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
      // Fetch scenarios for commission export
      const { data: commScenarios } = await supabase
        .from('scenarios')
        .select('name, assumptions, results')
        .eq('school_id', schoolId)
        .eq('scenario_type', 'engine')
        .order('name')

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
        scenarios: commScenarios && commScenarios.length > 0 ? commScenarios : undefined,
        pathway: pathwayConfig.pathway,
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
        a.download = `${schoolName.replace(/\s+/g, '_')}_${isWaCharter ? 'Commission_Template' : 'Financial_Plan'}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Commission export failed:', err)
    }
    setCommissionExporting(false)
  }

  // Extract first paragraph of briefing for collapsed preview
  const briefingPreview = advisory?.briefing
    ? (advisory.briefing.split(/\n\n/)[0] || advisory.briefing.slice(0, 400))
    : ''

  return (
    <div className="animate-fade-in">
      {/* 1. School Identity Header */}
      <div className="mb-6 flex items-start gap-4">
        <SchoolLogo name={schoolName} logoUrl={profile.logo_url} size={48} />
        <div>
        <h1 className="text-[28px] font-semibold text-slate-900 leading-tight">{schoolName || 'Overview'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {openingGrades && `${openingGrades} Opening ${profile.planned_open_year || ''}`}
          {buildoutGrades && ` \u2192 ${buildoutGrades} at Full Build-Out`}
          {profile.target_enrollment_y1 > 0 && ` | ${profile.target_enrollment_y1} Students Year 1`}
          {profile.region && ` | ${REGIONALIZATION_FACTORS[profile.region]?.label?.split('(')[0]?.trim() || profile.region}`}
        </p>
        </div>
      </div>

      {/* 2. Health tiles */}
      <div data-tour="health-tiles" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <HealthTile
          label="Days of Cash Y1 End"
          value={`${daysOfCash} days`}
          subtitle={isWaCharter
            ? (daysOfCash >= 60 ? 'Meets Stage 2' : daysOfCash >= 30 ? 'Meets Stage 1' : daysOfCash >= 21 ? 'Approaches Stage 1' : 'Below Stage 1 minimum')
            : (daysOfCash >= 60 ? 'Healthy' : daysOfCash >= 30 ? 'Watch' : 'Needs attention')}
          colorClass={rc}
        />
        <HealthTile
          label="Ending Cash Y1"
          value={fmt(endingCashY1)}
          colorClass={endingCashColor}
        />
        <HealthTile
          label="Total Margin %"
          value={`${totalMarginPct.toFixed(1)}%`}
          subtitle={totalMarginSubtitle}
          colorClass={totalMarginColor}
        />
        <HealthTile
          label="Personnel % Revenue"
          value={`${personnelPctRevenue.toFixed(1)}%`}
          colorClass={personnelColor}
        />
        <HealthTile
          label="Facility % Revenue"
          value={`${baseSummary.facilityPct.toFixed(1)}%`}
          subtitle={facilityCost > 0 ? `${fmt(facilityCost)}/yr` : undefined}
          colorClass={fc}
        />
      </div>

      {/* 3. Scorecard summary banner — WA FPF or Generic Health */}
      {(() => {
        const sc = isWaCharter ? scorecard : genericScorecard
        if (!sc) return null
        return (
          <div className={`mb-4 px-5 py-3 rounded-xl text-sm font-medium flex items-center justify-between ${
            sc.overallStatus === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : sc.overallStatus === 'yellow' ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span>{sc.overallMessage}</span>
            <Link href="/dashboard/scorecard" className="text-xs font-medium opacity-75 hover:opacity-100 transition-opacity whitespace-nowrap ml-4">
              View Full {isWaCharter ? 'Scorecard' : 'Health Report'} &rarr;
            </Link>
          </div>
        )
      })()}

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
          facility costs below 15% for financing.{isWaCharter ? ' The Charter School Commission may flag this during application review.' : ''}
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

          {/* Preview (first paragraph) — always visible */}
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

      {/* 7. 5-Year Trajectory */}
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
              <td className="px-5 py-2.5 text-slate-600">Days Cash</td>
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
            {!isWaCharter && multiYear.length > 0 && pathwayConfig.revenue_model === 'tuition' ? (
              <>
                <BudgetRow label="Net Tuition Revenue" value={multiYear[0].revenue.regularEd} />
                {multiYear[0].revenue.interestIncome > 0 && <BudgetRow label="Interest Income" value={multiYear[0].revenue.interestIncome} />}
              </>
            ) : (
              <BudgetRow label="Operating Revenue" value={multiYear.length > 0 ? multiYear[0].revenue.operatingRevenue : baseSummary.operatingRevenue} />
            )}
            {(multiYear.length > 0 ? multiYear[0].revenue.grantRevenue : baseSummary.grantRevenue) > 0 && (
              <BudgetRow label="Startup Grants (Year 1)" value={multiYear.length > 0 ? multiYear[0].revenue.grantRevenue : baseSummary.grantRevenue} />
            )}
            <BudgetRow label="Total Revenue" value={y1Revenue} bold borderTop />

            {/* EXPENSES section */}
            <tr className="bg-slate-50/60">
              <td colSpan={2} className="px-5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Expenses</td>
            </tr>
            <BudgetRow label="Total Personnel" value={y1Personnel} />
            <BudgetRow label="Total Operations" value={y1Operations} />
            <BudgetRow label="Total Expenses" value={y1Expenses} bold borderTop />

            {/* BOTTOM LINE section */}
            <tr className="border-t-2 border-slate-300 bg-slate-50/30">
              <td colSpan={2} className="px-5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bottom Line</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-5 py-3 font-semibold text-slate-800">Net Position</td>
              <td className={`px-5 py-3 text-right font-semibold tabular-nums ${y1Net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(y1Net)}</td>
            </tr>
            <tr>
              <td className="px-5 py-3 font-semibold text-slate-800">Days of Cash</td>
              <td className={`px-5 py-3 text-right font-semibold tabular-nums ${daysOfCash >= 60 ? 'text-emerald-600' : daysOfCash >= 30 ? 'text-amber-600' : 'text-red-600'}`}>{daysOfCash} days</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 9.5 Scenario Summary (only if scenarios have been seeded) */}
      <ScenarioSummaryCard schoolId={schoolId} />

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
          {commissionExporting ? 'Generating...' : isWaCharter ? 'Export for Commission' : 'Export Financial Plan'}
        </button>
      </div>
    </div>
  )
}

/** Reusable row for the sectioned budget table */
function ScenarioSummaryCard({ schoolId }: { schoolId: string }) {
  const [scenarios, setScenarios] = useState<Array<{ name: string; assumptions: { enrollment_fill_rate: number }; results: { years: Record<string, { reserve_days: number; ending_cash: number; fpf_days_cash: string }> } | null }>>([])
  const supabase = createClient()

  useEffect(() => {
    if (!schoolId) return
    supabase
      .from('scenarios')
      .select('name, assumptions, results')
      .eq('school_id', schoolId)
      .eq('scenario_type', 'engine')
      .order('name')
      .then(({ data }) => { if (data && data.length > 0) setScenarios(data as typeof scenarios) })
  }, [schoolId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (scenarios.length === 0) return null

  const colors: Record<string, string> = { Conservative: 'text-amber-600', 'Base Case': 'text-blue-600', Optimistic: 'text-emerald-600' }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Scenario Summary</h3>
        <a href="/dashboard/scenarios" className="text-xs text-teal-600 hover:text-teal-700 font-medium">View Full Scenarios →</a>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        {scenarios.map(s => {
          const y1 = s.results?.years?.['1']
          const days = Math.max(0, y1?.reserve_days ?? 0)
          const endingCash = y1?.ending_cash ?? 0
          const status = y1?.fpf_days_cash || 'na'
          const fillPct = Math.round((s.assumptions?.enrollment_fill_rate || 0.9) * 100)
          return (
            <div key={s.name}>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${colors[s.name] || 'text-slate-600'}`}>{s.name} ({fillPct}% Fill)</div>
              {endingCash < 0 ? (
                <>
                  <div className="text-xl font-bold text-red-600">0 days</div>
                  <div className="mt-0.5"><span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Cash Shortfall</span></div>
                </>
              ) : (
                <>
                  <div className={`text-xl font-bold ${days >= 60 ? 'text-emerald-600' : days >= 30 ? 'text-amber-600' : 'text-red-600'}`}>{days} days</div>
                  <div className="mt-0.5">
                    {status === 'meets' ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">On Track</span>
                      : status === 'approaches' ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Approaching</span>
                      : <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">At Risk</span>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
