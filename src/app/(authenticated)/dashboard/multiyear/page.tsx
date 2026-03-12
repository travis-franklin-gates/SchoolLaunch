'use client'

import { useState, useMemo } from 'react'
import { useSchoolData } from '@/lib/useSchoolData'
import {
  computeSummaryFromProjections,
} from '@/lib/budgetEngine'
import {
  calcRevenue,
  calcLevyEquity,
  calcAllGrants,
  PER_PUPIL_RATE,
  LEVY_EQUITY_RATE,
} from '@/lib/calculations'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface YearRow {
  year: string
  enrollment: number | null
  revenue: number
  personnel: number
  operations: number
  net: number
  reserveDays: number
}

export default function MultiYearPage() {
  const { profile, positions, projections, loading } = useSchoolData()

  // Year 0 pre-opening costs
  const [preOpening, setPreOpening] = useState({
    leaseDeposit: 15000,
    furniture: 25000,
    techSetup: 20000,
    preOpenStaff: 30000,
  })

  const year1Summary = useMemo(
    () => computeSummaryFromProjections(projections, positions),
    [projections, positions]
  )

  const enrollments = [
    profile.target_enrollment_y1,
    profile.target_enrollment_y2,
    profile.target_enrollment_y3,
    profile.target_enrollment_y4,
  ]

  const yearRows: YearRow[] = useMemo(() => {
    const rows: YearRow[] = []

    // Year 0
    const preOpenTotal = preOpening.leaseDeposit + preOpening.furniture + preOpening.techSetup + preOpening.preOpenStaff
    rows.push({
      year: 'Year 0 (Pre-Opening)',
      enrollment: null,
      revenue: 0,
      personnel: preOpening.preOpenStaff,
      operations: preOpening.leaseDeposit + preOpening.furniture + preOpening.techSetup,
      net: -preOpenTotal,
      reserveDays: 0,
    })

    // Year 1
    rows.push({
      year: 'Year 1',
      enrollment: enrollments[0],
      revenue: year1Summary.totalRevenue,
      personnel: year1Summary.totalPersonnel,
      operations: year1Summary.totalOperations,
      net: year1Summary.netPosition,
      reserveDays: year1Summary.reserveDays,
    })

    // Years 2-4: simplified projection
    const SALARY_ESCALATOR = 1.025
    const OPS_ESCALATOR = 1.02

    for (let y = 2; y <= 4; y++) {
      const enr = enrollments[y - 1] || enrollments[0]
      const apportionment = calcRevenue(enr)
      const levyEquity = calcLevyEquity(enr)
      const grants = calcAllGrants(enr, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap)
      const revenue = apportionment + levyEquity + grants.titleI + grants.idea + grants.lap + grants.tbip + grants.hicap

      const personnel = Math.round(year1Summary.totalPersonnel * Math.pow(SALARY_ESCALATOR, y - 1))
      const operations = Math.round(year1Summary.totalOperations * Math.pow(OPS_ESCALATOR, y - 1))
      const totalExpenses = personnel + operations
      const net = revenue - totalExpenses
      const dailyExpense = totalExpenses / 365
      const reserveDays = dailyExpense > 0 ? Math.round(net / dailyExpense) : 0

      rows.push({
        year: `Year ${y}`,
        enrollment: enr,
        revenue,
        personnel,
        operations,
        net,
        reserveDays,
      })
    }

    return rows
  }, [year1Summary, enrollments, profile, preOpening])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Multi-Year Projection</h1>
      <p className="text-sm text-slate-500 mb-6">
        Years 2-4 use enrollment growth assumptions from onboarding, 2.5% annual salary escalator, and 2% operations escalator.
      </p>

      {/* Pre-opening cost inputs */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Year 0 Pre-Opening Costs</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: 'leaseDeposit' as const, label: 'Lease Deposits' },
            { key: 'furniture' as const, label: 'Furniture & Equipment' },
            { key: 'techSetup' as const, label: 'Technology Setup' },
            { key: 'preOpenStaff' as const, label: 'Pre-Opening Staff' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
              <input
                type="number"
                step={1000}
                value={preOpening[key]}
                onChange={(e) => setPreOpening((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Multi-year table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Year</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Enrollment</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Revenue</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Personnel</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Operations</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Net</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Reserve Days</th>
            </tr>
          </thead>
          <tbody>
            {yearRows.map((row) => (
              <tr key={row.year} className="border-b border-slate-100">
                <td className="px-5 py-3 font-medium text-slate-800">{row.year}</td>
                <td className="px-5 py-3 text-right text-slate-600">
                  {row.enrollment !== null ? row.enrollment : '—'}
                </td>
                <td className="px-5 py-3 text-right text-slate-600">{row.revenue > 0 ? fmt(row.revenue) : '—'}</td>
                <td className="px-5 py-3 text-right text-slate-600">{fmt(row.personnel)}</td>
                <td className="px-5 py-3 text-right text-slate-600">{fmt(row.operations)}</td>
                <td className={`px-5 py-3 text-right font-medium ${row.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(row.net)}
                </td>
                <td className="px-5 py-3 text-right">
                  {row.year.includes('Year 0') ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className={`font-medium ${
                      row.reserveDays >= 60 ? 'text-emerald-600' :
                      row.reserveDays >= 30 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {row.reserveDays}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
