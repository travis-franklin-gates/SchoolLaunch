'use client'

import { ScenarioProvider } from '@/lib/ScenarioContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ScenarioProvider>{children}</ScenarioProvider>
}
