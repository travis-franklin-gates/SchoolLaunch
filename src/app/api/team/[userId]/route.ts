import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

async function verifyCeo(adminClient: ReturnType<typeof createServiceRoleClient>, authUserId: string, schoolId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', authUserId)
    .eq('school_id', schoolId)
    .single()
  return data?.role === 'school_ceo'
}

// PATCH — change a team member's role (editor <-> viewer)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params
  const { role, schoolId } = await request.json()

  if (!role || !schoolId) {
    return NextResponse.json({ error: 'Missing role or schoolId' }, { status: 400 })
  }

  if (!['school_editor', 'school_viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be school_editor or school_viewer' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cannot change your own role
  if (user.id === targetUserId) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  if (!(await verifyCeo(admin, user.id, schoolId))) {
    return NextResponse.json({ error: 'Only the school CEO can change roles' }, { status: 403 })
  }

  // Verify target user belongs to this school and isn't a CEO
  const { data: targetRole } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('school_id', schoolId)
    .single()

  if (!targetRole) {
    return NextResponse.json({ error: 'User not found in this school' }, { status: 404 })
  }

  if (targetRole.role === 'school_ceo') {
    return NextResponse.json({ error: 'Cannot change the CEO role' }, { status: 400 })
  }

  const { error } = await admin
    .from('user_roles')
    .update({ role })
    .eq('user_id', targetUserId)
    .eq('school_id', schoolId)

  if (error) {
    return NextResponse.json({ error: 'Failed to update role', detail: error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE — remove a team member from the school
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params
  const { searchParams } = new URL(request.url)
  const schoolId = searchParams.get('schoolId')

  if (!schoolId) {
    return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cannot remove yourself
  if (user.id === targetUserId) {
    return NextResponse.json({ error: 'Cannot remove yourself from the school' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  if (!(await verifyCeo(admin, user.id, schoolId))) {
    return NextResponse.json({ error: 'Only the school CEO can remove team members' }, { status: 403 })
  }

  // Verify target isn't a CEO
  const { data: targetRole } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('school_id', schoolId)
    .single()

  if (!targetRole) {
    return NextResponse.json({ error: 'User not found in this school' }, { status: 404 })
  }

  if (targetRole.role === 'school_ceo') {
    return NextResponse.json({ error: 'Cannot remove the CEO' }, { status: 400 })
  }

  const { error } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('school_id', schoolId)

  if (error) {
    return NextResponse.json({ error: 'Failed to remove team member', detail: error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
