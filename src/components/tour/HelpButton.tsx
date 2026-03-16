'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTourContext } from './TourContext'
import { pathToTourName } from './tourSteps'

export default function HelpButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { startOverviewTour, startTabTour, loading } = useTourContext()

  const tabTour = pathToTourName(pathname)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (loading) return null

  return (
    <div ref={ref} className="fixed top-4 right-4 z-50 md:top-5 md:right-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-teal-600 hover:border-teal-300 transition-colors"
        title="Help & Tours"
      >
        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-11 right-0 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 animate-fade-in">
          <button
            onClick={() => { setOpen(false); startOverviewTour() }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart Overview Tour
          </button>
          {tabTour && (
            <button
              onClick={() => { setOpen(false); startTabTour(tabTour) }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tour This Tab
            </button>
          )}
          <div className="border-t border-slate-100 my-1" />
          <div className="px-4 py-2 text-[11px] text-slate-400">
            Tours guide you through each section of SchoolLaunch.
          </div>
        </div>
      )}
    </div>
  )
}
