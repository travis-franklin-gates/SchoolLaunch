'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  computeSummaryFromProjections,
  computeMultiYearDetailed,
  computeFPFScorecard,
  computeCashFlow,
  computeCarryForward,
  getGrantRevenueForYear,
  MONTHS,
  type BudgetSummary,
  type MultiYearDetailedRow,
  type CashFlowMonth,
} from '@/lib/budgetEngine'
import { calcCommissionRevenue } from '@/lib/calculations'
import type { SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry, FinancialAssumptions, StartupFundingSource } from '@/lib/types'
import { getAssumptions } from '@/lib/types'

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

function HealthTile({ label, value, colorClass }: {
  label: string
  value: string
  colorClass?: { bg: string; text: string; border: string }
}) {
  const bg = colorClass?.bg || 'bg-white'
  const text = colorClass?.text || 'text-slate-800'
  const border = colorClass?.border || 'border-slate-200'
  return (
    <div className={`${bg} ${border} border rounded-xl p-5`}>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${text}`}>{value}</div>
    </div>
  )
}

export default function SchoolDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [schoolName, setSchoolName] = useState('')
  const [profile, setProfile] = useState<SchoolProfile | null>(null)
  const [positions, setPositions] = useState<StaffingPosition[]>([])
  const [allPositions, setAllPositions] = useState<StaffingPosition[]>([])
  const [projections, setProjections] = useState<BudgetProjection[]>([])
  const [gradeExpansionPlan, setGradeExpansionPlan] = useState<GradeExpansionEntry[]>([])
  const [notes, setNotes] = useState<Array<{ id: string; content: string; created_at: string }>>([])
  const [noteInput, setNoteInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Verify user is org_admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!roleData || roleData.role === 'school_ceo') {
        router.push('/dashboard')
        return
      }

      const [schoolRes, profileRes, posRes, projRes, gepRes, notesRes] = await Promise.all([
        supabase.from('schools').select('name').eq('id', schoolId).single(),
        supabase.from('school_profiles').select('*').eq('school_id', schoolId).single(),
        supabase.from('staffing_positions').select('*').eq('school_id', schoolId).order('year'),
        supabase.from('budget_projections').select('*').eq('school_id', schoolId).eq('year', 1),
        supabase.from('grade_expansion_plan').select('*').eq('school_id', schoolId).order('year').order('grade_level'),
        supabase.from('org_notes').select('id, content, created_at').eq('school_id', schoolId).order('created_at', { ascending: false }),
      ])

      if (schoolRes.data) setSchoolName(schoolRes.data.name)
      if (profileRes.data) setProfile(profileRes.data as SchoolProfile)
      if (posRes.data) {
        const all = posRes.data as StaffingPosition[]
        setAllPositions(all)
        setPositions(all.filter(p => p.year === 1))
      }
      if (projRes.data) setProjections(projRes.data as BudgetProjection[])
      if (gepRes.data) setGradeExpansionPlan(gepRes.data as GradeExpansionEntry[])
      if (notesRes.data) setNotes(notesRes.data)
      setLoading(false)
    }
    load()
  }, [schoolId, supabase, router])

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    )
  }

  const assumptions = getAssumptions(profile.financial_assumptions as Partial<FinancialAssumptions> | null)
  const y1Grant = getGrantRevenueForYear(profile.startup_funding as StartupFundingSource[] | null, 1)
  const revenueProfile = {
    target_enrollment_y1: profile.target_enrollment_y1,
    pct_frl: profile.pct_frl,
    pct_iep: profile.pct_iep,
    pct_ell: profile.pct_ell,
    pct_hicap: profile.pct_hicap,
  }
  const summary = computeSummaryFromProjections(projections, positions, assumptions, y1Grant, revenueProfile)

  // Use computeCarryForward for beginning cash — same as school_ceo dashboard
  const preOpenCash = computeCarryForward(profile)
  const rev = calcCommissionRevenue(profile.target_enrollment_y1, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions)
  const apportionment = rev.regularEd + rev.sped + rev.facilitiesRev
  const cashFlow = computeCashFlow(summary, apportionment, preOpenCash)

  // Use same multi-year calculation as school_ceo dashboard with carry-forward and all positions
  const multiYear = computeMultiYearDetailed(
    profile, positions, projections, assumptions, preOpenCash,
    gradeExpansionPlan.length > 0 ? gradeExpansionPlan : undefined,
    allPositions, profile.startup_funding as StartupFundingSource[] | null
  )
  const scorecard = computeFPFScorecard(multiYear, preOpenCash, false)

  // Use scorecard Days of Cash (same as school_ceo dashboard) instead of summary.reserveDays
  const daysOfCash = scorecard.measures.find(m => m.name === 'Days of Cash')?.values[0] ?? 0
  const rc = reserveColor(daysOfCash as number)
  // Use multiYear Y1 values (same source of truth as school_ceo dashboard)
  const y1Net = multiYear.length > 0 ? multiYear[0].net : summary.netPosition
  const y1Personnel = multiYear.length > 0 ? multiYear[0].personnel.total : summary.totalPersonnel
  const y1OpRev = multiYear.length > 0 ? multiYear[0].revenue.operatingRevenue : summary.operatingRevenue
  const personnelPct = y1OpRev > 0 ? (y1Personnel / y1OpRev) * 100 : 0
  const breakEvenEnroll = multiYear.length > 0 && multiYear[0].revenue.total > 0
    ? Math.ceil(multiYear[0].totalExpenses / (multiYear[0].revenue.total / multiYear[0].enrollment))
    : summary.breakEvenEnrollment

  const surplusColor = y1Net >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  const personnelColor = personnelPct <= 78
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : personnelPct <= 85
      ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
      : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }

  // Build revenue display from live-calculated multiYear data (matches school_ceo dashboard)
  const y1Rev = multiYear.length > 0 ? multiYear[0].revenue : null
  const liveRevenueLines = y1Rev ? [
    { label: 'Regular Ed Apportionment', amount: y1Rev.regularEd },
    { label: 'SPED Apportionment', amount: y1Rev.sped },
    { label: 'State Special Education', amount: y1Rev.stateSped },
    { label: 'Facilities Revenue', amount: y1Rev.facilitiesRev },
    { label: 'Levy Equity', amount: y1Rev.levyEquity },
    { label: 'Title I', amount: y1Rev.titleI },
    { label: 'IDEA', amount: y1Rev.idea },
    { label: 'LAP', amount: y1Rev.lap },
    { label: 'LAP High Poverty', amount: y1Rev.lapHighPoverty },
    { label: 'TBIP', amount: y1Rev.tbip },
    { label: 'HiCap', amount: y1Rev.hicap },
    { label: 'Food Service (NSLP)', amount: y1Rev.foodServiceRev },
    { label: 'Transportation (State)', amount: y1Rev.transportationRev },
    { label: 'Interest Income', amount: y1Rev.interestIncome },
  ].filter(l => l.amount > 0) : projections.filter(p => p.is_revenue).map(p => ({ label: p.subcategory, amount: p.amount }))
  const totalRevenue = multiYear.length > 0 ? multiYear[0].revenue.total : summary.totalRevenue
  const opsLines = projections.filter((p) => !p.is_revenue && p.category === 'Operations')

  async function handleAddNote() {
    const content = noteInput.trim()
    if (!content) return
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, content }),
      })
      if (res.ok) {
        const note = await res.json()
        setNotes(prev => [{ id: note.id, content: note.content, created_at: note.created_at }, ...prev])
        setNoteInput('')
      }
    } catch (err) {
      console.error('Failed to save note:', err)
    }
  }

  return (
    <div data-tour="school-detail">
      {/* Back link */}
      <Link href="/portfolio" className="text-sm text-teal-600 hover:text-teal-800 font-medium mb-4 inline-block">
        &larr; Back to Portfolio
      </Link>

      <h1 className="text-2xl font-bold text-slate-800 mb-1">{schoolName}</h1>
      <p className="text-sm text-slate-500 mb-6">
        {profile.grade_config} &middot; {profile.target_enrollment_y1} students (Y1) &middot; {profile.region}
      </p>

      {/* Health tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HealthTile label="Days of Cash Y1" value={`${daysOfCash} days`} colorClass={rc} />
        <HealthTile label="Personnel % of Revenue" value={`${personnelPct.toFixed(1)}%`} colorClass={personnelColor} />
        <HealthTile label="Year 1 Net Position" value={fmt(y1Net)} colorClass={surplusColor} />
        <HealthTile label="Break-Even Enrollment" value={`${breakEvenEnroll} students`} />
      </div>

      {/* Revenue */}
      <Section title="Revenue">
        <SimpleTable
          rows={liveRevenueLines.map((r) => [r.label, fmt(r.amount)])}
          footer={['Total Revenue', fmt(totalRevenue)]}
        />
      </Section>

      {/* Staffing */}
      <Section title="Staffing">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2 font-semibold text-slate-600">Position</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-600">Category</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">FTE</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">Salary</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-600">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const totalCost = Math.round(p.annual_salary * p.fte * (1 + assumptions.benefits_load_pct / 100))
                return (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-4 py-2 text-slate-700">{p.title}</td>
                    <td className="px-4 py-2 text-slate-500 capitalize">{p.category}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{p.fte}</td>
                    <td className="px-4 py-2 text-right text-slate-600">${p.annual_salary.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-700 font-medium">${totalCost.toLocaleString()}</td>
                  </tr>
                )
              })}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-2 text-slate-800" colSpan={4}>Total Personnel</td>
                <td className="px-4 py-2 text-right text-slate-800">{fmt(summary.totalPersonnel)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Operations */}
      <Section title="Operations">
        <SimpleTable
          rows={opsLines.map((o) => [o.subcategory, fmt(o.amount)])}
          footer={['Total Operations', fmt(summary.totalOperations)]}
        />
      </Section>

      {/* Cash Flow */}
      <Section title="Monthly Cash Flow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Month</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Inflow</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Payroll</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Other Exp</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Net</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Balance</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map((m) => (
                <tr key={m.month} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-700 font-medium">{m.month}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(m.totalInflow)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(m.payroll)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(m.otherExpenses)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${m.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(m.netCashFlow)}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${m.cumulativeBalance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                    {fmt(m.cumulativeBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Multi-Year */}
      <Section title="Multi-Year Projections">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2 font-semibold text-slate-600"></th>
                {multiYear.map((r) => (
                  <th key={r.year} className="text-right px-4 py-2 font-semibold text-slate-600">Year {r.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Enrollment', values: multiYear.map((r) => `${r.enrollment}`) },
                { label: 'Total Revenue', values: multiYear.map((r) => fmt(r.revenue.total)) },
                { label: 'Total Personnel', values: multiYear.map((r) => fmt(r.personnel.total)) },
                { label: 'Total Operations', values: multiYear.map((r) => fmt(r.operations.total)) },
                { label: 'Net Position', values: multiYear.map((r) => fmt(r.net)), bold: true },
                { label: 'Days Cash', values: multiYear.map((r) => `${r.reserveDays} days`), bold: true },
              ].map((row) => (
                <tr key={row.label} className="border-b border-slate-100">
                  <td className={`px-4 py-2 ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-4 py-2 text-right ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Add a note about this school..."
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button onClick={handleAddNote} disabled={!noteInput.trim()} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">
            Save Note
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No notes yet. Add a note to track your review of this school.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(n => {
              const ago = Math.floor((Date.now() - new Date(n.created_at).getTime()) / (1000 * 60))
              const timeLabel = ago < 1 ? 'Just now' : ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.floor(ago / 60)}h ago` : `${Math.floor(ago / 1440)}d ago`
              return (
                <div key={n.id} className="border-l-2 border-teal-200 pl-3 py-1">
                  <p className="text-sm text-slate-700">{n.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{timeLabel}</p>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function SimpleTable({ rows, footer }: { rows: [string, string][]; footer: [string, string] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className="border-b border-slate-100">
            <td className="px-5 py-2.5 text-slate-600">{label}</td>
            <td className="px-5 py-2.5 text-right text-slate-700 font-medium">{value}</td>
          </tr>
        ))}
        <tr className="bg-slate-50 font-semibold">
          <td className="px-5 py-2.5 text-slate-800">{footer[0]}</td>
          <td className="px-5 py-2.5 text-right text-slate-800">{footer[1]}</td>
        </tr>
      </tbody>
    </table>
  )
}
