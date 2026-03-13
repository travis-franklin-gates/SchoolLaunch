'use client'

import { useState, useMemo } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeCashFlow } from '@/lib/budgetEngine'
import type { StartupFundingSource } from '@/lib/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const PRE_OPEN_MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

// Distribute pre-opening costs across 6 months
function computeYear0CashFlow(
  leaseDeposit: number,
  furniture: number,
  techSetup: number,
  preOpenStaff: number,
  funding: number,
) {
  // Mar-Apr: lease deposits + initial staff
  // May-Jun: furniture + tech
  // Jul-Aug: remaining staff + final setup
  const monthly = [
    { month: 'Mar', spending: Math.round(leaseDeposit * 0.5 + preOpenStaff * 0.15) },
    { month: 'Apr', spending: Math.round(leaseDeposit * 0.5 + preOpenStaff * 0.15) },
    { month: 'May', spending: Math.round(furniture * 0.5 + techSetup * 0.5) },
    { month: 'Jun', spending: Math.round(furniture * 0.5 + techSetup * 0.5) },
    { month: 'Jul', spending: Math.round(preOpenStaff * 0.35) },
    { month: 'Aug', spending: Math.round(preOpenStaff * 0.35) },
  ]

  let cumulative = 0
  return monthly.map((m) => {
    cumulative += m.spending
    return {
      month: m.month,
      spending: m.spending,
      cumulativeSpent: cumulative,
      balance: funding - cumulative,
    }
  })
}

export default function CashFlowPage() {
  const {
    schoolData: { profile, loading },
    baseSummary,
    currentSummary,
    baseApportionment,
    scenarioApportionment,
    isModified,
  } = useScenario()

  const [view, setView] = useState<'year0' | 'year1'>('year1')
  const [preOpening, setPreOpening] = useState({
    leaseDeposit: 15000,
    furniture: 25000,
    techSetup: 20000,
    preOpenStaff: 30000,
  })

  // Use startup funding from profile if available
  const fundingSources: StartupFundingSource[] = profile.startup_funding && profile.startup_funding.length > 0
    ? profile.startup_funding
    : [{ source: 'Pre-Opening Funding', amount: 250000, type: 'grant' as const, status: 'projected' as const }]

  const totalFunding = fundingSources.reduce((s, f) => s + f.amount, 0)
  const securedFunding = fundingSources
    .filter((f) => f.status === 'received' || f.status === 'pledged')
    .reduce((s, f) => s + f.amount, 0)

  const year0Flow = useMemo(
    () => computeYear0CashFlow(preOpening.leaseDeposit, preOpening.furniture, preOpening.techSetup, preOpening.preOpenStaff, totalFunding),
    [preOpening, totalFunding]
  )

  const year0EndingBalance = year0Flow.length > 0 ? year0Flow[year0Flow.length - 1].balance : 0

  const baseCashFlow = useMemo(
    () => computeCashFlow(baseSummary, baseApportionment, year0EndingBalance),
    [baseSummary, baseApportionment, year0EndingBalance]
  )

  const scenarioCashFlow = useMemo(
    () => computeCashFlow(currentSummary, isModified ? scenarioApportionment : baseApportionment, year0EndingBalance),
    [currentSummary, isModified, scenarioApportionment, baseApportionment, year0EndingBalance]
  )

  const cashFlow = isModified ? scenarioCashFlow : baseCashFlow

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Cash Flow</h1>
      <p className="text-sm text-slate-500 mb-4">
        Month-by-month projections using the OSPI apportionment payment schedule.
      </p>

      {/* View toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setView('year0')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'year0' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Year 0 (Pre-Opening)
        </button>
        <button
          onClick={() => setView('year1')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'year1' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Year 1 (First Operating Year)
        </button>
      </div>

      {isModified && view === 'year1' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          Scenario active — cash flow reflects adjusted enrollment, salary, and lease inputs.
        </div>
      )}

      {view === 'year0' ? (
        <>
          {/* Startup Funding Sources summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Startup Funding Inflows</h2>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Source</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-600 w-28">Amount</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 w-24">Type</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {fundingSources.map((src, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{src.source || 'Unnamed'}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{fmt(src.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        src.type === 'grant' ? 'bg-blue-100 text-blue-700' :
                        src.type === 'donation' ? 'bg-purple-100 text-purple-700' :
                        src.type === 'debt' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {src.type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        src.status === 'received' ? 'bg-emerald-100 text-emerald-700' :
                        src.status === 'pledged' ? 'bg-blue-100 text-blue-700' :
                        src.status === 'applied' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {src.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-3 py-2 font-bold text-slate-800">Total Available</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{fmt(totalFunding)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>

            <div className="flex flex-wrap gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-emerald-600 font-semibold">Secured:</span>
                <span className="text-emerald-700 font-bold ml-1">{fmt(securedFunding)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-amber-600 font-semibold">At Risk:</span>
                <span className="text-amber-700 font-bold ml-1">{fmt(totalFunding - securedFunding)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Manage funding sources on the Multi-Year tab. Only &quot;received&quot; and &quot;pledged&quot; funds count as secured.
            </p>
          </div>

          {/* Pre-opening cost inputs */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Pre-Opening Spending</h2>
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
                    type="number" step={1000} value={preOpening[key]}
                    onChange={(e) => setPreOpening((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Year 0 cash flow table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Month</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Startup Spending</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Cumulative Spent</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {year0Flow.map((m) => (
                  <tr key={m.month} className={`border-b border-slate-100 ${m.balance < 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{m.month}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(m.spending)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(m.cumulativeSpent)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {fmt(m.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
            Year 0 ending balance of <strong>{fmt(year0EndingBalance)}</strong> carries forward as Year 1 starting cash.
          </div>

          {year0Flow.some((m) => m.balance < 0) && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <strong>Warning:</strong> Pre-opening funding is insufficient. You need additional startup capital to cover shortfalls.
            </div>
          )}

          {securedFunding < totalFunding * 0.5 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              <strong>Funding Risk:</strong> Less than 50% of startup funding is secured.
              Cash flow projections may be optimistic if pending funding does not materialize.
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
            Starting cash balance: <strong>{fmt(year0EndingBalance)}</strong> (carried from Year 0 pre-opening)
          </div>

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
        </>
      )}
    </div>
  )
}
