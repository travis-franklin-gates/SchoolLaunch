'use client'

import { Suspense } from 'react'
import Sidebar from '@/components/Sidebar'
import { TourProvider } from '@/components/tour/TourContext'
import TourRunner from '@/components/tour/TourRunner'
import HelpButton from '@/components/tour/HelpButton'
import TourBanner from '@/components/tour/TourBanner'
import { StateConfigProvider } from '@/contexts/StateConfigContext'
import { ToastProvider } from '@/components/ui/Toast'
import { usePermissions } from '@/hooks/usePermissions'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = usePermissions()
  const isViewer = role === 'school_viewer'

  return (
    <StateConfigProvider>
      <TourProvider>
        <div
          className="min-h-screen"
          style={{ background: 'var(--bg-page)' }}
          data-viewer={isViewer ? 'true' : undefined}
        >
          <Sidebar />
          <main className="md:ml-60 p-4 md:p-8 pt-16 md:pt-8">
            <TourBanner />
            {children}
          </main>
          <HelpButton />
          <Suspense fallback={null}>
            <TourRunner />
          </Suspense>
          <ToastProvider />
        </div>
      </TourProvider>
    </StateConfigProvider>
  )
}
