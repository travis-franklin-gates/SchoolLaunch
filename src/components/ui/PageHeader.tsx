import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  badges?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, badges, actions }: PageHeaderProps) {
  return (
    <div data-testid="page-header" className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-[28px] font-semibold text-slate-900 leading-tight"
            style={{ fontFamily: 'var(--font-heading-var)' }}
          >
            {title}
          </h1>
          {badges}
        </div>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
