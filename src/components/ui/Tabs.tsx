'use client'

import * as RadixTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'

export type TabsVariant = 'segmented' | 'underlined'

export interface TabItem {
  value: string
  label: ReactNode
  panel?: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  variant?: TabsVariant
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  ariaLabel?: string
  className?: string
}

/**
 * Two visual variants over Radix Tabs:
 *  - 'segmented' (default): chip-pill row with active background, used for
 *    binary/short toggles like Cash Flow's Year-0/Year-1 selector.
 *  - 'underlined': flat row with an active underline, used for longer tab
 *    sets that sit at the top of a content section.
 */
export function Tabs({
  variant = 'segmented',
  items,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  className,
}: TabsProps) {
  const listClass =
    variant === 'segmented'
      ? 'inline-flex bg-slate-100 rounded-lg p-1'
      : 'inline-flex border-b border-slate-200 gap-1'

  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={onValueChange}
      className={className}
    >
      <RadixTabs.List aria-label={ariaLabel} className={listClass}>
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={
              variant === 'segmented'
                ? [
                    'px-4 py-1.5 rounded-md text-sm font-medium transition-colors text-slate-500 hover:text-slate-700',
                    'data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-sm',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  ].join(' ')
                : [
                    'px-3 py-2 -mb-px text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors',
                    'data-[state=active]:text-teal-700 data-[state=active]:border-teal-600',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  ].join(' ')
            }
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) =>
        item.panel !== undefined ? (
          <RadixTabs.Content key={item.value} value={item.value} className="mt-4 focus:outline-none">
            {item.panel}
          </RadixTabs.Content>
        ) : null,
      )}
    </RadixTabs.Root>
  )
}
