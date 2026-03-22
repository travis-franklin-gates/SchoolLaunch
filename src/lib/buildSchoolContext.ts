import type { FinancialAssumptions, SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry } from './types'
import { getAssumptions } from './types'
import { calcCommissionRevenue, calcAAFTE, calcBenefits } from './calculations'
import { computeExpansionEnrollments, expansionToEnrollmentArray } from './gradeExpansion'
import type { MultiYearDetailedRow, FPFScorecard } from './budgetEngine'

/** Stable hash of key financial metrics for advisory cache invalidation */
export function computeAdvisoryHash(revenue: number, personnel: number, operations: number, enrollment: number, staffCount: number): string {
  return `r:${Math.round(revenue)}|p:${Math.round(personnel)}|o:${Math.round(operations)}|e:${enrollment}|s:${Math.round(staffCount * 10) / 10}`
}

/**
 * Summarized context for advisory agents. Contains pre-computed metrics as settled facts
 * and staffing/operations detail, but NOT raw revenue breakdowns or per-year financials
 * that would let the model recompute metrics independently.
 */
export function buildAgentContextString(
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
  const hasMultiYear = multiYear && multiYear.length > 0

  const operatingRevenue = rev.total
  const totalRevenue = hasMultiYear ? multiYear[0].revenue.total : rev.total
  const totalPersonnel = hasMultiYear
    ? multiYear[0].personnel.total
    : positions.reduce((s, p) => { const c = p.annual_salary * p.fte; return s + c + calcBenefits(c, assumptions.benefits_load_pct / 100) }, 0)
  const totalOperations = hasMultiYear
    ? multiYear[0].operations.total
    : projections.filter((p) => !p.is_revenue && p.category === 'Operations').reduce((s, p) => s + p.amount, 0)
  const totalExpenses = totalPersonnel + totalOperations
  const netPosition = hasMultiYear ? multiYear[0].net : totalRevenue - totalExpenses
  const personnelPct = operatingRevenue > 0 ? ((totalPersonnel / operatingRevenue) * 100).toFixed(1) : '0'
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const facilityAmount = projections.find((p) => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 0
  const facilityPct = operatingRevenue > 0 ? ((facilityAmount / operatingRevenue) * 100).toFixed(1) : '0'
  const revenuePerStudent = enroll > 0 ? totalRevenue / enroll : 0
  const breakEvenEnrollment = revenuePerStudent > 0 ? Math.ceil(totalExpenses / revenuePerStudent) : 0
  const teacherCount = positions.filter((p) => p.category === 'certificated' && /teacher/i.test(p.title)).reduce((s, p) => s + p.fte, 0)
  const studentTeacherRatio = teacherCount > 0 ? Math.round(enroll / teacherCount) : 0

  // Days of Cash from scorecard (authoritative) or budget engine
  const daysOfCashValues = scorecard
    ? scorecard.measures.find(m => m.name === 'Days of Cash')?.values || []
    : (multiYear || []).map(r => r.reserveDays)
  const daysOfCashY1 = daysOfCashValues[0] ?? 0

  // Beginning/ending cash
  const beginningCash = hasMultiYear ? multiYear[0].cumulativeNet - multiYear[0].net : 0
  const endingCash = hasMultiYear ? multiYear[0].cumulativeNet : netPosition

  // Enrollment summary
  const hasExpansion = gradeExpansionPlan && gradeExpansionPlan.length > 0
  const retRate = profile.retention_rate ?? 90
  let enrollSummary: string
  if (hasExpansion) {
    const expansionEnrollments = computeExpansionEnrollments(gradeExpansionPlan!, retRate)
    enrollSummary = expansionEnrollments.map(e =>
      `Year ${e.year}: ${e.total} students [${e.grades.join(', ')}]${e.newGrades.length > 0 ? ` (adding: ${e.newGrades.join(', ')})` : ''}`
    ).join('; ')
    enrollSummary += ` | Growth model: Grade expansion with ${retRate}% cohort retention (${100 - retRate}% annual attrition backfilled through new student recruitment)`
  } else {
    enrollSummary = `Y1: ${enroll}, Y2: ${profile.target_enrollment_y2}, Y3: ${profile.target_enrollment_y3}, Y4: ${profile.target_enrollment_y4}, Y5: ${profile.target_enrollment_y5 || profile.target_enrollment_y4}`
  }

  // Staffing list (agents need this for analysis)
  const staffingList = positions.map(p => {
    const cost = p.annual_salary * p.fte
    const total = cost + calcBenefits(cost, assumptions.benefits_load_pct / 100)
    return `- ${p.title}: ${p.fte} FTE, $${p.annual_salary.toLocaleString()} salary, ${p.category} (total with benefits: $${total.toLocaleString()})`
  }).join('\n')

  // Detailed operations breakdown with per-pupil/per-FTE context
  const opsItems = projections.filter(p => !p.is_revenue && p.category === 'Operations')
  const opsMap = new Map(opsItems.map(p => [p.subcategory, p.amount]))
  const perStudent = (amt: number) => enroll > 0 ? `$${Math.round(amt / enroll).toLocaleString()}/student` : ''
  const perFte = (amt: number) => totalFte > 0 ? `$${Math.round(amt / totalFte).toLocaleString()}/FTE` : ''
  const foodAmt = opsMap.get('Food Service') ?? 0
  const transportAmt = opsMap.get('Transportation') ?? 0
  const opsBreakdown = [
    `- Facilities: $${(opsMap.get('Facilities') ?? 0).toLocaleString()} (${facilityPct}% of operating revenue)`,
    `- Insurance: $${(opsMap.get('Insurance') ?? 0).toLocaleString()}`,
    `- Supplies & Materials: $${(opsMap.get('Supplies & Materials') ?? 0).toLocaleString()} (${perStudent(opsMap.get('Supplies & Materials') ?? 0)})`,
    `- Technology: $${(opsMap.get('Technology') ?? 0).toLocaleString()} (${perStudent(opsMap.get('Technology') ?? 0)})`,
    `- Curriculum & Materials: $${(opsMap.get('Curriculum & Materials') ?? 0).toLocaleString()} (${perStudent(opsMap.get('Curriculum & Materials') ?? 0)})`,
    `- Professional Development: $${(opsMap.get('Professional Development') ?? 0).toLocaleString()} (${perFte(opsMap.get('Professional Development') ?? 0)})`,
    `- Food Service: ${foodAmt > 0 ? `$${foodAmt.toLocaleString()} (${perStudent(foodAmt)})` : 'Not budgeted'}${assumptions.food_service_offered ? ' [program enabled]' : ''}`,
    `- Transportation: ${transportAmt > 0 ? `$${transportAmt.toLocaleString()} (${perStudent(transportAmt)})` : 'Not budgeted'}${assumptions.transportation_offered ? ' [program enabled]' : ''}`,
    `- Contracted Services: $${(opsMap.get('Contracted Services') ?? 0).toLocaleString()} (${perStudent(opsMap.get('Contracted Services') ?? 0)})`,
    `- Marketing & Outreach: $${(opsMap.get('Marketing & Outreach') ?? 0).toLocaleString()} (${perStudent(opsMap.get('Marketing & Outreach') ?? 0)})`,
    `- Fundraising: $${(opsMap.get('Fundraising') ?? 0).toLocaleString()}`,
    `- Authorizer Fee: $${(opsMap.get('Authorizer Fee') ?? 0).toLocaleString()} (3% of state apportionment)`,
    `- Misc/Contingency: $${(opsMap.get('Misc/Contingency') ?? 0).toLocaleString()} (${totalExpenses > 0 ? ((opsMap.get('Misc/Contingency') ?? 0) / totalExpenses * 100).toFixed(1) : '0'}% of total expenses)`,
  ].join('\n')

  // Days of cash trajectory in prose
  const cashTrajectory = daysOfCashValues.length > 0
    ? daysOfCashValues.map((d, i) => `Year ${i + 1}: ${d} days`).join(', ')
    : `Year 1: ${daysOfCashY1} days`

  // Multi-year trajectory in prose (settled facts, not raw data)
  let multiYearProse = ''
  if (hasMultiYear && multiYear.length > 1) {
    const lastYear = multiYear[multiYear.length - 1]
    const lastEndingCash = lastYear.cumulativeNet
    const lastDays = daysOfCashValues[multiYear.length - 1] ?? lastYear.reserveDays
    multiYearProse = `\n\nFIVE-YEAR TRAJECTORY:\nThe school grows from ${multiYear[0].enrollment} students in Year 1 to ${lastYear.enrollment} in Year ${lastYear.year}. Cash reserves ${lastEndingCash > endingCash ? 'strengthen' : 'decline'} over the projection period, reaching $${lastEndingCash.toLocaleString()} (${lastDays} days cash) by Year ${lastYear.year}. ${lastDays >= 60 ? 'This meets the Commission Stage 2 standard of 60+ days.' : lastDays >= 30 ? 'This meets the Commission Stage 1 standard but falls short of the Stage 2 target of 60+ days.' : 'This falls below the Commission Stage 1 minimum of 30 days — a serious concern.'}`
  }

  // FPF scorecard summary in prose
  let scorecardProse = ''
  if (scorecard) {
    const meetsCounts = scorecard.measures.map(m => {
      const y1Status = m.statuses[0]
      return `${m.name}: ${y1Status === 'meets' ? 'MEETS' : y1Status === 'approaches' ? 'APPROACHES' : y1Status === 'na' ? 'N/A' : 'DOES NOT MEET'} Stage 1`
    }).join('; ')
    scorecardProse = `\n\nFPF SCORECARD (Year 1): ${meetsCounts}\nOverall: ${scorecard.overallStatus} — ${scorecard.overallMessage}`
  }

  // Categorical grants for compliance analysis
  const categoricalGrants = `Title I: $${rev.titleI.toLocaleString()}${profile.pct_frl >= 40 ? ' (Schoolwide eligible)' : ' (Not eligible)'}, IDEA: $${rev.idea.toLocaleString()}, LAP: $${rev.lap.toLocaleString()}, LAP High Poverty: $${rev.lapHighPoverty.toLocaleString()}, TBIP: $${rev.tbip.toLocaleString()}, HiCap: $${rev.hicap.toLocaleString()}`

  return `SCHOOL: ${schoolName}
Grade configuration: ${profile.grade_config} | Region: ${profile.region} | Opening: ${profile.planned_open_year}
Demographics: ${profile.pct_frl}% FRL, ${profile.pct_iep}% IEP, ${profile.pct_ell}% ELL, ${profile.pct_hicap}% HiCap

ENROLLMENT: ${enrollSummary}

YEAR 1 FINANCIAL SUMMARY:
This school projects ${daysOfCashY1} days of cash at the end of Year 1${daysOfCashY1 >= 30 ? ', meeting the Commission Stage 1 standard of 30+ days' : daysOfCashY1 >= 21 ? ', approaching the Commission Stage 1 standard of 30 days' : ', below the Commission Stage 1 minimum of 30 days'}.
- Beginning Cash: $${beginningCash.toLocaleString()} (carried forward from pre-opening)
- Ending Cash: $${endingCash.toLocaleString()}
- Days of Cash by year: ${cashTrajectory}
- Total Revenue: $${totalRevenue.toLocaleString()} (Operating: $${operatingRevenue.toLocaleString()})
- Total Expenses: $${totalExpenses.toLocaleString()}
- Net Position: $${netPosition.toLocaleString()}
- Personnel % of Operating Revenue: ${personnelPct}%
- Facility % of Operating Revenue: ${facilityPct}%
- Break-Even Enrollment: ${breakEvenEnrollment} students (target: ${enroll})
- Student-to-teacher ratio: ${studentTeacherRatio}:1

STAFFING (Year 1, ${totalFte} FTE, $${totalPersonnel.toLocaleString()} total):
${staffingList}

OPERATIONS (Year 1, $${totalOperations.toLocaleString()} total):
${opsBreakdown}

CATEGORICAL GRANT REVENUE: ${categoricalGrants}${multiYearProse}${scorecardProse}`
}

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
- HiCap: $${rev.hicap.toLocaleString()}${rev.foodServiceRev > 0 ? `\n- Food Service (NSLP): $${rev.foodServiceRev.toLocaleString()}` : ''}${rev.transportationRev > 0 ? `\n- Transportation (State): $${rev.transportationRev.toLocaleString()}` : ''}
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
- Days of Cash (Year 1): ${scorecard ? scorecard.measures.find(m => m.name === 'Days of Cash')?.values[0] : hasMultiYear ? multiYear[0].reserveDays : 0} days — USE THIS VALUE, do not calculate independently
- Personnel % of Operating Revenue: ${personnelPct}% (= $${totalPersonnel.toLocaleString()} ÷ $${operatingRevenue.toLocaleString()})
- Break-Even Enrollment: ${breakEvenEnrollment} students (target: ${enroll})
- Facility % of Operating Revenue: ${facilityPct}%
NOTE: Personnel % and Facility % use Operating Revenue as the denominator (excludes one-time grants). This matches the Commission FPF evaluation methodology.${multiYear && multiYear.length > 0 ? `

MULTI-YEAR SUMMARY (Years 1-${multiYear.length}):
${multiYear.map((r, i) => {
    const daysOfCash = scorecard ? (scorecard.measures.find(m => m.name === 'Days of Cash')?.values[i] ?? r.reserveDays) : r.reserveDays // reserveDays now = endingCash / dailyExpense
    return `- Year ${r.year}: Revenue $${r.revenue.total.toLocaleString()}, Expenses $${r.totalExpenses.toLocaleString()}, Net $${r.net.toLocaleString()}, Cumulative $${r.cumulativeNet.toLocaleString()}, ${daysOfCash} days cash`
  }).join('\n')}` : ''}${scorecard ? `

FPF SCORECARD (Commission Financial Performance Framework):
${scorecard.measures.map((m) => `- ${m.name}: ${m.values.map((v, i) => `Y${i + 1}=${v === null ? 'N/A' : v}`).join(', ')} | Stage 1: ${m.stage1Target}, Stage 2: ${m.stage2Target} | Status: ${m.statuses.join(', ')}`).join('\n')}
Overall: ${scorecard.overallStatus} — ${scorecard.overallMessage}` : ''}

IMPORTANT: Use ONLY the pre-computed financial metrics provided above. Do not independently calculate, estimate, or infer any financial figures. The KEY METRICS, MULTI-YEAR SUMMARY, and FPF SCORECARD sections contain exact values from the budget engine — reference these numbers directly.`
}
