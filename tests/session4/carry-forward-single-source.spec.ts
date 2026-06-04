import { test, expect } from '@playwright/test'
import { computeCarryForward, computeCarryForwardBreakdown } from '../../src/lib/budgetEngine'
import type { SchoolProfile, StartupFundingSource, PreOpeningTransaction, PreOpeningExpense } from '../../src/lib/types'

/**
 * P-UX-20 — single source of truth for pre-opening cash.
 *
 * computeCarryForward now delegates to computeCarryForwardBreakdown (sub-components:
 * year0Total, preOpenActualSpend, preOpenBudget, preOpenExpenses, carryForward), so the
 * multiyear page can display the components WITHOUT re-deriving them inline (and with zero
 * raw pre_opening_* reads — the breakdown canonicalizes, inheriting P-UX-19 crash-safety).
 *
 * BYTE-IDENTICAL bar (computeCarryForward is shared by 9 callers): the delegating
 * computeCarryForward must equal the pre-refactor values across four input shapes, and the
 * breakdown must sum back to carryForward exactly.
 */
const P = (sf: unknown, txs: unknown = [], exps: unknown = []): SchoolProfile => ({
  startup_funding: sf as StartupFundingSource[],
  pre_opening_transactions: txs as PreOpeningTransaction[],
  pre_opening_expenses: exps as PreOpeningExpense[],
} as unknown as SchoolProfile)

const WA = P([{ source: 'CSP', amount: 350000, type: 'grant', status: 'projected', selectedYears: [0, 1, 2, 3, 4], yearAllocations: { 0: 350000, 1: 0, 2: 0, 3: 0, 4: 0 } }])
const GEN = P([{ source: 'Donation', amount: 120000, type: 'donation', status: 'received' }])
const PRIV = P([{ source: 'Loan', amount: 200000, type: 'debt', status: 'pledged', selectedYears: [1, 2] }], [], [{ id: 'e', name: 'n', budgeted: 30000, actual: 0 }])
const MICRO = P([{ source: 'Seed', amount: 80000, type: 'grant', status: 'projected', selectedYears: [0], yearAllocations: { 0: 80000 } }], [{ id: 't', month: 'mar', description: 'd', amount: 5000, expense_category: 'c', created_at: 'x' }], [{ id: 'e', name: 'n', budgeted: 9999, actual: 0 }])

// Pre-refactor baselines (captured from current code before the breakdown refactor).
const PINS: Array<[string, SchoolProfile, number]> = [['WA', WA, 350000], ['Generic', GEN, 120000], ['Private', PRIV, 170000], ['Micro', MICRO, 75000]]

test.describe('P-UX-20 — computeCarryForward byte-identical via breakdown delegation', () => {
  test('all four input shapes unchanged from pre-refactor baselines', () => {
    for (const [label, p, expected] of PINS) {
      expect.soft(computeCarryForward(p), `${label} carry-forward`).toBe(expected)
    }
  })

  test('computeCarryForward === breakdown.carryForward (delegation consistency)', () => {
    for (const [label, p] of PINS) {
      expect.soft(computeCarryForwardBreakdown(p).carryForward, `${label} delegation`).toBe(computeCarryForward(p))
    }
  })

  test('breakdown components sum back to carryForward (year0Total - preOpenExpenses)', () => {
    for (const [label, p] of PINS) {
      const b = computeCarryForwardBreakdown(p)
      expect.soft(b.year0Total - b.preOpenExpenses, `${label} sum`).toBe(b.carryForward)
    }
  })

  test('component values the multiyear page displays are correct', () => {
    const micro = computeCarryForwardBreakdown(MICRO)
    expect(micro.year0Total).toBe(80000)
    expect(micro.preOpenActualSpend).toBe(5000)
    expect(micro.preOpenExpenses).toBe(5000) // actual spend > 0 wins over budget
    const priv = computeCarryForwardBreakdown(PRIV)
    expect(priv.year0Total).toBe(200000) // no Y0 allocation -> falls back to total funding
    expect(priv.preOpenActualSpend).toBe(0)
    expect(priv.preOpenExpenses).toBe(30000) // budget used when no actual spend
  })

  test('breakdown is crash-safe on malformed pre_opening_* (inherits P-UX-19 canonicalization)', () => {
    let cf = NaN
    expect(() => { cf = computeCarryForwardBreakdown(P(WA.startup_funding, [null, { amount: 'x' }], [null])).carryForward }).not.toThrow()
    expect(cf).toBe(350000)
  })
})
