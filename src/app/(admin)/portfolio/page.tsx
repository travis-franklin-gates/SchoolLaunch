'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { computeMultiYearDetailed, computeFPFScorecard, computeCarryForward, type FPFScorecard, type MultiYearDetailedRow } from '@/lib/budgetEngine'
import type { SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry, FinancialAssumptions } from '@/lib/types'
import { getAssumptions } from '@/lib/types'

interface SchoolCard {
  id: string
  name: string
  status: string
  gradeConfig: string
  openingGrades: string[] | null
  buildoutGrades: string[] | null
  plannedOpenYear: number
  enrollmentY1: number
  multiYear: MultiYearDetailedRow[]
  scorecard: FPFScorecard
  stage1Issues: number
  notes: NoteEntry[]
  onboardingComplete: boolean
  lastUpdated: string | null
}

interface NoteEntry {
  id: string
  content: string
  created_at: string
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planning: 'bg-blue-50 text-blue-700 border-blue-200',
    authorized: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    exported: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${styles[status] || styles.planning}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ReadinessBadge({ issues }: { issues: number }) {
  if (issues === 0) {
    return (
      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
        Meets Stage 1
      </span>
    )
  }
  if (issues <= 2) {
    return (
      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
        {issues} {issues === 1 ? 'Issue' : 'Issues'}
      </span>
    )
  }
  return (
    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
      {issues} Issues
    </span>
  )
}

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-semibold ${color || 'text-slate-800'}`}>{value}</div>
    </div>
  )
}

function reserveColor(days: number): string {
  if (days >= 60) return 'text-emerald-600'
  if (days >= 30) return 'text-amber-600'
  return 'text-red-600'
}

function personnelColor(pct: number): string {
  if (pct >= 72 && pct <= 78) return 'text-emerald-600'
  if (pct > 78 && pct <= 85) return 'text-amber-600'
  return 'text-red-600'
}

function formatGradeTrajectory(opening: string[] | null, buildout: string[] | null, gradeConfig: string): string {
  if (!opening?.length || !buildout?.length) return gradeConfig || 'Not set'
  const sortGrades = (grades: string[]) => {
    const order = ['PK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    return [...grades].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }
  const sorted = sortGrades(opening)
  const sortedBuild = sortGrades(buildout)
  const first = sorted[0] === 'K' ? 'K' : sorted[0]
  const last = sorted[sorted.length - 1] === 'K' ? 'K' : sorted[sorted.length - 1]
  const bFirst = sortedBuild[0] === 'K' ? 'K' : sortedBuild[0]
  const bLast = sortedBuild[sortedBuild.length - 1] === 'K' ? 'K' : sortedBuild[sortedBuild.length - 1]
  const openLabel = sorted.length === 1 ? first : `${first}-${last}`
  const buildLabel = sortedBuild.length === 1 ? bFirst : `${bFirst}-${bLast}`
  if (openLabel === buildLabel) return buildLabel
  return `${openLabel} → ${buildLabel}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No activity'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** Count Stage 1 "does_not_meet" measures (Years 1-2) */
function countStage1Issues(scorecard: FPFScorecard): number {
  const skip = new Set(['Debt Default', 'Enrollment Variance'])
  let count = 0
  for (const m of scorecard.measures) {
    if (skip.has(m.name)) continue
    for (let i = 0; i < Math.min(2, m.statuses.length); i++) {
      if (m.statuses[i] === 'does_not_meet') {
        count++
        break // count each measure once
      }
    }
  }
  return count
}

/** Determine current school year: Aug-Jul. If now is Aug 2026+, current year is 2026-2027 (opening fall 2026). */
function getCurrentAndNextOpenYear(): [number, number] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  // School year starts in August. If before August, the "current" opening year is this year's fall.
  // If August or later, the current opening year is this year, next is year+1.
  const currentOpenYear = month >= 7 ? year + 1 : year // schools opening "this" fall
  return [currentOpenYear, currentOpenYear + 1]
}

