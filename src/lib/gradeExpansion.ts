import type { GradeExpansionEntry } from './types'

export const ALL_GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

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

export function isSecondaryGrade(grade: string): boolean {
  return gradeIndex(grade) >= gradeIndex('6')
}

export function isHighSchoolGrade(grade: string): boolean {
  return gradeIndex(grade) >= gradeIndex('9')
}

/**
 * Compute the default mapping of which new grades are added each year (1 per year).
 */
export function defaultYearNewGrades(
  openingGrades: string[],
  buildoutGrades: string[],
): Map<number, string[]> {
  const openSet = new Set(openingGrades)
  const gradesToAdd = sortGrades(buildoutGrades.filter((g) => !openSet.has(g)))
  const map = new Map<number, string[]>()

  // 1 grade per year in years 2–5
  for (let i = 0; i < gradesToAdd.length && (i + 2) <= 5; i++) {
    map.set(i + 2, [gradesToAdd[i]])
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
  sectionsPerGrade: number = 2,
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

    const newGrades = mapping.get(year) || []
    for (const g of sortGrades(newGrades)) {
      entries.push({
        year,
        grade_level: g,
        sections: sectionsPerGrade,
        students_per_section: studentsPerSection,
        is_new_grade: true,
      })
    }
  }

  return entries
}

/**
 * Compute cohort-based enrollment for each year given an expansion plan and retention rate.
 */
export function computeExpansionEnrollments(
  plan: GradeExpansionEntry[],
  retentionRate: number = 90,
): { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[] {
  const retention = retentionRate / 100
  const years = Array.from(new Set(plan.map((e) => e.year))).sort((a, b) => a - b)
  const results: { year: number; total: number; returning: number; newGrade: number; grades: string[]; newGrades: string[] }[] = []

  let priorTotal = 0

  for (const year of years) {
    const yearEntries = plan.filter((e) => e.year === year)
    const newGradeEntries = yearEntries.filter((e) => e.is_new_grade)
    const newGradeStudents = newGradeEntries.reduce(
      (s, e) => s + e.sections * e.students_per_section, 0
    )

    let total: number
    let returning: number

    if (year === 1 || years.indexOf(year) === 0) {
      // Year 1: all students are new (opening)
      total = yearEntries.reduce((s, e) => s + e.sections * e.students_per_section, 0)
      returning = 0
    } else {
      returning = Math.round(priorTotal * retention)
      total = returning + newGradeStudents
    }

    const grades = sortGrades(yearEntries.map((e) => e.grade_level))
    const newGrades = sortGrades(newGradeEntries.map((e) => e.grade_level))

    results.push({ year, total, returning, newGrade: newGradeStudents, grades, newGrades })
    priorTotal = total
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
 * Returns [y1, y2, y3, y4, y5].
 */
export function expansionToEnrollmentArray(
  plan: GradeExpansionEntry[],
  retentionRate: number = 90,
): number[] {
  const enrollments = computeExpansionEnrollments(plan, retentionRate)
  const result: number[] = [0, 0, 0, 0, 0]
  for (const e of enrollments) {
    if (e.year >= 1 && e.year <= 5) {
      result[e.year - 1] = e.total
    }
  }
  // Fill forward if plan doesn't cover all 5 years
  for (let i = 1; i < 5; i++) {
    if (result[i] === 0 && result[i - 1] > 0) {
      result[i] = result[i - 1]
    }
  }
  return result
}
