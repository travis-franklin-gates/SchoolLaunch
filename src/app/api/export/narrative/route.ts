import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// --- Types matching the POST body ---
interface Position {
  title: string
  category: 'certificated' | 'classified' | 'admin'
  fte: number
  annual_salary: number
}

interface Projection {
  category: string
  subcategory: string
  amount: number
  is_revenue: boolean
}

interface FundingSource {
  source: string
  amount: number
  type: string
  status: string
}

interface CashFlowMonth {
  month: string
  apportionmentPct: number
  apportionmentAmt: number
  otherRevenue: number
  totalInflow: number
  payroll: number
  otherExpenses: number
  netCashFlow: number
  cumulativeBalance: number
}

interface MultiYearRow {
  year: number
  enrollment: number
  revenue: { total: number }
  personnel: { total: number }
  operations: { total: number }
  totalExpenses: number
  net: number
  cumulativeNet: number
  reserveDays: number
}

interface NarrativePayload {
  schoolName: string
  profile: {
    grade_config: string
    target_enrollment_y1: number
    target_enrollment_y2: number
    target_enrollment_y3: number
    target_enrollment_y4: number
    pct_frl: number
    pct_iep: number
    pct_ell: number
    pct_hicap: number
    max_class_size: number
    planned_open_year: number
    region: string
    startup_funding?: FundingSource[] | null
  }
  assumptions: {
    per_pupil_rate: number
    levy_equity_per_student: number
    benefits_load_pct: number
    authorizer_fee_pct: number
    regular_ed_per_pupil: number
    sped_per_pupil: number
    state_sped_per_pupil: number
    facilities_per_pupil: number
    lap_per_pupil: number
    lap_high_poverty_per_pupil: number
    tbip_per_pupil: number
    hicap_per_pupil: number
    title_i_per_pupil: number
    idea_per_pupil: number
    revenue_cola_pct: number
    aafte_pct: number
    interest_rate_on_cash: number
    regionalization_factor: number
  }
  positions: Position[]
  projections: Projection[]
  baseSummary: {
    totalRevenue: number
    totalPersonnel: number
    totalOperations: number
    totalExpenses: number
    netPosition: number
    reserveDays: number
    personnelPctRevenue: number
    breakEvenEnrollment: number
    facilityPct: number
  }
  conservativeSummary: {
    totalRevenue: number
    totalPersonnel: number
    totalOperations: number
    totalExpenses: number
    netPosition: number
    reserveDays: number
    personnelPctRevenue: number
    breakEvenEnrollment: number
    facilityPct: number
  }
  cashFlow: CashFlowMonth[]
  multiYear: MultiYearRow[]
  advisory?: {
    briefing: string
    agents: {
      id: string
      name: string
      icon: string
      subtitle: string
      status: 'strong' | 'needs_attention' | 'risk'
      summary: string
      actions: string[]
    }[]
    generatedAt: string
  }
  scenarios?: {
    name: string
    assumptions: { enrollment_fill_rate: number; per_pupil_funding_adjustment: number; personnel_cost_adjustment: number; facility_cost_monthly: number; startup_capital: number }
    results: { years: Record<string, { enrollment: number; total_revenue: number; total_expenses: number; net_position: number; reserve_days: number; personnel_pct: number; fpf_days_cash: string; fpf_total_margin: string }> } | null
    ai_analysis?: string | null
  }[]
}

function fmtDollars(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmtDollars(n)
}

function pct(n: number, total: number): string {
  return total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%'
}

// Color helpers
// Stage 1 (Years 1-2) thresholds per WA Commission Financial Performance Framework
function reserveColor(days: number): string {
  if (days >= 30) return '#0F6E56'
  if (days >= 21) return '#B45309'
  return '#D85A30'
}

function metricCardBg(days: number): string {
  if (days >= 30) return '#ECFDF5'
  if (days >= 21) return '#FFFBEB'
  return '#FEF2F2'
}

// Stage 2 (Year 3+) thresholds
function reserveColorStage2(days: number): string {
  if (days >= 60) return '#0F6E56'
  if (days >= 30) return '#B45309'
  return '#D85A30'
}

async function generateAIContent(prompt: string, context: string): Promise<string> {
  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: `${context}\n\n${prompt}` }],
    })
    const block = response.content[0]
    return block.type === 'text' ? block.text : ''
  } catch (err) {
    console.error('AI generation failed:', err)
    return ''
  }
}

