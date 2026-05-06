import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Page-level skeleton compositions for each dashboard tab. Used in place of
 * spinner "Loading..." text on initial mount so users see a content-shaped
 * preview while data fetches.
 *
 * Built from the Skeleton primitive — no new top-level UI components.
 */

function PageHeaderSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-7 w-64 mb-2" />
      <Skeleton className="h-4 w-96" />
    </div>
  )
}

function TableSkeleton({ rows, cols, firstColWide = true }: { rows: number; cols: number; firstColWide?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === 0 && firstColWide ? 'flex-[2]' : 'flex-1'}`} />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-4 ${c === 0 && firstColWide ? 'flex-[2]' : 'flex-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function TileRowSkeleton({ count }: { count: number }) {
  return (
    <div className={`grid gap-4 mb-6`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <TileRowSkeleton count={5} />
      <TableSkeleton rows={6} cols={4} />
    </div>
  )
}

export function RevenueSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <TableSkeleton rows={13} cols={3} />
    </div>
  )
}

export function StaffingSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <TileRowSkeleton count={4} />
      <TableSkeleton rows={8} cols={6} />
    </div>
  )
}

export function OperationsSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={4} />
    </div>
  )
}

export function CashflowSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <div className="mb-4 inline-flex bg-slate-100 rounded-lg p-1">
        <Skeleton className="h-7 w-24 mr-1" />
        <Skeleton className="h-7 w-24" />
      </div>
      <TableSkeleton rows={6} cols={7} />
    </div>
  )
}

export function MultiYearSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  )
}

export function ScenariosSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
      </div>
    </div>
  )
}

export function AskSkeleton() {
  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-4rem)]">
      <PageHeaderSkeleton />
      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-11 mt-4 rounded-full" />
    </div>
  )
}

export function AdvisorySkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <div className="bg-white border-l-4 border-l-teal-600 border border-slate-200 rounded-xl p-6 mb-8">
        <Skeleton className="h-4 w-48 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-full mt-4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AlignmentSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-5/6 mb-2" />
        <Skeleton className="h-3 w-4/6 mb-6" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function ScorecardSkeleton() {
  return (
    <div className="animate-fade-in">
      <PageHeaderSkeleton />
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 grid grid-cols-6 gap-4">
          <Skeleton className="h-3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 8 }).map((_, r) => (
            <div key={r} className="px-4 py-3 grid grid-cols-6 gap-4 items-center">
              <Skeleton className="h-4" />
              {Array.from({ length: 5 }).map((_, c) => (
                <Skeleton key={c} className="h-6 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeaderSkeleton />
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, f) => (
              <div key={f}>
                <Skeleton className="h-3 w-24 mb-1.5" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
