import type { ReactNode } from 'react'

export type Status = 'meets' | 'approaching' | 'fails' | 'na'

const STATUS_STYLES: Record<Status, { bg: string; fg: string; border: string; dot: string }> = {
  meets: {
    bg: 'var(--status-meets-bg)',
    fg: 'var(--status-meets-fg)',
    border: 'var(--status-meets-border)',
    dot: 'var(--teal-500)',
  },
  approaching: {
    bg: 'var(--status-approaching-bg)',
    fg: 'var(--status-approaching-fg)',
    border: 'var(--status-approaching-border)',
    dot: 'var(--amber-500)',
  },
  fails: {
    bg: 'var(--status-fails-bg)',
    fg: 'var(--status-fails-fg)',
    border: 'var(--status-fails-border)',
    dot: 'var(--rose-500)',
  },
  na: {
    bg: '#F1F5F9',
    fg: '#64748B',
    border: '#E2E8F0',
    dot: '#94A3B8',
  },
}

const DEFAULT_LABELS: Record<Status, string> = {
  meets: 'Meets',
  approaching: 'Approaching',
  fails: 'Does Not Meet',
  na: 'N/A',
}

export interface StatusBadgeProps {
  status: Status
  label?: string
  icon?: ReactNode
}

export function StatusBadge({ status, label, icon }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status]
  const text = label ?? DEFAULT_LABELS[status]

  return (
    <span
      data-status={status}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap"
      style={{
        background: styles.bg,
        color: styles.fg,
        borderColor: styles.border,
      }}
    >
      {icon ?? (
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: styles.dot }}
        />
      )}
      <span>{text}</span>
    </span>
  )
}
