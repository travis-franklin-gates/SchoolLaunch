'use client'

import { useEffect } from 'react'

export function useDocumentTitle(tab: string, schoolName?: string): void {
  useEffect(() => {
    const suffix = schoolName ? ` · ${schoolName}` : ''
    document.title = `SchoolLaunch — ${tab}${suffix}`
  }, [tab, schoolName])
}
