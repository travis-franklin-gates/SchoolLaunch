import type { GradeExpansionEntry } from './types'

export const ALL_GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

/**
 * Engine fallback for `retention_rate` when a school has no value set.
 * Single source of truth for the default; do not hardcode the integer elsewhere.
 * Range: 70–100 (integer percentage). Calibrated for WA charter elementary (R-ENR-01).
 */
export const RETENTION_RATE_DEFAULT = 92

/** Resolve a school's retention rate with the engine fallback. */
export function getRetentionRate(profile: { retention_rate?: number | null }): number {
  return profile.retention_rate ?? RETENTION_RATE_DEFAULT
}

export function gradeIndex(g: string): number {
  return ALL_GRADES.indexOf(g)
}

export function sortGrades(grades: string[]): string[] {
  return [...grades].sort((a, b) => gradeIndex(a) - gradeIndex(b))
}

export function gradesForConfig(config: string): string[] {
  switch (config) {
    case 'K-5': return ['K', '1', '2', '3', '4', '5']
    case 'K-8': return ['K', '1', '2', '3', '4', '5', '6', '7', '8']
    case 'K-12': return ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    case '6-8': return ['6', '7', '8']
    case '6-12': return ['6', '7', '8', '9', '10', '11', '12']
    case '9-12': return ['9', '10', '11', '12']
    default: return ['K', '1', '2', '3', '4', '5']
  }
}

export function defaultOpeningGrades(config: string): string[] {
  const all = gradesForConfig(config)
  // Default: first 2 grades (or all if <= 2)
  return all.slice(0, Math.min(2, all.length))
}

/**
 * Derive a grade config string (e.g. "K-8") from an array of buildout grades.
 */
export function deriveGradeConfig(buildoutGrades: string[]): string {
  if (buildoutGrades.length === 0) return 'K-5'
  const sorted = sortGrades(buildoutGrades)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === last) return first === 'K' ? 'K' : `${first}`
  return `${first}-${last}`
}

export function isSecondaryGrade(grade: string): boolean {
  return gradeIndex(grade) >= gradeIndex('6')
}

export function isHighSchoolGrade(grade: string): boolean {
  return gradeIndex(grade) >= gradeIndex('9')
}

/**
 * Compute the default mapping of which new grades are added each year.
 *
 * Founding grades are grouped into contiguous bands (consecutive grade indices).
 * Each year, every band attempts to add the next buildout grade above its current
 * top, capped at either the next band's bottom grade minus 1, or the maximum
 * buildout grade for the topmost band. This means non-contiguous founding bands
 * (e.g., {6,9} for a combined middle/high model) expand in parallel.
 */
export function defaultYearNewGrades(
  openingGrades: string[],
  buildoutGrades: string[],
): Map<number, string[]> {
  const buildoutSet = new Set(buildoutGrades)
  const sortedOpening = sortGrades(openingGrades.filter((g) => buildoutSet.has(g)))
  const map = new Map<number, string[]>()
  if (sortedOpening.length === 0) return map

  // Group founding grades into contiguous bands
  const bands: string[][] = []
  let currentBand: string[] = [sortedOpening[0]]
  for (let i = 1; i < sortedOpening.length; i++) {
    if (gradeIndex(sortedOpening[i]) === gradeIndex(sortedOpening[i - 1]) + 1) {
      currentBand.push(sortedOpening[i])
    } else {
      bands.push(currentBand)
      currentBand = [sortedOpening[i]]
    }
  }
  bands.push(currentBand)

  const sortedBuildout = sortGrades(buildoutGrades)
  const maxBuildoutIdx = gradeIndex(sortedBuildout[sortedBuildout.length - 1])
  const bandTops: number[] = bands.map((b) => gradeIndex(b[b.length - 1]))
  const bandCaps: number[] = bands.map((_, i) =>
    i + 1 < bands.length ? gradeIndex(bands[i + 1][0]) - 1 : maxBuildoutIdx
  )

  for (let year = 2; year <= 5; year++) {
    const newGrades: string[] = []
    for (let bi = 0; bi < bands.length; bi++) {
      if (bandTops[bi] >= bandCaps[bi]) continue
      let next = bandTops[bi] + 1
      while (next <= bandCaps[bi] && !buildoutSet.has(ALL_GRADES[next])) next++
      if (next <= bandCaps[bi]) {
        newGrades.push(ALL_GRADES[next])
        bandTops[bi] = next
      } else {
        bandTops[bi] = bandCaps[bi]
      }
    }
    if (newGrades.length === 0) break
    map.set(year, sortGrades(newGrades))
  }

  return map
}

