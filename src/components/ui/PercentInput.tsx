'use client'

import { useState, type ChangeEvent } from 'react'

export interface PercentInputProps {
  id?: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  placeholder?: string
  className?: string
  ariaLabel?: string
}

/**
 * Numeric input bound to a percentage value (0-100 scale, NOT 0-1). Renders
 * a "%" suffix outside the <input>. The bound value is the raw percentage,
 * so a "12.5%" input emits 12.5 — callers convert to a multiplier
 * (value / 100) at the application boundary.
 */
export function PercentInput({
  id,
  value,
  onChange,
  step = 0.5,
  min,
  max,
  disabled,
  placeholder,
  className,
  ariaLabel,
}: PercentInputProps) {
  const [localText, setLocalText] = useState<string | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setLocalText(raw)
    if (raw === '' || raw === '-') {
      onChange(0)
      return
    }
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) onChange(parsed)
  }

  function handleBlur() {
    setLocalText(null)
  }

  const display = localText ?? String(Number.isFinite(value) ? value : 0)

  return (
    <div className={['inline-flex items-center gap-1', className ?? ''].filter(Boolean).join(' ')}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className="font-tabular text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600 w-20"
      />
      <span aria-hidden="true" className="text-xs text-slate-400">%</span>
    </div>
  )
}
