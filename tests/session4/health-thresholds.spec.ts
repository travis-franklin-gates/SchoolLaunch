import { test, expect } from '@playwright/test'
import {
  evaluatePersonnelPctHealth,
  getPersonnelHealthBand,
  personnelHealthBandsForPrompt,
} from '../../src/lib/healthThresholds'

/**
 * Suite — Personnel-% health threshold helper (F-001 / F-011 fix).
 *
 * Pure-function contract tests. The helper is the single source of truth for
 * personnel-% verdict logic across:
 *   - Overview tile
 *   - Staffing tab UI copy
 *   - Staffing Advisor agent prompt (via injection)
 *   - Ask SchoolLaunch agent prompt (via injection)
 *   - PDF export
 *
 * REPRESENTATION NOTE: pct is an integer percentage (65, 72, 78), not a decimal
 * fraction (0.65, 0.72, 0.78). All callers must use the same representation.
 */

test.describe('getPersonnelHealthBand — year-aware band selection', () => {
  test('Year 1 returns founding band (65–72%)', () => {
    const band = getPersonnelHealthBand(1)
    expect(band.yearCategory).toBe('founding')
    expect(band.meetsLower).toBe(65)
    expect(band.meetsUpper).toBe(72)
    expect(band.approachingLow).toBe(62)
    expect(band.approachingHigh).toBe(75)
    expect(band.label).toBe('Founding year 65–72%')
  })

  test('Year 2 returns steady-state band (72–78%)', () => {
    const band = getPersonnelHealthBand(2)
    expect(band.yearCategory).toBe('steady_state')
    expect(band.meetsLower).toBe(72)
    expect(band.meetsUpper).toBe(78)
    expect(band.approachingLow).toBe(69)
    expect(band.approachingHigh).toBe(81)
    expect(band.label).toBe('Steady-state 72–78%')
  })

  test('Year 3, 4, 5 all return steady-state band', () => {
    for (const year of [3, 4, 5]) {
      expect(getPersonnelHealthBand(year).yearCategory).toBe('steady_state')
    }
  })
})

test.describe('evaluatePersonnelPctHealth — Year 1 founding boundaries', () => {
  // Founding band: meets 65–72, approaching 62–65 or 72–75, fails outside
  test('65.3% (the Evergreen Heights audit case) → meets', () => {
    const result = evaluatePersonnelPctHealth(65.3, 1)
    expect(result.verdict).toBe('meets')
    expect(result.short).toBe('Within founding-year range')
  })

  test('exactly 65% → meets (inclusive lower boundary)', () => {
    expect(evaluatePersonnelPctHealth(65, 1).verdict).toBe('meets')
  })

  test('exactly 72% → meets (inclusive upper boundary)', () => {
    expect(evaluatePersonnelPctHealth(72, 1).verdict).toBe('meets')
  })

  test('64.9% → approaching low', () => {
    const result = evaluatePersonnelPctHealth(64.9, 1)
    expect(result.verdict).toBe('approaching')
    expect(result.short).toBe('Approaching low')
  })

  test('exactly 62% → approaching low (inclusive lower of approaching)', () => {
    expect(evaluatePersonnelPctHealth(62, 1).verdict).toBe('approaching')
  })

  test('61.9% → fails (below approaching range)', () => {
    const result = evaluatePersonnelPctHealth(61.9, 1)
    expect(result.verdict).toBe('fails')
    expect(result.short).toBe('Below healthy range')
  })

  test('72.1% → approaching high', () => {
    const result = evaluatePersonnelPctHealth(72.1, 1)
    expect(result.verdict).toBe('approaching')
    expect(result.short).toBe('Approaching high')
  })

  test('exactly 75% → approaching high (inclusive upper of approaching)', () => {
    expect(evaluatePersonnelPctHealth(75, 1).verdict).toBe('approaching')
  })

  test('75.1% → fails (above approaching range)', () => {
    const result = evaluatePersonnelPctHealth(75.1, 1)
    expect(result.verdict).toBe('fails')
    expect(result.short).toBe('Above healthy range')
  })
})

test.describe('evaluatePersonnelPctHealth — Year 2+ steady-state boundaries', () => {
  // Steady-state band: meets 72–78, approaching 69–72 or 78–81, fails outside
  test('75% in Y3 → meets (mid-range)', () => {
    expect(evaluatePersonnelPctHealth(75, 3).verdict).toBe('meets')
  })

  test('exactly 72% in Y3 → meets', () => {
    expect(evaluatePersonnelPctHealth(72, 3).verdict).toBe('meets')
  })

  test('exactly 78% in Y3 → meets', () => {
    expect(evaluatePersonnelPctHealth(78, 3).verdict).toBe('meets')
  })

  test('71.9% in Y3 → approaching low', () => {
    expect(evaluatePersonnelPctHealth(71.9, 3).verdict).toBe('approaching')
    expect(evaluatePersonnelPctHealth(71.9, 3).short).toBe('Approaching low')
  })

  test('exactly 69% in Y3 → approaching', () => {
    expect(evaluatePersonnelPctHealth(69, 3).verdict).toBe('approaching')
  })

  test('68.9% in Y3 → fails (below approaching)', () => {
    expect(evaluatePersonnelPctHealth(68.9, 3).verdict).toBe('fails')
  })

  test('78.1% in Y3 → approaching high', () => {
    expect(evaluatePersonnelPctHealth(78.1, 3).verdict).toBe('approaching')
    expect(evaluatePersonnelPctHealth(78.1, 3).short).toBe('Approaching high')
  })

  test('exactly 81% in Y3 → approaching', () => {
    expect(evaluatePersonnelPctHealth(81, 3).verdict).toBe('approaching')
  })

  test('81.1% in Y3 → fails (above approaching)', () => {
    expect(evaluatePersonnelPctHealth(81.1, 3).verdict).toBe('fails')
  })

  test('65.3% in Y3 → fails (regression: this is healthy in Y1 but NOT in Y3)', () => {
    const result = evaluatePersonnelPctHealth(65.3, 3)
    expect(result.verdict).toBe('fails')
    expect(result.short).toBe('Below healthy range')
  })
})

test.describe('evaluatePersonnelPctHealth — band differentiation', () => {
  test('same pct (70%) reaches different verdicts in Y1 vs Y3', () => {
    // 70% sits inside the founding meets band but inside the steady-state approaching-low band
    expect(evaluatePersonnelPctHealth(70, 1).verdict).toBe('meets')
    expect(evaluatePersonnelPctHealth(70, 3).verdict).toBe('approaching')
  })

  test('long-form explanation cites the year-appropriate band', () => {
    const y1 = evaluatePersonnelPctHealth(70, 1).long
    const y3 = evaluatePersonnelPctHealth(70, 3).long
    expect(y1).toContain('founding year')
    expect(y3).toContain('steady-state')
  })
})

test.describe('personnelHealthBandsForPrompt — single source for AI prompts', () => {
  test('output contains both year-aware bands', () => {
    const text = personnelHealthBandsForPrompt()
    expect(text).toContain('Year 1 (founding)')
    expect(text).toContain('Year 2+ (steady-state)')
    expect(text).toContain('65–72%')
    expect(text).toContain('72–78%')
  })

  test('output warns against citing steady-state as Y1 standard', () => {
    const text = personnelHealthBandsForPrompt()
    expect(text).toMatch(/DO NOT/)
    expect(text).toMatch(/founding/i)
  })
})
