import type { FinancialAssumptions, SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry } from './types'
import { getAssumptions } from './types'
import { calcCommissionRevenue, calcAAFTE } from './calculations'
import { computeExpansionEnrollments, expansionToEnrollmentArray } from './gradeExpansion'
import type { MultiYearDetailedRow, FPFScorecard } from './budgetEngine'

export function buildSchoolContextString(
  schoolName: string,
  profile: SchoolProfile,
  positions: StaffingPosition[],
  projections: BudgetProjection[],
  gradeExpansionPlan?: GradeExpansionEntry[],
  multiYear?: MultiYearDetailedRow[],
  scorecard?: FPFScorecard,
): string {
  const assumptions = getAssumptions(profile.financial_assumptions)
  const enroll = profile.target_enrollment_y1
  const benefitsMultiplier = 1 + assumptions.benefits_load_pct / 100

  const rev = calcCommissionRevenue(enroll, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions)
  const aafte = calcAAFTE(enroll, assumptions.aafte_pct)
  const totalRevenue = rev.total

  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const totalPersonnel = positions.reduce(
    (s, p) => s + Math.round(p.annual_salary * p.fte * benefitsMultiplier),
    0
  )

  const opsProjections = projections.filter((p) => !p.is_revenue && p.category === 'Operations')
  const totalOperations = opsProjections.reduce((s, p) => s + p.amount, 0)
  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = totalRevenue - totalExpenses
  const dailyCost = totalExpenses > 0 ? totalExpenses / 365 : 1
  const reserveDays = Math.round(netPosition / dailyCost)
  const personnelPct = totalRevenue > 0 ? ((totalPersonnel / totalRevenue) * 100).toFixed(1) : '0'
  const revenuePerStudent = enroll > 0 ? totalRevenue / enroll : 0
  const breakEvenEnrollment = revenuePerStudent > 0 ? Math.ceil(totalExpenses / revenuePerStudent) : 0
  const facilityCost = opsProjections.find((p) => p.subcategory === 'Facilities')?.amount || 0
  const facilityPct = totalRevenue > 0 ? ((facilityCost / totalRevenue) * 100).toFixed(1) : '0'

  const teacherCount = positions.filter((p) => p.category === 'certificated' && /teacher/i.test(p.title)).reduce((s, p) => s + p.fte, 0)
  const studentTeacherRatio = teacherCount > 0 ? Math.round(enroll / teacherCount) : 0

  const staffingList = positions.length > 0
    ? positions.map((p) => {
        const cost = Math.round(p.annual_salary * p.fte * benefitsMultiplier)
        return `- ${p.title}: ${p.fte} FTE, $${p.annual_salary.toLocaleString()} salary, ${p.category}, total cost with benefits: $${cost.toLocaleString()}`
      }).join('\n')
    : 'No positions entered'

  const opsBreakdown = opsProjections.length > 0
    ? opsProjections.map((p) => `- ${p.subcategory}: $${p.amount.toLocaleString()}`).join('\n')
    : 'No operations expenses entered'

  const hasExpansion = gradeExpansionPlan && gradeExpansionPlan.length > 0
  const retRate = profile.retention_rate ?? 90

  let enrollmentSection: string
  if (hasExpansion) {
    const expansionEnrollments = computeExpansionEnrollments(gradeExpansionPlan!, retRate)
    const arr = expansionToEnrollmentArray(gradeExpansionPlan!, retRate)
    const expansionLines = expansionEnrollments.map((e) => {
      const newGradeStr = e.newGrades.length > 0 ? ` (adding grades: ${e.newGrades.join(', ')})` : ''
      return `- Year ${e.year}: ${e.total} students [grades: ${e.grades.join(', ')}] (returning: ${e.returning}, new grade: ${e.newGrade})${newGradeStr}`
    }).join('\n')
    enrollmentSection = `ENROLLMENT (Grade Expansion Model, ${retRate}% retention):
${expansionLines}
- Growth model: Cohort-based grade expansion (adding new grade levels each year)
- Opening grades: ${profile.opening_grades?.join(', ') || 'not set'}
- Buildout grades: ${profile.buildout_grades?.join(', ') || 'not set'}
- Retention rate: ${retRate}%`
  } else {
    enrollmentSection = `ENROLLMENT:
- Year 1: ${enroll} students
- Year 2: ${profile.target_enrollment_y2} students
- Year 3: ${profile.target_enrollment_y3} students
- Year 4: ${profile.target_enrollment_y4} students
- Year 5: ${profile.target_enrollment_y5 || profile.target_enrollment_y4} students
- Growth Y1→Y2: ${enroll > 0 ? (((profile.target_enrollment_y2 - enroll) / enroll) * 100).toFixed(0) : 0}%
- Growth Y2→Y3: ${profile.target_enrollment_y2 > 0 ? (((profile.target_enrollment_y3 - profile.target_enrollment_y2) / profile.target_enrollment_y2) * 100).toFixed(0) : 0}%`
  }

  return `School: ${schoolName}
Grade configuration: ${profile.grade_config}
Region: ${profile.region}
Planned opening year: ${profile.planned_open_year}
Max class size: ${profile.max_class_size}

${enrollmentSection}

DEMOGRAPHICS:
- Free/Reduced Lunch: ${profile.pct_frl}%
- IEP: ${profile.pct_iep}%
- ELL: ${profile.pct_ell}%
- Highly Capable: ${profile.pct_hicap}%

REVENUE (Year 1, AAFTE: ${aafte} of ${enroll} headcount):
- Regular Ed Apportionment: $${rev.regularEd.toLocaleString()} (${aafte} AAFTE × $${assumptions.regular_ed_per_pupil.toLocaleString()})
- SPED Apportionment: $${rev.sped.toLocaleString()} (${aafte} × ${profile.pct_iep}% IEP × $${assumptions.sped_per_pupil.toLocaleString()})
- Facilities Revenue: $${rev.facilitiesRev.toLocaleString()}
- Levy Equity: $${rev.levyEquity.toLocaleString()} (${aafte} AAFTE × $${assumptions.levy_equity_per_student.toLocaleString()})
- Title I: $${rev.titleI.toLocaleString()}${profile.pct_frl >= 40 ? ' (Schoolwide eligible)' : ' (Not eligible, FRL < 40%)'}
- IDEA: $${rev.idea.toLocaleString()}
- LAP: $${rev.lap.toLocaleString()}
- TBIP: $${rev.tbip.toLocaleString()}
- HiCap: $${rev.hicap.toLocaleString()}
- Total Revenue: $${totalRevenue.toLocaleString()}

STAFFING (Year 1):
${staffingList}
Total FTE: ${totalFte}, Total Personnel Cost: $${totalPersonnel.toLocaleString()}
Student-to-teacher ratio: ${studentTeacherRatio}:1

OPERATIONS (Year 1):
${opsBreakdown}
Total Operations: $${totalOperations.toLocaleString()}

KEY METRICS:
- Net Position: $${netPosition.toLocaleString()}
- Reserve Days: ${reserveDays}
- Personnel % of Revenue: ${personnelPct}%
- Break-Even Enrollment: ${breakEvenEnrollment} students (target: ${enroll})
- Facility % of Revenue: ${facilityPct}%${multiYear && multiYear.length > 0 ? `

MULTI-YEAR SUMMARY (Years 1-${multiYear.length}):
${multiYear.map((r) => `- Year ${r.year}: Revenue $${r.revenue.total.toLocaleString()}, Expenses $${r.totalExpenses.toLocaleString()}, Net $${r.net.toLocaleString()}, Cumulative $${r.cumulativeNet.toLocaleString()}, ${r.reserveDays} days cash`).join('\n')}` : ''}${scorecard ? `

FPF SCORECARD (Commission Financial Performance Framework):
${scorecard.measures.map((m) => `- ${m.name}: ${m.values.map((v, i) => `Y${i + 1}=${v === null ? 'N/A' : v}`).join(', ')} | Stage 1: ${m.stage1Target}, Stage 2: ${m.stage2Target} | Status: ${m.statuses.join(', ')}`).join('\n')}
Overall: ${scorecard.overallStatus} — ${scorecard.overallMessage}` : ''}`
}