export default function PortfolioPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orgName, setOrgName] = useState('')
  const [schools, setSchools] = useState<SchoolCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .single()

    if (!roleData) { router.push('/login'); return }

    if (roleData.role === 'school_ceo') {
      router.push('/dashboard')
      return
    }

    // Load org name
    if (roleData.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', roleData.organization_id)
        .single()
      if (org) setOrgName(org.name)
    }

    // Load schools in org
    const { data: schoolRows } = await supabase
      .from('schools')
      .select('id, name, status, organization_id')
      .eq('organization_id', roleData.organization_id)

    if (!schoolRows?.length) { setLoading(false); return }

    const schoolIds = schoolRows.map((s) => s.id)

    // Load all data needed for computeMultiYearDetailed per school
    const [profilesRes, allPosRes, projectionsRes, notesRes, gepRes] = await Promise.all([
      supabase.from('school_profiles').select('*').in('school_id', schoolIds),
      supabase.from('staffing_positions').select('*').in('school_id', schoolIds).order('year'),
      supabase.from('budget_projections').select('*').in('school_id', schoolIds).eq('year', 1),
      supabase.from('org_notes').select('id, school_id, content, created_at').in('school_id', schoolIds).order('created_at', { ascending: false }),
      supabase.from('grade_expansion_plan').select('*').in('school_id', schoolIds).order('year').order('grade_level'),
    ])

    const profiles = profilesRes.data || []
    const allPositions = (allPosRes.data || []) as (StaffingPosition & { updated_at?: string })[]
    const projections = (projectionsRes.data || []) as BudgetProjection[]
    const notes = (notesRes.data || []) as (NoteEntry & { school_id: string })[]
    const allGep = (gepRes.data || []) as (GradeExpansionEntry & { school_id: string })[]

    const cards: SchoolCard[] = schoolRows.map((school) => {
      const profileRaw = profiles.find((p) => p.school_id === school.id)
      const profile = profileRaw as SchoolProfile | undefined
      const schoolAllPositions = allPositions.filter((p) => p.school_id === school.id)
      const schoolY1Positions = schoolAllPositions.filter((p) => p.year === 1)
      const schoolProjections = projections.filter((p) => p.school_id === school.id)
      const schoolNotes = notes.filter((n) => n.school_id === school.id)
      const schoolGep = allGep.filter((g) => (g as unknown as { school_id: string }).school_id === school.id) as GradeExpansionEntry[]

      const assumptions = getAssumptions(profile?.financial_assumptions as Partial<FinancialAssumptions> | null)
      const preOpenCash = profile ? computeCarryForward(profile) : 0

      // Compute multi-year detailed rows (same engine as school_ceo dashboard)
      let multiYear: MultiYearDetailedRow[] = []
      let scorecard: FPFScorecard = { measures: [], overallStatus: 'green', overallMessage: '' }
      let stage1Issues = 0

      if (profile && profile.onboarding_complete) {
        multiYear = computeMultiYearDetailed(
          profile, schoolY1Positions, schoolProjections, assumptions,
          preOpenCash, schoolGep.length > 0 ? schoolGep : undefined,
          schoolAllPositions, profile.startup_funding,
        )
        scorecard = computeFPFScorecard(multiYear, preOpenCash, false)
        stage1Issues = countStage1Issues(scorecard)
      }

      // Last activity: most recent updated_at across profile, positions, projections
      const timestamps: string[] = []
      if (profileRaw?.updated_at) timestamps.push(profileRaw.updated_at)
      for (const pos of schoolAllPositions) {
        if ((pos as { updated_at?: string }).updated_at) timestamps.push((pos as { updated_at?: string }).updated_at!)
      }
      for (const proj of schoolProjections) {
        if (proj.updated_at) timestamps.push(proj.updated_at)
      }
      const lastUpdated = timestamps.length > 0
        ? timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null

      return {
        id: school.id,
        name: school.name,
        status: school.status || 'planning',
        gradeConfig: profile?.grade_config || 'Not set',
        openingGrades: profile?.opening_grades || null,
        buildoutGrades: profile?.buildout_grades || null,
        plannedOpenYear: profile?.planned_open_year || 0,
        enrollmentY1: profile?.target_enrollment_y1 || 0,
        multiYear,
        scorecard,
        stage1Issues,
        notes: schoolNotes,
        onboardingComplete: profile?.onboarding_complete || false,
        lastUpdated,
      }
    })

    setSchools(cards)
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  async function addNote(schoolId: string) {
    const content = noteInputs[schoolId]?.trim()
    if (!content) return

    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, content }),
    })

    if (res.ok) {
      const note = await res.json()
      setSchools((prev) =>
        prev.map((s) =>
          s.id === schoolId
            ? { ...s, notes: [{ id: note.id, content: note.content, created_at: note.created_at }, ...s.notes] }
            : s
        )
      )
      setNoteInputs((prev) => ({ ...prev, [schoolId]: '' }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading portfolio...</p>
        </div>
      </div>
    )
  }

  // Summary stats
  const totalSchools = schools.length
  const schoolsWithData = schools.filter((s) => s.onboardingComplete)
  const meetingStage1 = schoolsWithData.filter((s) => s.stage1Issues === 0).length
  const [currentOpenYear, nextOpenYear] = getCurrentAndNextOpenYear()
  const openingSoon = schools.filter((s) => s.plannedOpenYear === currentOpenYear || s.plannedOpenYear === nextOpenYear).length
  const needsAttention = schoolsWithData.filter((s) => s.stage1Issues >= 2).length

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-slate-900">Portfolio</h1>
          <p className="text-sm text-slate-500 mt-1">{orgName}</p>
        </div>
        <button
          data-tour="invite-button"
          onClick={() => setShowInviteModal(true)}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          Invite School
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Schools</div>
          <div className="text-2xl font-bold text-slate-800">{totalSchools}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Meeting Stage 1</div>
          <div className={`text-2xl font-bold ${
            schoolsWithData.length === 0 ? 'text-slate-400'
            : meetingStage1 === schoolsWithData.length ? 'text-emerald-600'
            : meetingStage1 === 0 ? 'text-red-600'
            : 'text-amber-600'
          }`}>
            {schoolsWithData.length > 0
              ? `${meetingStage1} of ${schoolsWithData.length}`
              : '—'
            }
            <span className="text-sm font-normal text-slate-400 ml-1">
              {schoolsWithData.length > 0 ? 'schools' : ''}
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Opening Soon</div>
          <div className={`text-2xl font-bold ${openingSoon > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
            {openingSoon > 0 ? openingSoon : '0'}
            <span className="text-sm font-normal text-slate-400 ml-1">
              {openingSoon === 0 ? '— None' : openingSoon === 1 ? 'school' : 'schools'}
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Needs Attention</div>
          <div className={`text-2xl font-bold ${needsAttention > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {needsAttention}
            <span className="text-sm font-normal text-slate-400 ml-1">
              {needsAttention === 1 ? 'school' : 'schools'}
            </span>
          </div>
        </div>
      </div>

      {/* School cards grid */}
      {schools.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">No schools in your portfolio yet.</p>
          <p className="text-sm text-slate-400 mt-1">Click &ldquo;Invite School&rdquo; to get started.</p>
        </div>
      ) : (
        <div data-tour="school-cards" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {schools.map((school, idx) => {
            const y1 = school.multiYear[0]
            const personnelPct = y1 && y1.revenue.operatingRevenue > 0
              ? (y1.personnel.total / y1.revenue.operatingRevenue) * 100
              : 0
            const netPosition = y1 ? y1.net : 0
            const reserveDays = y1 ? y1.reserveDays : 0
            const breakEven = y1 && y1.revenue.total > 0 && y1.totalExpenses > 0
              ? Math.ceil(school.enrollmentY1 * (y1.totalExpenses / y1.revenue.total))
              : 0
            const gradeLabel = formatGradeTrajectory(school.openingGrades, school.buildoutGrades, school.gradeConfig)

            return (
              <div key={school.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                {/* Card header */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-800">{school.name}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2" {...(idx === 0 ? { 'data-tour': 'status-badge' } : {})}>
                      <StatusBadge status={school.status} />
                      {school.onboardingComplete && <ReadinessBadge issues={school.stage1Issues} />}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {school.plannedOpenYear > 0 && (
                      <span className="font-medium text-slate-600">Opening Fall {school.plannedOpenYear}</span>
                    )}
                    <span>{gradeLabel}</span>
                    {school.enrollmentY1 > 0 && <span>{school.enrollmentY1} students Year 1</span>}
                  </div>
                </div>

                {/* Metrics */}
                {school.onboardingComplete ? (
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <MetricCell
                        label="Reserve Days"
                        value={`${reserveDays} days`}
                        color={reserveColor(reserveDays)}
                      />
                      <MetricCell
                        label="Personnel %"
                        value={`${personnelPct.toFixed(1)}%`}
                        color={personnelColor(personnelPct)}
                      />
                      <MetricCell
                        label="Net Position"
                        value={fmt(netPosition)}
                        color={netPosition >= 0 ? 'text-emerald-600' : 'text-red-600'}
                      />
                      <MetricCell
                        label="Break-Even"
                        value={`${breakEven} students`}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Last updated: {formatDate(school.lastUpdated)}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center text-sm text-slate-400">
                    Onboarding not yet complete
                  </div>
                )}

                {/* Notes */}
                <div {...(idx === 0 ? { 'data-tour': 'notes-panel' } : {})} className="border-t border-slate-100 p-4">
                  <button
                    onClick={() => setExpandedNotes((prev) => ({ ...prev, [school.id]: !prev[school.id] }))}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 mb-2 flex items-center gap-1"
                  >
                    <svg className={`w-3 h-3 transition-transform ${expandedNotes[school.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    Notes ({school.notes.length})
                  </button>
                  {expandedNotes[school.id] && (
                    <div>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={noteInputs[school.id] || ''}
                          onChange={(e) => setNoteInputs((prev) => ({ ...prev, [school.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addNote(school.id)}
                          placeholder="Add a note..."
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <button
                          onClick={() => addNote(school.id)}
                          className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {school.notes.length > 0 && (
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {school.notes.map((note) => (
                            <div key={note.id} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                              <span>{note.content}</span>
                              <span className="text-slate-400 ml-2">
                                {new Date(note.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* View details link */}
                {school.onboardingComplete && (
                  <div className="border-t border-slate-100 px-5 py-3">
                    <Link
                      href={`/portfolio/${school.id}`}
                      className="text-sm text-teal-600 hover:text-teal-800 font-medium"
                    >
                      View Details
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} onSuccess={loadData} />}
    </div>
  )
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [ceoName, setCeoName] = useState('')
  const [ceoEmail, setCeoEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ceoName, ceoEmail }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create invitation')
        setLoading(false)
        return
      }

      const data = await res.json()
      setInviteUrl(data.inviteUrl)
      onSuccess()
    } catch {
      setError('An unexpected error occurred')
    }
    setLoading(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Invite School</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {inviteUrl ? (
          <div>
            <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg mb-4">
              Invitation created successfully!
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invite Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-600"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Send this link to the school CEO. They&apos;ll use it to create their account.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CEO Name</label>
              <input
                type="text"
                value={ceoName}
                onChange={(e) => setCeoName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                placeholder="e.g., Sarah Johnson"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CEO Email</label>
              <input
                type="email"
                value={ceoEmail}
                onChange={(e) => setCeoEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                placeholder="ceo@school.org"
              />
            </div>
            <p className="text-xs text-slate-400">The CEO will set up their school name, grade configuration, and all other details during onboarding.</p>

            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Invitation'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
