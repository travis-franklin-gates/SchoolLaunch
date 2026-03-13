'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  computeSummaryFromProjections,
  computeMultiYearDetailed,
  computeCashFlow,
  MONTHS,
  type BudgetSummary,
  type MultiYearDetailedRow,
  type CashFlowMonth,
} from '@/lib/budgetEngine'
import { calcCommissionRevenue } from '@/lib/calculations'
import type { SchoolProfile, StaffingPosition, BudgetProjection, FinancialAssumptions } from '@/lib/types'
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
  const [projections, setProjections] = useState<BudgetProjection[]>([])
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

      const [schoolRes, profileRes, posRes, projRes] = await Promise.all([
        supabase.from('schools').select('name').eq('id', schoolId).single(),
        supabase.from('school_profiles').select('*').eq('school_id', schoolId).single(),
        supabase.from('staffing_positions').select('*').eq('school_id', schoolId).eq('year', 1),
        supabase.from('budget_projections').select('*').eq('school_id', schoolId).eq('year', 1),
      ])

      if (schoolRes.data) setSchoolName(schoolRes.data.name)
      if (profileRes.data) setProfile(profileRes.data as SchoolProfile)
      if (posRes.data) setPositions(posRes.data as StaffingPosition[])
      if (projRes.data) setProjections(projRes.data as BudgetProjection[])
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
  const summary = computeSummaryFromProjections(projections, positions, assumptions)
  const rev = calcCommissionRevenue(profile.target_enrollment_y1, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions)
  const apportionment = rev.regularEd + rev.sped + rev.facilitiesRev
  const cashFlow = computeCashFlow(summary, apportionment)
  const multiYear = computeMultiYearDetailed(profile, positions, projections, assumptions, 0)

  const rc = reserveColor(summary.reserveDays)
  const surplusColor = summary.netPosition >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  const personnelColor = summary.personnelPctRevenue <= 78
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : summary.personnelPctRevenue <= 85
      ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
      : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }

  const revenueLines = projections.filter((p) => p.is_revenue)
  const opsLines = projections.filter((p) => !p.is_revenue && p.category === 'Operations')

  return (
    <div>
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
        <HealthTile label="Year-End Reserve" value={`${summary.reserveDays} days`} colorClass={rc} />
        <HealthTile label="Personnel % of Revenue" value={`${summary.personnelPctRevenue.toFixed(1)}%`} colorClass={personnelColor} />
        <HealthTile label="Year 1 Surplus/Deficit" value={fmt(summary.netPosition)} colorClass={surplusColor} />
        <HealthTile label="Break-Even Enrollment" value={`${summary.breakEvenEnrollment} students`} />
      </div>

      {/* Revenue */}
      <Section title="Revenue">
        <SimpleTable
          rows={revenueLines.map((r) => [r.subcategory, fmt(r.amount)])}
          footer={['Total Revenue', fmt(summary.totalRevenue)]}
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
                { label: 'Reserve Days', values: multiYear.map((r) => `${r.reserveDays} days`), bold: true },
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
