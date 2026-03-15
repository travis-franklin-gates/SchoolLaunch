'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useScenario } from '@/lib/ScenarioContext'
import { calcBenefits } from '@/lib/calculations'
import { createClient } from '@/lib/supabase/client'
import { COMMISSION_POSITIONS, getCommissionPosition } from '@/lib/types'
import { expansionToEnrollmentArray } from '@/lib/gradeExpansion'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtFte(n: number) {
  return n % 1 === 0 ? n.toString() : n.toFixed(1)
}

// ─── Authoritative classification mapping by position type ────────────────────
// These override whatever is stored in the DB or in COMMISSION_POSITIONS.

const POSITION_CLASSIFICATION: Record<string, 'Administrative' | 'Certificated' | 'Classified'> = {
  // Administrative
  ceo_director: 'Administrative',
  principal: 'Administrative',
  asst_principal: 'Administrative',
  coo: 'Administrative',
  cfo: 'Administrative',
  nutrition_mgr: 'Administrative',
  facilities_mgr: 'Administrative',
  // Certificated
  teacher_elem: 'Certificated',
  teacher_ms: 'Certificated',
  teacher_hs: 'Certificated',
  sped_teacher: 'Certificated',
  el_specialist: 'Certificated',
  instructional_coach: 'Certificated',
  interventionist: 'Certificated',
  counselor: 'Certificated',
  psychologist: 'Certificated',
  substitute_pool: 'Certificated',
  // Classified
  paraeducator: 'Classified',
  registrar: 'Classified',
  office_mgr: 'Classified',
  it_coordinator: 'Classified',
  custodian: 'Classified',
  food_service: 'Classified',
  security: 'Classified',
  transport_coord: 'Classified',
  hr_specialist: 'Classified',
  // Fallback
  custom: 'Classified',
}

// ─── Authoritative driver mapping by position type ────────────────────────────

const POSITION_DRIVER: Record<string, string> = {
  // Fixed
  ceo_director: 'fixed',
  principal: 'fixed',
  asst_principal: 'fixed',
  coo: 'fixed',
  cfo: 'fixed',
  office_mgr: 'fixed',
  counselor: 'fixed',
  psychologist: 'fixed',
  nutrition_mgr: 'fixed',
  facilities_mgr: 'fixed',
  it_coordinator: 'fixed',
  security: 'fixed',
  transport_coord: 'fixed',
  hr_specialist: 'fixed',
  registrar: 'fixed',
  // Per Pupil
  teacher_elem: 'per_pupil',
  teacher_ms: 'per_pupil',
  teacher_hs: 'per_pupil',
  instructional_coach: 'per_pupil',
  interventionist: 'per_pupil',
  paraeducator: 'per_pupil',
  custodian: 'per_pupil',
  food_service: 'per_pupil',
  substitute_pool: 'per_pupil',
  // Per Pupil - SPED
  sped_teacher: 'per_pupil_sped',
  // Per Pupil - EL
  el_specialist: 'per_pupil_el',
  // Fallback
  custom: 'fixed',
}

// ─── Students per position (for FTE auto-scaling) ─────────────────────────────

const POSITION_STUDENTS_PER: Record<string, number> = {
  teacher_elem: 24,
  teacher_ms: 24,
  teacher_hs: 24,
  sped_teacher: 12,
  el_specialist: 30,
  instructional_coach: 200,
  interventionist: 50,
  paraeducator: 48,
  custodian: 200,
  food_service: 100,
  substitute_pool: 200,
  asst_principal: 300,
}

function getClassification(positionType: string): 'Administrative' | 'Certificated' | 'Classified' {
  return POSITION_CLASSIFICATION[positionType] || 'Classified'
}

function getDriver(positionType: string): string {
  return POSITION_DRIVER[positionType] || 'fixed'
}

function getStudentsPerPosition(positionType: string): number {
  return POSITION_STUDENTS_PER[positionType] || 0
}

function classificationToCategory(cls: string): 'certificated' | 'classified' | 'admin' {
  if (cls === 'Administrative') return 'admin'
  if (cls === 'Certificated') return 'certificated'
  return 'classified'
}

