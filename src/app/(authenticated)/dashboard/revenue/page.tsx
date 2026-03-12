'use client'

import { useState, useMemo } from 'react'
import { useSchoolData } from '@/lib/useSchoolData'
import {
  calcRevenue,
  calcLevyEquity,
  calcTitleI,
  calcIDEA,
  calcLAP,
  calcTBIP,
  calcHiCap,
  PER_PUPIL_RATE,
  LEVY_EQUITY_RATE,
} from '@/lib/calculations'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface RevenueRow {
  label: string
  formula: string
  calculated: number
  override: number | null
}

export default function RevenuePage() {
  const { profile, projections, loading } = useSchoolData()
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const enrollment = profile.target_enrollment_y1

  const rows: RevenueRow[] = useMemo(() => [
    {
      label: 'State Apportionment',
      formula: `${enrollment} students x $${PER_PUPIL_RATE.toLocaleString()}/student`,
      calculated: calcRevenue(enrollment),
      override: overrides['State Apportionment'] ?? null,
    },
    {
      label: 'Levy Equity',
      formula: `${enrollment} students x $${LEVY_EQUITY_RATE.toLocaleString()}/student`,
      calculated: calcLevyEquity(enrollment),
      override: overrides['Levy Equity'] ?? null,
    },
    {
      label: 'Title I',
      formula: profile.pct_frl > 40
        ? `${enrollment} x ${profile.pct_frl}% FRL x $880`
        : 'FRL must exceed 40% to qualify',
      calculated: calcTitleI(enrollment, profile.pct_frl),
      override: overrides['Title I'] ?? null,
    },
    {
      label: 'IDEA (Special Education)',
      formula: `${enrollment} x ${profile.pct_iep}% IEP x $2,200`,
      calculated: calcIDEA(enrollment, profile.pct_iep),
      override: overrides['IDEA'] ?? null,
    },
    {
      label: 'LAP (Learning Assistance)',
      formula: `${enrollment} x ${profile.pct_frl}% FRL x $400`,
      calculated: calcLAP(enrollment, profile.pct_frl),
      override: overrides['LAP'] ?? null,
    },
    {
      label: 'TBIP (Bilingual)',
      formula: `${enrollment} x ${profile.pct_ell}% ELL x $1,800`,
      calculated: calcTBIP(enrollment, profile.pct_ell),
      override: overrides['TBIP'] ?? null,
    },
    {
      label: 'Highly Capable',
      formula: `${enrollment} x ${profile.pct_hicap}% HiCap x $500`,
      calculated: calcHiCap(enrollment, profile.pct_hicap),
      override: overrides['HiCap'] ?? null,
    },
  ], [enrollment, profile, overrides])

  const totalRevenue = rows.reduce((sum, r) => sum + (r.override ?? r.calculated), 0)

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Revenue</h1>
      <p className="text-sm text-slate-500 mb-6">Detailed revenue breakdown for Year 1. Override any line by entering a custom amount.</p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Revenue Source</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Formula</th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Calculated</th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Override</th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate-100">
                <td className="px-6 py-3 font-medium text-slate-800">{row.label}</td>
                <td className="px-6 py-3 text-slate-500 text-xs">{row.formula}</td>
                <td className="px-6 py-3 text-right text-slate-500">{fmt(row.calculated)}</td>
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
                  {fmt(row.override ?? row.calculated)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-6 py-3 font-bold text-slate-800" colSpan={4}>Total Revenue</td>
              <td className="px-6 py-3 text-right font-bold text-slate-800">{fmt(totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
