import { test, expect } from '@playwright/test'
import { defaultYearNewGrades } from '../../src/lib/gradeExpansion'

/**
 * Suite — defaultYearNewGrades band-based parallel expansion.
 *
 * Pure-function contract tests. These do not require a running dev server or
 * Supabase — they exercise `defaultYearNewGrades` directly and assert that
 * non-contiguous founding grades expand each band in parallel, while
 * contiguous-founding cases remain unchanged from previous behavior.
 */

function yearMap(map: Map<number, string[]>): Record<number, string[]> {
  const out: Record<number, string[]> = {}
  for (const [year, grades] of map) out[year] = grades
  return out
}

test.describe('defaultYearNewGrades — parallel band expansion', () => {
  test('founding {6,9}, buildout 6-12 → both bands grow in parallel', () => {
    const map = defaultYearNewGrades(['6', '9'], ['6', '7', '8', '9', '10', '11', '12'])
    expect(yearMap(map)).toEqual({
      2: ['7', '10'],
      3: ['8', '11'],
      4: ['12'],
    })
  })

  test('founding {K,5}, buildout K-8 → bands grow in parallel; band 1 fills last grade in Y5', () => {
    const map = defaultYearNewGrades(['K', '5'], ['K', '1', '2', '3', '4', '5', '6', '7', '8'])
    expect(yearMap(map)).toEqual({
      2: ['1', '6'],
      3: ['2', '7'],
      4: ['3', '8'],
      5: ['4'],
    })
  })

  test('founding {6,9}, buildout {6,7,9,10,11,12} (gap edge case) → band 1 caps at 7 because 8 is excluded', () => {
    const map = defaultYearNewGrades(['6', '9'], ['6', '7', '9', '10', '11', '12'])
    expect(yearMap(map)).toEqual({
      2: ['7', '10'],
      3: ['11'],
      4: ['12'],
    })
  })

  test('founding {K,1}, buildout K-8 (Spokane Arts contiguous regression) → matches prior single-grade-per-year output', () => {
    const map = defaultYearNewGrades(['K', '1'], ['K', '1', '2', '3', '4', '5', '6', '7', '8'])
    expect(yearMap(map)).toEqual({
      2: ['2'],
      3: ['3'],
      4: ['4'],
      5: ['5'],
    })
  })

  test('single founding {K}, buildout K-5 → one grade per year, identical to current behavior', () => {
    const map = defaultYearNewGrades(['K'], ['K', '1', '2', '3', '4', '5'])
    expect(yearMap(map)).toEqual({
      2: ['1'],
      3: ['2'],
      4: ['3'],
      5: ['4'],
    })
  })
})
