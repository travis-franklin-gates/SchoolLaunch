'use client'

import { useState } from 'react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { HealthTile } from '@/components/ui/HealthTile'
import { Callout } from '@/components/ui/Callout'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormField } from '@/components/ui/FormField'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { PercentInput } from '@/components/ui/PercentInput'
import { Tabs } from '@/components/ui/Tabs'
import { DataTable, type DataTableColumn, type DataTableRow } from '@/components/ui/DataTable'
import { Skeleton } from '@/components/ui/Skeleton'
import { Dialog } from '@/components/ui/Dialog'
import { ToastProvider, toast } from '@/components/ui/Toast'

interface OpsRow {
  lineItem: string
  rate: string
  amount: number
}

const TABLE_COLUMNS: DataTableColumn<OpsRow>[] = [
  { key: 'lineItem', header: 'Expense' },
  { key: 'rate', header: 'Rate', cellClassName: 'text-xs text-slate-500' },
  { key: 'amount', header: 'Amount', numeric: true, render: (r) => r.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) },
]

const TABLE_ROWS: DataTableRow<OpsRow>[] = [
  { type: 'header', key: 'h-instr', label: 'Instructional' },
  { type: 'item', key: 'supplies', data: { lineItem: 'Supplies & Materials', rate: '$120/student', amount: 21600 } },
  { type: 'item', key: 'tech', data: { lineItem: 'Technology', rate: '$240/student', amount: 43200 } },
  { type: 'subtotal', key: 'sub-instr', label: 'Subtotal: Instructional', values: { rate: '', amount: '$64,800' } },
  { type: 'header', key: 'h-admin', label: 'Administrative' },
  { type: 'item', key: 'auth', data: { lineItem: 'Authorizer Fee', rate: '3% of state appn.', amount: 47640 } },
  { type: 'total', key: 'tot', label: 'Total Operations', values: { rate: '', amount: '$112,440' } },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white border border-slate-200 rounded-xl p-6 mb-6" style={{ boxShadow: 'var(--shadow-1)' }}>
      <h2 data-testid={`section-${id}`} className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4" style={{ fontFamily: 'var(--font-heading-var)' }}>
        {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}

function ControlledTabs() {
  const [seg, setSeg] = useState('y0')
  const [ul, setUl] = useState('overview')
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs text-slate-500 mb-2">Segmented</div>
        <Tabs
          variant="segmented"
          ariaLabel="Cash flow year"
          value={seg}
          onValueChange={setSeg}
          items={[
            { value: 'y0', label: 'Year 0 (Pre-Opening)' },
            { value: 'y1', label: 'Year 1' },
            { value: 'y2', label: 'Year 2', disabled: true },
          ]}
        />
      </div>
      <div>
        <div className="text-xs text-slate-500 mb-2">Underlined</div>
        <Tabs
          variant="underlined"
          ariaLabel="Section"
          value={ul}
          onValueChange={setUl}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'detail', label: 'Detail' },
            { value: 'history', label: 'History' },
          ]}
        />
      </div>
    </div>
  )
}

function ControlledInputs() {
  const [currency, setCurrency] = useState(125000)
  const [pct, setPct] = useState(12.5)
  return (
    <div className="flex flex-col gap-4 max-w-md">
      <FormField label="Founder salary (Y1)" helperText="Includes benefits load.">
        {(id) => <CurrencyInput id={id} value={currency} onChange={setCurrency} step={1000} />}
      </FormField>
      {/* FIXME(F-001): showcase intentionally uses different copy than production. */}
      {/* Production personnel-% bands live in src/lib/healthThresholds.ts. Don't sync. */}
      <FormField label="Personnel target" helperText="Healthy charters typically run 75–80% of revenue.">
        {(id) => <PercentInput id={id} value={pct} onChange={setPct} step={0.5} />}
      </FormField>
      <FormField label="Authorizer fee" required errorText="WA charter authorizer fee is fixed at 3% — value cannot be changed.">
        {(id) => <PercentInput id={id} value={3} onChange={() => undefined} disabled />}
      </FormField>
    </div>
  )
}

function ControlledDialog() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
      >
        Open dialog
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Reset school?"
        description="This will clear all positions, projections, and scenarios. The action cannot be undone."
        actions={
          <>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
            >
              Reset
            </button>
          </>
        }
      />
    </div>
  )
}

export default function Showcase() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ToastProvider />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <PageHeader
          title="UI primitives"
          subtitle="Phase 1 design-system surface. Visual regression target."
          badges={<StatusBadge status="meets" label="Phase 1" />}
          actions={
            <button
              onClick={() => toast.success('Toast fired', { description: 'Sonner is wired up.' })}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
            >
              Fire toast
            </button>
          }
        />

        <Section id="status-health" title="Status & Health">
          <div className="flex flex-wrap gap-3 mb-6">
            <StatusBadge status="meets" />
            <StatusBadge status="approaching" />
            <StatusBadge status="fails" />
            <StatusBadge status="na" />
            <StatusBadge status="meets" label="On Target" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <HealthTile label="Days of Cash" value={169} status="meets" sublabel="Healthy reserves" valueFormat="compact" />
            <HealthTile label="Personnel %" value={78.4} status="approaching" sublabel="Watch closely" valueFormat="percent" />
            <HealthTile label="Net Position" value={-45200} status="fails" sublabel="Y1 deficit" valueFormat="currency" />
            <HealthTile label="Enrollment" value={0} status="na" sublabel="Not yet projected" valueFormat="compact" />
          </div>
        </Section>

        <Section id="callouts" title="Callouts">
          <div className="flex flex-col gap-3">
            <Callout variant="info" title="Heads up">
              Cash Flow uses the OSPI apportionment schedule for state revenue.
            </Callout>
            <Callout variant="warn" title="Approaching threshold" dismissible>
              Personnel ratio at 80% — Commission recommends staying below 78% in Stage 1.
            </Callout>
            <Callout variant="crit" title="Below standard">
              Days of Cash at 12 — Stage 1 minimum is 30. This will fail the Commission scorecard.
            </Callout>
            <Callout variant="info">No-title callout for inline informational notes that don&apos;t need a heading.</Callout>
          </div>
        </Section>

        <Section id="page-header-demo" title="Page Header">
          <div className="border border-dashed border-slate-200 rounded-lg p-4">
            <PageHeader
              title="Scenario Engine"
              subtitle="Model conservative, base, and optimistic scenarios side-by-side."
              badges={<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">Sandbox · changes don&apos;t affect your real model</span>}
              actions={
                <>
                  <button className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                  <button className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg">Recalculate</button>
                </>
              }
            />
          </div>
        </Section>

        <Section id="form-fields" title="Form Fields & Numeric Inputs">
          <ControlledInputs />
        </Section>

        <Section id="tabs" title="Tabs">
          <ControlledTabs />
        </Section>

        <Section id="data-table" title="DataTable">
          <DataTable columns={TABLE_COLUMNS} rows={TABLE_ROWS} caption="Operations breakdown — sample data" />
        </Section>

        <Section id="skeleton" title="Skeleton">
          <div className="flex flex-col gap-3 max-w-md">
            <Skeleton width="60%" />
            <Skeleton width="40%" />
            <Skeleton width="80%" />
            <div className="flex gap-3 mt-2">
              <Skeleton width={48} height={48} className="rounded-full" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton width="50%" />
                <Skeleton width="30%" />
              </div>
            </div>
          </div>
        </Section>

        <Section id="dialog-toast" title="Dialog & Toast">
          <ControlledDialog />
        </Section>
      </div>
    </div>
  )
}
