import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { invitationId, userId } = body

  if (!invitationId || !userId) {
    return NextResponse.json({ error: 'Missing invitationId or userId' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  // 1. Fetch and validate invitation
  const { data: invitation, error: invError } = await admin
    .from('invitations')
    .select('id, email, role, organization_id, ceo_name, accepted')
    .eq('id', invitationId)
    .single()

  if (invError || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invitation.accepted) {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
  }

  const orgId = invitation.organization_id

  // 2. Create school record
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

  // 3. Create minimal school profile
  const { error: profileError } = await admin
    .from('school_profiles')
    .insert({
      school_id: school.id,
      onboarding_complete: false,
    })

  if (profileError) {
    // Clean up: delete the school we just created
    await admin.from('schools').delete().eq('id', school.id)
    return NextResponse.json({ error: 'Failed to create school profile', detail: profileError }, { status: 500 })
  }

  // 4. Create user_roles record
  const { error: roleError } = await admin
    .from('user_roles')
    .insert({
      user_id: userId,
      role: invitation.role,
      school_id: school.id,
      organization_id: orgId,
    })

  if (roleError) {
    return NextResponse.json({ error: 'Failed to assign role', detail: roleError }, { status: 500 })
  }

  // 5. Mark invitation accepted and link to school
  await admin
    .from('invitations')
    .update({
      accepted: true,
      accepted_at: new Date().toISOString(),
      school_id: school.id,
    })
    .eq('id', invitationId)

  return NextResponse.json({
    success: true,
    schoolId: school.id,
  })
}
