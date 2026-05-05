/**
 * Shared number-formatting utility for the SchoolLaunch UI surface.
 *
 * formatCurrency  — display monetary values across the app:
 *   - 'compact':    $1.2M / $840K / $0   (cards, tiles, pills)
 *   - 'accounting': $1,834,120 / ($45,200) (P&L, scorecard, exports)
 *   - 'plain':      1834120              (input-field underlying values)
 * formatPercent  — '12.5%' / '0%'        (margins, fill rates, ratios)
 * formatDays     — '169 days' / '0 days' (cash reserves, runway)
 *
 * Calculations live in src/lib/{calculations,budgetEngine}.ts and are NOT
 * to be touched by formatting changes. This file is presentation-only.
 */

export type CurrencyMode = 'compact' | 'accounting' | 'plain'

export function formatCurrency(n: number, mode: CurrencyMode = 'accounting'): string {
  const value = Number.isFinite(n) ? n : 0

  if (mode === 'plain') {
    return String(Math.round(value))
  }

  if (mode === 'compact') {
    if (value === 0) return '$0'
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`
    return `${sign}$${Math.round(abs)}`
  }

  // accounting: $1,834,120 for positive, ($45,200) for negative
  if (value < 0) {
    const formatted = Math.round(Math.abs(value)).toLocaleString('en-US')
    return `($${formatted})`
  }
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export function formatPercent(n: number, decimals: number = 1): string {
  const value = Number.isFinite(n) ? n : 0
  return `${value.toFixed(decimals)}%`
}

export function formatDays(n: number): string {
  const value = Number.isFinite(n) ? Math.round(n) : 0
  return `${value} days`
}
