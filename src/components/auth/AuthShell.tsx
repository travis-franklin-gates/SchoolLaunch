import type { ReactNode } from 'react'

export interface AuthShellProps {
  children: ReactNode
  /** Optional subhead under the form area (e.g., "Reset your password") */
  formSubhead?: string
}

/**
 * Two-panel auth shell: dark navy brand panel on the left (md+), white form
 * panel on the right. On mobile (<md) the brand panel collapses and only a
 * compact SchoolLaunch wordmark sits above the form.
 */
export function AuthShell({ children, formSubhead }: AuthShellProps) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-page)' }}>
      <aside
        className="hidden md:flex md:w-1/2 lg:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--navy-dark)', color: 'var(--text-on-dark)' }}
      >
        {/* Decorative pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #fff 0, transparent 40%), radial-gradient(circle at 80% 70%, #fff 0, transparent 35%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-md"
              style={{ background: 'var(--teal-600)' }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M3 12l9-9 9 9" />
                <path d="M5 10v10h14V10" />
                <path d="M9 20v-6h6v6" />
              </svg>
            </span>
            <span
              className="text-xl font-semibold tracking-tight"
              style={{ fontFamily: 'var(--font-heading-var)' }}
            >
              SchoolLaunch
            </span>
          </div>
        </div>

        <div className="relative space-y-3 max-w-md">
          <h2
            className="text-3xl leading-tight font-semibold"
            style={{ fontFamily: 'var(--font-heading-var)' }}
          >
            The financial planning platform for charter school founders.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(241, 245, 249, 0.7)' }}>
            Model your enrollment, staffing, revenue, and multi-year projections — then validate them against the WA Charter School Commission&rsquo;s Financial Performance Framework.
          </p>
        </div>

        <div className="relative text-xs" style={{ color: 'rgba(241, 245, 249, 0.5)' }}>
          &copy; SchoolLaunch
        </div>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 md:px-12">
        <div className="w-full max-w-md">
          {/* Mobile-only wordmark */}
          <div className="md:hidden flex items-center gap-2 mb-8 justify-center">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-md"
              style={{ background: 'var(--teal-600)' }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 12l9-9 9 9" />
                <path d="M5 10v10h14V10" />
                <path d="M9 20v-6h6v6" />
              </svg>
            </span>
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading-var)' }}
            >
              SchoolLaunch
            </span>
          </div>

          {formSubhead && (
            <p className="text-sm mb-6 text-center md:text-left" style={{ color: 'var(--text-secondary)' }}>
              {formSubhead}
            </p>
          )}

          {children}
        </div>
      </main>
    </div>
  )
}
