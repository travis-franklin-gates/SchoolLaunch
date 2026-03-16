'use client'

import React, { useState, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { calcCommissionRevenue, calcAAFTE } from '@/lib/calculations'
import { getGrantAllocationsForYear } from '@/lib/budgetEngine'
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

interface RevenueRow {
  label: string
  group: string
  formula: string
  calculated: number
  scenarioCalc: number
  override: number | null
  helperNote?: string
}

export default function RevenuePage() {
  const {
    schoolData: { schoolId, profile, loading, reload },
    assumptions,
    isModified,
    scenarioInputs,
  } = useScenario()
  const supabase = createClient()
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  // Startup funding source state
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
          const perYear = Math.round(s.amount / (newSelected.length || 1))
          for (const y of newSelected) allocs[y] = perYear
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

  const baseEnrollment = profile.target_enrollment_y1
  const scenarioEnrollment = scenarioInputs.enrollment
  const aaftePct = assumptions.aafte_pct
  const baseAAFTE = calcAAFTE(baseEnrollment, aaftePct)
  const scenarioAAFTE = calcAAFTE(scenarioEnrollment, aaftePct)

  const baseRev = useMemo(() => calcCommissionRevenue(baseEnrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions), [baseEnrollment, profile, assumptions])
  const scenarioRev = useMemo(() => calcCommissionRevenue(scenarioEnrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions), [scenarioEnrollment, profile, assumptions])

  // Grant allocations for Year 1 — derived from local fundingSources (live edits) not profile.startup_funding (stale until save)
  const grantRows = useMemo(() => {
    const allocations = getGrantAllocationsForYear(fundingSources, 1)
    return allocations.map((a) => ({
      label: a.source,
      group: 'Startup & Other Grants',
      formula: `Year 1 allocation: ${fmt(a.amount)}`,
      calculated: a.amount,
      scenarioCalc: a.amount,
      override: overrides[`grant:${a.source}`] ?? null,
    }))
  }, [fundingSources, overrides])

  const rows: RevenueRow[] = useMemo(() => [
    // State & Local
    {
      label: 'Regular Ed Apportionment',
      group: 'State & Local',
      formula: `${baseAAFTE} AAFTE × $${assumptions.regular_ed_per_pupil.toLocaleString()}`,
      calculated: baseRev.regularEd,
      scenarioCalc: scenarioRev.regularEd,
      override: overrides['Regular Ed Apportionment'] ?? null,
    },
    {
      label: 'SPED Apportionment',
      group: 'State & Local',
      formula: `${baseAAFTE} × ${profile.pct_iep}% IEP × $${assumptions.sped_per_pupil.toLocaleString()}`,
      calculated: baseRev.sped,
      scenarioCalc: scenarioRev.sped,
      override: overrides['SPED Apportionment'] ?? null,
    },
    {
      label: 'Levy Equity',
      group: 'State & Local',
      formula: `${baseAAFTE} AAFTE × $${assumptions.levy_equity_per_student.toLocaleString()}`,
      calculated: baseRev.levyEquity,
      scenarioCalc: scenarioRev.levyEquity,
      override: overrides['Levy Equity'] ?? null,
      helperNote: 'Currently unfunded by legislature. Override if reinstated.',
    },
    {
      label: 'Facilities Revenue',
      group: 'State & Local',
      formula: `${baseAAFTE} × $${assumptions.facilities_per_pupil}`,
      calculated: baseRev.facilitiesRev,
      scenarioCalc: scenarioRev.facilitiesRev,
      override: overrides['Facilities Revenue'] ?? null,
    },
    // Federal
    {
      label: 'Title I',
      group: 'Federal',
      formula: profile.pct_frl > 40
        ? `${baseEnrollment} × ${profile.pct_frl}% FRL × $880`
        : 'FRL must exceed 40% to qualify',
      calculated: baseRev.titleI,
      scenarioCalc: scenarioRev.titleI,
      override: overrides['Title I'] ?? null,
    },
    {
      label: 'IDEA (Special Education)',
      group: 'Federal',
      formula: `${baseEnrollment} × ${profile.pct_iep}% IEP × $2,200`,
      calculated: baseRev.idea,
      scenarioCalc: scenarioRev.idea,
      override: overrides['IDEA'] ?? null,
    },
    // State Categorical
    {
      label: 'LAP (Learning Assistance)',
      group: 'State Categorical',
      formula: `${baseEnrollment} × ${profile.pct_frl}% FRL × $400`,
      calculated: baseRev.lap,
      scenarioCalc: scenarioRev.lap,
      override: overrides['LAP'] ?? null,
    },
    {
      label: 'TBIP (Bilingual)',
      group: 'State Categorical',
      formula: `${baseEnrollment} × ${profile.pct_ell}% ELL × $1,800`,
      calculated: baseRev.tbip,
      scenarioCalc: scenarioRev.tbip,
      override: overrides['TBIP'] ?? null,
    },
    {
      label: 'Highly Capable',
      group: 'State Categorical',
      formula: `${baseEnrollment} × ${profile.pct_hicap}% HiCap × $500`,
      calculated: baseRev.hicap,
      scenarioCalc: scenarioRev.hicap,
      override: overrides['HiCap'] ?? null,
    },
  ], [baseEnrollment, scenarioEnrollment, baseAAFTE, profile, overrides, assumptions, baseRev, scenarioRev])

  // Operating revenue = all recurring state/local + federal + state categorical
  const operatingBase = rows.reduce((sum, r) => sum + (r.override ?? r.calculated), 0)
  const operatingScenario = rows.reduce((sum, r) => sum + (r.override ?? r.scenarioCalc), 0)

  // Grant totals
  const grantBase = grantRows.reduce((sum, r) => sum + (r.override ?? r.calculated), 0)
  const grantScenario = grantRows.reduce((sum, r) => sum + (r.override ?? r.scenarioCalc), 0)

  // Total = operating + grants
  const totalBase = operatingBase + grantBase
  const totalScenario = operatingScenario + grantScenario

  // Group rows for display
  const groups = ['State & Local', 'Federal', 'State Categorical']
  const colSpan = isModified ? 6 : 5

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold text-slate-900 mb-2">Revenue</h1>
      <p className="text-sm text-slate-500 mb-2">Commission-aligned revenue breakdown for Year 1. Override any line by entering a custom amount.</p>
      <div className="text-xs text-slate-400 mb-6">
        Headcount: <strong className="text-slate-600">{baseEnrollment} students</strong> | AAFTE: <strong className="text-slate-600">{baseAAFTE} students ({aaftePct}%)</strong>
        <span className="ml-2 italic">State apportionment uses AAFTE. Federal programs use headcount.</span>
      </div>

      {isModified && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
          Scenario active — enrollment adjusted to <strong>{scenarioEnrollment}</strong> students (AAFTE: {scenarioAAFTE}).
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="sl-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-6 py-3">Revenue Source</th>
              <th className="text-left px-6 py-3">Formula</th>
              <th className="text-right px-6 py-3">Base Case</th>
              {isModified && <th className="text-right px-6 py-3 text-teal-600">Scenario</th>}
              <th className="text-right px-6 py-3">Override</th>
              <th className="text-right px-6 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const groupRows = rows.filter((r) => r.group === group)
              return (
                <React.Fragment key={`group-${group}`}>
                  <tr className="section-header">
                    <td colSpan={colSpan} className="px-6 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {group}
                    </td>
                  </tr>
                  {groupRows.map((row) => (
                    <RevenueRowComponent key={row.label} row={row} isModified={isModified} overrides={overrides} setOverrides={setOverrides} overrideKey={row.label} />
                  ))}
                </React.Fragment>
              )
            })}

            {/* Operating Revenue subtotal */}
            <tr className="border-b border-slate-200 bg-slate-50">
              <td className="px-6 py-3 font-bold text-slate-800" colSpan={2}>Operating Revenue</td>
              <td className="num px-6 py-3 font-bold text-slate-800">{fmt(operatingBase)}</td>
              {isModified && (
                <td className="num px-6 py-3 font-bold text-teal-600">{fmt(operatingScenario)}</td>
              )}
              <td></td>
              <td className="num px-6 py-3 font-bold text-slate-800">
                {fmt(isModified ? operatingScenario : operatingBase)}
              </td>
            </tr>

            {/* Startup & Other Grants section — full management UI */}
            <tr className="section-header">
              <td colSpan={colSpan} className="px-6 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
                Startup &amp; Other Grants
                <span className="ml-2 font-normal normal-case text-[10px]">(one-time — not included in sustainability metrics)</span>
              </td>
            </tr>
            {/* Inline funding source editor */}
            <tr>
              <td colSpan={colSpan} className="p-0">
                <div className="bg-slate-50/50 border-y border-slate-100 px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">Manage funding sources and year-by-year allocations</span>
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white border-b border-slate-200">
                          <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Source</th>
                          <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs w-32">Total Amount</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs w-24">Type</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs w-24">Status</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Year Allocation</th>
                          <th className="px-3 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fundingSources.map((src, idx) => {
                          const selected = src.selectedYears || []
                          const allocs = src.yearAllocations || {}
                          const allocTotal = selected.reduce((s, y) => s + (allocs[y] || 0), 0)
                          const allocMismatch = selected.length > 0 && allocTotal !== src.amount
                          return (
                            <tr key={idx} className="border-b border-slate-100 align-top bg-white">
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
                          <td className="px-3 py-2 font-bold text-slate-800 text-xs">Total</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800 text-xs">{fmt(totalFunding)}</td>
                          <td colSpan={4}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Secured vs Pending badges */}
                  <div className="flex flex-wrap gap-3 mt-3">
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
              </td>
            </tr>

            {/* Year 1 grant allocations from the sources above */}
            {grantRows.length > 0 && (
              <>
                {grantRows.map((row) => (
                  <RevenueRowComponent key={row.label} row={row} isModified={isModified} overrides={overrides} setOverrides={setOverrides} overrideKey={`grant:${row.label}`} />
                ))}
              </>
            )}
            <tr className="border-b border-slate-200 bg-amber-50/50">
              <td className="px-6 py-2.5 font-semibold text-slate-700" colSpan={2}>Startup Grants Subtotal (Year 1)</td>
              <td className="num px-6 py-2.5 font-semibold text-slate-700">{fmt(grantBase)}</td>
              {isModified && (
                <td className="num px-6 py-2.5 font-semibold text-teal-600">{fmt(grantScenario)}</td>
              )}
              <td></td>
              <td className="num px-6 py-2.5 font-semibold text-slate-700">
                {fmt(isModified ? grantScenario : grantBase)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300">
              <td className="px-6 py-3 font-bold text-slate-800" colSpan={2}>
                Total Revenue {grantRows.length > 0 ? '(incl. Grants)' : ''}
              </td>
              <td className="num px-6 py-3 font-bold text-slate-800">{fmt(totalBase)}</td>
              {isModified && (
                <td className="num px-6 py-3 font-bold text-teal-600">{fmt(totalScenario)}</td>
              )}
              <td></td>
              <td className="num px-6 py-3 font-bold text-slate-800">
                {fmt(isModified ? totalScenario : totalBase)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {grantRows.length > 0 && (
        <div className="mt-3 text-xs text-slate-400 italic">
          Sustainability metrics (Personnel % of Revenue, Facility % of Revenue, Break-Even) use Operating Revenue as the denominator, excluding one-time grants.
        </div>
      )}
    </div>
  )
}

