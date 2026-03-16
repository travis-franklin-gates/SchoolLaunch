'use client'

import { useState, useMemo, useCallback } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { computeCashFlow } from '@/lib/budgetEngine'
import { createClient } from '@/lib/supabase/client'
import type { StartupFundingSource, PreOpeningExpense } from '@/lib/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

let _id = 0
function uid() { return `poe-${++_id}-${Date.now()}` }

const PRE_OPEN_MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

const DEFAULT_EXPENSES: PreOpeningExpense[] = [
  { id: uid(), name: 'Founder/CEO Compensation', budgeted: 0, actual: 0 },
]

// Distribute total pre-opening budget evenly across 6 months
function computeYear0CashFlow(totalBudgeted: number, totalActual: number, funding: number) {
  const monthlyBudget = Math.round(totalBudgeted / PRE_OPEN_MONTHS.length)
  const monthlyActual = Math.round(totalActual / PRE_OPEN_MONTHS.length)

  let cumBudget = 0
  let cumActual = 0
  return PRE_OPEN_MONTHS.map((month) => {
    cumBudget += monthlyBudget
    cumActual += monthlyActual
    return {
      month,
      budgeted: monthlyBudget,
      actual: monthlyActual,
      cumulativeBudgeted: cumBudget,
      cumulativeActual: cumActual,
      balanceBudgeted: funding - cumBudget,
      balanceActual: funding - cumActual,
    }
  })
}

