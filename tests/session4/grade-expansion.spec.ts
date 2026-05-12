import { test, expect } from '@playwright/test'
import {
  defaultYearNewGrades,
  computeExpansionEnrollments,
  expansionToEnrollmentArray,
  RETENTION_RATE_DEFAULT,
  getRetentionRate,
} from '../../src/lib/gradeExpansion'
import type { GradeExpansionEntry } from '../../src/lib/types'

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

/**
 * Suite — computeExpansionEnrollments retention math (R-ENR-01).
 *
 * Pure-function contract tests for Formula A whole-year compounding retention.
 *
 * REPRESENTATION NOTE: retentionRate is an INTEGER PERCENTAGE (90 means 90%),
 * not a decimal fraction (0.9). The fixture at tests/session4/advisory-hash.spec.ts:39
 * uses decimal form for hash-input testing only — do NOT propagate that pattern.
 * If you copy a fixture, verify the representation matches production code.
 */
test.describe('computeExpansionEnrollments — retention math (R-ENR-01)', () => {
  // Evergreen Heights canonical plan: K-2 founding → K-5 buildout, 1 section × 24 students.
  // This mirrors the baseline-audit school used to discover R-ENR-01.
  const evergreenPlan: GradeExpansionEntry[] = [
    // Y1 — founding K, 1, 2 (is_new_grade=false; they're the school's first cohort)
    { year: 1, grade_level: 'K', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 1, grade_level: '1', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 1, grade_level: '2', sections: 1, students_per_section: 24, is_new_grade: false },
    // Y2 — K, 1, 2 continuing + grade 3 added
    { year: 2, grade_level: 'K', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 2, grade_level: '1', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 2, grade_level: '2', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 2, grade_level: '3', sections: 1, students_per_section: 24, is_new_grade: true },
    // Y3 — K-3 continuing + grade 4 added
    { year: 3, grade_level: 'K', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 3, grade_level: '1', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 3, grade_level: '2', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 3, grade_level: '3', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 3, grade_level: '4', sections: 1, students_per_section: 24, is_new_grade: true },
    // Y4 — K-4 continuing + grade 5 added
    { year: 4, grade_level: 'K', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 4, grade_level: '1', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 4, grade_level: '2', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 4, grade_level: '3', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 4, grade_level: '4', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 4, grade_level: '5', sections: 1, students_per_section: 24, is_new_grade: true },
    // Y5 — K-5 full buildout, no new grades
    { year: 5, grade_level: 'K', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 5, grade_level: '1', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 5, grade_level: '2', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 5, grade_level: '3', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 5, grade_level: '4', sections: 1, students_per_section: 24, is_new_grade: false },
    { year: 5, grade_level: '5', sections: 1, students_per_section: 24, is_new_grade: false },
  ]

  test('retention=100 → legacy trajectory [72, 96, 120, 144, 144] (regression guard)', () => {
    // This is the as-shipped behavior before R-ENR-01. The fix MUST preserve it
    // for retention=100, since 100% retention should mean "no attrition".
    const result = computeExpansionEnrollments(evergreenPlan, 100)
    expect(result.map((r) => r.total)).toEqual([72, 96, 120, 144, 144])
  })

  test('retention=92 (engine default) → [72, 90, 107, 122, 112]', () => {
    const result = computeExpansionEnrollments(evergreenPlan, 92)
    expect(result.map((r) => r.total)).toEqual([72, 90, 107, 122, 112])
  })

  test('retention=90 → [72, 89, 104, 118, 106]', () => {
    const result = computeExpansionEnrollments(evergreenPlan, 90)
    expect(result.map((r) => r.total)).toEqual([72, 89, 104, 118, 106])
  })

  test('retention=0 → only new-grade students count [72, 24, 24, 24, 0]', () => {
    // Y1 is the founding cohort regardless of retention.
    // Y2-Y4 each add a new grade (24 students), zero from prior year.
    // Y5 has no new grade and zero retention → 0 students.
    const result = computeExpansionEnrollments(evergreenPlan, 0)
    expect(result.map((r) => r.total)).toEqual([72, 24, 24, 24, 0])
  })

  test('default param equals RETENTION_RATE_DEFAULT (92) and matches explicit-92 result', () => {
    const implicit = computeExpansionEnrollments(evergreenPlan)
    const explicit = computeExpansionEnrollments(evergreenPlan, RETENTION_RATE_DEFAULT)
    expect(implicit.map((r) => r.total)).toEqual(explicit.map((r) => r.total))
    expect(RETENTION_RATE_DEFAULT).toBe(92)
  })

  test('Y1 founding semantics: returning=0, newGrade=0 even though grades exist', () => {
    // Y1 is_new_grade=false for all founding grades. The founding cohort is the
    // first enrollment, not "new grades added this year" in the expansion sense.
    const result = computeExpansionEnrollments(evergreenPlan, 92)
    const y1 = result.find((r) => r.year === 1)!
    expect(y1.returning).toBe(0)
    expect(y1.newGrade).toBe(0)
    expect(y1.total).toBe(72)
  })

  test('constituent-sum invariant: Y2+ total === returning + newGrade', () => {
    for (const rate of [100, 92, 90, 80, 70, 0]) {
      const result = computeExpansionEnrollments(evergreenPlan, rate)
      for (const row of result) {
        if (row.year === 1) continue
        expect(row.returning + row.newGrade).toBe(row.total)
      }
    }
  })

  test('new-grade students never subject to retention (full capacity each year added)', () => {
    // Y2 grade 3, Y3 grade 4, Y4 grade 5 are each "newGrade" cohorts at 24 students.
    // These should not be reduced by retention.
    for (const rate of [100, 90, 80, 50, 0]) {
      const result = computeExpansionEnrollments(evergreenPlan, rate)
      expect(result.find((r) => r.year === 2)!.newGrade).toBe(24)
      expect(result.find((r) => r.year === 3)!.newGrade).toBe(24)
      expect(result.find((r) => r.year === 4)!.newGrade).toBe(24)
      expect(result.find((r) => r.year === 5)!.newGrade).toBe(0)
    }
  })

  test('returning students = round(prior total × retention/100), confirming compounding', () => {
    const result = computeExpansionEnrollments(evergreenPlan, 90)
    // Y2 returning = round(72 × 0.9) = 65
    expect(result.find((r) => r.year === 2)!.returning).toBe(65)
    // Y3 returning = round(Y2.total=89 × 0.9) = 80 (compounding from Y2 result, not Y1)
    expect(result.find((r) => r.year === 3)!.returning).toBe(80)
    // Y4 returning = round(Y3.total=104 × 0.9) = 94
    expect(result.find((r) => r.year === 4)!.returning).toBe(94)
    // Y5 returning = round(Y4.total=118 × 0.9) = 106
    expect(result.find((r) => r.year === 5)!.returning).toBe(106)
  })

  test('expansionToEnrollmentArray delegates to computeExpansionEnrollments correctly', () => {
    for (const rate of [100, 92, 90, 80, 0]) {
      const direct = computeExpansionEnrollments(evergreenPlan, rate).map((r) => r.total)
      const array = expansionToEnrollmentArray(evergreenPlan, rate)
      expect(array).toEqual(direct)
    }
  })
})

test.describe('getRetentionRate — accessor + default fallback (R-ENR-01)', () => {
  test('returns explicit value when set', () => {
    expect(getRetentionRate({ retention_rate: 85 })).toBe(85)
    expect(getRetentionRate({ retention_rate: 100 })).toBe(100)
    expect(getRetentionRate({ retention_rate: 0 })).toBe(0)
  })

  test('returns RETENTION_RATE_DEFAULT (92) when retention_rate is null or undefined', () => {
    expect(getRetentionRate({ retention_rate: null })).toBe(RETENTION_RATE_DEFAULT)
    expect(getRetentionRate({ retention_rate: undefined })).toBe(RETENTION_RATE_DEFAULT)
    expect(getRetentionRate({})).toBe(RETENTION_RATE_DEFAULT)
  })

  test('RETENTION_RATE_DEFAULT is the calibrated 92% per R-ENR-01 Phase 1 decision', () => {
    expect(RETENTION_RATE_DEFAULT).toBe(92)
  })
})
