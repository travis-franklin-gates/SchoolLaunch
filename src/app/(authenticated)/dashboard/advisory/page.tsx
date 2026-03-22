'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { buildSchoolContextString, buildAgentContextString, computeAdvisoryHash } from '@/lib/buildSchoolContext'
import { computeMultiYearDetailed, computeFPFScorecard } from '@/lib/budgetEngine'
import { createClient } from '@/lib/supabase/client'
import type { AdvisoryCache } from '@/lib/types'
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
  dataHash?: string
}

const STATUS_CONFIG = {
  strong: { label: 'Strong', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  needs_attention: { label: 'Needs Attention', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500' },
  risk: { label: 'Risk', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' },
}

function AgentIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className || 'w-5 h-5'
  const paths: Record<string, string> = {
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    briefcase: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    trending: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[icon] || paths.shield} />
    </svg>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 animate-shimmer rounded-lg" />
        <div className="flex-1">
          <div className="h-4 animate-shimmer rounded w-32 mb-1" />
          <div className="h-3 animate-shimmer rounded w-48" />
        </div>
        <div className="h-5 animate-shimmer rounded-full w-24" />
      </div>
      <div className="space-y-2">
        <div className="h-3 animate-shimmer rounded w-full" />
        <div className="h-3 animate-shimmer rounded w-5/6" />
        <div className="h-3 animate-shimmer rounded w-4/6" />
      </div>
    </div>
  )
}

interface AlignmentReview {
  overall_alignment: string
  summary: string
  misalignments: { severity: string; title: string }[]
}

export default function AdvisoryPage() {
  const {
    schoolData: { schoolId, schoolName, profile, positions, allPositions, projections, gradeExpansionPlan, loading },
    assumptions,
    baseSummary,
    conservativeMode,
  } = useScenario()
  const supabase = createClient()

  const multiYear = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, 0, gradeExpansionPlan, allPositions, profile.startup_funding),
    [profile, positions, allPositions, projections, assumptions, gradeExpansionPlan]
  )
  const startupFunding = profile.startup_funding?.reduce((s: number, f: { amount: number }) => s + f.amount, 0) || 0
  const preOpenCash = Math.round(startupFunding * 0.6)
  const scorecard = useMemo(
    () => computeFPFScorecard(multiYear, preOpenCash, conservativeMode),
    [multiYear, preOpenCash, conservativeMode]
  )

  const [data, setData] = useState<AdvisoryData | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelChanged, setModelChanged] = useState(false)
  const [alignmentReview, setAlignmentReview] = useState<AlignmentReview | null>(null)
  const initRef = useRef(false)

  // Compute current data hash — same inputs as Overview page
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const currentDataHash = useMemo(
    () => computeAdvisoryHash(baseSummary.operatingRevenue, baseSummary.totalPersonnel, baseSummary.totalOperations, profile.target_enrollment_y1, totalFte),
    [baseSummary.operatingRevenue, baseSummary.totalPersonnel, baseSummary.totalOperations, profile.target_enrollment_y1, totalFte]
  )

  // Fetch alignment review from Supabase
  useEffect(() => {
    if (!schoolId || loading) return
    supabase
      .from('alignment_reviews')
      .select('overall_alignment, summary, misalignments')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: review }) => {
        if (review) setAlignmentReview(review as AlignmentReview)
      })
  }, [schoolId, loading, supabase])

  // Save advisory to DB cache (same column as Overview)
  const saveAdvisoryCache = useCallback(async (advisoryData: AdvisoryData) => {
    if (!schoolId) return
    const cache: AdvisoryCache = {
      briefing: advisoryData.briefing,
      agents: advisoryData.agents,
      generatedAt: advisoryData.generatedAt,
      dataHash: currentDataHash,
    }
    await supabase
      .from('school_profiles')
      .update({ advisory_cache: cache })
      .eq('school_id', schoolId)
  }, [schoolId, currentDataHash, supabase])

  // Fetch fresh advisory from API and cache it
  const fetchAdvisory = useCallback(async () => {
    if (!schoolName || loading) return
    setFetching(true)
    setError(null)
    setModelChanged(false)
    try {
      let schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
      let agentContext = buildAgentContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)

      // Append alignment review findings if available
      if (alignmentReview) {
        const criticalFindings = alignmentReview.misalignments
          .filter((m) => m.severity === 'critical' || m.severity === 'important')
          .map((m) => `- [${m.severity}] ${m.title}`)
          .join('\n')
        const alignmentAppendix = `\n\nAPPLICATION ALIGNMENT REVIEW (${alignmentReview.overall_alignment}):
${alignmentReview.summary}
${criticalFindings ? `Key misalignments:\n${criticalFindings}` : 'No critical misalignments found.'}`
        schoolContext += alignmentAppendix
        agentContext += alignmentAppendix
      }

      const res = await fetch('/api/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolContext, agentContext }),
      })
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const result = await res.json() as AdvisoryData
      result.dataHash = currentDataHash
      setData(result)
      await saveAdvisoryCache(result)
    } catch (err) {
      console.error('Advisory fetch failed:', err)
      setError('Failed to generate advisory analysis. Please try again.')
    }
    setFetching(false)
  }, [schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard, loading, alignmentReview, currentDataHash, saveAdvisoryCache])

  // Load cached advisory on mount; auto-generate only on first visit (no cache)
  useEffect(() => {
    if (loading || initRef.current) return
    initRef.current = true

    const cached = profile.advisory_cache
    if (cached && cached.briefing) {
      setData({
        briefing: cached.briefing,
        agents: cached.agents,
        generatedAt: cached.generatedAt,
        dataHash: cached.dataHash,
      })
      // Check if the model has changed since the cached analysis
      if (cached.dataHash && cached.dataHash !== currentDataHash) {
        setModelChanged(true)
      }
    } else {
      // First visit — no cached analysis, auto-generate
      fetchAdvisory()
    }
  }, [loading, profile.advisory_cache, currentDataHash]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  // Build alignment agent card if review exists
  const alignmentAgent: AgentResult | null = alignmentReview ? {
    id: 'application_reviewer',
    name: 'Application Reviewer',
    icon: 'clipboard',
    subtitle: 'Application narrative vs. financial model',
    status: alignmentReview.overall_alignment === 'strong' ? 'strong'
      : alignmentReview.overall_alignment === 'weak' ? 'risk'
      : 'needs_attention',
    summary: alignmentReview.summary,
    actions: alignmentReview.misalignments
      .filter((m) => m.severity === 'critical' || m.severity === 'important')
      .slice(0, 3)
      .map((m) => m.title),
  } : null

  const allAgents = data ? [...data.agents, ...(alignmentAgent ? [alignmentAgent] : [])] : []
  const riskCount = allAgents.filter((a) => a.status === 'risk').length
  const attentionCount = allAgents.filter((a) => a.status === 'needs_attention').length
  const strongCount = allAgents.filter((a) => a.status === 'strong').length

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold text-slate-900">Advisory Panel</h1>
          <p className="text-sm text-slate-500 mt-1">Seven expert perspectives on your financial plan</p>
        </div>
        <button
          onClick={fetchAdvisory}
          disabled={fetching}
          className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {fetching ? 'Analyzing...' : 'Refresh Analysis'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Model changed banner */}
      {modelChanged && !fetching && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 flex items-center justify-between">
          <span>Your financial model has changed since the last analysis.</span>
          <button onClick={fetchAdvisory} className="font-medium text-amber-800 hover:text-amber-900 underline ml-2">
            Click Refresh for updated results
          </button>
        </div>
      )}

      {/* Briefing */}
      {fetching && !data ? (
        <div className="bg-white border-l-4 border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-8">
          <div className="h-4 animate-shimmer rounded w-48 mb-4" />
          <div className="space-y-3">
            <div className="h-3 animate-shimmer rounded w-full" />
            <div className="h-3 animate-shimmer rounded w-full" />
            <div className="h-3 animate-shimmer rounded w-5/6" />
            <div className="h-3 animate-shimmer rounded w-full mt-4" />
            <div className="h-3 animate-shimmer rounded w-full" />
            <div className="h-3 animate-shimmer rounded w-4/6" />
          </div>
        </div>
      ) : data ? (
        <div data-tour="advisor-briefing" className={`bg-white border-l-4 border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-8 animate-fade-in-up ${fetching ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Financial Advisor Briefing</h2>
          </div>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {data.briefing}
          </div>
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-500">{strongCount} Strong</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-500">{attentionCount} Needs Attention</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-500">{riskCount} Risk</span>
            </div>
            <div className="ml-auto text-xs text-slate-400">
              {data.generatedAt && `Last updated: ${new Date(data.generatedAt).toLocaleString()}`}
            </div>
          </div>
        </div>
      ) : null}

      {/* Agent cards */}
      <div data-tour="agent-cards" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {fetching && !data
          ? Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)
          : allAgents.map((agent, agentIdx) => {
              const cfg = STATUS_CONFIG[agent.status]
              return (
                <div key={agent.id} className={`bg-white border-l-4 ${cfg.border} border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in-up stagger-${agentIdx + 1}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.text}`}>
                      <AgentIcon icon={agent.icon} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm">{agent.name}</div>
                      <div className="text-xs text-slate-500">{agent.subtitle}</div>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">{agent.summary}</p>
                  {agent.actions.length > 0 && (
                    <div className="space-y-1.5">
                      {agent.actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                          <svg className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {action}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
      </div>

      {/* Ask about findings */}
      {data && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-700">Want to explore a finding?</div>
            <div className="text-xs text-slate-500 mt-0.5">Ask SchoolLaunch to explain any advisory assessment in detail.</div>
          </div>
          <Link
            href="/dashboard/ask"
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
          >
            Ask SchoolLaunch
          </Link>
        </div>
      )}
    </div>
  )
}