// ─── Position type grouping for dropdown ──────────────────────────────────────

const ADMIN_TYPES = COMMISSION_POSITIONS.filter((cp) => getClassification(cp.type) === 'Administrative')
const CERT_TYPES = COMMISSION_POSITIONS.filter((cp) => getClassification(cp.type) === 'Certificated')
const CLASS_TYPES = COMMISSION_POSITIONS.filter((cp) => getClassification(cp.type) === 'Classified')

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MultiYearPosition {
  id: string
  positionType: string
  title: string
  classification: 'Administrative' | 'Certificated' | 'Classified'
  category: 'certificated' | 'classified' | 'admin'
  salary: number
  benchmarkSalary: number
  driver: string
  studentsPerPosition: number
  fte: [number, number, number, number, number]
}

let nextId = 0
function tempId() { return `new-${++nextId}` }

function inferPositionType(title: string): string {
  const t = title.toLowerCase().trim()
  if (/\bceo\b/.test(t) || /\bexecutive director\b/.test(t)) return 'ceo_director'
  if (/\bassistant principal\b/.test(t) || /\bvice principal\b/.test(t) || /\bap\b/.test(t)) return 'asst_principal'
  if (/\bprincipal\b/.test(t) || /\bhead of school\b/.test(t)) return 'principal'
  if (/\bregistrar\b/.test(t) || /\benrollment manager\b/.test(t)) return 'registrar'
  if (/\bcoo\b/.test(t) || /\boperations manager\b/.test(t)) return 'coo'
  if (/\bcfo\b/.test(t) || /\bfinance\b/.test(t) || /\bbusiness manager\b/.test(t)) return 'cfo'
  if (/\bit coordinator\b/.test(t)) return 'it_coordinator'
  if (/\bfacilities manager\b/.test(t)) return 'facilities_mgr'
  if (/\bnutrition\b/.test(t)) return 'nutrition_mgr'
  if (/\bspecial ed\b/.test(t) || /\bsped\b/.test(t)) return 'sped_teacher'
  if (/\bell teacher\b/.test(t) || /\bell specialist\b/.test(t) || /\benglish learner\b/.test(t)) return 'el_specialist'
  if (/\binstructional coach\b/.test(t) || /\bcurriculum\b/.test(t)) return 'instructional_coach'
  if (/\bintervention\b/.test(t)) return 'interventionist'
  if (/\bsubstitute\b/.test(t)) return 'substitute_pool'
  if (/\bsubject teacher\b/.test(t)) return 'teacher_ms'
  if (/\bteacher\b/.test(t)) return 'teacher_elem'
  if (/\bparaeducator\b/.test(t) || /\bpara\b/.test(t) || /\binstructional aide\b/.test(t)) return 'paraeducator'
  if (/\bcounselor\b/.test(t)) return 'counselor'
  if (/\bpsychologist\b/.test(t)) return 'psychologist'
  if (/\boffice manager\b/.test(t) || /\badministrative assistant\b/.test(t)) return 'office_mgr'
  if (/\bhuman resources\b/.test(t) || /\bhr\b/.test(t)) return 'hr_specialist'
  if (/\bcustodian\b/.test(t) || /\bjanitor\b/.test(t)) return 'custodian'
  if (/\bsecurity\b/.test(t) || /\bsafety\b/.test(t)) return 'security'
  if (/\bfood service\b/.test(t)) return 'food_service'
  if (/\btransportation\b/.test(t)) return 'transport_coord'
  return 'custom'
}

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string }> = {
  Administrative: { bg: 'bg-purple-50', text: 'text-purple-700' },
  Certificated: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Classified: { bg: 'bg-slate-100', text: 'text-slate-600' },
}

const DRIVER_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  per_pupil: 'Per Pupil',
  per_pupil_sped: 'Per Pupil (SPED)',
  per_pupil_el: 'Per Pupil (EL)',
}

const TEACHER_TYPES = new Set(['teacher_elem', 'teacher_ms', 'teacher_hs'])

/** Is this a classroom teacher position whose FTE should match sections? */
function isTeacherType(positionType: string): boolean {
  return TEACHER_TYPES.has(positionType)
}

