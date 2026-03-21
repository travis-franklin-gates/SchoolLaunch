import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { email, role, schoolId } = await request.json()

  if (!email || !role || !schoolId) {
    return NextResponse.json({ error: 'Missing email, role, or schoolId' }, { status: 400 })
  }

  if (!['school_editor', 'school_viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be school_editor or school_viewer' }, { status: 400 })
  }

  // Authenticate the requesting user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()

  // Verify requesting user is school_ceo for this school
  const { data: callerRole } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('school_id', schoolId)
    .single()

  if (!callerRole || callerRole.role !== 'school_ceo') {
    return NextResponse.json({ error: 'Only the school CEO can invite team members' }, { status: 403 })
  }

  // Get the school's organization_id
  const { data: school } = await admin
    .from('schools')
    .select('organization_id')
    .eq('id', schoolId)
    .single()

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }

  // Check for existing pending invitation
  const { data: existing } = await admin
    .from('invitations')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('school_id', schoolId)
    .eq('accepted', false)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'A pending invitation already exists for this email' }, { status: 409 })
  }

  // Create the invitation
  const { data: invitation, error: invError } = await admin
    .from('invitations')
    .insert({
      email: email.toLowerCase(),
      role,
      school_id: schoolId,
      organization_id: school.organization_id,
      created_by: user.id,
    })
    .select('id, token')
    .single()

  if (invError || !invitation) {
    return NextResponse.json({ error: 'Failed to create invitation', detail: invError }, { status: 500 })
  }

  const inviteUrl = `/invite?token=${invitation.token}`

  return NextResponse.json({
    success: true,
    invitationId: invitation.id,
    inviteUrl,
  })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const invitationId = searchParams.get('invitationId')
  const schoolId = searchParams.get('schoolId')

  if (!invitationId || !schoolId) {
    return NextResponse.json({ error: 'Missing invitationId or schoolId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()

  // Verify caller is CEO
  const { data: callerRole } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('school_id', schoolId)
    .single()

  if (!callerRole || callerRole.role !== 'school_ceo') {
    return NextResponse.json({ error: 'Only the school CEO can revoke invitations' }, { status: 403 })
  }

  const { error } = await admin
    .from('invitations')
    .delete()
    .eq('id', invitationId)
    .eq('school_id', schoolId)

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke invitation', detail: error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
