'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { buildSchoolContextString } from '@/lib/buildSchoolContext'
import { computeMultiYearDetailed, computeFPFScorecard } from '@/lib/budgetEngine'
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
    <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-slate-200 rounded-lg" />
        <div className="flex-1">
          <div className="h-4 bg-slate-200 rounded w-32 mb-1" />
          <div className="h-3 bg-slate-100 rounded w-48" />
        </div>
        <div className="h-5 bg-slate-200 rounded-full w-24" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
        <div className="h-3 bg-slate-100 rounded w-4/6" />
      </div>
    </div>
  )
}

export default function AdvisoryPage() {
  const {
    schoolData: { schoolName, profile, positions, projections, gradeExpansionPlan, loading },
    assumptions,
    conservativeMode,
  } = useScenario()

  const multiYear = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, 0, gradeExpansionPlan),
    [profile, positions, projections, assumptions, gradeExpansionPlan]
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

  const fetchAdvisory = useCallback(async () => {
    if (!schoolName || loading) return
    setFetching(true)
    setError(null)
    try {
      const schoolContext = buildSchoolContextString(schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard)
      const res = await fetch('/api/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolContext }),
      })
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error('Advisory fetch failed:', err)
      setError('Failed to generate advisory analysis. Please try again.')
    }
    setFetching(false)
  }, [schoolName, profile, positions, projections, gradeExpansionPlan, multiYear, scorecard, loading])

  useEffect(() => {
    if (!data && !fetching && schoolName && !loading) {
      fetchAdvisory()
    }
  }, [data, fetching, schoolName, loading, fetchAdvisory])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  const riskCount = data?.agents.filter((a) => a.status === 'risk').length || 0
  const attentionCount = data?.agents.filter((a) => a.status === 'needs_attention').length || 0
  const strongCount = data?.agents.filter((a) => a.status === 'strong').length || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Advisory Panel</h1>
          <p className="text-sm text-slate-500 mt-1">Seven expert perspectives on your financial plan</p>
        </div>
        <button
          onClick={fetchAdvisory}
          disabled={fetching}
          className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {fetching ? 'Analyzing...' : 'Refresh Analysis'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Briefing */}
      {fetching && !data ? (
        <div className="bg-white border-l-4 border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-8 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-48 mb-4" />
          <div className="space-y-3">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
            <div className="h-3 bg-slate-100 rounded w-full mt-4" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-4/6" />
          </div>
        </div>
      ) : data ? (
        <div className="bg-white border-l-4 border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-8">
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
              {data.generatedAt && `Updated ${new Date(data.generatedAt).toLocaleTimeString()}`}
            </div>
          </div>
        </div>
      ) : null}

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {fetching && !data
          ? Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)
          : data?.agents.map((agent) => {
              const cfg = STATUS_CONFIG[agent.status]
              return (
                <div key={agent.id} className={`bg-white border-l-4 ${cfg.border} border border-slate-200 rounded-xl p-5`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.text}`}>
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
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Ask SchoolLaunch
          </Link>
        </div>
      )}
    </div>
  )
}