/** Compute smart default FTE for years 2-5 based on driver and enrollment growth.
 *  For teacher positions, uses sections-per-year from the grade expansion plan.
 *  For other per-pupil positions, scales proportionally with enrollment ratio. */
function computeSmartFte(
  y1Fte: number,
  driver: string,
  positionType: string,
  enrollments: number[],
  sectionsPerYear: number[],
): [number, number, number, number, number] {
  const fte: [number, number, number, number, number] = [y1Fte, y1Fte, y1Fte, y1Fte, y1Fte]
  if (driver === 'fixed' || enrollments[0] <= 0) return fte

  // Teacher positions: Y2-Y5 FTE = sections for that year, Y1 stays as provided
  if (isTeacherType(positionType) && sectionsPerYear[0] > 0) {
    fte[0] = y1Fte
    for (let y = 1; y < 5; y++) {
      const sections = sectionsPerYear[y] || sectionsPerYear[y - 1] || y1Fte
      // If user overrode Y1 relative to sections, scale proportionally
      const y1Sections = sectionsPerYear[0]
      if (y1Fte !== y1Sections && y1Sections > 0) {
        fte[y] = Math.round((y1Fte / y1Sections) * sections * 2) / 2
      } else {
        fte[y] = sections
      }
    }
    return fte
  }

  // Other per-pupil positions: scale proportionally with enrollment ratio from Y1
  for (let y = 1; y < 5; y++) {
    if (enrollments[y] <= 0) continue
    const ratio = enrollments[y] / enrollments[0]
    fte[y] = Math.round(y1Fte * ratio * 2) / 2
    if (fte[y] < y1Fte) fte[y] = y1Fte
  }
  return fte
}

