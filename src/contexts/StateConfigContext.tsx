'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStateConfig } from '@/lib/stateConfig'
import type { StateConfig, Pathway } from '@/lib/stateConfig'
import { SELECTED_SCHOOL_KEY } from '@/lib/useSchoolData'

interface StateConfigContextValue {
  config: StateConfig
  pathway: Pathway
  loading: boolean
}

const StateConfigContext = createContext<StateConfigContextValue>({
  config: getStateConfig('wa_charter'),
  pathway: 'wa_charter',
  loading: true,
})

export function StateConfigProvider({ children }: { children: React.ReactNode }) {
  const [pathway, setPathway] = useState<Pathway>('wa_charter')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadPathway() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        // Check sessionStorage for selected school (multi-school support)
        const selectedSchoolId = typeof window !== 'undefined'
          ? sessionStorage.getItem(SELECTED_SCHOOL_KEY)
          : null

        let schoolId: string | null = null

        if (selectedSchoolId) {
          schoolId = selectedSchoolId
        } else {
          // Get the first school for this user
          const { data: roles } = await supabase
            .from('user_roles')
            .select('school_id')
            .eq('user_id', user.id)

          schoolId = roles?.[0]?.school_id || null
        }

        if (!schoolId) { setLoading(false); return }

        const { data: school } = await supabase
          .from('schools')
          .select('pathway')
          .eq('id', schoolId)
          .single()

        if (school?.pathway) {
          setPathway(school.pathway as Pathway)
        }
      } catch {
        // Default to wa_charter on error
      } finally {
        setLoading(false)
      }
    }
    loadPathway()
  }, [supabase])

  const config = getStateConfig(pathway)

  return (
    <StateConfigContext.Provider value={{ config, pathway, loading }}>
      {children}
    </StateConfigContext.Provider>
  )
}

export function useStateConfig(): StateConfigContextValue {
  return useContext(StateConfigContext)
}
