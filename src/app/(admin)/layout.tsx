'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
          >
            S
          </div>
          <div>
            <div className="text-slate-800 text-lg font-bold tracking-tight">
              School<span className="text-blue-600">Launch</span>
            </div>
            <div className="text-[0.6rem] text-slate-400 uppercase tracking-widest font-medium">
              Portfolio
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          Sign Out
        </button>
      </header>
      <main className="p-8">{children}</main>
    </div>
  )
}
