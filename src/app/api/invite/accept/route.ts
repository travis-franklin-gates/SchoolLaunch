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
    .select('id, email, role, organization_id, school_id, ceo_name, accepted, expires_at')
    .eq('id', invitationId)
    .single()

  if (invError || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invitation.accepted) {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 })
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
  }

  const orgId = invitation.organization_id

  // Team invitation: school_id is already set (editor/viewer joining an existing school)
  const isTeamInvite = !!invitation.school_id

  let schoolId: string

  if (isTeamInvite) {
    // Joining an existing school — verify the school exists
    const { data: existingSchool } = await admin
      .from('schools')
      .select('id')
      .eq('id', invitation.school_id)
      .single()

    if (!existingSchool) {
      return NextResponse.json({ error: 'School no longer exists' }, { status: 404 })
    }

    schoolId = existingSchool.id
  } else {
    // New school invitation (CEO) — create school + profile
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

    const { error: profileError } = await admin
      .from('school_profiles')
      .insert({
        school_id: school.id,
        onboarding_complete: false,
        max_class_size: 24,
      })

    if (profileError) {
      await admin.from('schools').delete().eq('id', school.id)
      return NextResponse.json({ error: 'Failed to create school profile', detail: profileError }, { status: 500 })
    }

    schoolId = school.id
  }

  // Create user_roles record
  const { error: roleError } = await admin
    .from('user_roles')
    .insert({
      user_id: userId,
      role: invitation.role,
      school_id: schoolId,
      organization_id: orgId,
    })

  if (roleError) {
    return NextResponse.json({ error: 'Failed to assign role', detail: roleError }, { status: 500 })
  }

  // Mark invitation accepted
  await admin
    .from('invitations')
    .update({
      accepted: true,
      accepted_at: new Date().toISOString(),
      school_id: schoolId,
    })
    .eq('id', invitationId)

  return NextResponse.json({
    success: true,
    schoolId,
    isTeamInvite,
  })
}
