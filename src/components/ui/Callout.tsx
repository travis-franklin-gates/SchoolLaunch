'use client'

import { useState, type ReactNode } from 'react'

export type CalloutVariant = 'info' | 'warn' | 'crit'

const VARIANT_STYLES: Record<CalloutVariant, { bg: string; fg: string; border: string; iconColor: string }> = {
  info: {
    bg: '#EFF6FF',
    fg: '#1D4ED8',
    border: '#BFDBFE',
    iconColor: '#2563EB',
  },
  warn: {
    bg: 'var(--status-approaching-bg)',
    fg: 'var(--status-approaching-fg)',
    border: 'var(--status-approaching-border)',
    iconColor: 'var(--amber-600)',
  },
  crit: {
    bg: 'var(--status-fails-bg)',
    fg: 'var(--status-fails-fg)',
    border: 'var(--status-fails-border)',
    iconColor: 'var(--rose-600)',
  },
}

function VariantIcon({ variant, color }: { variant: CalloutVariant; color: string }) {
  if (variant === 'info') {
    return (
      <svg aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    )
  }
  if (variant === 'warn') {
    return (
      <svg aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  )
}

export interface CalloutProps {
  variant: CalloutVariant
  title?: string
  children: ReactNode
  dismissible?: boolean
}

export function Callout({ variant, title, children, dismissible }: CalloutProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const styles = VARIANT_STYLES[variant]

  return (
    <div
      role={variant === 'crit' ? 'alert' : 'status'}
      data-variant={variant}
      className="flex items-start gap-3 px-4 py-3 rounded-lg border text-sm"
      style={{
        background: styles.bg,
        color: styles.fg,
        borderColor: styles.border,
      }}
    >
      <VariantIcon variant={variant} color={styles.iconColor} />
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="shrink-0 -mr-1 -mt-0.5 p-1 rounded hover:bg-black/5 transition-colors"
          style={{ color: styles.fg }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
