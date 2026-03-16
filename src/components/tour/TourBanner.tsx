'use client'

import { usePathname } from 'next/navigation'
import { useTourContext } from './TourContext'
import { pathToTourName } from './tourSteps'

export default function TourBanner() {
  const pathname = usePathname()
  const { completedTours, dismissedTabs, dismissTabBanner, startTabTour, tourCompleted, loading } = useTourContext()

  if (loading) return null
  // Don't show banner until overview tour is done
  if (!tourCompleted) return null

  const tabTour = pathToTourName(pathname)
  if (!tabTour) return null

  // Already completed or dismissed
  if (completedTours.includes(tabTour) || dismissedTabs.includes(tabTour)) return null

  return (
    <div className="mb-4 bg-teal-50 border border-teal-200 rounded-xl px-5 py-3 flex items-center justify-between animate-fade-in">
      <span className="text-sm text-teal-800">
        New to this tab?
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => startTabTour(tabTour)}
          className="text-sm font-medium text-teal-700 hover:text-teal-900 underline underline-offset-2 transition-colors"
        >
          Take a quick tour
        </button>
        <button
          onClick={() => dismissTabBanner(tabTour)}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
