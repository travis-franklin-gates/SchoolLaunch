'use client'

import { useState, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeMultiYearDetailed } from '@/lib/budgetEngine'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function MultiYearPage() {
  const {
    schoolData: { profile, positions, projections, loading },
    assumptions,
  } = useScenario()

  const [preOpening, setPreOpening] = useState({
    leaseDeposit: 15000,
    furniture: 25000,
    techSetup: 20000,
    preOpenStaff: 30000,
  })

  const preOpenTotal = preOpening.leaseDeposit + preOpening.furniture + preOpening.techSetup + preOpening.preOpenStaff

  const years = useMemo(
    () => computeMultiYearDetailed(profile, positions, projections, assumptions, -preOpenTotal),
    [profile, positions, projections, assumptions, preOpenTotal]
  )

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  const yrs = [1, 2, 3, 4]

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Multi-Year Projection</h1>
      <p className="text-sm text-slate-500 mb-6">
        Years 2-4 add teaching positions as enrollment grows, {assumptions.salary_escalator_pct}% annual salary escalator, and {assumptions.ops_escalator_pct}% operations escalator.
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
        <div className="mt-3 text-sm text-slate-600">
          Total Pre-Opening: <span className="font-semibold text-red-600">{fmt(-preOpenTotal)}</span>
        </div>
      </div>

      {/* Main multi-year table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-3 font-semibold text-slate-600 min-w-[200px]"></th>
              {yrs.map((y) => (
                <th key={y} className="text-right px-5 py-3 font-semibold text-slate-600 min-w-[130px]">
                  Year {y}
                  <div className="text-[10px] font-normal text-slate-400">
                    {years[y - 1]?.enrollment || 0} students
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Revenue Section */}
            <SectionHeader label="Revenue" cols={4} />
            <Row label="State Apportionment" values={years.map((y) => y.revenue.apportionment)} />
            <Row label="Levy Equity" values={years.map((y) => y.revenue.levyEquity)} />
            <Row label="Title I" values={years.map((y) => y.revenue.titleI)} />
            <Row label="IDEA" values={years.map((y) => y.revenue.idea)} />
            <Row label="LAP" values={years.map((y) => y.revenue.lap)} />
            <Row label="TBIP" values={years.map((y) => y.revenue.tbip)} />
            <Row label="HiCap" values={years.map((y) => y.revenue.hicap)} />
            <TotalRow label="Total Revenue" values={years.map((y) => y.revenue.total)} />

            {/* Personnel Section */}
            <SectionHeader label="Personnel" cols={4} />
            <Row label="Certificated Staff" values={years.map((y) => y.personnel.certificated)} />
            <Row label="Classified Staff" values={years.map((y) => y.personnel.classified)} />
            <Row label="Admin Staff" values={years.map((y) => y.personnel.admin)} />
            <Row label={`Benefits (${assumptions.benefits_load_pct}%)`} values={years.map((y) => y.personnel.benefits)} />
            <TotalRow label="Total Personnel" values={years.map((y) => y.personnel.total)} />

            {/* Staffing summary */}
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <td className="px-5 py-2 text-xs text-slate-500 italic">Staff Count</td>
              {years.map((y) => (
                <td key={y.year} className="px-5 py-2 text-right text-xs text-slate-500 italic">
                  {y.staffing.totalPositions} ({y.staffing.teachers}T, {y.staffing.paras}P, {y.staffing.officeStaff}O)
                </td>
              ))}
            </tr>

            {/* Operations Section */}
            <SectionHeader label="Operations" cols={4} />
            <Row label="Facilities" values={years.map((y) => y.operations.facilities)} />
            <Row label="Supplies & Materials" values={years.map((y) => y.operations.supplies)} />
            <Row label="Contracted Services" values={years.map((y) => y.operations.contracted)} />
            <Row label="Technology" values={years.map((y) => y.operations.technology)} />
            <Row label="Authorizer Fee" values={years.map((y) => y.operations.authorizerFee)} />
            <Row label="Insurance" values={years.map((y) => y.operations.insurance)} />
            <Row label="Misc/Contingency" values={years.map((y) => y.operations.contingency)} />
            <TotalRow label="Total Operations" values={years.map((y) => y.operations.total)} />

            {/* Summary Section */}
            <SectionHeader label="Summary" cols={4} />
            <TotalRow label="Total Revenue" values={years.map((y) => y.revenue.total)} />
            <TotalRow label="Total Expenses" values={years.map((y) => y.totalExpenses)} />
            <tr className="border-b border-slate-200">
              <td className="px-5 py-3 font-bold text-slate-800">Net Position</td>
              {years.map((y) => (
                <td key={y.year} className={`px-5 py-3 text-right font-bold ${y.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(y.net)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-5 py-3 font-medium text-slate-700">Cumulative Net</td>
              {years.map((y) => (
                <td key={y.year} className={`px-5 py-3 text-right font-medium ${y.cumulativeNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(y.cumulativeNet)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-3 font-bold text-slate-800">Reserve Days</td>
              {years.map((y) => (
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
    <tr className="bg-slate-100 border-b border-slate-200">
      <td className="px-5 py-2 font-semibold text-xs text-slate-600 uppercase tracking-wide" colSpan={cols + 1}>
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
        <td key={i} className="px-5 py-2.5 text-right text-slate-600">{fmt(v)}</td>
      ))}
    </tr>
  )
}

function TotalRow({ label, values }: { label: string; values: number[] }) {
  return (
    <tr className="border-b border-slate-200 bg-slate-50">
      <td className="px-5 py-3 font-bold text-slate-800">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-5 py-3 text-right font-bold text-slate-800">{fmt(v)}</td>
      ))}
    </tr>
  )
}
