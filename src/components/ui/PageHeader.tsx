import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, badges, actions }: PageHeaderProps) {
  return (
    <div
      data-testid="page-header"
      className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-6"
    >
      <div className="min-w-0 md:flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-[24px] md:text-[28px] font-semibold text-slate-900 leading-tight break-words"
            style={{ fontFamily: 'var(--font-heading-var)' }}
          >
            {title}
          </h1>
          {badges}
        </div>
        {subtitle && (
          typeof subtitle === 'string'
            ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            : <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
      )}
    </div>
  )
}