/**
 * Auto-generate an expansion timeline given opening and buildout grades.
 * Uses yearNewGrades mapping to decide which grades are added each year.
 * Defaults to 1 new grade per year if no mapping provided.
 */
export function generateExpansionPlan(
  openingGrades: string[],
  buildoutGrades: string[],
  sectionsPerGrade: number = 1,
  studentsPerSection: number = 24,
  yearNewGrades?: Map<number, string[]>,
): GradeExpansionEntry[] {
  const mapping = yearNewGrades || defaultYearNewGrades(openingGrades, buildoutGrades)
  const entries: GradeExpansionEntry[] = []

  // Year 1: opening grades
  for (const g of sortGrades(openingGrades)) {
    entries.push({
      year: 1,
      grade_level: g,
      sections: sectionsPerGrade,
      students_per_section: studentsPerSection,
      is_new_grade: false,
    })
  }

  // Years 2–5: carry forward prior grades + add new grades from mapping
  for (let year = 2; year <= 5; year++) {
    const priorGrades = entries
      .filter((e) => e.year === year - 1)
      .map((e) => e.grade_level)

    for (const g of priorGrades) {
      const priorEntry = entries.find((e) => e.year === year - 1 && e.grade_level === g)
      entries.push({
        year,
        grade_level: g,
        sections: priorEntry?.sections || sectionsPerGrade,
        students_per_section: priorEntry?.students_per_section || studentsPerSection,
        is_new_grade: false,
      })
    }

    // New grades inherit sections/students from the most recently added grade
    const priorYearEntries = entries.filter((e) => e.year === year - 1)
    const lastAddedEntry = priorYearEntries.length > 0
      ? priorYearEntries[priorYearEntries.length - 1]
      : null

    const priorGradeSet = new Set(priorGrades)
    const newGrades = (mapping.get(year) || []).filter((g) => !priorGradeSet.has(g))
    for (const g of sortGrades(newGrades)) {
      entries.push({
        year,
        grade_level: g,
        sections: lastAddedEntry?.sections || sectionsPerGrade,
        students_per_section: lastAddedEntry?.students_per_section || studentsPerSection,
        is_new_grade: true,
      })
    }
  }

  // Sort entries within each year by grade order
  entries.sort((a, b) => a.year - b.year || gradeIndex(a.grade_level) - gradeIndex(b.grade_level))

  return entries
}

/**
 * Compute cohort-based enrollment for each year given an expansion plan and retention rate.
 *
 * RETENTION MATH (R-ENR-01 — Formula A, whole-year compounding):
 *
 *   Year 1 (founding):
 *     returning[1]        = 0  (no prior year)
 *     newGradeStudents[1] = 0  (Y1 grades have is_new_grade=false; they're the founding cohort,
 *                               not "added" — they're the school's first enrollment)
 *     total[1]            = sum of (sections × students_per_section) across all Y1 entries
 *
 *   Year n ≥ 2:
 *     newGradeStudents[n] = sum of (sections × students_per_section) for entries where
 *                           is_new_grade=true (grade levels added this year)
 *     priorContinuingTotal = total[n-1] minus the planned capacity of any grade that existed
 *                            in year n-1 but is NOT in year n (grade dropped). For pure
 *                            expansion plans (every prior grade continues), this subtraction
 *                            is zero.
 *     returning[n]        = round(priorContinuingTotal × retentionRate / 100)
 *     total[n]            = returning[n] + newGradeStudents[n]
 *
 *   Key invariants:
 *     - Continuing-grade students are subject to retention; new-grade-level students
 *       enroll at full planned capacity (never reduced).
 *     - Retention compounds: year n's returning is calculated from year n-1's RESULT
 *       total (already retention-adjusted), not from year n-1's plan capacity.
 *     - retention=100 reproduces the legacy "no attrition" trajectory exactly.
 *     - retention=0 produces a trajectory of [Y1_total, new_grades_Y2, new_grades_Y3, ...].
 *
 *   Model limitations (v4.1 candidates):
 *     - This is a school-wide aggregate, not per-grade promotion. We do not explicitly
 *       model "Y1 K class becomes Y2 1st grade"; instead retention is applied as a
 *       whole-school continuing-students factor.
 *     - Section expansion (e.g., Y3 K goes 1→2 sections) is not modeled. The added
 *       capacity does not enter the retention math.
 *     - Grade-drop edge case uses prior plan capacity (not prior actual) for the
 *       subtraction, which slightly over-corrects.
 *
 *   IMPORTANT: retentionRate is an INTEGER percentage (e.g., 92 means 92%), NOT a
 *   decimal fraction (0.92). The test fixture at tests/session4/advisory-hash.spec.ts:39
 *   uses decimal form for hash-input testing only — do not propagate that pattern into
 *   new tests or production code.
 */
