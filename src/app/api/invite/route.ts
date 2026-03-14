import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Authenticate the user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is org_admin or super_admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .single()

  if (!roleData || !['org_admin', 'super_admin'].includes(roleData.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { ceoName, ceoEmail } = body

  if (!ceoName || !ceoEmail) {
    return NextResponse.json({ error: 'CEO name and email are required' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const orgId = roleData.organization_id

  // 1. Create placeholder school (CEO sets name + details during onboarding)
  const { data: school, error: schoolError } = await admin
    .from('schools')
    .insert({
      name: 'New School',
      organization_id: orgId,
      status: 'planning',
    })
    .select('id')
    .single()

  if (schoolError || !school) {
    return NextResponse.json({ error: 'Failed to create school', detail: schoolError }, { status: 500 })
  }

  // 2. Create minimal school profile (CEO completes during onboarding)
  const { error: profileError } = await admin
    .from('school_profiles')
    .insert({
      school_id: school.id,
      onboarding_complete: false,
    })

  if (profileError) {
    return NextResponse.json({ error: 'Failed to create school profile', detail: profileError }, { status: 500 })
  }

  // 3. Generate invitation token and create invitation
  const token = crypto.randomUUID()
  const { error: inviteError } = await admin
    .from('invitations')
    .insert({
      token,
      email: ceoEmail,
      ceo_name: ceoName,
      role: 'school_ceo',
      organization_id: orgId,
      school_id: school.id,
      created_by: user.id,
      accepted: false,
    })

  if (inviteError) {
    return NextResponse.json({ error: 'Failed to create invitation', detail: inviteError }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    schoolId: school.id,
    token,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://schoollaunch.vercel.app'}/invite?token=${token}`,
  })
}
