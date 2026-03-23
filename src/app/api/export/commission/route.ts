import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface MultiYearRow {
  year: number
  enrollment: number
  aafte: number
  revenue: {
    regularEd: number
    sped: number
    stateSped: number
    facilitiesRev: number
    levyEquity: number
    titleI: number
    idea: number
    lap: number
    lapHighPoverty: number
    tbip: number
    hicap: number
    foodServiceRev: number
    transportationRev: number
    interestIncome: number
    grantRevenue: number
    operatingRevenue: number
    total: number
    apportionment: number
  }
  personnel: {
    certificated: number
    classified: number
    admin: number
    benefits: number
    total: number
    totalSalaries: number
  }
  operations: {
    facilities: number
    supplies: number
    contracted: number
    technology: number
    authorizerFee: number
    insurance: number
    foodService: number
    transportation: number
    curriculum: number
    profDev: number
    marketing: number
    fundraising: number
    contingency: number
    total: number
  }
  totalExpenses: number
  net: number
  cumulativeNet: number
  reserveDays: number
  staffing: {
    teachers: number
    paras: number
    officeStaff: number
    otherStaff: number
    totalPositions: number
    totalPersonnelCost: number
    totalSalaries: number
    totalBenefits: number
  }
  expansionDetail?: {
    grades: string[]
    newGrades: string[]
  }
}

interface Position {
  title: string
  category: string
  fte: number
  annual_salary: number
  position_type?: string
  classification?: string
  driver?: string
  benchmark_salary?: number
}

