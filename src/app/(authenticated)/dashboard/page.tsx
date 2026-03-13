'use client'

import { useState } from 'react'
import { useScenario } from '@/lib/ScenarioContext'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function reserveColor(days: number) {
  if (days >= 60) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
  if (days >= 30) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
}

function facilityColor(pct: number) {
  if (pct <= 12) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
  if (pct <= 15) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
}

function HealthTile({ label, value, subtitle, colorClass }: {
  label: string
  value: string
  subtitle?: string
  colorClass?: { bg: string; text: string; border: string }
}) {
  const bg = colorClass?.bg || 'bg-white'
  const text = colorClass?.text || 'text-slate-800'
  const border = colorClass?.border || 'border-slate-200'
  return (
    <div className={`${bg} ${border} border rounded-xl p-5`}>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${text}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const {
    schoolData: { profile, projections, loading },
    baseSummary,
    scenario,
    scenarioInputs,
    scenarioSummary,
    isModified,
    currentSummary: current,
    conservativeMode,
    conservativeSummary,
    setConservativeMode,
    updateScenario,
    resetScenario,
  } = useScenario()

  const [exporting, setExporting] = useState(false)

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>
  }

  const rc = reserveColor(current.reserveDays)
  const surplusColor = current.netPosition >= 0
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  const personnelColor = current.personnelPctRevenue < 72
    ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
    : current.personnelPctRevenue <= 78
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : current.personnelPctRevenue <= 80
    ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
    : { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }

  const facilityCost = projections.find((p) => p.subcategory === 'Facilities' && !p.is_revenue)?.amount || 0
  const fc = facilityColor(current.facilityPct)

  const conservativeEnrollment = Math.floor(profile.target_enrollment_y1 * 0.9)

  const delta = (base: number, curr: number, unit: string, invert = false) => {
    if (!isModified && !conservativeMode) return null
    const diff = curr - base
    if (diff === 0) return null
    const arrow = (invert ? -diff : diff) > 0 ? '\u2191' : '\u2193'
    return `${arrow}${Math.abs(Math.round(diff))} ${unit} from base`
  }

  async function handleExport() {
    setExporting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()

      // Cover
      doc.setFontSize(28)
      doc.setTextColor(30, 41, 59)
      doc.text(profile.grade_config ? `${profile.grade_config}` : '', pageW / 2, 60, { align: 'center' })
      doc.setFontSize(22)
      doc.text('Financial Plan', pageW / 2, 75, { align: 'center' })
      doc.setFontSize(14)
      doc.text('Year 1 through Year 4', pageW / 2, 88, { align: 'center' })
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(`Prepared by SchoolLaunch  |  ${new Date().toLocaleDateString()}`, pageW / 2, 105, { align: 'center' })

      // Revenue page
      doc.addPage()
      doc.setFontSize(16)
      doc.setTextColor(30, 41, 59)
      doc.text('Revenue Assumptions', 14, 20)

      const revenueRows = projections
        .filter((p) => p.is_revenue)
        .map((p) => [p.subcategory, fmt(p.amount)])
      revenueRows.push(['Total Revenue', fmt(baseSummary.totalRevenue)])

      autoTable(doc, {
        startY: 28,
        head: [['Revenue Source', 'Amount']],
        body: revenueRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
      })

      // Personnel page
      doc.addPage()
      doc.setFontSize(16)
      doc.text('Personnel Plan', 14, 20)
      doc.setFontSize(10)
      doc.text(`Personnel as % of Revenue: ${baseSummary.personnelPctRevenue.toFixed(1)}%`, 14, 28)

      // Operations page
      doc.addPage()
      doc.setFontSize(16)
      doc.text('Operations Budget', 14, 20)

      const opsRows = projections
        .filter((p) => !p.is_revenue && p.category === 'Operations')
        .map((p) => [p.subcategory, fmt(p.amount)])
      opsRows.push(['Total Operations', fmt(baseSummary.totalOperations)])

      autoTable(doc, {
        startY: 28,
        head: [['Expense', 'Amount']],
        body: opsRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
      })

      doc.setFontSize(10)
      const opsEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 80
      doc.text(`Facility cost: ${current.facilityPct.toFixed(1)}% of revenue (target: ≤15%)`, 14, opsEndY + 10)

      // Summary page
      doc.addPage()
      doc.setFontSize(16)
      doc.text('Financial Summary', 14, 20)

      autoTable(doc, {
        startY: 28,
        head: [['Metric', 'Value']],
        body: [
          ['Total Revenue', fmt(baseSummary.totalRevenue)],
          ['Total Personnel', fmt(baseSummary.totalPersonnel)],
          ['Total Operations', fmt(baseSummary.totalOperations)],
          ['Net Position', fmt(baseSummary.netPosition)],
          ['Reserve Days', `${baseSummary.reserveDays} days`],
          ['Personnel % of Revenue', `${baseSummary.personnelPctRevenue.toFixed(1)}%`],
          ['Break-Even Enrollment', `${baseSummary.breakEvenEnrollment} students`],
          ['Facility % of Revenue', `${baseSummary.facilityPct.toFixed(1)}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
      })

      // Conservative sensitivity
      doc.addPage()
      doc.setFontSize(16)
      doc.text('Sensitivity Analysis: 90% Enrollment', 14, 20)
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text('Industry best practice: budget for revenue at 90% of projected enrollment.', 14, 28)
      doc.text(`Revenue enrollment: ${conservativeEnrollment} students / Expense enrollment: ${profile.target_enrollment_y1} students`, 14, 35)

      doc.setTextColor(30, 41, 59)
      autoTable(doc, {
        startY: 42,
        head: [['Metric', 'Base Case', 'Conservative (90%)']],
        body: [
          ['Total Revenue', fmt(baseSummary.totalRevenue), fmt(conservativeSummary.totalRevenue)],
          ['Net Position', fmt(baseSummary.netPosition), fmt(conservativeSummary.netPosition)],
          ['Reserve Days', `${baseSummary.reserveDays}`, `${conservativeSummary.reserveDays}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
      })

      doc.save('SchoolLaunch-Budget-Narrative.pdf')
    } catch (err) {
      console.error('PDF export failed:', err)
    }
    setExporting(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Overview</h1>

      {/* Conservative mode banner */}
      {conservativeMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          <strong>Conservative mode:</strong> Revenue calculated at 90% enrollment ({conservativeEnrollment} students).
          Expenses unchanged ({profile.target_enrollment_y1} students). This reflects the industry-recommended planning
          approach — budget for the revenue you&apos;re likely to receive, not the revenue you hope to receive.
        </div>
      )}

      {/* Health tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <HealthTile
          label="Year-End Reserve"
          value={`${current.reserveDays} days`}
          subtitle={delta(baseSummary.reserveDays, current.reserveDays, 'days') || undefined}
          colorClass={rc}
        />
        <HealthTile
          label="Personnel % of Revenue"
          value={`${current.personnelPctRevenue.toFixed(1)}%`}
          subtitle={delta(baseSummary.personnelPctRevenue, current.personnelPctRevenue, '%', true) || undefined}
          colorClass={personnelColor}
        />
        <HealthTile
          label="Year 1 Surplus/Deficit"
          value={fmt(current.netPosition)}
          subtitle={delta(baseSummary.netPosition, current.netPosition, '') || undefined}
          colorClass={surplusColor}
        />
        <HealthTile
          label="Break-Even Enrollment"
          value={`${current.breakEvenEnrollment} students`}
          subtitle={delta(baseSummary.breakEvenEnrollment, current.breakEvenEnrollment, 'students', true) || undefined}
        />
        <HealthTile
          label="Facility % of Revenue"
          value={`${current.facilityPct.toFixed(1)}%`}
          subtitle={facilityCost > 0 ? `${fmt(facilityCost)}/yr` : undefined}
          colorClass={fc}
        />
      </div>

      {/* 90% enrollment sensitivity alert — always visible */}
      {!conservativeMode && baseSummary.reserveDays !== conservativeSummary.reserveDays && (
        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm text-slate-600">
          <strong>90% enrollment sensitivity:</strong> At {conservativeEnrollment} students,
          reserve days drop from {baseSummary.reserveDays} to{' '}
          <span className={conservativeSummary.reserveDays < 30 ? 'text-red-600 font-semibold' : conservativeSummary.reserveDays < 60 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
            {conservativeSummary.reserveDays} days
          </span>.
          {conservativeSummary.reserveDays < 60 && ' Toggle conservative mode below to plan for this scenario.'}
        </div>
      )}

      {/* Facility cost alert */}
      {current.facilityPct > 15 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700">
          <strong>Warning:</strong> Facility costs exceed 15% of projected revenue. Most lenders require
          facility costs below 15% for financing. The Charter School Commission may flag this during application review.
        </div>
      )}
      {current.facilityPct > 12 && current.facilityPct <= 15 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-700">
          Facility costs at {current.facilityPct.toFixed(1)}% of revenue — approaching the 15% maximum lenders and authorizers look for.
        </div>
      )}

      {/* Scenario panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Scenario Controls</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Opening Enrollment: {scenarioInputs.enrollment}
            </label>
            <input
              type="range"
              min={Math.round(profile.target_enrollment_y1 * 0.5)}
              max={Math.round(profile.target_enrollment_y1 * 1.5)}
              step={1}
              value={scenarioInputs.enrollment}
              onChange={(e) => updateScenario({ enrollment: Number(e.target.value) })}
              className="w-full accent-blue-600"
              disabled={conservativeMode}
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{Math.round(profile.target_enrollment_y1 * 0.5)}</span>
              <span>{Math.round(profile.target_enrollment_y1 * 1.5)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class Size Cap</label>
            <input
              type="number"
              min={15}
              max={30}
              value={scenarioInputs.classSize}
              onChange={(e) => updateScenario({ classSize: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lead Teacher Salary</label>
            <input
              type="number"
              step={1000}
              value={scenarioInputs.leadTeacherSalary}
              onChange={(e) => updateScenario({ leadTeacherSalary: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Monthly Lease</label>
            <input
              type="number"
              step={500}
              value={scenarioInputs.monthlyLease}
              onChange={(e) => updateScenario({ monthlyLease: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">+1 FTE Teacher</label>
            <button
              onClick={() => updateScenario({ extraTeacher: !scenarioInputs.extraTeacher })}
              className={`mt-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scenarioInputs.extraTeacher
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {scenarioInputs.extraTeacher ? 'On' : 'Off'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Budget at 90%</label>
            <button
              onClick={() => {
                setConservativeMode(!conservativeMode)
                if (!conservativeMode) resetScenario()
              }}
              className={`mt-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                conservativeMode
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {conservativeMode ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {(isModified || conservativeMode) && (
          <button
            onClick={() => { resetScenario(); setConservativeMode(false) }}
            className="mt-4 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Reset to Base Case
          </button>
        )}
      </div>

      {/* Budget summary table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 font-semibold text-slate-600"></th>
              <th className="text-right px-6 py-3 font-semibold text-slate-600">Base Case</th>
              {(isModified || conservativeMode) && <th className="text-right px-6 py-3 font-semibold text-blue-600">{conservativeMode ? 'Conservative (90%)' : 'Scenario'}</th>}
              {(isModified || conservativeMode) && <th className="text-right px-6 py-3 font-semibold text-slate-500">Delta</th>}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Total Revenue', base: baseSummary.totalRevenue, curr: current.totalRevenue },
              { label: 'Total Personnel', base: baseSummary.totalPersonnel, curr: current.totalPersonnel },
              { label: 'Total Operations', base: baseSummary.totalOperations, curr: current.totalOperations },
              { label: 'Net Position', base: baseSummary.netPosition, curr: current.netPosition, bold: true },
              { label: 'Reserve Days', base: baseSummary.reserveDays, curr: current.reserveDays, bold: true, isDays: true },
            ].map((row) => {
              const diff = row.curr - row.base
              return (
                <tr key={row.label} className="border-b border-slate-100 last:border-0">
                  <td className={`px-6 py-3 ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {row.label}
                  </td>
                  <td className={`px-6 py-3 text-right ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {row.isDays ? `${row.base} days` : fmt(row.base)}
                  </td>
                  {(isModified || conservativeMode) && (
                    <td className={`px-6 py-3 text-right ${row.bold ? 'font-semibold' : ''} ${
                      row.isDays
                        ? (row.curr >= 60 ? 'text-emerald-600' : row.curr >= 30 ? 'text-amber-600' : 'text-red-600')
                        : row.label === 'Net Position'
                        ? (row.curr >= 0 ? 'text-emerald-600' : 'text-red-600')
                        : 'text-blue-600'
                    }`}>
                      {row.isDays ? `${row.curr} days` : fmt(row.curr)}
                    </td>
                  )}
                  {(isModified || conservativeMode) && (
                    <td className={`px-6 py-3 text-right text-sm ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {diff === 0 ? '—' : row.isDays ? `${diff > 0 ? '+' : ''}${diff}` : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {exporting ? 'Generating...' : 'Export Budget Narrative (PDF)'}
      </button>
    </div>
  )
}
