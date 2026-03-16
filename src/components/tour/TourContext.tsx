'use client'

import { createContext, useContext } from 'react'
import { useTour } from '@/hooks/useTour'

type TourContextType = ReturnType<typeof useTour>

const TourContext = createContext<TourContextType | null>(null)

export function TourProvider({ children }: { children: React.ReactNode }) {
  const tour = useTour()
  return <TourContext.Provider value={tour}>{children}</TourContext.Provider>
}

export function useTourContext(): TourContextType {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTourContext must be used within TourProvider')
  return ctx
}
