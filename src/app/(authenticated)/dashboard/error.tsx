'use client'

import { useEffect, useState } from 'react'

/**
 * Dashboard error boundary. Catches unhandled exceptions during rendering of
 * any /dashboard route and presents a brand-aligned recovery surface.
 *
 * Transient API failures (failed AI requests, failed saves) are handled by
 * Sonner toasts in the corresponding components — this boundary is for
 * uncaught rendering errors only.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    console.error('[dashboard error boundary]', error)
  }, [error])

  async function copyDetails() {
    const payload = [
      `Message: ${error.message}`,
      error.digest ? `Digest: ${error.digest}` : null,
      error.stack ? `Stack:\n${error.stack}` : null,
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore — clipboard may be unavailable in some contexts */
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--rose-50)' }}>
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--rose-600)' }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1
          className="text-2xl font-semibold text-slate-900 mb-1"
          style={{ fontFamily: 'var(--font-heading-var)' }}
        >
          Something went wrong
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          An unexpected error occurred loading this page.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="bg-teal-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={copyDetails}
            className="text-xs text-slate-500 hover:text-slate-700 underline-offset-4 hover:underline transition-colors"
          >
            {copied ? 'Copied to clipboard' : 'Copy error details'}
          </button>
        </div>
      </div>
    </div>
  )
}
