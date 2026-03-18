import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user has school_ceo role and get school_id
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('school_id')
    .eq('user_id', user.id)
    .eq('role', 'school_ceo')
    .single()

  if (!roleData?.school_id) {
    return NextResponse.json({ error: 'No school found for this user' }, { status: 403 })
  }

  const schoolId = roleData.school_id
  const admin = createServiceRoleClient()

  // Delete planning data in foreign-key-safe order
  const tables = [
    'staffing_positions',
    'budget_projections',
    'scenarios',
    'grade_expansion_plan',
    'org_notes',
    'school_profiles',
  ] as const

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq('school_id', schoolId)
    if (error) {
      console.error(`[reset-school] failed to delete from ${table}:`, error)
      return NextResponse.json(
        { error: `Failed to delete ${table}`, detail: error },
        { status: 500 },
      )
    }
  }

  // Re-create a blank school_profiles row so onboarding can start fresh
  const { error: insertError } = await admin.from('school_profiles').insert({
    school_id: schoolId,
    onboarding_complete: false,
    max_class_size: 24,
  })

  if (insertError) {
    console.error('[reset-school] failed to re-create school_profiles:', insertError)
    return NextResponse.json(
      { error: 'Failed to re-initialize school profile', detail: insertError },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