/** Recalculate Y2-Y5 based on a new Y1 FTE value for a per-pupil position */
function recomputePerPupilFte(
  newY1: number,
  driver: string,
  positionType: string,
  enrollments: number[],
  sectionsPerYear: number[],
): [number, number, number, number, number] {
  return computeSmartFte(newY1, driver, positionType, enrollments, sectionsPerYear)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffingPage() {
  const {
    schoolData: { schoolId, positions: dbPositions, allPositions: dbAllPositions, projections, gradeExpansionPlan, profile, loading, reload },
    assumptions,
    isModified,
  } = useScenario()
  const [positions, setPositions] = useState<MultiYearPosition[]>([])
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const seedingRef = useRef(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const supabase = createClient()
  const benefitsRate = assumptions.benefits_load_pct / 100
  const salaryEscalator = assumptions.salary_escalator_pct / 100

  // Compute per-year enrollment from grade expansion plan
  const enrollments = useMemo(() => {
    if (gradeExpansionPlan.length > 0) {
      return expansionToEnrollmentArray(gradeExpansionPlan, profile.retention_rate ?? 90)
    }
    return [
      profile.target_enrollment_y1,
      profile.target_enrollment_y2 || profile.target_enrollment_y1,
      profile.target_enrollment_y3 || profile.target_enrollment_y1,
      profile.target_enrollment_y4 || profile.target_enrollment_y1,
      profile.target_enrollment_y5 || profile.target_enrollment_y1,
    ]
  }, [gradeExpansionPlan, profile])

  // Compute total sections per year from grade expansion plan
  const sectionsPerYear = useMemo(() => {
    const result = [0, 0, 0, 0, 0]
    if (gradeExpansionPlan.length === 0) return result
    for (const entry of gradeExpansionPlan) {
      if (entry.year >= 1 && entry.year <= 5) {
        result[entry.year - 1] += entry.sections
      }
    }
    // Fill forward if plan doesn't cover all 5 years
    for (let i = 1; i < 5; i++) {
      if (result[i] === 0 && result[i - 1] > 0) result[i] = result[i - 1]
    }
    return result
  }, [gradeExpansionPlan])

  // Total revenue for Year 1 (for personnel % badge)
  const y1Revenue = projections.filter((p) => p.is_revenue).reduce((s, p) => s + p.amount, 0)

  // Server-side seed: call API endpoint that atomically checks + inserts
  const ensureSeeded = useCallback(async () => {
    if (!schoolId || seedingRef.current) return
    seedingRef.current = true
    setSeeding(true)

    try {
      const res = await fetch('/api/staffing/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.seeded) {
          await reload()
        }
      }
    } catch (err) {
      console.error('Seed check failed:', err)
    }

    setSeeding(false)
  }, [schoolId, reload])

  useEffect(() => {
    // No positions loaded from the hook — ask the server to seed if needed
    if (dbPositions.length === 0 && dbAllPositions.length === 0) {
      if (schoolId && !seedingRef.current) ensureSeeded()
      return
    }

    const y1Positions = dbAllPositions.filter((p) => p.year === 1)
    const source = y1Positions.length > 0 ? y1Positions : dbPositions

    const result: MultiYearPosition[] = source.map((p) => {
      const posType = (p.position_type && p.position_type !== 'custom') ? p.position_type : inferPositionType(p.title)
      const cp = getCommissionPosition(posType)

      const classification = getClassification(posType)
      const driver = getDriver(posType)
      const studentsPerPos = getStudentsPerPosition(posType)

      const fte: [number, number, number, number, number] = [0, 0, 0, 0, 0]
      fte[0] = p.fte

      const hasMultiYear = dbAllPositions.some((ap) => ap.year > 1)

      if (hasMultiYear) {
        for (let y = 2; y <= 5; y++) {
          const match = dbAllPositions.find(
            (ap) => ap.year === y && (ap.position_type === posType || ap.title === p.title)
          )
          fte[y - 1] = match?.fte ?? fte[0]
        }
      } else {
        const smartFte = computeSmartFte(p.fte, driver, posType, enrollments, sectionsPerYear)
        for (let y = 1; y < 5; y++) fte[y] = smartFte[y]
      }

      return {
        id: p.id || tempId(),
        positionType: posType,
        title: p.title,
        classification,
        category: classificationToCategory(classification),
        salary: p.annual_salary,
        benchmarkSalary: p.benchmark_salary || cp?.salary || 0,
        driver,
        studentsPerPosition: studentsPerPos,
        fte,
      }
    })

    setPositions(result)
  }, [dbPositions, dbAllPositions, enrollments, sectionsPerYear, schoolId])

  function salaryForYear(baseSalary: number, year: number) {
    return Math.round(baseSalary * Math.pow(1 + salaryEscalator, year - 1))
  }

  // Compute per-year totals
  const yearTotals = useMemo(() => {
    return [0, 1, 2, 3, 4].map((yi) => {
      const year = yi + 1
      let totalFte = 0
      let totalSalaries = 0
      let totalBenefits = 0
      let certFte = 0
      let classFte = 0
      let adminFte = 0

      for (const pos of positions) {
        const fte = pos.fte[yi]
        const sal = salaryForYear(pos.salary, year) * fte
        totalFte += fte
        totalSalaries += sal
        totalBenefits += calcBenefits(sal, benefitsRate)
        if (pos.classification === 'Certificated') certFte += fte
        else if (pos.classification === 'Classified') classFte += fte
        else adminFte += fte
      }

      const totalPersonnel = totalSalaries + totalBenefits
      return { totalFte, totalSalaries, totalBenefits, totalPersonnel, certFte, classFte, adminFte }
    })
  }, [positions, benefitsRate, salaryEscalator])

  const y1Totals = yearTotals[0]
  const personnelPctY1 = y1Revenue > 0 ? (y1Totals.totalPersonnel / y1Revenue * 100).toFixed(1) : '0'

  function updateFte(id: string, yearIndex: number, value: number) {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        // If Y1 FTE changed and position is per-pupil, recalculate Y2-Y5
        if (yearIndex === 0 && p.driver !== 'fixed') {
          return { ...p, fte: recomputePerPupilFte(value, p.driver, p.positionType, enrollments, sectionsPerYear) }
        }
        // Otherwise just update the single year (manual override)
        const fte = [...p.fte] as [number, number, number, number, number]
        fte[yearIndex] = value
        return { ...p, fte }
      })
    )
  }

  function selectPositionType(id: string, type: string) {
    const cp = getCommissionPosition(type)
    if (!cp) return

    // Derive classification and driver from the authoritative maps
    const classification = getClassification(type)
    const driver = getDriver(type)
    const studentsPerPos = getStudentsPerPosition(type)

    setPositions((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const newFte = computeSmartFte(p.fte[0] || 1, driver, type, enrollments, sectionsPerYear)
        return {
          ...p,
          positionType: type,
          title: type === 'custom' ? p.title : cp.name,
          classification,
          category: classificationToCategory(classification),
          benchmarkSalary: cp.salary,
          salary: cp.salary > 0 ? cp.salary : p.salary,
          driver,
          studentsPerPosition: studentsPerPos,
          fte: newFte,
        }
      })
    )
  }

  function updateSalary(id: string, value: number) {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, salary: value } : p))
    )
  }

  function updateTitle(id: string, value: string) {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: value } : p))
    )
  }

  function addPosition() {
    const fte = computeSmartFte(1, 'fixed', 'custom', enrollments, sectionsPerYear)
    setPositions((prev) => [
      ...prev,
      {
        id: tempId(),
        positionType: 'custom',
        title: 'New Position',
        classification: 'Classified',
        category: 'classified',
        salary: 45000,
        benchmarkSalary: 0,
        driver: 'fixed',
        studentsPerPosition: 0,
        fte,
      },
    ])
  }

  function removePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id))
  }

  async function save() {
    if (!schoolId) return
    setSaving(true)
    setToast(null)

    const { error: delError } = await supabase
      .from('staffing_positions')
      .delete()
      .eq('school_id', schoolId)

    if (delError) {
      console.error('Delete staffing failed:', delError)
      setSaving(false)
      setToast({ type: 'error', message: `Failed to save: ${delError.message}` })
      return
    }

    const rows: Array<{
      school_id: string
      year: number
      title: string
      category: string
      fte: number
      annual_salary: number
      position_type: string
      driver: string
      classification: string
      benchmark_salary: number
      students_per_position: number
    }> = []

    for (const pos of positions) {
      for (let y = 1; y <= 5; y++) {
        rows.push({
          school_id: schoolId,
          year: y,
          title: pos.title,
          category: pos.category,
          fte: pos.fte[y - 1],
          annual_salary: salaryForYear(pos.salary, y),
          position_type: pos.positionType,
          driver: pos.driver,
          classification: pos.classification,
          benchmark_salary: pos.benchmarkSalary,
          students_per_position: pos.studentsPerPosition,
        })
      }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('staffing_positions').insert(rows)
      if (insertError) {
        console.error('Insert staffing failed:', insertError)
        setSaving(false)
        setToast({ type: 'error', message: `Failed to save positions: ${insertError.message}` })
        return
      }
    }

    const { error: projError } = await supabase.from('budget_projections')
      .update({ amount: y1Totals.totalPersonnel })
      .eq('school_id', schoolId)
      .eq('year', 1)
      .eq('subcategory', 'Total Personnel')

    if (projError) {
      console.error('Update personnel projection failed:', projError)
    }

    setSaving(false)
    setToast({ type: 'success', message: 'Staffing changes saved successfully.' })
    await reload()
    setTimeout(() => setToast(null), 3000)
  }

  if (loading || seeding) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">{seeding ? 'Setting up default positions...' : 'Loading...'}</p></div>
  }

  // Group positions by classification for display
  const adminPositions = positions.filter((p) => p.classification === 'Administrative')
  const certPositions = positions.filter((p) => p.classification === 'Certificated')
  const classifiedPositions = positions.filter((p) => p.classification === 'Classified')

  const groups = [
    { label: 'Administrative', positions: adminPositions, color: CLASSIFICATION_COLORS.Administrative },
    { label: 'Certificated', positions: certPositions, color: CLASSIFICATION_COLORS.Certificated },
    { label: 'Classified', positions: classifiedPositions, color: CLASSIFICATION_COLORS.Classified },
  ]

  return (
    <div className="animate-fade-in">
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium animate-slide-in-right ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.message}
        </div>
      )}

      {isModified && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
          Scenario active — showing base case staffing. Adjust positions here to update the base case budget.
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold text-slate-900">Staffing Plan</h1>
          <p className="text-sm text-slate-500 mt-1">Multi-year staffing projection — Commission V8 template format.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
            Number(personnelPctY1) < 72 ? 'bg-red-50 text-red-700' :
            Number(personnelPctY1) <= 78 ? 'bg-emerald-50 text-emerald-700' :
            Number(personnelPctY1) <= 80 ? 'bg-amber-50 text-amber-700' :
            'bg-red-50 text-red-700'
          }`}>
            Personnel: {personnelPctY1}% of Revenue
            <span className="text-[10px] opacity-70 ml-1">(Y1)</span>
          </div>
        </div>
      </div>

      {/* Enrollment context row */}
      <div className="mb-4 flex items-center gap-6 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Enrollment:</span>
        {enrollments.map((e, i) => (
          <span key={i}>Y{i + 1}: <span className="font-semibold text-slate-700">{e}</span></span>
        ))}
        {salaryEscalator > 0 && (
          <span className="ml-auto">Salary escalator: {(salaryEscalator * 100).toFixed(1)}%/yr</span>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
        <div className="overflow-x-auto">
          <table className="sl-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-3 min-w-[220px]">Position</th>
                <th className="text-left px-2 py-3 w-[100px]">Classification</th>
                <th className="text-left px-2 py-3 w-[80px]">Driver</th>
                <th className="text-right px-2 py-3 w-[100px]">Salary (Y1)</th>
                {[1, 2, 3, 4, 5].map((y) => (
                  <th key={y} className="text-right px-2 py-3 w-[70px]">Y{y} FTE</th>
                ))}
                <th className="px-2 py-3 w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                if (group.positions.length === 0) return null
                return (
                  <GroupSection
                    key={group.label}
                    label={group.label}
                    color={group.color}
                    positions={group.positions}
                    onSelectType={selectPositionType}
                    onUpdateFte={updateFte}
                    onUpdateSalary={updateSalary}
                    onUpdateTitle={updateTitle}
                    onRemove={removePosition}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td className="px-3 py-2 font-semibold text-slate-700" colSpan={3}>Total FTE</td>
                <td className="px-2 py-2"></td>
                {yearTotals.map((yt, i) => (
                  <td key={i} className="text-right px-2 py-2 font-semibold text-slate-800">{fmtFte(yt.totalFte)}</td>
                ))}
                <td></td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-3 py-2 text-slate-600 font-medium" colSpan={3}>Total Salaries</td>
                <td className="px-2 py-2"></td>
                {yearTotals.map((yt, i) => (
                  <td key={i} className="text-right px-2 py-2 font-medium text-slate-700 text-xs">{fmt(yt.totalSalaries)}</td>
                ))}
                <td></td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-3 py-2 text-slate-600 font-medium" colSpan={3}>
                  Benefits ({assumptions.benefits_load_pct}%)
                </td>
                <td className="px-2 py-2"></td>
                {yearTotals.map((yt, i) => (
                  <td key={i} className="text-right px-2 py-2 font-medium text-slate-700 text-xs">{fmt(yt.totalBenefits)}</td>
                ))}
                <td></td>
              </tr>
              <tr className="bg-slate-100 border-t border-slate-300">
                <td className="px-3 py-3 font-bold text-slate-800" colSpan={3}>Total Personnel Cost</td>
                <td className="px-2 py-3"></td>
                {yearTotals.map((yt, i) => (
                  <td key={i} className="text-right px-2 py-3 font-bold text-slate-800 text-xs">{fmt(yt.totalPersonnel)}</td>
                ))}
                <td></td>
              </tr>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <td className="px-3 py-2" colSpan={4}>
                  Staff: {fmtFte(y1Totals.adminFte)} Admin / {fmtFte(y1Totals.certFte)} Cert / {fmtFte(y1Totals.classFte)} Class (Y1)
                </td>
                {yearTotals.map((yt, i) => (
                  <td key={i} className="text-right px-2 py-2">
                    {fmtFte(yt.adminFte)}/{fmtFte(yt.certFte)}/{fmtFte(yt.classFte)}
                  </td>
                ))}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={addPosition}
          className="px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
        >
          + Add Position
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

/* --- Group Section --- */

function GroupSection({
  label,
  color,
  positions,
  onSelectType,
  onUpdateFte,
  onUpdateSalary,
  onUpdateTitle,
  onRemove,
}: {
  label: string
  color: { bg: string; text: string }
  positions: MultiYearPosition[]
  onSelectType: (id: string, type: string) => void
  onUpdateFte: (id: string, yearIndex: number, value: number) => void
  onUpdateSalary: (id: string, value: number) => void
  onUpdateTitle: (id: string, value: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <>
      <tr className="bg-slate-50/70">
        <td colSpan={10} className="px-3 py-1.5">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color.bg} ${color.text}`}>
            {label}
          </span>
        </td>
      </tr>
      {positions.map((pos) => (
        <PositionRow
          key={pos.id}
          pos={pos}
          onSelectType={onSelectType}
          onUpdateFte={onUpdateFte}
          onUpdateSalary={onUpdateSalary}
          onUpdateTitle={onUpdateTitle}
          onRemove={onRemove}
        />
      ))}
    </>
  )
}