export function computeExpansionEnrollments(
  plan: GradeExpansionEntry[],
  retentionRate: number = RETENTION_RATE_DEFAULT,
): { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[] {
  const years = Array.from(new Set(plan.map((e) => e.year))).sort((a, b) => a - b)
  const results: { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[] = []

  for (const year of years) {
    const yearEntries = plan.filter((e) => e.year === year)
    const newGradeEntries = yearEntries.filter((e) => e.is_new_grade)
    const newGradeStudents = newGradeEntries.reduce(
      (s, e) => s + e.sections * e.students_per_section, 0
    )
    const grades = sortGrades(yearEntries.map((e) => e.grade_level))
    const newGrades = sortGrades(newGradeEntries.map((e) => e.grade_level))

    let total: number
    let returning: number

    if (year === years[0]) {
      // Founding year — no prior to retain from. All Y1 students enroll at planned capacity.
      total = yearEntries.reduce((s, e) => s + e.sections * e.students_per_section, 0)
      returning = 0
    } else {
      // Year n ≥ 2: retention applies to continuing students from prior year's result.
      const priorResult = results[results.length - 1]
      let priorContinuingTotal = priorResult.total

      // Subtract any grade that existed in prior year but isn't in current year (grade dropped).
      // For normal expansion plans, this loop is a no-op.
      const currentGradeSet = new Set(yearEntries.map((e) => e.grade_level))
      const priorEntries = plan.filter((e) => e.year === priorResult.year)
      for (const pe of priorEntries) {
        if (!currentGradeSet.has(pe.grade_level)) {
          priorContinuingTotal -= pe.sections * pe.students_per_section
        }
      }
      if (priorContinuingTotal < 0) priorContinuingTotal = 0

      returning = Math.round((priorContinuingTotal * retentionRate) / 100)
      total = returning + newGradeStudents
    }

    results.push({ year, total, returning, newGrade: newGradeStudents, grades, newGrades })
  }

  return results
}

/**
 * Get teachers needed per new grade based on grade band.
 */
export function teachersPerNewGrade(grade: string, sections: number): number {
  if (isHighSchoolGrade(grade)) {
    // High school: ~2-3 teachers per new grade (subject specialists)
    return Math.max(2, Math.ceil(sections * 1.2))
  }
  if (isSecondaryGrade(grade)) {
    // Middle school: ~1.5-2 teachers per new grade
    return Math.max(1, Math.ceil(sections * 1.0))
  }
  // Elementary: 1 teacher per section
  return sections
}

/**
 * Convert expansion enrollments to the Y1-Y5 array used by the budget engine.
 * Returns [y1, y2, y3, y4, y5]. Delegates retention math to computeExpansionEnrollments.
 *
 * Fill-forward: if a year has NO entries in the plan (e.g., a 3-year plan), copy the
 * prior year's total. This is distinct from a year whose computed total happens to be
 * 0 students (legitimate at retention=0 with no new grade), which we preserve as 0.
 */
export function expansionToEnrollmentArray(
  plan: GradeExpansionEntry[],
  retentionRate: number = RETENTION_RATE_DEFAULT,
): number[] {
  const enrollments = computeExpansionEnrollments(plan, retentionRate)
  const result: number[] = [0, 0, 0, 0, 0]
  const yearHasEntries = [false, false, false, false, false]
  for (const e of enrollments) {
    if (e.year >= 1 && e.year <= 5) {
      result[e.year - 1] = e.total
      yearHasEntries[e.year - 1] = true
    }
  }
  // Fill forward ONLY for years absent from the plan (not for years that computed to 0).
  for (let i = 1; i < 5; i++) {
    if (!yearHasEntries[i] && result[i - 1] > 0) {
      result[i] = result[i - 1]
    }
  }
  return result
}
