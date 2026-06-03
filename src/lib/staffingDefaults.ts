// R-REV-05: single source of truth for WA Charter default salaries.
//
// Salaries are NOT stored here. They are read from COMMISSION_POSITIONS in
// types.ts (the OSPI/BLS WA benchmark catalog) via getCommissionPosition, so the
// onboarding seed (StepStaffing.buildDefaultPositions), the staffing/seed
// fallback route (SEED_POSITIONS below), and the dashboard add-position path
// (staffing/page.tsx, which reads getCommissionPosition(type).salary) all resolve
// to the same number. This eliminated the prior drift where onboarding seeded
// salaries ~25-40% below the catalog benchmark a founder saw on the dashboard.
//
// WA Charter pathway only. Generic / Private / Micro pathways build positions
// from their own stateConfig catalogs and are intentionally untouched.

import { getCommissionPosition } from './types'

/** WA Charter position types instantiated by the seed paths. teacher_ms is the
 *  secondary-grades variant chosen by the onboarding builder; the rest are the
 *  fixed onboarding/seed roster. */
export const WA_SEED_POSITION_TYPES = [
  'ceo_director',
  'principal',
  'teacher_elem',
  'teacher_ms',
  'sped_teacher',
  'office_mgr',
  'paraeducator',
] as const

/** Resolve a position type's default salary from the single source of truth
 *  (COMMISSION_POSITIONS). Returns 0 only if the type is absent from the catalog,
 *  which would be a catalog bug the guardrail test catches. */
export function waSeedSalary(positionType: string): number {
  return getCommissionPosition(positionType)?.salary ?? 0
}

export interface SeedPosition {
  positionType: string
  title: string
  category: 'admin' | 'certificated' | 'classified'
  classification: string
  salary: number
  benchmarkSalary: number
  driver: string
  studentsPerPosition: number
  fixedFte: number | null
}

/** Default seed roster used by /api/staffing/seed (6 position types x 5 years).
 *  salary and benchmarkSalary both resolve to the catalog value so a seeded
 *  school starts at benchmark, not below it. */
export const SEED_POSITIONS: SeedPosition[] = [
  { positionType: 'ceo_director', title: 'CEO/Executive Director', category: 'admin', classification: 'Administrative', salary: waSeedSalary('ceo_director'), benchmarkSalary: waSeedSalary('ceo_director'), driver: 'fixed', studentsPerPosition: 0, fixedFte: 1 },
  { positionType: 'principal', title: 'Principal/Head of School', category: 'admin', classification: 'Administrative', salary: waSeedSalary('principal'), benchmarkSalary: waSeedSalary('principal'), driver: 'fixed', studentsPerPosition: 0, fixedFte: 1 },
  { positionType: 'teacher_elem', title: 'Classroom Teacher - Elementary', category: 'certificated', classification: 'Certificated', salary: waSeedSalary('teacher_elem'), benchmarkSalary: waSeedSalary('teacher_elem'), driver: 'per_pupil', studentsPerPosition: 24, fixedFte: null },
  { positionType: 'sped_teacher', title: 'Special Education (SPED) Teacher', category: 'certificated', classification: 'Certificated', salary: waSeedSalary('sped_teacher'), benchmarkSalary: waSeedSalary('sped_teacher'), driver: 'fixed', studentsPerPosition: 12, fixedFte: 1 },
  { positionType: 'office_mgr', title: 'Administrative Assistant/Office Manager', category: 'classified', classification: 'Classified', salary: waSeedSalary('office_mgr'), benchmarkSalary: waSeedSalary('office_mgr'), driver: 'fixed', studentsPerPosition: 0, fixedFte: 1 },
  { positionType: 'paraeducator', title: 'Instructional Aides/Paraeducators', category: 'classified', classification: 'Classified', salary: waSeedSalary('paraeducator'), benchmarkSalary: waSeedSalary('paraeducator'), driver: 'per_pupil', studentsPerPosition: 48, fixedFte: null },
]

/** Tooltip copy shown next to salary inputs. ASCII only. */
export const SALARY_SOURCE_NOTE = 'Default from BLS WA / OSPI S-275 - verify against your local market.'