/* --- Position Row --- */

function PositionRow({
  pos,
  onSelectType,
  onUpdateFte,
  onUpdateSalary,
  onUpdateTitle,
  onRemove,
}: {
  pos: MultiYearPosition
  onSelectType: (id: string, type: string) => void
  onUpdateFte: (id: string, yearIndex: number, value: number) => void
  onUpdateSalary: (id: string, value: number) => void
  onUpdateTitle: (id: string, value: string) => void
  onRemove: (id: string) => void
}) {
  const driverLabel = DRIVER_LABELS[pos.driver] || pos.driver.replace(/_/g, ' ')
  const clsColor = CLASSIFICATION_COLORS[pos.classification] || CLASSIFICATION_COLORS.Classified

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="px-3 py-1.5">
        <select
          value={pos.positionType}
          onChange={(e) => onSelectType(pos.id, e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
        >
          <optgroup label="Administrative">
            {ADMIN_TYPES.map(cp => (
              <option key={cp.type} value={cp.type}>{cp.name}</option>
            ))}
          </optgroup>
          <optgroup label="Certificated">
            {CERT_TYPES.map(cp => (
              <option key={cp.type} value={cp.type}>{cp.name}</option>
            ))}
          </optgroup>
          <optgroup label="Classified">
            {CLASS_TYPES.map(cp => (
              <option key={cp.type} value={cp.type}>{cp.name}</option>
            ))}
          </optgroup>
        </select>
        {pos.positionType === 'custom' && (
          <input
            value={pos.title}
            onChange={(e) => onUpdateTitle(pos.id, e.target.value)}
            className="w-full border border-slate-200 rounded px-2 py-1 text-sm mt-1"
            placeholder="Custom position name"
          />
        )}
      </td>
      <td className="px-2 py-1.5">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${clsColor.bg} ${clsColor.text}`}>
          {pos.classification}
        </span>
      </td>
      <td className="px-2 py-1.5">
        <span className="text-[10px] text-slate-500">{driverLabel}</span>
      </td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          step={1000}
          value={pos.salary}
          onChange={(e) => onUpdateSalary(pos.id, Number(e.target.value))}
          className="w-24 text-right border border-slate-200 rounded px-2 py-1 text-sm"
        />
        {pos.benchmarkSalary > 0 && (
          <div className="text-[9px] text-slate-400 text-right mt-0.5">BM: {fmt(pos.benchmarkSalary)}</div>
        )}
      </td>
      {[0, 1, 2, 3, 4].map((yi) => (
        <td key={yi} className="px-2 py-1.5">
          <input
            type="number"
            step={0.5}
            min={0}
            value={pos.fte[yi]}
            onChange={(e) => onUpdateFte(pos.id, yi, Number(e.target.value))}
            className="w-14 text-right border border-slate-200 rounded px-1.5 py-1 text-sm"
          />
        </td>
      ))}
      <td className="px-2 py-1.5">
        <button
          onClick={() => onRemove(pos.id)}
          className="text-red-400 hover:text-red-600 text-xs"
        >
          &times;
        </button>
      </td>
    </tr>
  )
}
