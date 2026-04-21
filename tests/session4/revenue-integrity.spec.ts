import { test, expect } from '@playwright/test'
import { calcCommissionRevenue, calcSmallSchoolEnhancementFromGrades } from '../../src/lib/calculations'
import { stateApportionmentBase } from '../../src/lib/budgetEngine'
import { DEFAULT_ASSUMPTIONS } from '../../src/lib/types'

/**
 * Suite 7 — Revenue integrity (LAP High Poverty + SSE accounting).
 *
 * Pure-function regression tests pinning:
 *   1. LAP High Poverty gate — OSPI's 50% FRPL threshold (three-year rolling avg).
 *   2. rev.total invariant — SSE folded in so `rev.total` is a true total.
 *   3. Step 2 / Step 3 cross-consistency — totalGrants = sum of Step 3 grant lines.
 *   4. Constituent sum invariant — rev.total = sum of revenue line items.
 *
 * Guardrails for the bug pair documented in BACKLOG.md (LAP HP fix + Option A-wide
 * SSE plumbing). Run with: `npx playwright test tests/session4/revenue-integrity.spec.ts`
 */

test.describe('Revenue integrity — LAP High Poverty + SSE accounting', () => {
  test('LAP High Poverty: 50% FRPL threshold gate + pctFrl factor', () => {
    // Sub-threshold: pctFrl = 0 → 0 allocation
    const revBelow = calcCommissionRevenue(300, 0, 12, 10, 5, DEFAULT_ASSUMPTIONS)
    expect(revBelow.lapHighPoverty).toBe(0)

    // Sub-threshold: pctFrl = 49 → still 0 (strictly below 50)
    const revJustBelow = calcCommissionRevenue(300, 49, 12, 10, 5, DEFAULT_ASSUMPTIONS)
    expect(revJustBelow.lapHighPoverty).toBe(0)

    // At-threshold: pctFrl = 50 → allocation scales with FRL share (not flat per-student)
    const revAt = calcCommissionRevenue(300, 50, 12, 10, 5, DEFAULT_ASSUMPTIONS)
    const expectedAt = Math.round(300 * 0.5 * 374)
    expect(revAt.lapHighPoverty).toBe(expectedAt)

    // Above-threshold: higher FRL share → proportionally higher allocation
    const revHigh = calcCommissionRevenue(300, 80, 12, 10, 5, DEFAULT_ASSUMPTIONS)
    const expectedHigh = Math.round(300 * 0.8 * 374)
    expect(revHigh.lapHighPoverty).toBe(expectedHigh)
    expect(revHigh.lapHighPoverty).toBeGreaterThan(revAt.lapHighPoverty)
  })

  test('rev.total includes SSE for sub-threshold K-1 school', () => {
    // Tiny K-1 school: 40 students across 2 grades. AAFTE = 38 < 60 k6 threshold.
    const enrollment = 40
    const openingGrades = ['K', '1']
    const sse = calcSmallSchoolEnhancementFromGrades(
      enrollment,
      openingGrades,
      DEFAULT_ASSUMPTIONS.aafte_pct,
      DEFAULT_ASSUMPTIONS.regular_ed_per_pupil,
      DEFAULT_ASSUMPTIONS.regionalization_factor || 1.0,
    )
    expect(sse).toBeGreaterThan(0) // Sub-threshold schools must receive SSE

    const revWithSse = calcCommissionRevenue(enrollment, 30, 12, 10, 5, DEFAULT_ASSUMPTIONS, 1, sse)
    const revWithoutSse = calcCommissionRevenue(enrollment, 30, 12, 10, 5, DEFAULT_ASSUMPTIONS, 1, 0)

    expect(revWithSse.smallSchoolEnhancement).toBe(sse)
    expect(revWithSse.total - revWithoutSse.total).toBe(sse)
  })

  test('Step 2 / Step 3 cross-consistency: totalGrants = sum of Step 3 grant lines', () => {
    // Cedar Ridge-like profile: above 50% FRL so all grants activate.
    const enrollment = 250
    const openingGrades = ['K', '1', '2', '3']
    const sse = calcSmallSchoolEnhancementFromGrades(
      enrollment,
      openingGrades,
      DEFAULT_ASSUMPTIONS.aafte_pct,
      DEFAULT_ASSUMPTIONS.regular_ed_per_pupil,
      DEFAULT_ASSUMPTIONS.regionalization_factor || 1.0,
    )
    const rev = calcCommissionRevenue(enrollment, 60, 15, 12, 5, DEFAULT_ASSUMPTIONS, 1, sse)
    const baseRevenue = stateApportionmentBase(rev, sse)
    const totalGrants = rev.total - baseRevenue

    // Step 3 Demographics sums these lines (see StepDemographics.tsx:63 demographicRevenue)
    const step3GrantLines =
      rev.levyEquity +
      rev.titleI +
      rev.idea +
      rev.lap +
      rev.lapHighPoverty +
      rev.tbip +
      rev.hicap +
      rev.foodServiceRev +
      rev.transportationRev
    expect(totalGrants).toBe(step3GrantLines)
    expect(totalGrants).toBeGreaterThan(0) // No negative grants bug
  })

  test('Invariant: rev.total = sum of constituent revenue lines', () => {
    // Regression guardrail: any new revenue line added to CommissionRevenue must be
    // included in `rev.total`. This test encodes the contract that `rev.total` is
    // the authoritative total — callers must not "add something on top."
    const cases: Array<[number, number, number, number, number, number]> = [
      [0, 0, 0, 0, 0, 0],        // Zero enrollment, no SSE
      [40, 30, 12, 10, 5, 50000], // Sub-threshold, with SSE
      [150, 45, 12, 10, 5, 0],   // Below Title I + LAP HP thresholds
      [300, 55, 15, 12, 6, 0],   // Above all thresholds
      [500, 80, 20, 25, 8, 25000],// Above thresholds, with SSE
    ]

    for (const [headcount, pctFrl, pctIep, pctEll, pctHicap, sse] of cases) {
      const rev = calcCommissionRevenue(
        headcount,
        pctFrl,
        pctIep,
        pctEll,
        pctHicap,
        DEFAULT_ASSUMPTIONS,
        1,
        sse,
      )
      const expectedTotal =
        rev.regularEd +
        rev.sped +
        rev.stateSped +
        rev.facilitiesRev +
        rev.levyEquity +
        rev.titleI +
        rev.idea +
        rev.lap +
        rev.lapHighPoverty +
        rev.tbip +
        rev.hicap +
        rev.foodServiceRev +
        rev.transportationRev +
        rev.smallSchoolEnhancement
      expect(rev.total).toBe(expectedTotal)
      expect(rev.smallSchoolEnhancement).toBe(sse)
    }
  })
})