interface FPFMeasure {
  name: string
  values: (number | null)[]
  stage1Target: string
  stage2Target: string
  statuses: string[]
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    schoolName,
    profile,
    assumptions,
    positions,
    multiYear,
    scorecard,
    startingCash,
  } = body as {
    schoolName: string
    profile: { pct_frl: number; pct_iep: number; pct_ell: number; grade_config: string }
    assumptions: { benefits_load_pct: number; aafte_pct: number }
    positions: Position[]
    multiYear: MultiYearRow[]
    scorecard: { measures: FPFMeasure[] }
    startingCash: number
    scenarios?: { name: string; assumptions: Record<string, number>; results: { years: Record<string, Record<string, number | string>> } | null }[]
  }

  const wb = XLSX.utils.book_new()
  const yearHeaders = ['Year 0', ...multiYear.map((r) => `Year ${r.year}`)]

  // --- Tab 1: ENROLLMENT ---
  const enrollRows: (string | number)[][] = [
    ['', ...yearHeaders],
  ]

  // If we have expansion detail with grades, show per-grade rows
  const allGrades = new Set<string>()
  for (const row of multiYear) {
    if (row.expansionDetail?.grades) {
      row.expansionDetail.grades.forEach((g) => allGrades.add(g))
    }
  }
  const sortedGrades = Array.from(allGrades).sort((a, b) => {
    const order = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    return order.indexOf(a) - order.indexOf(b)
  })

  if (sortedGrades.length > 0) {
    for (const grade of sortedGrades) {
      const row: (string | number)[] = [`Grade ${grade}`, 0]
      for (const yr of multiYear) {
        const hasGrade = yr.expansionDetail?.grades?.includes(grade)
        row.push(hasGrade ? Math.round(yr.enrollment / (yr.expansionDetail?.grades?.length || 1)) : 0)
      }
      enrollRows.push(row)
    }
  }

  enrollRows.push(['Total Enrollment', 0, ...multiYear.map((r) => r.enrollment)])
  enrollRows.push(['AAFTE', 0, ...multiYear.map((r) => r.aafte)])
  enrollRows.push([])
  enrollRows.push(['Student Needs Populations'])
  enrollRows.push(['SPED Enrollment', 0, ...multiYear.map((r) => Math.round(r.enrollment * profile.pct_iep / 100))])
  enrollRows.push(['FRPL Enrollment', 0, ...multiYear.map((r) => Math.round(r.enrollment * profile.pct_frl / 100))])
  enrollRows.push(['EL Enrollment', 0, ...multiYear.map((r) => Math.round(r.enrollment * profile.pct_ell / 100))])

  const enrollSheet = XLSX.utils.aoa_to_sheet(enrollRows)
  XLSX.utils.book_append_sheet(wb, enrollSheet, 'ENROLLMENT')

  // --- Tab 2: REVENUE ---
  const revRows: (string | number)[][] = [
    ['#', 'Source', 'Description', 'Driver', ...yearHeaders],
    ['1.0', 'State & Local', 'Regular Ed Per Pupil', 'Per Pupil (AAFTE)', 0, ...multiYear.map((r) => r.revenue.regularEd)],
    ['2.0', 'State & Local', 'SPED Apportionment', 'Per Pupil-SPED', 0, ...multiYear.map((r) => r.revenue.sped)],
    ['3.0', 'State & Local', 'State Special Education', 'Per Pupil-SPED', 0, ...multiYear.map((r) => r.revenue.stateSped)],
    ['4.0', 'State & Local', 'Facilities Per Pupil', 'Per Pupil', 0, ...multiYear.map((r) => r.revenue.facilitiesRev)],
    ['5.0', 'State & Local', 'Levy Equity', 'Per Pupil (AAFTE)', 0, ...multiYear.map((r) => r.revenue.levyEquity)],
    ['6.0', 'Federal', 'Title I', 'Per Pupil-FRL', 0, ...multiYear.map((r) => r.revenue.titleI)],
    ['7.0', 'Federal', 'IDEA (Federal Special Ed)', 'Per Pupil-IEP', 0, ...multiYear.map((r) => r.revenue.idea)],
    ['8.0', 'State Categorical', 'LAP (Learning Assistance)', 'Per Pupil-FRL', 0, ...multiYear.map((r) => r.revenue.lap)],
    ['8.1', 'State Categorical', 'LAP High Poverty', 'Per Pupil', 0, ...multiYear.map((r) => r.revenue.lapHighPoverty)],
    ['9.0', 'State Categorical', 'TBIP (Bilingual)', 'Per Pupil-ELL', 0, ...multiYear.map((r) => r.revenue.tbip)],
    ['10.0', 'State Categorical', 'Highly Capable', 'Per Pupil-HiCap', 0, ...multiYear.map((r) => r.revenue.hicap)],
    ['11.0', 'Program Revenue', 'Food Service (NSLP)', 'Per Pupil', 0, ...multiYear.map((r) => r.revenue.foodServiceRev)],
    ['11.1', 'Program Revenue', 'Transportation (State)', 'Per Pupil', 0, ...multiYear.map((r) => r.revenue.transportationRev)],
    ['12.0', 'Other', 'Interest & Other Income', 'Cash Balance', 0, ...multiYear.map((r) => r.revenue.interestIncome)],
    [],
    ['', '', 'Total Revenue', '', 0, ...multiYear.map((r) => r.revenue.total)],
  ]

  const revSheet = XLSX.utils.aoa_to_sheet(revRows)
  XLSX.utils.book_append_sheet(wb, revSheet, 'REVENUE')

  // --- Tab 3: STAFFING ---
  const staffRows: (string | number | string)[][] = [
    ['#', 'Classification', 'Position', 'Driver', 'FTE Y1', 'Salary Y1'],
  ]
  positions.forEach((p: Position, idx: number) => {
    staffRows.push([
      idx + 1,
      p.classification || p.category,
      p.title,
      p.driver || 'fixed',
      p.fte,
      p.annual_salary,
    ])
  })
  staffRows.push([])
  staffRows.push(['Total FTE', '', '', '', positions.reduce((s: number, p: Position) => s + p.fte, 0)])
  staffRows.push([])
  staffRows.push(['Personnel Summary', ...yearHeaders])
  staffRows.push(['Total Salaries', 0, ...multiYear.map((r) => r.personnel.totalSalaries)])
  staffRows.push([`Benefits (${assumptions.benefits_load_pct}%)`, 0, ...multiYear.map((r) => r.personnel.benefits)])
  staffRows.push(['Total Compensation', 0, ...multiYear.map((r) => r.personnel.total)])

  const staffSheet = XLSX.utils.aoa_to_sheet(staffRows)
  XLSX.utils.book_append_sheet(wb, staffSheet, 'STAFFING')

  // --- Tab 4: P&L ---
  const plRows: (string | number)[][] = [
    ['Income Statement', ...yearHeaders],
    [],
    ['REVENUE'],
    ['Regular Ed Apportionment', 0, ...multiYear.map((r) => r.revenue.regularEd)],
    ['SPED Apportionment', 0, ...multiYear.map((r) => r.revenue.sped)],
    ['State Special Education', 0, ...multiYear.map((r) => r.revenue.stateSped)],
    ['Facilities Revenue', 0, ...multiYear.map((r) => r.revenue.facilitiesRev)],
    ['Levy Equity', 0, ...multiYear.map((r) => r.revenue.levyEquity)],
    ['Title I', 0, ...multiYear.map((r) => r.revenue.titleI)],
    ['IDEA (Federal Special Ed)', 0, ...multiYear.map((r) => r.revenue.idea)],
    ['LAP', 0, ...multiYear.map((r) => r.revenue.lap)],
    ['LAP High Poverty', 0, ...multiYear.map((r) => r.revenue.lapHighPoverty)],
    ['TBIP', 0, ...multiYear.map((r) => r.revenue.tbip)],
    ['HiCap', 0, ...multiYear.map((r) => r.revenue.hicap)],
    ['Food Service (NSLP)', 0, ...multiYear.map((r) => r.revenue.foodServiceRev)],
    ['Transportation (State)', 0, ...multiYear.map((r) => r.revenue.transportationRev)],
    ['Interest & Other Income', 0, ...multiYear.map((r) => r.revenue.interestIncome)],
    ['Total Revenue', 0, ...multiYear.map((r) => r.revenue.total)],
    [],
    ['PERSONNEL'],
    ['Certificated Staff', 0, ...multiYear.map((r) => r.personnel.certificated)],
    ['Classified Staff', 0, ...multiYear.map((r) => r.personnel.classified)],
    ['Administrative Staff', 0, ...multiYear.map((r) => r.personnel.admin)],
    ['Total Salaries', 0, ...multiYear.map((r) => r.personnel.totalSalaries)],
    [`Taxes & Benefits (${assumptions.benefits_load_pct}%)`, 0, ...multiYear.map((r) => r.personnel.benefits)],
    ['Total Personnel', 0, ...multiYear.map((r) => r.personnel.total)],
    [],
    ['NON-PERSONNEL EXPENSES'],
    ['Facilities', 0, ...multiYear.map((r) => r.operations.facilities)],
    ['Supplies & Materials', 0, ...multiYear.map((r) => r.operations.supplies)],
    ['Contracted Services', 0, ...multiYear.map((r) => r.operations.contracted)],
    ['Technology', 0, ...multiYear.map((r) => r.operations.technology)],
    ['Authorizer Fee', 0, ...multiYear.map((r) => r.operations.authorizerFee)],
    ['Insurance', 0, ...multiYear.map((r) => r.operations.insurance)],
    ['Food Service', 0, ...multiYear.map((r) => r.operations.foodService)],
    ['Transportation', 0, ...multiYear.map((r) => r.operations.transportation)],
    ['Curriculum & Materials', 0, ...multiYear.map((r) => r.operations.curriculum)],
    ['Professional Development', 0, ...multiYear.map((r) => r.operations.profDev)],
    ['Marketing & Outreach', 0, ...multiYear.map((r) => r.operations.marketing)],
    ['Fundraising', 0, ...multiYear.map((r) => r.operations.fundraising)],
    ['Contingency', 0, ...multiYear.map((r) => r.operations.contingency)],
    ['Total Non-Personnel', 0, ...multiYear.map((r) => r.operations.total)],
    [],
    ['Total Expenses', 0, ...multiYear.map((r) => r.totalExpenses)],
    ['Net Income / Change in Net Assets', 0, ...multiYear.map((r) => r.net)],
    ['Cumulative Net Position', 0, ...multiYear.map((r) => r.cumulativeNet)],
    [],
    ['KEY METRICS'],
    ['Personnel % of Revenue', '', ...multiYear.map((r) => r.revenue.operatingRevenue > 0 ? `${(r.personnel.total / r.revenue.operatingRevenue * 100).toFixed(1)}%` : '0%')],
    ['Total Margin', '', ...multiYear.map((r) => r.revenue.operatingRevenue > 0 ? `${(r.net / r.revenue.operatingRevenue * 100).toFixed(1)}%` : '0%')],
    ['Days of Cash on Hand', '', ...multiYear.map((r) => r.reserveDays)],
  ]

  const plSheet = XLSX.utils.aoa_to_sheet(plRows)
  XLSX.utils.book_append_sheet(wb, plSheet, 'P&L')

  // --- Tab 5: CASH FLOW ---
  // Simplified annual cash flow view
  const cfRows: (string | number)[][] = [
    ['Cash Flow Summary', ...yearHeaders],
    ['Beginning Cash', startingCash, ...multiYear.map((r, i) => i === 0 ? startingCash : multiYear[i - 1].cumulativeNet + startingCash - multiYear[i - 1].net + multiYear.slice(0, i).reduce((s, x) => s + x.net, 0))],
    ['Total Revenue', 0, ...multiYear.map((r) => r.revenue.total)],
    ['Total Expenses', 0, ...multiYear.map((r) => r.totalExpenses)],
    ['Net Cash Flow', 0, ...multiYear.map((r) => r.net)],
  ]
  // Compute ending cash properly
  let runningCash = startingCash
  const endingCashRow: (string | number)[] = ['Ending Cash']
  endingCashRow.push(startingCash) // Year 0
  for (const row of multiYear) {
    runningCash += row.net
    endingCashRow.push(runningCash)
  }
  cfRows.push(endingCashRow)
  cfRows.push(['Days of Cash', '', ...multiYear.map((r) => r.reserveDays)])

  const cfSheet = XLSX.utils.aoa_to_sheet(cfRows)
  XLSX.utils.book_append_sheet(wb, cfSheet, 'CASH FLOW')

  // --- Tab 6: DASHBOARD (FPF Scorecard) ---
  const dashRows: (string | number | null)[][] = [
    ['Commission Financial Performance Framework Scorecard'],
    [],
    ['Measure', 'Formula', ...multiYear.map((r) => `Year ${r.year}`), 'Stage 1 Target', 'Stage 2 Target'],
  ]
  if (scorecard?.measures) {
    for (const m of scorecard.measures as FPFMeasure[]) {
      dashRows.push([
        m.name,
        '',
        ...m.values.map((v: number | null) => v === null ? 'N/A' : v),
        m.stage1Target,
        m.stage2Target,
      ])
    }
  }

  const dashSheet = XLSX.utils.aoa_to_sheet(dashRows)
  XLSX.utils.book_append_sheet(wb, dashSheet, 'DASHBOARD')

  // --- Tab 7: SCENARIOS (if seeded) ---
  const { scenarios } = body as { scenarios?: { name: string; assumptions: Record<string, number>; results: { years: Record<string, Record<string, number | string>> } | null }[] }
  if (scenarios && scenarios.length > 0) {
    const scenRows: (string | number)[][] = [
      ['SCENARIO ASSUMPTIONS', ...scenarios.map(s => s.name)],
      ['Enrollment Fill Rate', ...scenarios.map(s => `${Math.round((s.assumptions.enrollment_fill_rate || 0) * 100)}%`)],
      ['Per-Pupil Funding Adj', ...scenarios.map(s => `${((s.assumptions.per_pupil_funding_adjustment || 0) * 100).toFixed(0)}%`)],
      ['Personnel Cost Adj', ...scenarios.map(s => `${((s.assumptions.personnel_cost_adjustment || 0) * 100).toFixed(0)}%`)],
      ['Monthly Facility Cost', ...scenarios.map(s => s.assumptions.facility_cost_monthly || 0)],
      ['Startup Capital', ...scenarios.map(s => s.assumptions.startup_capital || 0)],
      [],
      ['5-YEAR PROJECTIONS'],
    ]

    const metrics = ['enrollment', 'total_revenue', 'total_expenses', 'net_position', 'reserve_days', 'personnel_pct']
    const metricLabels: Record<string, string> = { enrollment: 'Enrollment', total_revenue: 'Total Revenue', total_expenses: 'Total Expenses', net_position: 'Net Position', reserve_days: 'Reserve Days', personnel_pct: 'Personnel %' }

    for (let y = 1; y <= 5; y++) {
      scenRows.push([`Year ${y}`, ...scenarios.map(s => s.name)])
      for (const m of metrics) {
        scenRows.push([metricLabels[m], ...scenarios.map(s => {
          const val = s.results?.years?.[String(y)]?.[m]
          return val !== undefined ? (typeof val === 'number' ? val : String(val)) : ''
        })])
      }
      scenRows.push([])
    }

    scenRows.push(['FPF COMPLIANCE (Year 1)', ...scenarios.map(s => s.name)])
    for (const fpf of ['fpf_current_ratio', 'fpf_days_cash', 'fpf_total_margin', 'fpf_enrollment_variance']) {
      const label = fpf.replace('fpf_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      scenRows.push([label, ...scenarios.map(s => String(s.results?.years?.['1']?.[fpf] || 'N/A'))])
    }

    const scenSheet = XLSX.utils.aoa_to_sheet(scenRows)
    XLSX.utils.book_append_sheet(wb, scenSheet, 'SCENARIOS')
  }

  // Generate Excel buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${schoolName.replace(/[^a-zA-Z0-9]/g, '_')}_Commission_Template.xlsx"`,
    },
  })
}
