'use client'

import { useId, type ReactElement, type ReactNode } from 'react'

export interface FormFieldProps {
  label: string
  helperText?: string
  errorText?: string
  required?: boolean
  /**
   * Either a ReactElement (the input — id will be cloned in via React's
   * cloneElement equivalent: pass the id manually if your input needs it),
   * or a render-prop function receiving the generated id.
   */
  children: ReactElement | ((id: string) => ReactNode)
  className?: string
}

export function FormField({ label, helperText, errorText, required, children, className }: FormFieldProps) {
  const generatedId = useId()
  const id = generatedId
  const hasError = Boolean(errorText)

  return (
    <div className={['flex flex-col gap-1.5', className ?? ''].filter(Boolean).join(' ')}>
      <label
        htmlFor={id}
        className="text-xs font-medium text-slate-600"
      >
        {label}
        {required && <span aria-hidden="true" className="text-rose-600 ml-0.5">*</span>}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hasError ? (
        <p role="alert" className="text-xs" style={{ color: 'var(--rose-600)' }}>
          {errorText}
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  )
}
