'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SchoolProfile, StaffingPosition, BudgetProjection, GradeExpansionEntry } from '@/lib/types'

export interface SchoolData {
  schoolId: string
  schoolName: string
  profile: SchoolProfile
  positions: StaffingPosition[]
  projections: BudgetProjection[]
  gradeExpansionPlan: GradeExpansionEntry[]
  scenarioId: string | null
  loading: boolean
  reload: () => Promise<void>
}

export function useSchoolData(): SchoolData {
  const [schoolId, setSchoolId] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [profile, setProfile] = useState<SchoolProfile>({
    school_id: '',
    region: '',
    planned_open_year: 0,
    grade_config: '',
    target_enrollment_y1: 0,
    target_enrollment_y2: 0,
    target_enrollment_y3: 0,
    target_enrollment_y4: 0,
    target_enrollment_y5: 0,
    max_class_size: 22,
    pct_frl: 0,
    pct_iep: 0,
    pct_ell: 0,
    pct_hicap: 0,
    onboarding_complete: false,
  })
  const [positions, setPositions] = useState<StaffingPosition[]>([])
  const [projections, setProjections] = useState<BudgetProjection[]>([])
  const [gradeExpansionPlan, setGradeExpansionPlan] = useState<GradeExpansionEntry[]>([])
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('school_id')
      .eq('user_id', user.id)
      .eq('role', 'school_ceo')
      .single()

    if (!roleData?.school_id) { setLoading(false); return }

    const sid = roleData.school_id
    setSchoolId(sid)

    const [schoolRes, profileRes, posRes, projRes, scenRes, gepRes] = await Promise.all([
      supabase.from('schools').select('name').eq('id', sid).single(),
      supabase.from('school_profiles').select('*').eq('school_id', sid).single(),
      supabase.from('staffing_positions').select('*').eq('school_id', sid).eq('year', 1),
      supabase.from('budget_projections').select('*').eq('school_id', sid).eq('year', 1),
      supabase.from('scenarios').select('id').eq('school_id', sid).eq('is_base_case', true).single(),
      supabase.from('grade_expansion_plan').select('*').eq('school_id', sid).order('year').order('grade_level'),
    ])

    if (schoolRes.data) setSchoolName(schoolRes.data.name)
    if (profileRes.data) setProfile(profileRes.data as SchoolProfile)
    if (posRes.data) setPositions(posRes.data as StaffingPosition[])
    if (projRes.data) setProjections(projRes.data as BudgetProjection[])
    if (scenRes.data) setScenarioId(scenRes.data.id)
    if (gepRes.data) setGradeExpansionPlan(gepRes.data as GradeExpansionEntry[])

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { schoolId, schoolName, profile, positions, projections, gradeExpansionPlan, scenarioId, loading, reload: load }
}
