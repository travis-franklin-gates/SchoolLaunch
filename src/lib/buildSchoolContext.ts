import type { FinancialAssumptions, SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry } from './types'
import { getAssumptions } from './types'
import { calcCommissionRevenue, calcAAFTE, calcBenefits } from './calculations'
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
  const rev = calcCommissionRevenue(enroll, profile.pct_frl, profile.pct_iep, profile.pct_ell, profile.pct_hicap, assumptions)
  const aafte = calcAAFTE(enroll, assumptions.aafte_pct)
  const hasMultiYear = multiYear && multiYear.length > 0

  // Operating revenue from calcCommissionRevenue (excludes interest & grants) — matches baseSummary
  // and dashboard tiles. Interest income is included in multiYear but excluded here for consistency.
  const operatingRevenue = rev.total
  const totalRevenue = hasMultiYear ? multiYear[0].revenue.total : rev.total
  const totalPersonnel = hasMultiYear
    ? multiYear[0].personnel.total
    : positions.reduce(
        (s, p) => {
          const cost = p.annual_salary * p.fte
          return s + cost + calcBenefits(cost, assumptions.benefits_load_pct / 100)
        },
        0
      )
  const totalOperations = hasMultiYear
    ? multiYear[0].operations.total
    : projections.filter((p) => !p.is_revenue && p.category === 'Operations').reduce((s, p) => s + p.amount, 0)

  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const opsProjections = projections.filter((p) => !p.is_revenue && p.category === 'Operations')
  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = hasMultiYear ? multiYear[0].net : totalRevenue - totalExpenses
  const dailyCost = totalExpenses > 0 ? totalExpenses / 365 : 1
  const reserveDays = Math.round(netPosition / dailyCost)
  // Personnel % uses operating revenue (excludes grants) — matches budget engine and dashboard
  const personnelPct = operatingRevenue > 0 ? ((totalPersonnel / operatingRevenue) * 100).toFixed(1) : '0'
  const revenuePerStudent = enroll > 0 ? totalRevenue / enroll : 0
  const breakEvenEnrollment = revenuePerStudent > 0 ? Math.ceil(totalExpenses / revenuePerStudent) : 0
  const facilityCost = opsProjections.find((p) => p.subcategory === 'Facilities')?.amount || 0
  const facilityPct = operatingRevenue > 0 ? ((facilityCost / operatingRevenue) * 100).toFixed(1) : '0'

  const teacherCount = positions.filter((p) => p.category === 'certificated' && /teacher/i.test(p.title)).reduce((s, p) => s + p.fte, 0)
  const studentTeacherRatio = teacherCount > 0 ? Math.round(enroll / teacherCount) : 0

  const staffingList = positions.length > 0
    ? positions.map((p) => {
        const baseCost = p.annual_salary * p.fte
        const cost = baseCost + calcBenefits(baseCost, assumptions.benefits_load_pct / 100)
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

  const regionFactor = assumptions.regionalization_factor || 1.0

  return `School: ${schoolName}
Grade configuration: ${profile.grade_config}
Region: ${profile.region}
Regionalization factor: ${regionFactor}${regionFactor !== 1.0 ? ` (multiplies state per-pupil rates: Regular Ed, SPED, LAP, TBIP, HiCap)` : ''}
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
- State Special Education: $${rev.stateSped.toLocaleString()} (${Math.round(enroll * profile.pct_iep / 100)} SPED students × $${(assumptions.state_sped_per_pupil || 13556).toLocaleString()})
- Facilities Revenue: $${rev.facilitiesRev.toLocaleString()}
- Levy Equity: $${rev.levyEquity.toLocaleString()} (${aafte} AAFTE × $${assumptions.levy_equity_per_student.toLocaleString()})
- Title I: $${rev.titleI.toLocaleString()}${profile.pct_frl >= 40 ? ' (Schoolwide eligible)' : ' (Not eligible, FRL < 40%)'}
- IDEA: $${rev.idea.toLocaleString()}
- LAP: $${rev.lap.toLocaleString()}
- LAP High Poverty: $${rev.lapHighPoverty.toLocaleString()}
- TBIP: $${rev.tbip.toLocaleString()}
- HiCap: $${rev.hicap.toLocaleString()}
- Operating Revenue (recurring, excludes grants): $${operatingRevenue.toLocaleString()}
- Total Revenue (including one-time grants): $${totalRevenue.toLocaleString()}

STAFFING (Year 1):
${staffingList}
Total FTE: ${totalFte}, Total Personnel Cost: $${totalPersonnel.toLocaleString()}
Student-to-teacher ratio: ${studentTeacherRatio}:1

OPERATIONS (Year 1):
${opsBreakdown}
Total Operations: $${totalOperations.toLocaleString()}

KEY METRICS (pre-computed by the budget engine — use these exact numbers, do not independently calculate):
- Net Position: $${(hasMultiYear ? multiYear[0].net : netPosition).toLocaleString()}
- Reserve Days (Days of Cash): ${scorecard ? (scorecard.measures.find(m => m.name === 'Days of Cash')?.values[0] ?? reserveDays) : reserveDays}
- Personnel % of Operating Revenue: ${personnelPct}% (= $${totalPersonnel.toLocaleString()} ÷ $${operatingRevenue.toLocaleString()})
- Break-Even Enrollment: ${breakEvenEnrollment} students (target: ${enroll})
- Facility % of Operating Revenue: ${facilityPct}%
NOTE: Personnel % and Facility % use Operating Revenue as the denominator (excludes one-time grants). This matches the Commission FPF evaluation methodology.${multiYear && multiYear.length > 0 ? `

MULTI-YEAR SUMMARY (Years 1-${multiYear.length}):
${multiYear.map((r, i) => {
    const daysOfCash = scorecard ? (scorecard.measures.find(m => m.name === 'Days of Cash')?.values[i] ?? r.reserveDays) : r.reserveDays
    return `- Year ${r.year}: Revenue $${r.revenue.total.toLocaleString()}, Expenses $${r.totalExpenses.toLocaleString()}, Net $${r.net.toLocaleString()}, Cumulative $${r.cumulativeNet.toLocaleString()}, ${daysOfCash} days cash`
  }).join('\n')}` : ''}${scorecard ? `

FPF SCORECARD (Commission Financial Performance Framework):
${scorecard.measures.map((m) => `- ${m.name}: ${m.values.map((v, i) => `Y${i + 1}=${v === null ? 'N/A' : v}`).join(', ')} | Stage 1: ${m.stage1Target}, Stage 2: ${m.stage2Target} | Status: ${m.statuses.join(', ')}`).join('\n')}
Overall: ${scorecard.overallStatus} — ${scorecard.overallMessage}` : ''}

IMPORTANT: Use ONLY the pre-computed financial metrics provided above. Do not independently calculate, estimate, or infer any financial figures. The KEY METRICS, MULTI-YEAR SUMMARY, and FPF SCORECARD sections contain exact values from the budget engine — reference these numbers directly.`
}