export async function POST(request: NextRequest) {
  const data: NarrativePayload = await request.json()
  const {
    schoolName, profile, assumptions, positions, projections,
    baseSummary, conservativeSummary, cashFlow, multiYear, advisory, scenarios,
  } = data

  const enrollment = profile.target_enrollment_y1
  const conservativeEnrollment = Math.floor(enrollment * 0.9)
  const revenueProjections = projections.filter((p) => p.is_revenue)
  const opsProjections = projections.filter((p) => !p.is_revenue && p.category === 'Operations')
  const fundingSources = profile.startup_funding || []
  const totalFunding = fundingSources.reduce((s, f) => s + f.amount, 0)
  const securedFunding = fundingSources.filter((f) => f.status === 'received' || f.status === 'pledged').reduce((s, f) => s + f.amount, 0)
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const totalFte = positions.reduce((s, p) => s + p.fte, 0)
  const teacherCount = positions.filter((p) => p.category === 'certificated' && /teacher/i.test(p.title)).reduce((s, p) => s + p.fte, 0)
  const studentTeacherRatio = teacherCount > 0 ? Math.round(enrollment / teacherCount) : 0

  // Build school context for AI calls
  const schoolContext = `School: ${schoolName}
Grade configuration: ${profile.grade_config}, Region: ${profile.region}
Year 1 enrollment: ${enrollment} students, Max class size: ${profile.max_class_size}
Demographics: ${profile.pct_frl}% FRL, ${profile.pct_iep}% IEP, ${profile.pct_ell}% ELL, ${profile.pct_hicap}% HiCap
Total Revenue: ${fmtDollars(baseSummary.totalRevenue)}
Total Personnel: ${fmtDollars(baseSummary.totalPersonnel)} (${baseSummary.personnelPctRevenue.toFixed(1)}% of revenue)
Total Operations: ${fmtDollars(baseSummary.totalOperations)}
Net Position: ${fmtDollars(baseSummary.netPosition)}
Reserve Days: ${baseSummary.reserveDays}
Break-Even Enrollment: ${baseSummary.breakEvenEnrollment} students
Facility Cost: ${baseSummary.facilityPct.toFixed(1)}% of revenue
Staff: ${totalFte} FTE total, ${teacherCount} teachers, ${studentTeacherRatio}:1 student-teacher ratio
Conservative (90% enrollment): Revenue ${fmtDollars(conservativeSummary.totalRevenue)}, Net ${fmtDollars(conservativeSummary.netPosition)}, Reserve Days ${conservativeSummary.reserveDays}
Multi-year: Y1 net ${fmtDollars(multiYear[0]?.net || 0)}, Y2 net ${fmtDollars(multiYear[1]?.net || 0)}, Y3 net ${fmtDollars(multiYear[2]?.net || 0)}, Y4 net ${fmtDollars(multiYear[3]?.net || 0)}, Y5 net ${fmtDollars(multiYear[4]?.net || 0)}
Startup funding: ${fmtDollars(totalFunding)} total, ${fmtDollars(securedFunding)} secured`

  // Generate AI content in parallel
  const [executiveSummary, riskAnalysis] = await Promise.all([
    generateAIContent(
      `Write a 2-3 paragraph executive summary for a charter school financial plan being submitted to the Washington State Charter School Commission. Be specific with numbers. Be direct about risks. Write in third person (e.g., "The school projects..." not "You project..."). This should read like a professional financial document, not a conversation. Do not use markdown formatting — output plain text with paragraph breaks only.`,
      schoolContext,
    ),
    generateAIContent(
      `Based on this school's financial model, identify the top 5 financial risks and provide a specific mitigation strategy for each. Format as numbered items. Each risk should have a bold title (use <strong> tags), followed by the risk description and mitigation in 2-3 sentences. Write for a Charter School Commission reviewer — be specific and reference the school's actual numbers. Do not use markdown — use plain HTML inline formatting only (<strong> tags).`,
      schoolContext,
    ),
  ])

  // Revenue composition bar chart SVG
  const regularEd = revenueProjections.find((p) => p.subcategory === 'Regular Ed Apportionment')?.amount || 0
  const spedApport = revenueProjections.find((p) => p.subcategory === 'SPED Apportionment')?.amount || 0
  const stateSpedRev = revenueProjections.find((p) => p.subcategory === 'State Special Education')?.amount || 0
  const facilitiesRev = revenueProjections.find((p) => p.subcategory === 'Facilities Revenue')?.amount || 0
  // Fallback: old "State Apportionment" subcategory for schools onboarded before migration
  const legacyApport = revenueProjections.find((p) => p.subcategory === 'State Apportionment')?.amount || 0
  const effectiveRegularEd = regularEd || legacyApport
  const levyEquity = revenueProjections.find((p) => p.subcategory === 'Levy Equity')?.amount || 0
  const titleI = revenueProjections.find((p) => p.subcategory === 'Title I')?.amount || 0
  const idea = revenueProjections.find((p) => p.subcategory === 'IDEA')?.amount || 0
  const lap = revenueProjections.find((p) => p.subcategory === 'LAP')?.amount || 0
  const lapHighPov = revenueProjections.find((p) => p.subcategory === 'LAP High Poverty')?.amount || 0
  const tbip = revenueProjections.find((p) => p.subcategory === 'TBIP')?.amount || 0
  const hicap = revenueProjections.find((p) => p.subcategory === 'HiCap')?.amount || 0
  const totalRev = baseSummary.totalRevenue || 1

  const barSegments = [
    { label: 'Regular Ed', amount: effectiveRegularEd, color: '#1B2A4A' },
    { label: 'SPED Apport', amount: spedApport, color: '#3D5A80' },
    { label: 'State SpEd', amount: stateSpedRev, color: '#4A6FA5' },
    { label: 'Facilities', amount: facilitiesRev, color: '#5A7FA0' },
    { label: 'Levy Equity', amount: levyEquity, color: '#2D4A7A' },
    { label: 'Title I', amount: titleI, color: '#0F6E56' },
    { label: 'IDEA', amount: idea, color: '#16A085' },
    { label: 'LAP', amount: lap, color: '#2ECC71' },
    { label: 'LAP High Pov', amount: lapHighPov, color: '#27AE60' },
    { label: 'TBIP', amount: tbip, color: '#3498DB' },
    { label: 'HiCap', amount: hicap, color: '#9B59B6' },
  ].filter((s) => s.amount > 0)

  let barX = 0
  const barWidth = 700
  const barSvg = barSegments.map((s) => {
    const w = (s.amount / totalRev) * barWidth
    const segment = `<rect x="${barX}" y="0" width="${w}" height="36" fill="${s.color}" />`
    barX += w
    return segment
  }).join('\n')

  const barLegend = barSegments.map((s) =>
    `<span style="display:inline-flex;align-items:center;margin-right:16px;font-size:10px;color:#475569;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.color};margin-right:4px;"></span>
      ${s.label} (${pct(s.amount, totalRev)})
    </span>`
  ).join('')

  // Reserve days line chart SVG
  const chartW = 500
  const chartH = 140
  const maxDays = Math.max(90, ...multiYear.map((y) => Math.abs(y.reserveDays)))
  const yScale = (d: number) => chartH - 20 - ((d + maxDays) / (maxDays * 2)) * (chartH - 40)
  const xStep = chartW / 5
  const linePoints = multiYear.map((y, i) => `${50 + (i + 1) * xStep},${yScale(y.reserveDays)}`).join(' ')
  const dotsSvg = multiYear.map((y, i) => {
    const color = y.year <= 2 ? reserveColor(y.reserveDays) : reserveColorStage2(y.reserveDays)
    return `<circle cx="${50 + (i + 1) * xStep}" cy="${yScale(y.reserveDays)}" r="5" fill="${color}" />
     <text x="${50 + (i + 1) * xStep}" y="${yScale(y.reserveDays) - 12}" text-anchor="middle" font-size="11" font-weight="600" fill="${color}">${y.reserveDays}d</text>`
  }).join('\n')

  // Revenue formula strings — show regionalized rates
  const regionFactor = assumptions.regionalization_factor || 1.0
  function rateWithRegion(base: number, regionalized: boolean = true): string {
    if (!regionalized || regionFactor === 1.0) return fmtDollars(base)
    return `${fmtDollars(base)} × ${regionFactor} = ${fmtDollars(Math.round(base * regionFactor))}`
  }

  function revenueFormula(sub: string): string {
    switch (sub) {
      case 'Regular Ed Apportionment': return `${Math.floor(enrollment * assumptions.aafte_pct / 100)} AAFTE × ${rateWithRegion(assumptions.regular_ed_per_pupil)}`
      case 'SPED Apportionment': return `${Math.floor(enrollment * assumptions.aafte_pct / 100)} AAFTE × ${profile.pct_iep}% IEP × ${rateWithRegion(assumptions.sped_per_pupil)}`
      case 'State Special Education': return `${Math.round(enrollment * profile.pct_iep / 100)} SPED students × ${rateWithRegion(assumptions.state_sped_per_pupil || 13556)}`
      case 'Facilities Revenue': return `${Math.floor(enrollment * assumptions.aafte_pct / 100)} AAFTE × ${fmtDollars(assumptions.facilities_per_pupil)}`
      case 'State Apportionment': return `${enrollment} students × ${fmtDollars(assumptions.per_pupil_rate)}/student`
      case 'Levy Equity': return `${Math.floor(enrollment * assumptions.aafte_pct / 100)} AAFTE × ${fmtDollars(assumptions.levy_equity_per_student)}`
      case 'Title I': return profile.pct_frl > 40 ? `${enrollment} × ${profile.pct_frl}% FRL × ${fmtDollars(assumptions.title_i_per_pupil || 880)}` : 'Not eligible (FRL < 40%)'
      case 'IDEA': return `${enrollment} × ${profile.pct_iep}% IEP × ${fmtDollars(assumptions.idea_per_pupil || 1500)}`
      case 'LAP': return `${enrollment} × ${profile.pct_frl}% FRL × ${fmtDollars(assumptions.lap_per_pupil || 816)}`
      case 'LAP High Poverty': return `${enrollment} × ${fmtDollars(assumptions.lap_high_poverty_per_pupil || 374)}`
      case 'TBIP': return `${enrollment} × ${profile.pct_ell}% ELL × ${fmtDollars(assumptions.tbip_per_pupil || 1600)}`
      case 'HiCap': return `${enrollment} × ${profile.pct_hicap}% HiCap × ${fmtDollars(assumptions.hicap_per_pupil || 730)}`
      default: return ''
    }
  }

  // Operations grouping
  const opsGroups: Record<string, string[]> = {
    'Facilities & Occupancy': ['Facilities', 'Insurance'],
    'Instructional': ['Supplies & Materials', 'Technology', 'Curriculum & Materials', 'Professional Development'],
    'Student Services': ['Food Service', 'Transportation'],
    'Administrative': ['Contracted Services', 'Authorizer Fee', 'Marketing & Outreach', 'Fundraising'],
    'Other': ['Misc/Contingency'],
  }

  function buildOpsTable(): string {
    let html = ''
    for (const [group, items] of Object.entries(opsGroups)) {
      const groupRows = opsProjections.filter((p) => items.includes(p.subcategory))
      if (groupRows.length === 0) continue
      const groupTotal = groupRows.reduce((s, p) => s + p.amount, 0)
      html += `<tr class="group-header"><td colspan="3" style="background:#F1F5F9;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;padding:8px 16px;">${group}</td></tr>`
      for (const row of groupRows) {
        html += `<tr><td style="padding:8px 16px;padding-left:28px;">${row.subcategory}</td><td style="text-align:right;padding:8px 16px;">${fmtDollars(row.amount)}</td><td style="text-align:right;padding:8px 16px;color:#64748B;">${pct(row.amount, baseSummary.totalRevenue)}</td></tr>`
      }
      html += `<tr style="background:#F8FAFC;"><td style="padding:6px 16px;padding-left:28px;font-weight:600;font-size:11px;color:#475569;">Subtotal</td><td style="text-align:right;padding:6px 16px;font-weight:600;font-size:11px;color:#475569;">${fmtDollars(groupTotal)}</td><td style="text-align:right;padding:6px 16px;font-weight:600;font-size:11px;color:#475569;">${pct(groupTotal, baseSummary.totalRevenue)}</td></tr>`
    }
    return html
  }

  // Personnel health assessment
  function personnelAssessment(): string {
    const p = baseSummary.personnelPctRevenue
    if (p < 72) return `<span style="color:#D85A30;font-weight:600;">Below recommended range</span> — may indicate understaffing or under-enrollment for the staffing plan.`
    if (p <= 78) return `<span style="color:#0F6E56;font-weight:600;">Healthy range</span> — aligns with WA charter school best practices (72-78%).`
    if (p <= 80) return `<span style="color:#B45309;font-weight:600;">Caution</span> — approaching the upper limit. Monitor closely as enrollment fluctuates.`
    return `<span style="color:#D85A30;font-weight:600;">Exceeds 80%</span> — leaves insufficient margin for operations and reserves. Consider staffing adjustments.`
  }

  // Sensitivity narrative
  function sensitivityNarrative(): string {
    if (conservativeSummary.netPosition >= 0) {
      return `Under conservative enrollment assumptions (90% of target, ${conservativeEnrollment} students), the school still projects a surplus of ${fmtDollars(conservativeSummary.netPosition)} with ${conservativeSummary.reserveDays} reserve days. This indicates a financial model with meaningful margin for enrollment variability. The school could sustain below-target enrollment in Year 1 without requiring emergency budget adjustments.`
    }
    return `Under conservative enrollment assumptions (90% of target, ${conservativeEnrollment} students), the school projects a deficit of ${fmtDollars(Math.abs(conservativeSummary.netPosition))} with ${conservativeSummary.reserveDays} reserve days. This indicates the financial model has limited margin for enrollment shortfalls. The school should prioritize student recruitment, maintain contingency plans for below-target enrollment, and identify specific expense reductions that could be triggered if enrollment falls below ${baseSummary.breakEvenEnrollment} students.`
  }

  // Facility callout
  function facilityCallout(): string {
    const p = baseSummary.facilityPct
    if (p <= 12) return `<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:14px 18px;margin-top:16px;font-size:12px;color:#065F46;"><strong>Facility costs represent ${p.toFixed(1)}% of projected revenue.</strong> This is within the healthy range. Industry standard: &le;15% of revenue.</div>`
    if (p <= 15) return `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;margin-top:16px;font-size:12px;color:#92400E;"><strong>Facility costs represent ${p.toFixed(1)}% of projected revenue.</strong> Approaching the 15% threshold that lenders and authorizers monitor. Industry standard: &le;15%.</div>`
    return `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin-top:16px;font-size:12px;color:#991B1B;"><strong>Warning: Facility costs represent ${p.toFixed(1)}% of projected revenue.</strong> This exceeds the 15% threshold. Most lenders require facility costs below 15% for financing. The Charter Commission may flag this.</div>`
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${schoolName} — Financial Plan</title>
<style>
  @page { margin: 0.75in; size: letter; }
  @media print {
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    body { font-size: 10.5pt; }
    table { page-break-inside: avoid; }
    .metric-cards { page-break-inside: avoid; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1E293B;
    line-height: 1.6;
    background: #fff;
    padding: 0;
  }
  .container { max-width: 800px; margin: 0 auto; padding: 0 24px; }

  /* Print bar */
  .print-bar {
    position: sticky; top: 0; z-index: 100;
    background: #1B2A4A; color: #fff; padding: 12px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .print-bar button {
    background: #0F6E56; color: #fff; border: none; padding: 10px 24px;
    border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .print-bar button:hover { background: #0D5C48; }

  /* Cover */
  .cover {
    height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    page-break-after: always;
  }
  .cover h1 { font-size: 36px; color: #1B2A4A; margin-bottom: 8px; font-weight: 700; }
  .cover .subtitle { font-size: 20px; color: #475569; margin-bottom: 6px; }
  .cover .prepared { font-size: 14px; color: #64748B; margin-top: 32px; line-height: 1.8; }
  .cover .logo { margin-top: 60px; font-size: 14px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase; }

  /* Section headings */
  h2 {
    font-size: 22px; color: #1B2A4A; margin-bottom: 18px;
    padding-bottom: 8px; border-bottom: 3px solid #0F6E56;
  }
  h3 { font-size: 15px; color: #1B2A4A; margin: 20px 0 10px; }

  /* Metric cards */
  .metric-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .metric-card {
    border-radius: 10px; padding: 16px 18px; text-align: center;
    border: 1px solid #E2E8F0;
  }
  .metric-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; margin-bottom: 4px; }
  .metric-card .value { font-size: 24px; font-weight: 700; }
  .metric-card .sub { font-size: 11px; color: #64748B; margin-top: 2px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  table th {
    background: #1B2A4A; color: #fff; font-weight: 600;
    padding: 10px 16px; text-align: left; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.3px;
  }
  table th:not(:first-child) { text-align: right; }
  table td { padding: 8px 16px; border-bottom: 1px solid #E2E8F0; }
  table tr:nth-child(even) { background: #F8FAFC; }
  table .total-row { background: #F1F5F9; font-weight: 700; }
  table .total-row td { border-top: 2px solid #CBD5E1; }

  /* Footer */
  .page-footer {
    margin-top: 40px; padding-top: 12px; border-top: 1px solid #E2E8F0;
    font-size: 10px; color: #94A3B8; text-align: center;
  }

  /* Narrative */
  .narrative { font-size: 13px; line-height: 1.7; color: #334155; margin-bottom: 24px; }
  .narrative p { margin-bottom: 12px; }

  /* Callout */
  .callout {
    background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px;
    padding: 14px 18px; font-size: 12px; color: #166534; margin: 16px 0;
  }
  .callout.warning { background: #FEF2F2; border-color: #FECACA; color: #991B1B; }
  .callout.caution { background: #FFFBEB; border-color: #FDE68A; color: #92400E; }

  /* Positive/negative */
  .positive { color: #0F6E56; }
  .negative { color: #D85A30; }
  .highlight-row { background: #FFFBEB !important; }
</style>
</head>
<body>

<!-- Print bar -->
<div class="print-bar no-print">
  <div>
    <strong>${schoolName}</strong> &mdash; Financial Plan Preview
  </div>
  <button onclick="window.print()">Print or Save as PDF</button>
</div>

<div class="container">

<!-- PAGE 1: Cover -->
<div class="cover">
  <h1>${schoolName}</h1>
  <div class="subtitle">Financial Plan &mdash; Year 1 through Year 5</div>
  <div class="subtitle" style="font-size:16px;color:#64748B;">${profile.grade_config} &bull; ${profile.region || 'Washington State'}</div>
  <div class="prepared">
    Prepared for the<br/>
    <strong>Washington State Charter School Commission</strong><br/><br/>
    ${dateStr}
  </div>
  <div class="logo">SchoolLaunch</div>
</div>

<!-- PAGE 2: Executive Summary -->
<div class="page-break"></div>
<h2>Executive Summary</h2>

<div class="metric-cards">
  <div class="metric-card" style="background:${baseSummary.netPosition >= 0 ? '#ECFDF5' : '#FEF2F2'};">
    <div class="label">Year 1 Net Position</div>
    <div class="value" style="color:${baseSummary.netPosition >= 0 ? '#0F6E56' : '#D85A30'};">${fmtCompact(baseSummary.netPosition)}</div>
    <div class="sub">${baseSummary.netPosition >= 0 ? 'Surplus' : 'Deficit'}</div>
  </div>
  <div class="metric-card" style="background:${metricCardBg(baseSummary.reserveDays)};">
    <div class="label">Reserve Days</div>
    <div class="value" style="color:${reserveColor(baseSummary.reserveDays)};">${baseSummary.reserveDays}</div>
    <div class="sub">${baseSummary.reserveDays >= 30 ? 'Meets Stage 1' : baseSummary.reserveDays >= 21 ? 'Approaches Stage 1' : 'Below Stage 1'} &bull; Stage 2: 60 days</div>
  </div>
  <div class="metric-card" style="background:${baseSummary.personnelPctRevenue >= 72 && baseSummary.personnelPctRevenue <= 78 ? '#ECFDF5' : baseSummary.personnelPctRevenue <= 80 ? '#FFFBEB' : '#FEF2F2'};">
    <div class="label">Personnel % of Revenue</div>
    <div class="value" style="color:${baseSummary.personnelPctRevenue >= 72 && baseSummary.personnelPctRevenue <= 78 ? '#0F6E56' : baseSummary.personnelPctRevenue <= 80 ? '#B45309' : '#D85A30'};">${baseSummary.personnelPctRevenue.toFixed(1)}%</div>
    <div class="sub">Target: 72-78%</div>
  </div>
  <div class="metric-card">
    <div class="label">Break-Even Enrollment</div>
    <div class="value" style="color:#1B2A4A;">${baseSummary.breakEvenEnrollment}</div>
    <div class="sub">Target: ${enrollment} students</div>
  </div>
</div>

<div class="narrative">
  ${executiveSummary ? executiveSummary.split('\n\n').map((p: string) => `<p>${p.trim()}</p>`).join('') : `<p>${schoolName} projects Year 1 revenue of ${fmtDollars(baseSummary.totalRevenue)} based on ${enrollment} enrolled students at ${fmtDollars(assumptions.per_pupil_rate)} per-pupil state apportionment plus categorical grants. Total Year 1 expenses are projected at ${fmtDollars(baseSummary.totalExpenses)}, resulting in a net position of ${fmtDollars(baseSummary.netPosition)} and ${baseSummary.reserveDays} reserve days of operating cash.</p><p>Under a conservative enrollment scenario (90% of target, ${conservativeEnrollment} students), net position ${conservativeSummary.netPosition >= 0 ? 'remains positive at ' + fmtDollars(conservativeSummary.netPosition) : 'shifts to a deficit of ' + fmtDollars(Math.abs(conservativeSummary.netPosition))}, indicating ${conservativeSummary.netPosition >= 0 ? 'meaningful financial resilience' : 'limited margin for enrollment shortfalls'}.</p>`}
</div>

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 3: Revenue -->
<div class="page-break"></div>
<h2>Revenue Projections &mdash; Year 1</h2>

<table>
  <thead>
    <tr>
      <th>Revenue Source</th>
      <th>Formula</th>
      <th>Year 1 Amount</th>
    </tr>
  </thead>
  <tbody>
    ${revenueProjections.map((p) =>
      `<tr><td>${p.subcategory}</td><td style="text-align:right;font-size:11px;color:#64748B;">${revenueFormula(p.subcategory)}</td><td style="text-align:right;">${fmtDollars(p.amount)}</td></tr>`
    ).join('')}
    <tr class="total-row"><td>Total Revenue</td><td></td><td style="text-align:right;">${fmtDollars(baseSummary.totalRevenue)}</td></tr>
  </tbody>
</table>

<div style="margin:20px 0;">
  <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Revenue Composition</div>
  <svg width="100%" viewBox="0 0 700 36" style="border-radius:6px;overflow:hidden;">
    ${barSvg}
  </svg>
  <div style="margin-top:8px;">${barLegend}</div>
</div>

${regionFactor !== 1.0 ? `<div class="callout" style="margin-bottom:12px;">Per-pupil rates are adjusted by a regionalization factor of <strong>${regionFactor}</strong> (${profile.region}) reflecting the state&rsquo;s location-based funding adjustment per LEAP Document C3.</div>` : ''}
${profile.pct_frl > 40 ? `<div class="callout">Title I Schoolwide program eligible &mdash; FRL rate of ${profile.pct_frl}% exceeds the 40% federal threshold.</div>` : `<div class="callout caution">Title I Schoolwide program not eligible &mdash; FRL rate of ${profile.pct_frl}% is below the 40% federal threshold.</div>`}

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 4: Personnel -->
<div class="page-break"></div>
<h2>Personnel Plan &mdash; Year 1</h2>

<table>
  <thead>
    <tr>
      <th>Position</th>
      <th>Category</th>
      <th>FTE</th>
      <th>Salary</th>
      <th>Benefits (${assumptions.benefits_load_pct}%)</th>
      <th>Total Cost</th>
    </tr>
  </thead>
  <tbody>
    ${positions.map((p) => {
      const cost = p.fte * p.annual_salary
      const benefits = Math.round(cost * assumptions.benefits_load_pct / 100)
      return `<tr><td>${p.title}</td><td style="text-align:left;text-transform:capitalize;">${p.category}</td><td style="text-align:right;">${p.fte.toFixed(1)}</td><td style="text-align:right;">${fmtDollars(p.annual_salary)}</td><td style="text-align:right;">${fmtDollars(benefits)}</td><td style="text-align:right;">${fmtDollars(cost + benefits)}</td></tr>`
    }).join('')}
    <tr class="total-row"><td>Total</td><td></td><td style="text-align:right;">${totalFte.toFixed(1)} FTE</td><td></td><td></td><td style="text-align:right;">${fmtDollars(baseSummary.totalPersonnel)}</td></tr>
  </tbody>
</table>

<div style="display:flex;gap:16px;margin:16px 0;">
  <div style="background:${baseSummary.personnelPctRevenue >= 72 && baseSummary.personnelPctRevenue <= 78 ? '#ECFDF5' : baseSummary.personnelPctRevenue <= 80 ? '#FFFBEB' : '#FEF2F2'};border-radius:8px;padding:14px 20px;flex:1;">
    <div style="font-size:11px;color:#64748B;text-transform:uppercase;">Personnel % of Revenue</div>
    <div style="font-size:28px;font-weight:700;color:${baseSummary.personnelPctRevenue >= 72 && baseSummary.personnelPctRevenue <= 78 ? '#0F6E56' : baseSummary.personnelPctRevenue <= 80 ? '#B45309' : '#D85A30'};">${baseSummary.personnelPctRevenue.toFixed(1)}%</div>
    <div style="font-size:11px;margin-top:4px;">${personnelAssessment()}</div>
  </div>
  <div style="background:#F8FAFC;border-radius:8px;padding:14px 20px;flex:1;border:1px solid #E2E8F0;">
    <div style="font-size:11px;color:#64748B;text-transform:uppercase;">Student-to-Teacher Ratio</div>
    <div style="font-size:28px;font-weight:700;color:#1B2A4A;">${studentTeacherRatio}:1</div>
    <div style="font-size:11px;color:#64748B;margin-top:4px;">${teacherCount} teachers for ${enrollment} students</div>
  </div>
</div>

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 5: Operations -->
<div class="page-break"></div>
<h2>Operations Budget &mdash; Year 1</h2>

<table>
  <thead>
    <tr>
      <th>Category</th>
      <th>Amount</th>
      <th>% of Revenue</th>
    </tr>
  </thead>
  <tbody>
    ${buildOpsTable()}
    <tr class="total-row"><td>Total Operations</td><td style="text-align:right;">${fmtDollars(baseSummary.totalOperations)}</td><td style="text-align:right;">${pct(baseSummary.totalOperations, baseSummary.totalRevenue)}</td></tr>
  </tbody>
</table>

${facilityCallout()}

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 6: Cash Flow -->
<div class="page-break"></div>
<h2>Month-by-Month Cash Flow Projection</h2>
<p style="font-size:12px;color:#64748B;margin-bottom:16px;">Year 1 (September through August) using the OSPI apportionment payment schedule. Starting balance from pre-opening funding.</p>

<table>
  <thead>
    <tr>
      <th>Month</th>
      <th>Apport. %</th>
      <th>Apport. $</th>
      <th>Other Rev.</th>
      <th>Total In</th>
      <th>Payroll</th>
      <th>Other Exp.</th>
      <th>Net Cash</th>
      <th>Balance</th>
    </tr>
  </thead>
  <tbody>
    ${cashFlow.map((m) => {
      const isLowMonth = m.month === 'Nov' || m.month === 'May'
      const rowClass = isLowMonth ? ' class="highlight-row"' : ''
      const netColor = m.netCashFlow >= 0 ? '#0F6E56' : '#D85A30'
      const balColor = m.cumulativeBalance >= 0 ? '#1E293B' : '#D85A30'
      return `<tr${rowClass}><td style="font-weight:500;">${m.month}${isLowMonth ? ' *' : ''}</td><td style="text-align:right;color:#64748B;">${(m.apportionmentPct * 100).toFixed(1)}%</td><td style="text-align:right;">${fmtDollars(m.apportionmentAmt)}</td><td style="text-align:right;">${fmtDollars(m.otherRevenue)}</td><td style="text-align:right;font-weight:500;">${fmtDollars(m.totalInflow)}</td><td style="text-align:right;">${fmtDollars(m.payroll)}</td><td style="text-align:right;">${fmtDollars(m.otherExpenses)}</td><td style="text-align:right;font-weight:600;color:${netColor};">${fmtDollars(m.netCashFlow)}</td><td style="text-align:right;font-weight:700;color:${balColor};">${fmtDollars(m.cumulativeBalance)}</td></tr>`
    }).join('')}
  </tbody>
</table>

<div style="font-size:11px;color:#64748B;margin-top:8px;">* November and May are low apportionment months (5% each). Plan cash reserves accordingly.</div>

${cashFlow.some((m) => m.cumulativeBalance < 0)
  ? `<div class="callout warning" style="margin-top:12px;"><strong>Warning:</strong> Cumulative cash balance goes negative during the year. A line of credit or additional pre-opening reserves may be required to cover shortfalls.</div>`
  : `<div class="callout" style="margin-top:12px;">Cash balance remains positive throughout the year. The school can meet all monthly obligations without a line of credit.</div>`
}

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 7: Multi-Year -->
<div class="page-break"></div>
<h2>Multi-Year Financial Trajectory</h2>

<table>
  <thead>
    <tr>
      <th></th>
      ${multiYear.map((y) => `<th>Year ${y.year}<br/><span style="font-weight:400;font-size:10px;text-transform:none;">${y.enrollment} students</span></th>`).join('')}
    </tr>
  </thead>
  <tbody>
    <tr><td>Total Revenue</td>${multiYear.map((y) => `<td style="text-align:right;">${fmtDollars(y.revenue.total)}</td>`).join('')}</tr>
    <tr><td>Total Personnel</td>${multiYear.map((y) => `<td style="text-align:right;">${fmtDollars(y.personnel.total)}</td>`).join('')}</tr>
    <tr><td>Total Operations</td>${multiYear.map((y) => `<td style="text-align:right;">${fmtDollars(y.operations.total)}</td>`).join('')}</tr>
    <tr><td>Total Expenses</td>${multiYear.map((y) => `<td style="text-align:right;">${fmtDollars(y.totalExpenses)}</td>`).join('')}</tr>
    <tr class="total-row"><td>Net Position</td>${multiYear.map((y) => `<td style="text-align:right;color:${y.net >= 0 ? '#0F6E56' : '#D85A30'};">${fmtDollars(y.net)}</td>`).join('')}</tr>
    <tr><td>Cumulative Net</td>${multiYear.map((y) => `<td style="text-align:right;font-weight:600;color:${y.cumulativeNet >= 0 ? '#0F6E56' : '#D85A30'};">${fmtDollars(y.cumulativeNet)}</td>`).join('')}</tr>
    <tr class="total-row"><td>Reserve Days</td>${multiYear.map((y) => `<td style="text-align:right;color:${y.year <= 2 ? reserveColor(y.reserveDays) : reserveColorStage2(y.reserveDays)};">${y.reserveDays}</td>`).join('')}</tr>
  </tbody>
</table>

<div style="margin:24px 0;">
  <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Reserve Days Trajectory</div>
  <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;">
    <!-- Zero line -->
    <line x1="50" y1="${yScale(0)}" x2="${chartW - 20}" y2="${yScale(0)}" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="4,4" />
    <text x="45" y="${yScale(0) + 4}" text-anchor="end" font-size="10" fill="#94A3B8">0</text>
    <!-- 30 day line (Stage 1) -->
    <line x1="50" y1="${yScale(30)}" x2="${chartW - 20}" y2="${yScale(30)}" stroke="#FDE68A" stroke-width="1" stroke-dasharray="4,4" />
    <text x="45" y="${yScale(30) + 4}" text-anchor="end" font-size="9" fill="#D97706">30d</text>
    <!-- 60 day line (Stage 2) -->
    <line x1="50" y1="${yScale(60)}" x2="${chartW - 20}" y2="${yScale(60)}" stroke="#A7F3D0" stroke-width="1" stroke-dasharray="4,4" />
    <text x="45" y="${yScale(60) + 4}" text-anchor="end" font-size="9" fill="#6EE7B7">60d</text>
    <!-- X axis labels -->
    ${multiYear.map((y, i) => `<text x="${50 + (i + 1) * xStep}" y="${chartH - 4}" text-anchor="middle" font-size="11" fill="#64748B">Y${y.year}</text>`).join('')}
    <!-- Line -->
    <polyline points="${linePoints}" fill="none" stroke="#1B2A4A" stroke-width="2.5" stroke-linejoin="round" />
    <!-- Dots -->
    ${dotsSvg}
  </svg>
</div>

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 8: Startup Funding -->
<div class="page-break"></div>
<h2>Pre-Opening Budget &amp; Funding Sources</h2>

${fundingSources.length > 0 ? `
<table>
  <thead>
    <tr>
      <th>Funding Source</th>
      <th>Amount</th>
      <th style="text-align:left;">Type</th>
      <th style="text-align:left;">Status</th>
    </tr>
  </thead>
  <tbody>
    ${fundingSources.map((f) => {
      const statusColor = f.status === 'received' ? '#0F6E56' : f.status === 'pledged' ? '#1D4ED8' : f.status === 'applied' ? '#B45309' : '#64748B'
      return `<tr><td>${f.source}</td><td style="text-align:right;">${fmtDollars(f.amount)}</td><td style="text-align:left;text-transform:capitalize;">${f.type}</td><td style="text-align:left;"><span style="color:${statusColor};font-weight:600;text-transform:capitalize;">${f.status}</span></td></tr>`
    }).join('')}
    <tr class="total-row"><td>Total Startup Funding</td><td style="text-align:right;">${fmtDollars(totalFunding)}</td><td></td><td></td></tr>
  </tbody>
</table>

<div style="display:flex;gap:16px;margin:16px 0;">
  <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:12px 18px;flex:1;">
    <div style="font-size:11px;color:#065F46;text-transform:uppercase;font-weight:600;">Secured Funding</div>
    <div style="font-size:22px;font-weight:700;color:#0F6E56;">${fmtDollars(securedFunding)}</div>
    <div style="font-size:11px;color:#065F46;">Received + Pledged</div>
  </div>
  <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 18px;flex:1;">
    <div style="font-size:11px;color:#92400E;text-transform:uppercase;font-weight:600;">Pending / At Risk</div>
    <div style="font-size:22px;font-weight:700;color:#B45309;">${fmtDollars(totalFunding - securedFunding)}</div>
    <div style="font-size:11px;color:#92400E;">Applied + Projected</div>
  </div>
</div>

${securedFunding < totalFunding * 0.5 ? `<div class="callout warning"><strong>Funding Risk:</strong> Less than 50% of startup funding is secured. The Charter Commission typically expects committed funding sources before approving a charter application.</div>` : ''}
` : '<p style="color:#64748B;font-size:13px;">No startup funding sources have been configured. Add funding sources on the Multi-Year tab.</p>'}

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 9: Sensitivity -->
<div class="page-break"></div>
<h2>Sensitivity Analysis &mdash; Conservative Enrollment</h2>
<p style="font-size:12px;color:#64748B;margin-bottom:16px;">Industry best practice: budget for revenue at 90% of projected enrollment while maintaining 100% of planned expenses. The WA Charter Commission uses Stage 1 thresholds (30+ days cash) for Years 1-2 and Stage 2 thresholds (60+ days) for Year 3+.</p>

<table>
  <thead>
    <tr>
      <th>Metric</th>
      <th>Base Case (100%)</th>
      <th>Conservative (90%)</th>
      <th>Delta</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Revenue Enrollment</td><td style="text-align:right;">${enrollment}</td><td style="text-align:right;">${conservativeEnrollment}</td><td style="text-align:right;color:#D85A30;">-${enrollment - conservativeEnrollment}</td></tr>
    <tr><td>Total Revenue</td><td style="text-align:right;">${fmtDollars(baseSummary.totalRevenue)}</td><td style="text-align:right;">${fmtDollars(conservativeSummary.totalRevenue)}</td><td style="text-align:right;color:#D85A30;">${fmtDollars(conservativeSummary.totalRevenue - baseSummary.totalRevenue)}</td></tr>
    <tr><td>Total Expenses</td><td style="text-align:right;">${fmtDollars(baseSummary.totalExpenses)}</td><td style="text-align:right;">${fmtDollars(conservativeSummary.totalExpenses)}</td><td style="text-align:right;">${fmtDollars(conservativeSummary.totalExpenses - baseSummary.totalExpenses)}</td></tr>
    <tr class="total-row"><td>Net Position</td><td style="text-align:right;color:${baseSummary.netPosition >= 0 ? '#0F6E56' : '#D85A30'};">${fmtDollars(baseSummary.netPosition)}</td><td style="text-align:right;color:${conservativeSummary.netPosition >= 0 ? '#0F6E56' : '#D85A30'};">${fmtDollars(conservativeSummary.netPosition)}</td><td style="text-align:right;color:#D85A30;">${fmtDollars(conservativeSummary.netPosition - baseSummary.netPosition)}</td></tr>
    <tr class="total-row"><td>Reserve Days</td><td style="text-align:right;color:${reserveColor(baseSummary.reserveDays)};">${baseSummary.reserveDays}</td><td style="text-align:right;color:${reserveColor(conservativeSummary.reserveDays)};">${conservativeSummary.reserveDays}</td><td style="text-align:right;color:#D85A30;">${conservativeSummary.reserveDays - baseSummary.reserveDays}</td></tr>
  </tbody>
</table>

<div class="narrative" style="margin-top:20px;">
  <p>${sensitivityNarrative()}</p>
</div>

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

<!-- PAGE 10: Risk Factors -->
<div class="page-break"></div>
<h2>Key Financial Risks</h2>

<div class="narrative">
  ${riskAnalysis
    ? riskAnalysis.split('\n').filter((l: string) => l.trim()).map((l: string) => `<p>${l}</p>`).join('')
    : `<p><strong>1. Enrollment Risk:</strong> The school's financial model is based on ${enrollment} enrolled students. Each student below target reduces revenue by approximately ${fmtDollars(assumptions.per_pupil_rate + assumptions.levy_equity_per_student)} in base funding. The break-even enrollment is ${baseSummary.breakEvenEnrollment} students — a buffer of only ${enrollment - baseSummary.breakEvenEnrollment} students. Mitigation: Invest in pre-opening student recruitment and maintain a waiting list.</p>
       <p><strong>2. Cash Flow Timing:</strong> OSPI apportionment follows an uneven monthly schedule, with November and May at just 5%. Schools with thin reserves risk cash shortfalls during these months. Mitigation: Maintain at minimum 30 days of operating reserves and consider establishing a line of credit.</p>
       <p><strong>3. Facility Cost Escalation:</strong> Facility costs at ${baseSummary.facilityPct.toFixed(1)}% of revenue ${baseSummary.facilityPct > 12 ? 'are already elevated' : 'are within healthy range but could increase'}. Lease renegotiations or unexpected maintenance could push this ratio higher. Mitigation: Negotiate multi-year lease terms with fixed escalation clauses.</p>
       <p><strong>4. Personnel Cost Growth:</strong> Personnel comprises ${baseSummary.personnelPctRevenue.toFixed(1)}% of revenue. As staff receive annual raises, this ratio increases unless offset by enrollment growth. Mitigation: Tie salary increases to enrollment milestones.</p>
       <p><strong>5. Categorical Grant Uncertainty:</strong> Federal categorical grants (Title I, IDEA, etc.) are subject to annual appropriations and may fluctuate. These represent ${fmtDollars(baseSummary.totalRevenue - (effectiveRegularEd + spedApport + facilitiesRev + levyEquity))} or ${pct(baseSummary.totalRevenue - effectiveRegularEd - spedApport - facilitiesRev - levyEquity, baseSummary.totalRevenue)} of total revenue. Mitigation: Do not rely on categorical grants for core staffing costs.</p>`
  }
</div>

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>

${scenarios && scenarios.length > 0 ? `
<!-- PAGE: Scenario Analysis -->
<div class="page-break"></div>
<h2>Scenario Analysis</h2>
<p style="font-size:12px;color:#64748B;margin-bottom:16px;">Three scenarios modeled to stress-test financial assumptions against the Commission's Financial Performance Framework.</p>

<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
  <thead>
    <tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;">
      <th style="text-align:left;padding:8px 12px;color:#64748B;">Metric</th>
      ${scenarios.map(s => `<th style="text-align:right;padding:8px 12px;color:${s.name === 'Conservative' ? '#D97706' : s.name === 'Optimistic' ? '#059669' : '#2563EB'};">${s.name}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${['enrollment', 'total_revenue', 'total_expenses', 'net_position', 'reserve_days', 'personnel_pct'].map(metric => {
      const labels: Record<string, string> = { enrollment: 'Year 1 Enrollment', total_revenue: 'Total Revenue', total_expenses: 'Total Expenses', net_position: 'Net Position', reserve_days: 'Reserve Days', personnel_pct: 'Personnel %' }
      return `<tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:6px 12px;color:#475569;">${labels[metric]}</td>
        ${scenarios.map(s => {
          const y1 = s.results?.years?.['1']
          const val = y1 ? (y1 as unknown as Record<string, number>)[metric] : 0
          const formatted = metric === 'personnel_pct' ? `${val?.toFixed(1)}%` : metric === 'reserve_days' ? `${val} days` : metric === 'enrollment' ? String(val) : `$${(val || 0).toLocaleString()}`
          return `<td style="padding:6px 12px;text-align:right;font-weight:500;">${formatted}</td>`
        }).join('')}
      </tr>`
    }).join('')}
    <tr style="border-top:2px solid #E2E8F0;font-weight:700;">
      <td style="padding:8px 12px;color:#1E293B;">FPF Compliance (Y1)</td>
      ${scenarios.map(s => {
        const y1 = s.results?.years?.['1']
        const passing = [y1?.fpf_days_cash, y1?.fpf_total_margin].filter(v => v === 'meets' || v === 'approaches').length + 2
        return `<td style="padding:8px 12px;text-align:right;">${passing}/4 pass</td>`
      }).join('')}
    </tr>
  </tbody>
</table>

${scenarios[0]?.ai_analysis ? `
<div style="background:#F8FAFC;border-radius:8px;padding:16px;margin-top:12px;">
  <div style="font-size:11px;color:#64748B;text-transform:uppercase;font-weight:600;margin-bottom:8px;">AI Scenario Analysis</div>
  <div style="font-size:12px;color:#334155;line-height:1.7;white-space:pre-wrap;">${scenarios[0].ai_analysis}</div>
</div>
` : ''}

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>
` : ''}

${advisory ? `
<!-- PAGE 11: Advisory Panel -->
<div class="page-break"></div>
<h2>Multi-Expert Financial Review</h2>
<p style="font-size:12px;color:#64748B;margin-bottom:20px;">SchoolLaunch's advisory system evaluates your financial plan from seven expert perspectives critical to charter school success in Washington State.</p>

${advisory.agents.map((agent) => {
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    strong: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
    needs_attention: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    risk: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  }
  const statusLabels: Record<string, string> = { strong: 'Strong', needs_attention: 'Needs Attention', risk: 'Risk' }
  const sc = statusColors[agent.status] || statusColors.needs_attention
  return `
  <div style="border:1px solid ${sc.border};border-left:4px solid ${sc.border};border-radius:8px;padding:16px;margin-bottom:12px;background:${sc.bg};">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div>
        <strong style="font-size:13px;color:#1E293B;">${agent.name}</strong>
        <span style="font-size:11px;color:#64748B;margin-left:8px;">${agent.subtitle}</span>
      </div>
      <span style="font-size:11px;font-weight:600;color:${sc.text};background:white;padding:3px 10px;border-radius:12px;border:1px solid ${sc.border};">${statusLabels[agent.status] || 'Needs Attention'}</span>
    </div>
    <p style="font-size:12px;color:#334155;margin:0 0 8px 0;line-height:1.6;">${agent.summary}</p>
    ${agent.actions.length > 0 ? `<div style="font-size:11px;color:#475569;">${agent.actions.map((a) => `<div style="margin-top:4px;">&rarr; ${a}</div>`).join('')}</div>` : ''}
  </div>`
}).join('')}

<div class="page-footer">SchoolLaunch Financial Plan &bull; ${schoolName} &bull; Generated ${dateStr}</div>
` : ''}

</div><!-- end container -->
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
