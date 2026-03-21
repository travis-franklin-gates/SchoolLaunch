'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type SchoolRole = 'school_ceo' | 'school_editor' | 'school_viewer' | 'org_admin' | 'super_admin'

export interface Permissions {
  role: SchoolRole | null
  canEdit: boolean
  canManageTeam: boolean
  canResetSchool: boolean
  canEditIdentity: boolean
  canExport: boolean
  canUseAI: boolean
  isLoading: boolean
}

const EDIT_ROLES: SchoolRole[] = ['school_ceo', 'school_editor']
const CEO_ONLY: SchoolRole[] = ['school_ceo']

export function usePermissions(): Permissions {
  const supabase = createClient()
  const [role, setRole] = useState<SchoolRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsLoading(false); return }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Prefer CEO role, then most recent
      const primary = roles?.find((r) => r.role === 'school_ceo') || roles?.[0]
      if (primary?.role) {
        setRole(primary.role as SchoolRole)
      }
      setIsLoading(false)
    }
    load()
  }, [supabase])

  const canEdit = role !== null && EDIT_ROLES.includes(role)
  const canManageTeam = role !== null && CEO_ONLY.includes(role)
  const canResetSchool = role !== null && CEO_ONLY.includes(role)
  const canEditIdentity = role !== null && CEO_ONLY.includes(role)

  return {
    role,
    canEdit,
    canManageTeam,
    canResetSchool,
    canEditIdentity,
    canExport: role !== null,
    canUseAI: role !== null,
    isLoading,
  }
}
