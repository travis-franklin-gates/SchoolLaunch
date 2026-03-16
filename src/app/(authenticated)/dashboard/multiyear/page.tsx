'use client'

import { useState, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeMultiYearDetailed } from '@/lib/budgetEngine'
import { createClient } from '@/lib/supabase/client'
import type { StartupFundingSource } from '@/lib/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const FUNDING_TYPES: StartupFundingSource['type'][] = ['grant', 'donation', 'debt', 'other']
const FUNDING_STATUSES: StartupFundingSource['status'][] = ['received', 'pledged', 'applied', 'projected', 'n/a']

const DEFAULT_SOURCES: StartupFundingSource[] = [
  { source: 'WA Charter School Program (CSP) Grant', amount: 150000, type: 'grant', status: 'applied' },
  { source: 'Founder Savings / Personal Investment', amount: 50000, type: 'other', status: 'received' },
]

export default function MultiYearPage() {
  const {
    schoolData: { schoolId, profile, positions, allPositions, projections, gradeExpansionPlan, loading, reload },
    assumptions,
  } = useScenario()
  const supabase = createClient()

  const [fundingSources, setFundingSources] = useState<StartupFundingSource[]>(
    profile.startup_funding && profile.startup_funding.length > 0
      ? profile.startup_funding
      : DEFAULT_SOURCES
  )
  const [savingFunding, setSavingFunding] = useState(false)

  const totalFunding = fundingSources.reduce((s, f) => s + f.amount, 0)
  const securedFunding = fundingSources
    .filter((f) => f.status === 'received' || f.status === 'pledged')
    .reduce((s, f) => s + f.amount, 0)

  const years = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, -totalFunding + totalFunding, gradeExpansionPlan, allPositions, fundingSources),
    [profile, positions, allPositions, projections, assumptions, totalFunding, gradeExpansionPlan, fundingSources]
  )

  // Recalculate with actual pre-opening net (funding minus a rough pre-opening cost estimate)
  const preOpenTotal = Math.round(totalFunding * 0.4) // rough estimate: 40% goes to pre-opening
  const yearsWithStartup = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, totalFunding - preOpenTotal, gradeExpansionPlan, allPositions, fundingSources),
    [profile, positions, allPositions, projections, assumptions, totalFunding, preOpenTotal, gradeExpansionPlan, fundingSources]
  )

  const hasExpansion = gradeExpansionPlan && gradeExpansionPlan.length > 0

  function addSource() {
    setFundingSources((prev) => [...prev, { source: '', amount: 0, type: 'grant', status: 'projected', selectedYears: [], yearAllocations: {} }])
  }

  function removeSource(idx: number) {
    setFundingSources((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateSource(idx: number, field: keyof StartupFundingSource, value: string | number) {
    setFundingSources((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    )
  }

  function toggleYear(idx: number, year: number) {
    setFundingSources((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s
        const selected = s.selectedYears || []
        const allocs = { ...(s.yearAllocations || {}) }
        let newSelected: number[]
        if (selected.includes(year)) {
          newSelected = selected.filter((y) => y !== year)
          delete allocs[year]
        } else {
          newSelected = [...selected, year].sort()
          // Auto-distribute evenly across newly selected years
          const perYear = Math.round(s.amount / (newSelected.length || 1))
          for (const y of newSelected) allocs[y] = perYear
          // Adjust last year to absorb rounding
          const allocated = newSelected.slice(0, -1).reduce((sum, y) => sum + (allocs[y] || 0), 0)
          allocs[newSelected[newSelected.length - 1]] = s.amount - allocated
        }
        return { ...s, selectedYears: newSelected, yearAllocations: allocs }
      })
    )
  }

  function updateYearAllocation(idx: number, year: number, value: number) {
    setFundingSources((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s
        return { ...s, yearAllocations: { ...(s.yearAllocations || {}), [year]: value } }
      })
    )
  }

  async function saveFunding() {
    if (!schoolId) return
    setSavingFunding(true)
    await supabase
      .from('school_profiles')
      .update({ startup_funding: fundingSources })
      .eq('school_id', schoolId)
    setSavingFunding(false)
    await reload()
  }

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

      {/* Startup Funding Sources */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Startup Funding Sources</h2>
          <div className="flex gap-2">
            <button
              onClick={addSource}
              className="px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
            >
              + Add Source
            </button>
            <button
              onClick={saveFunding}
              disabled={savingFunding}
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {savingFunding ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto sl-scroll">
          <table className="w-full text-sm sl-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Source</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600 w-32">Total Amount</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Type</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Year Allocation</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {fundingSources.map((src, idx) => {
                const selected = src.selectedYears || []
                const allocs = src.yearAllocations || {}
                const allocTotal = selected.reduce((s, y) => s + (allocs[y] || 0), 0)
                const allocMismatch = selected.length > 0 && allocTotal !== src.amount
                return (
                  <tr key={idx} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={src.source}
                        onChange={(e) => updateSource(idx, 'source', e.target.value)}
                        placeholder="Funding source name..."
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step={1000}
                        value={src.amount}
                        onChange={(e) => updateSource(idx, 'amount', Number(e.target.value))}
                        className="w-full text-right border border-slate-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={src.type}
                        onChange={(e) => updateSource(idx, 'type', e.target.value)}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        {FUNDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={src.status}
                        onChange={(e) => updateSource(idx, 'status', e.target.value)}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        {FUNDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {/* Year toggle buttons */}
                      <div className="flex gap-1 mb-1.5">
                        {[0, 1, 2, 3, 4].map((y) => (
                          <button
                            key={y}
                            onClick={() => toggleYear(idx, y)}
                            className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                              selected.includes(y)
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            Y{y}
                          </button>
                        ))}
                      </div>
                      {/* Per-year allocation inputs */}
                      {selected.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.map((y) => (
                            <div key={y} className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-medium w-5">Y{y}</span>
                              <input
                                type="number"
                                step={1000}
                                value={allocs[y] || 0}
                                onChange={(e) => updateYearAllocation(idx, y, Number(e.target.value))}
                                className="w-20 text-right border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              />
                            </div>
                          ))}
                          {allocMismatch && (
                            <span className="text-[10px] text-amber-600 self-center">
                              ({fmt(allocTotal)} of {fmt(src.amount)})
                            </span>
                          )}
                        </div>
                      )}
                      {selected.length === 0 && (
                        <span className="text-[10px] text-slate-400">Select years above</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeSource(idx)}
                        className="text-slate-400 hover:text-red-500 text-lg leading-none"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td className="px-3 py-2 font-bold text-slate-800">Total</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmt(totalFunding)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Funding summary badges */}
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

        {securedFunding < totalFunding * 0.5 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            <strong>Warning:</strong> Less than 50% of startup funding is secured (received or pledged).
            Authorizers typically want to see committed funding before approving a charter.
          </div>
        )}
      </div>

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
