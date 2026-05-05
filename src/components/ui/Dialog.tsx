'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** The element that opens the dialog. Wrapped in <Dialog.Trigger asChild>. */
  trigger?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  /** Slot for primary/secondary action buttons rendered in the dialog footer. */
  actions?: ReactNode
  /**
   * Visual size — controls max-width. Defaults to 'md' (28rem).
   *  - sm: 24rem
   *  - md: 28rem
   *  - lg: 32rem
   *  - xl: 40rem
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Hide the close (×) icon in the corner. */
  hideCloseButton?: boolean
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  actions,
  size = 'md',
  hideCloseButton,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-fade-in"
        />
        <RadixDialog.Content
          className={[
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full',
            SIZE_CLASS[size],
            'bg-white rounded-xl border border-slate-200 p-6',
            'focus:outline-none data-[state=open]:animate-fade-in-up',
          ].join(' ')}
          style={{ boxShadow: 'var(--shadow-3)' }}
        >
          <RadixDialog.Title
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: 'var(--font-heading-var)' }}
          >
            {title}
          </RadixDialog.Title>
          {description && (
            <RadixDialog.Description className="text-sm text-slate-500 mt-1">
              {description}
            </RadixDialog.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
          {actions && <div className="flex items-center justify-end gap-2 mt-6">{actions}</div>}
          {!hideCloseButton && (
            <RadixDialog.Close
              aria-label="Close"
              className="absolute top-3 right-3 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </RadixDialog.Close>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