function RevenueRowComponent({ row, isModified, overrides, setOverrides, overrideKey }: {
  row: RevenueRow
  isModified: boolean
  overrides: Record<string, number>
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>
  overrideKey: string
}) {
  const effective = row.override ?? (isModified ? row.scenarioCalc : row.calculated)
  return (
    <tr className="border-b border-slate-100">
      <td className="px-6 py-3">
        <span className="font-medium text-slate-800">{row.label}</span>
        {row.helperNote && (
          <span className="block text-[10px] text-slate-400 mt-0.5">{row.helperNote}</span>
        )}
      </td>
      <td className="px-6 py-3 text-slate-500 text-xs">{row.formula}</td>
      <td className="num px-6 py-3 text-slate-500">{fmt(row.calculated)}</td>
      {isModified && (
        <td className={`num px-6 py-3 ${row.scenarioCalc !== row.calculated ? 'text-teal-600 font-medium' : 'text-slate-500'}`}>
          {fmt(row.scenarioCalc)}
        </td>
      )}
      <td className="px-6 py-3 text-right">
        <input
          type="number"
          placeholder="—"
          value={row.override ?? ''}
          onChange={(e) => {
            const v = e.target.value
            setOverrides((prev) => {
              const next = { ...prev }
              if (v === '') { delete next[overrideKey] } else { next[overrideKey] = Number(v) }
              return next
            })
          }}
          className="w-28 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </td>
      <td className={`num px-6 py-3 font-medium ${row.override !== null ? 'text-teal-600' : 'text-slate-800'}`}>
        {fmt(effective)}
      </td>
    </tr>
  )
}
