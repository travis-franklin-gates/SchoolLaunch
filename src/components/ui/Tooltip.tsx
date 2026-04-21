'use client'

import { useState, useId, cloneElement, isValidElement, ReactElement } from 'react'

type Position = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: React.ReactNode
  children: ReactElement
  position?: Position
  className?: string
  multiline?: boolean
}

const POSITION_CLASSES: Record<Position, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

export default function Tooltip({ content, children, position = 'top', className = '', multiline = false }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()

  if (!isValidElement(children)) return children
  if (content == null || content === false || content === '') return children

  const childProps = children.props as {
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
    onFocus?: (e: React.FocusEvent) => void
    onBlur?: (e: React.FocusEvent) => void
  }

  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onMouseEnter: (e: React.MouseEvent) => { setOpen(true); childProps.onMouseEnter?.(e) },
    onMouseLeave: (e: React.MouseEvent) => { setOpen(false); childProps.onMouseLeave?.(e) },
    onFocus: (e: React.FocusEvent) => { setOpen(true); childProps.onFocus?.(e) },
    onBlur: (e: React.FocusEvent) => { setOpen(false); childProps.onBlur?.(e) },
  } as Record<string, unknown>)

  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute z-50 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg ${multiline ? 'whitespace-pre-line text-left max-w-xs' : 'whitespace-nowrap'} ${POSITION_CLASSES[position]} ${className}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
