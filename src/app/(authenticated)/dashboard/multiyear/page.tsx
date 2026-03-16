'use client'

import { useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeMultiYearDetailed, getGrantRevenueForYear } from '@/lib/budgetEngine'
import type { StartupFundingSource } from '@/lib/types'
import Link from 'next/link'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function MultiYearPage() {
  const {
    schoolData: { profile, positions, allPositions, projections, gradeExpansionPlan, loading },
    assumptions,
  } = useScenario()

  const fundingSources: StartupFundingSource[] = profile.startup_funding && profile.startup_funding.length > 0
    ? profile.startup_funding
    : []

  const totalFunding = fundingSources.reduce((s, f) => s + f.amount, 0)
  const securedFunding = fundingSources
    .filter((f) => f.status === 'received' || f.status === 'pledged')
    .reduce((s, f) => s + f.amount, 0)

  // Recalculate with actual pre-opening net (funding minus a rough pre-opening cost estimate)
  const preOpenTotal = Math.round(totalFunding * 0.4)
  const yearsWithStartup = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, totalFunding - preOpenTotal, gradeExpansionPlan, allPositions, fundingSources),
    [profile, positions, allPositions, projections, assumptions, totalFunding, preOpenTotal, gradeExpansionPlan, fundingSources]
  )

  const hasExpansion = gradeExpansionPlan && gradeExpansionPlan.length > 0

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  const yrs = [1, 2, 3, 4, 5]

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold text-slate-900 mb-2">Multi-Year Projection</h1>
      <p className="text-sm text-slate-500 mb-6">
        Five-year projection with {assumptions.salary_escalator_pct}% annual salary escalator, {assumptions.ops_escalator_pct}% operations escalator, and {assumptions.revenue_cola_pct}% revenue COLA.
      </p>

      {/* Startup Funding Sources — read-only summary */}
      {fundingSources.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Startup Funding Sources</h2>
            <Link
              href="/dashboard/revenue"
              className="px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
            >
              Manage on Revenue tab
            </Link>
          </div>

          <div className="overflow-x-auto sl-scroll">
            <table className="w-full text-sm sl-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Source</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 w-20">Status</th>
                  {yrs.map((y) => (
                    <th key={y} className="text-right px-3 py-2 font-semibold text-slate-600 w-24">Year {y}</th>
                  ))}
                  <th className="text-right px-3 py-2 font-semibold text-slate-600 w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {fundingSources.map((src, idx) => {
                  const allocs = src.yearAllocations || {}
                  const isSecured = src.status === 'received' || src.status === 'pledged'
                  return (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{src.source || '(unnamed)'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-[10px] rounded font-medium ${
                          isSecured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {src.status}
                        </span>
                      </td>
                      {yrs.map((y) => (
                        <td key={y} className="px-3 py-2 text-right text-slate-600 tabular-nums">
                          {allocs[y] ? fmt(allocs[y]) : '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-medium text-slate-800 tabular-nums">{fmt(src.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-3 py-2 font-bold text-slate-800">Total</td>
                  <td></td>
                  {yrs.map((y) => {
                    const yearTotal = getGrantRevenueForYear(fundingSources, y)
                    return (
                      <td key={y} className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">
                        {yearTotal > 0 ? fmt(yearTotal) : '—'}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">{fmt(totalFunding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Secured vs Pending badges */}
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-emerald-600 font-semibold">Secured:</span>
              <span className="text-emerald-700 font-bold ml-1">{fmt(securedFunding)}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-amber-600 font-semibold">Pending:</span>
              <span className="text-amber-700 font-bold ml-1">{fmt(totalFunding - securedFunding)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main multi-year table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto sl-scroll">
        <table className="w-full text-sm whitespace-nowrap sl-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-3 font-semibold text-slate-600 min-w-[200px]"></th>
              {yrs.map((y) => (
                <th key={y} className="text-right px-5 py-3 font-semibold text-slate-600 min-w-[130px] num">
                  Year {y}
                  <div className="text-[10px] font-normal text-slate-400">
                    {yearsWithStartup[y - 1]?.enrollment || 0} students
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Enrollment Breakdown (grade expansion) */}
            {hasExpansion && (
              <>
                <SectionHeader label="Enrollment (Grade Expansion)" cols={5} />
                <tr className="border-b border-slate-100 bg-teal-50/30">
                  <td className="px-5 py-2.5 text-slate-600">Grades Served</td>
                  {yearsWithStartup.map((y) => (
                    <td key={y.year} className="px-5 py-2.5 text-right text-xs text-slate-600">
                      {y.expansionDetail?.grades.join(', ') || '—'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2.5 text-slate-600">New Grades Added</td>
                  {yearsWithStartup.map((y) => (
                    <td key={y.year} className="px-5 py-2.5 text-right text-teal-600 font-medium text-xs">
                      {y.expansionDetail?.newGrades.length ? `+${y.expansionDetail.newGrades.join(', ')}` : '—'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2.5 text-slate-600">Returning Students</td>
                  {yearsWithStartup.map((y) => (
                    <td key={y.year} className="px-5 py-2.5 text-right text-slate-600">
                      {y.expansionDetail ? (y.year === 1 ? '—' : y.expansionDetail.returning) : '—'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-2.5 text-slate-600">New Grade Students</td>
                  {yearsWithStartup.map((y) => (
                    <td key={y.year} className="px-5 py-2.5 text-right text-teal-600">
                      {y.expansionDetail ? (y.year === 1 ? y.enrollment : (y.expansionDetail.newGrade > 0 ? `+${y.expansionDetail.newGrade}` : '—')) : '—'}
                    </td>
                  ))}
                </tr>
                <TotalRow label="Total Enrollment" values={yearsWithStartup.map((y) => y.enrollment)} format="number" />
              </>
            )}

            {/* Revenue Section */}
            <SectionHeader label="Revenue" cols={5} />
            <Row label="Regular Ed Apportionment" values={yearsWithStartup.map((y) => y.revenue.regularEd)} />
            <Row label="SPED Apportionment" values={yearsWithStartup.map((y) => y.revenue.sped)} />
            <Row label="Facilities Revenue" values={yearsWithStartup.map((y) => y.revenue.facilitiesRev)} />
            <Row label="Levy Equity" values={yearsWithStartup.map((y) => y.revenue.levyEquity)} />
            <Row label="Title I" values={yearsWithStartup.map((y) => y.revenue.titleI)} />
            <Row label="IDEA" values={yearsWithStartup.map((y) => y.revenue.idea)} />
            <Row label="LAP" values={yearsWithStartup.map((y) => y.revenue.lap)} />
            <Row label="TBIP" values={yearsWithStartup.map((y) => y.revenue.tbip)} />
            <Row label="HiCap" values={yearsWithStartup.map((y) => y.revenue.hicap)} />
            <Row label="Interest & Other Income" values={yearsWithStartup.map((y) => y.revenue.interestIncome)} />
            <TotalRow label="Operating Revenue" values={yearsWithStartup.map((y) => y.revenue.operatingRevenue)} />
            {yearsWithStartup.some((y) => y.revenue.grantRevenue > 0) && (
              <>
                <Row label="Startup & Other Grants" values={yearsWithStartup.map((y) => y.revenue.grantRevenue)} />
                <TotalRow label="Total Revenue (incl. Grants)" values={yearsWithStartup.map((y) => y.revenue.total)} />
              </>
            )}

            {/* Personnel Section */}
            <SectionHeader label="Personnel" cols={5} />
            <Row label="Certificated Staff" values={yearsWithStartup.map((y) => y.personnel.certificated)} />
            <Row label="Classified Staff" values={yearsWithStartup.map((y) => y.personnel.classified)} />
            <Row label="Admin Staff" values={yearsWithStartup.map((y) => y.personnel.admin)} />
            <Row label={`Benefits (${assumptions.benefits_load_pct}%)`} values={yearsWithStartup.map((y) => y.personnel.benefits)} />
            <TotalRow label="Total Personnel" values={yearsWithStartup.map((y) => y.personnel.total)} />

            {/* Staffing summary */}
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <td className="px-5 py-2 text-xs text-slate-500 italic">Staff Count</td>
              {yearsWithStartup.map((y) => (
                <td key={y.year} className="px-5 py-2 text-right text-xs text-slate-500 italic">
                  {y.staffing.totalPositions} ({y.staffing.teachers}T, {y.staffing.paras}P, {y.staffing.officeStaff}O)
                </td>
              ))}
            </tr>

            {/* Operations Section */}
            <SectionHeader label="Operations" cols={5} />
            <Row label="Facilities" values={yearsWithStartup.map((y) => y.operations.facilities)} />
            <Row label="Supplies & Materials" values={yearsWithStartup.map((y) => y.operations.supplies)} />
            <Row label="Contracted Services" values={yearsWithStartup.map((y) => y.operations.contracted)} />
            <Row label="Technology" values={yearsWithStartup.map((y) => y.operations.technology)} />
            <Row label="Authorizer Fee" values={yearsWithStartup.map((y) => y.operations.authorizerFee)} />
            <Row label="Insurance" values={yearsWithStartup.map((y) => y.operations.insurance)} />
            <Row label="Misc/Contingency" values={yearsWithStartup.map((y) => y.operations.contingency)} />
            <TotalRow label="Total Operations" values={yearsWithStartup.map((y) => y.operations.total)} />

            {/* Summary Section */}
            <SectionHeader label="Summary" cols={5} />
            <TotalRow label={yearsWithStartup.some((y) => y.revenue.grantRevenue > 0) ? 'Total Revenue (incl. Grants)' : 'Total Revenue'} values={yearsWithStartup.map((y) => y.revenue.total)} />
            <TotalRow label="Total Expenses" values={yearsWithStartup.map((y) => y.totalExpenses)} />
            <tr className="border-b border-slate-200">
              <td className="px-5 py-3 font-bold text-slate-800">Net Position</td>
              {yearsWithStartup.map((y) => (
                <td key={y.year} className={`px-5 py-3 text-right font-bold ${y.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(y.net)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-5 py-3 font-medium text-slate-700">Cumulative Net</td>
              {yearsWithStartup.map((y) => (
                <td key={y.year} className={`px-5 py-3 text-right font-medium ${y.cumulativeNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(y.cumulativeNet)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-3 font-bold text-slate-800">Reserve Days</td>
              {yearsWithStartup.map((y) => (
                <td key={y.year} className={`px-5 py-3 text-right font-bold ${
                  y.reserveDays >= 60 ? 'text-emerald-600' :
                  y.reserveDays >= 30 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {y.reserveDays}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionHeader({ label, cols }: { label: string; cols: number }) {
  return (
    <tr className="bg-slate-100 border-b border-slate-200 section-header">
      <td className="px-5 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide" colSpan={cols + 1}>
        {label}
      </td>
    </tr>
  )
}

function Row({ label, values }: { label: string; values: number[] }) {
  return (
    <tr className="border-b border-slate-100 even:bg-slate-50/30">
      <td className="px-5 py-2.5 text-slate-600">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-5 py-2.5 text-right text-slate-600 tabular-nums num">{fmt(v)}</td>
      ))}
    </tr>
  )
}

function TotalRow({ label, values, format = 'currency' }: { label: string; values: number[]; format?: 'currency' | 'number' }) {
  return (
    <tr className="border-b border-slate-200 bg-slate-50 total">
      <td className="px-5 py-3 font-bold text-slate-800">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-5 py-3 text-right font-bold text-slate-800 tabular-nums num">
          {format === 'number' ? v.toLocaleString() : fmt(v)}
        </td>
      ))}
    </tr>
  )
}
