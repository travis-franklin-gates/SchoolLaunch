'use client'

import { useState, type ChangeEvent } from 'react'

export interface CurrencyInputProps {
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
 * Numeric input bound to a currency value. Renders a "$" prefix outside the
 * <input> so the bound value is always a plain number. onChange fires with
 * the parsed numeric value; non-numeric strokes are ignored. Empty input
 * resolves to 0.
 */
export function CurrencyInput({
  id,
  value,
  onChange,
  step = 1,
  min,
  max,
  disabled,
  placeholder,
  className,
  ariaLabel,
}: CurrencyInputProps) {
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
      <span aria-hidden="true" className="text-xs text-slate-400">$</span>
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
        className="font-tabular text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600 w-32"
      />
    </div>
  )
}
