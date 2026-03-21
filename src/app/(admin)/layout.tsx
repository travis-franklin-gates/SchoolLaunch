'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TourProvider } from '@/components/tour/TourContext'
import TourRunner from '@/components/tour/TourRunner'
import HelpButton from '@/components/tour/HelpButton'
import TourBanner from '@/components/tour/TourBanner'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <TourProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
        <header className="bg-white border-b border-slate-200 px-8 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              S
            </div>
            <div>
              <div className="text-slate-800 text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading-var)' }}>
                School<span className="text-emerald-600">Launch</span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-[0.15em] font-medium">
                Portfolio
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
            style={{ fontFamily: 'var(--font-heading-var)' }}
          >
            Sign Out
          </button>
        </header>
        <main className="p-4 md:p-8">
          <TourBanner />
          {children}
        </main>
        <HelpButton />
        <Suspense fallback={null}>
          <TourRunner />
        </Suspense>
      </div>
    </TourProvider>
  )
}