export default function CashFlowPage() {
  const {
    schoolData: { schoolId, profile, loading, reload },
    baseSummary,
    currentSummary,
    baseApportionment,
    scenarioApportionment,
    isModified,
  } = useScenario()

  const supabase = createClient()
  const [view, setView] = useState<'year0' | 'year1'>('year1')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Load expenses from profile or use defaults
  const [expenses, setExpenses] = useState<PreOpeningExpense[]>(() => {
    if (profile.pre_opening_expenses && profile.pre_opening_expenses.length > 0) {
      return profile.pre_opening_expenses
    }
    return DEFAULT_EXPENSES.map((e) => ({ ...e, id: uid() }))
  })

  // Funding
  const fundingSources: StartupFundingSource[] = profile.startup_funding && profile.startup_funding.length > 0
    ? profile.startup_funding
    : [{ source: 'Pre-Opening Funding', amount: 250000, type: 'grant' as const, status: 'projected' as const }]

  const totalFunding = fundingSources.reduce((s, f) => s + f.amount, 0)
  const securedFunding = fundingSources
    .filter((f) => f.status === 'received' || f.status === 'pledged')
    .reduce((s, f) => s + f.amount, 0)

  // Year 0 allocation from startup funding
  const year0Funding = useMemo(() => {
    let y0 = 0
    for (const src of fundingSources) {
      if (src.selectedYears?.includes(0) && src.yearAllocations?.[0]) {
        y0 += src.yearAllocations[0]
      } else if (!src.selectedYears || src.selectedYears.length === 0) {
        y0 += src.amount
      }
    }
    return y0 || totalFunding
  }, [fundingSources, totalFunding])

  // Totals
  const totalBudgeted = expenses.reduce((s, e) => s + e.budgeted, 0)
  const totalActual = expenses.reduce((s, e) => s + e.actual, 0)
  const totalRemaining = totalBudgeted - totalActual
  const pctFundingUsed = year0Funding > 0 ? (totalBudgeted / year0Funding * 100) : 0

  const year0Flow = useMemo(
    () => computeYear0CashFlow(totalBudgeted, totalActual, year0Funding),
    [totalBudgeted, totalActual, year0Funding]
  )

  const year0EndingBalance = year0Flow.length > 0 ? year0Flow[year0Flow.length - 1].balanceBudgeted : 0

  const baseCashFlow = useMemo(
    () => computeCashFlow(baseSummary, baseApportionment, year0EndingBalance),
    [baseSummary, baseApportionment, year0EndingBalance]
  )

  const scenarioCashFlow = useMemo(
    () => computeCashFlow(currentSummary, isModified ? scenarioApportionment : baseApportionment, year0EndingBalance),
    [currentSummary, isModified, scenarioApportionment, baseApportionment, year0EndingBalance]
  )

  const cashFlow = isModified ? scenarioCashFlow : baseCashFlow

  // Expense CRUD
  function updateExpense(id: string, field: keyof PreOpeningExpense, value: string | number) {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e))
  }

  function addExpense() {
    setExpenses((prev) => [...prev, { id: uid(), name: '', budgeted: 0, actual: 0 }])
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  const saveExpenses = useCallback(async () => {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

    const { error } = await supabase
      .from('school_profiles')
      .update({ pre_opening_expenses: expenses })
      .eq('school_id', schoolId)

    if (error) {
      setToast({ type: 'error', message: `Failed to save: ${error.message}` })
    } else {
      setToast({ type: 'success', message: 'Pre-opening expenses saved.' })
      await reload()
      setTimeout(() => setToast(null), 3000)
    }
    setSaving(false)
  }, [schoolId, expenses, supabase, reload])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  return (
    <div className="animate-fade-in">
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium animate-slide-in-right ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.message}
        </div>
      )}

      <h1 className="text-[28px] font-semibold text-slate-900 mb-2">Cash Flow</h1>
      <p className="text-sm text-slate-500 mb-4">
        Month-by-month projections using the OSPI apportionment payment schedule.
      </p>

      {/* View toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setView('year0')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === 'year0' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Year 0 (Pre-Opening)
        </button>
        <button
          onClick={() => setView('year1')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            view === 'year1' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Year 1 (First Operating Year)
        </button>
      </div>

      {isModified && view === 'year1' && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
          Scenario active — cash flow reflects adjusted enrollment, salary, and lease inputs.
        </div>
      )}

      {view === 'year0' ? (
        <>
          {/* Startup Funding Sources summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Startup Funding Inflows</h2>
            <div className="overflow-x-auto sl-scroll">
            <table className="w-full text-sm sl-table mb-4">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Source</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-28">Amount</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-24">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {fundingSources.map((src, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{src.source || 'Unnamed'}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800 num">{fmt(src.amount)}</td>
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
                  <td className="px-3 py-2 text-right font-bold text-slate-800 num">{fmt(year0Funding)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
            </div>

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
              Manage funding sources on the Revenue tab. Only &quot;received&quot; and &quot;pledged&quot; funds count as secured.
            </p>
          </div>

          {/* Pre-Opening Expenses — custom rows with budget vs actual */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Pre-Opening Expenses</h2>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Total Budgeted</p>
                <p className="text-sm font-bold text-slate-800">{fmt(totalBudgeted)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Total Spent</p>
                <p className="text-sm font-bold text-slate-800">{fmt(totalActual)}</p>
              </div>
              <div className={`border rounded-lg px-3 py-2 ${totalRemaining >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] text-slate-400 uppercase font-medium">Remaining</p>
                <p className={`text-sm font-bold ${totalRemaining >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(totalRemaining)}</p>
              </div>
              <div className={`border rounded-lg px-3 py-2 ${pctFundingUsed <= 100 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] text-slate-400 uppercase font-medium">% of Startup Funding</p>
                <p className={`text-sm font-bold ${pctFundingUsed <= 100 ? 'text-blue-700' : 'text-red-700'}`}>{pctFundingUsed.toFixed(1)}%</p>
              </div>
            </div>

            {/* Expense table */}
            <div className="overflow-x-auto sl-scroll">
            <table className="w-full text-sm sl-table mb-3">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Expense Name</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-32">Budgeted</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-32">Actual</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide w-28">Variance</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const variance = exp.budgeted - exp.actual
                  return (
                    <tr key={exp.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={exp.name}
                          onChange={(e) => updateExpense(exp.id, 'name', e.target.value)}
                          placeholder="Expense name..."
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step={500}
                          min={0}
                          value={exp.budgeted}
                          onChange={(e) => updateExpense(exp.id, 'budgeted', Number(e.target.value))}
                          className="w-full text-right border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step={100}
                          min={0}
                          value={exp.actual}
                          onChange={(e) => updateExpense(exp.id, 'actual', Number(e.target.value))}
                          className="w-full text-right border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className={`px-3 py-2 text-right font-medium num ${
                        variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {variance !== 0 && (variance > 0 ? '+' : '')}{fmt(variance)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeExpense(exp.id)}
                          className="text-red-400 hover:text-red-600 text-lg leading-none"
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
                  <td className="px-3 py-2 font-bold text-slate-800">Total Pre-Opening Expenses</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800 num">{fmt(totalBudgeted)}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800 num">{fmt(totalActual)}</td>
                  <td className={`px-3 py-2 text-right font-bold num ${
                    totalRemaining > 0 ? 'text-emerald-600' : totalRemaining < 0 ? 'text-red-600' : 'text-slate-400'
                  }`}>
                    {totalRemaining !== 0 && (totalRemaining > 0 ? '+' : '')}{fmt(totalRemaining)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={addExpense}
                className="text-sm text-teal-600 hover:text-teal-800 font-medium"
              >
                + Add Expense
              </button>
              <button
                onClick={saveExpenses}
                disabled={saving}
                className="px-4 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Year 0 monthly cash flow table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto sl-scroll shadow-sm">
            <table className="w-full text-sm whitespace-nowrap sl-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Budgeted</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Actual</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Cumulative Budget</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Cumulative Actual</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Balance (Budget)</th>
                </tr>
              </thead>
              <tbody>
                {year0Flow.map((m) => (
                  <tr key={m.month} className={`border-b border-slate-100 ${m.balanceBudgeted < 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{m.month}</td>
                    <td className="px-4 py-3 text-right text-slate-600 num">{fmt(m.budgeted)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 num">{fmt(m.actual)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 num">{fmt(m.cumulativeBudgeted)}</td>
                    <td className={`px-4 py-3 text-right num ${
                      m.cumulativeActual > m.cumulativeBudgeted ? 'text-red-600 font-medium' : 'text-slate-600'
                    }`}>{fmt(m.cumulativeActual)}</td>
                    <td className={`px-4 py-3 text-right font-bold num ${m.balanceBudgeted >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {fmt(m.balanceBudgeted)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
            Year 0 ending balance of <strong>{fmt(year0EndingBalance)}</strong> carries forward as Year 1 starting cash.
          </div>

          {year0Flow.some((m) => m.balanceBudgeted < 0) && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <strong>Warning:</strong> Pre-opening funding is insufficient. You need additional startup capital to cover shortfalls.
            </div>
          )}

          {totalActual > 0 && totalActual > totalBudgeted && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <strong>Over Budget:</strong> Actual spending ({fmt(totalActual)}) exceeds budget ({fmt(totalBudgeted)}) by {fmt(totalActual - totalBudgeted)}.
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

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto sl-scroll shadow-sm">
            <table className="w-full text-sm whitespace-nowrap sl-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Apport. %</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Apport. $</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Other Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Total Inflow</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Payroll</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Other Expenses</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Net Cash Flow</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Cumulative Balance</th>
                </tr>
              </thead>
              <tbody>
                {cashFlow.map((m) => (
                  <tr key={m.month} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{m.month}</td>
                    <td className="px-4 py-3 text-right text-slate-500 num">{(m.apportionmentPct * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-slate-600 num">{fmt(m.apportionmentAmt)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 num">{fmt(m.otherRevenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-800 font-medium num">{fmt(m.totalInflow)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 num">{fmt(m.payroll)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 num">{fmt(m.otherExpenses)}</td>
                    <td className={`px-4 py-3 text-right font-medium num ${m.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(m.netCashFlow)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold num ${m.cumulativeBalance >= 0 ? 'text-slate-800' : 'text-red-600 bg-red-50'}`}>
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
