'use client'

import { useState, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { calcCommissionRevenue, calcAAFTE } from '@/lib/calculations'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface RevenueRow {
  label: string
  group: string
  formula: string
  calculated: number
  scenarioCalc: number
  override: number | null
}

export default function RevenuePage() {
  const {
    schoolData: { profile, loading },
    assumptions,
    isModified,
    scenarioInputs,
  } = useScenario()
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const baseEnrollment = profile.target_enrollment_y1
  const scenarioEnrollment = scenarioInputs.enrollment
  const aaftePct = assumptions.aafte_pct
  const baseAAFTE = calcAAFTE(baseEnrollment, aaftePct)
  const scenarioAAFTE = calcAAFTE(scenarioEnrollment, aaftePct)

  const baseRev = useMemo(() => calcCommissionRevenue(baseEnrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions), [baseEnrollment, profile, assumptions])
  const scenarioRev = useMemo(() => calcCommissionRevenue(scenarioEnrollment, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions), [scenarioEnrollment, profile, assumptions])

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

  const totalBase = rows.reduce((sum, r) => sum + (r.override ?? r.calculated), 0)
  const totalScenario = rows.reduce((sum, r) => sum + (r.override ?? r.scenarioCalc), 0)

  // Group rows for display
  const groups = ['State & Local', 'Federal', 'State Categorical']

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Revenue</h1>
      <p className="text-sm text-slate-500 mb-2">Commission-aligned revenue breakdown for Year 1. Override any line by entering a custom amount.</p>
      <div className="text-xs text-slate-400 mb-6">
        Headcount: <strong className="text-slate-600">{baseEnrollment} students</strong> | AAFTE: <strong className="text-slate-600">{baseAAFTE} students ({aaftePct}%)</strong>
        <span className="ml-2 italic">State apportionment uses AAFTE. Federal programs use headcount.</span>
      </div>

      {isModified && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Scenario active — enrollment adjusted to <strong>{scenarioEnrollment}</strong> students (AAFTE: {scenarioAAFTE}).
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Revenue Source</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Formula</th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Base Case</th>
              {isModified && <th className="text-right px-6 py-3 font-semibold text-blue-600">Scenario</th>}
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Override</th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const groupRows = rows.filter((r) => r.group === group)
              const groupTotal = groupRows.reduce((s, r) => s + (r.override ?? r.calculated), 0)
              return (
                <>{/* group header */}
                  <tr key={`header-${group}`} className="bg-slate-50">
                    <td colSpan={isModified ? 6 : 5} className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {group}
                    </td>
                  </tr>
                  {groupRows.map((row) => {
                    const effective = row.override ?? (isModified ? row.scenarioCalc : row.calculated)
                    return (
                      <tr key={row.label} className="border-b border-slate-100">
                        <td className="px-6 py-3 font-medium text-slate-800">{row.label}</td>
                        <td className="px-6 py-3 text-slate-500 text-xs">{row.formula}</td>
                        <td className="px-6 py-3 text-right text-slate-500">{fmt(row.calculated)}</td>
                        {isModified && (
                          <td className={`px-6 py-3 text-right ${row.scenarioCalc !== row.calculated ? 'text-blue-600 font-medium' : 'text-slate-500'}`}>
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
                                if (v === '') { delete next[row.label] } else { next[row.label] = Number(v) }
                                return next
                              })
                            }}
                            className="w-28 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className={`px-6 py-3 text-right font-medium ${row.override !== null ? 'text-blue-600' : 'text-slate-800'}`}>
                          {fmt(effective)}
                        </td>
                      </tr>
                    )
                  })}
                </>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-6 py-3 font-bold text-slate-800" colSpan={2}>Total Revenue</td>
              <td className="px-6 py-3 text-right font-bold text-slate-800">{fmt(totalBase)}</td>
              {isModified && (
                <td className="px-6 py-3 text-right font-bold text-blue-600">{fmt(totalScenario)}</td>
              )}
              <td></td>
              <td className="px-6 py-3 text-right font-bold text-slate-800">
                {fmt(isModified ? totalScenario : totalBase)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
