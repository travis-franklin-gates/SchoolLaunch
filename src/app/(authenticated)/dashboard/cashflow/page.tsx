'use client'

import { useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeCashFlow } from '@/lib/budgetEngine'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function CashFlowPage() {
  const {
    schoolData: { loading },
    baseSummary,
    currentSummary,
    baseApportionment,
    scenarioApportionment,
    isModified,
  } = useScenario()

  const baseCashFlow = useMemo(
    () => computeCashFlow(baseSummary, baseApportionment),
    [baseSummary, baseApportionment]
  )

  const scenarioCashFlow = useMemo(
    () => computeCashFlow(currentSummary, isModified ? scenarioApportionment : baseApportionment),
    [currentSummary, isModified, scenarioApportionment, baseApportionment]
  )

  const cashFlow = isModified ? scenarioCashFlow : baseCashFlow

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Cash Flow</h1>
      <p className="text-sm text-slate-500 mb-6">
        Month-by-month Year 1 projection (September through August) using the OSPI apportionment payment schedule.
        Starting cash balance: $0.
      </p>

      {isModified && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Scenario active — cash flow reflects adjusted enrollment, salary, and lease inputs.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Month</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Apport. %</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Apport. $</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Other Revenue</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Inflow</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Payroll</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Other Expenses</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Net Cash Flow</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Cumulative Balance</th>
            </tr>
          </thead>
          <tbody>
            {cashFlow.map((m) => (
              <tr key={m.month} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{m.month}</td>
                <td className="px-4 py-3 text-right text-slate-500">{(m.apportionmentPct * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmt(m.apportionmentAmt)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmt(m.otherRevenue)}</td>
                <td className="px-4 py-3 text-right text-slate-800 font-medium">{fmt(m.totalInflow)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmt(m.payroll)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmt(m.otherExpenses)}</td>
                <td className={`px-4 py-3 text-right font-medium ${m.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(m.netCashFlow)}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${m.cumulativeBalance >= 0 ? 'text-slate-800' : 'text-red-600 bg-red-50'}`}>
                  {fmt(m.cumulativeBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cashFlow.some((m) => m.cumulativeBalance < 0) && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <strong>Warning:</strong> Cumulative cash balance goes negative in one or more months.
          This may require a line of credit or pre-opening fundraising to cover shortfalls.
        </div>
      )}
    </div>
  )
}
