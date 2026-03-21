import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schoolId = searchParams.get('schoolId')

  if (!schoolId) {
    return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })
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
    return NextResponse.json({ error: 'Only the school CEO can view team members' }, { status: 403 })
  }

  // Fetch team members for this school
  const { data: members, error } = await admin
    .from('user_roles')
    .select('id, user_id, role, display_name, created_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch team members', detail: error }, { status: 500 })
  }

  // Fetch emails from auth.users for each member
  const enriched = await Promise.all(
    (members || []).map(async (m) => {
      const { data: authUser } = await admin.auth.admin.getUserById(m.user_id)
      return {
        ...m,
        email: authUser?.user?.email || null,
      }
    })
  )

  // Fetch pending invitations for this school
  const { data: pendingInvites } = await admin
    .from('invitations')
    .select('id, email, role, created_at, expires_at')
    .eq('school_id', schoolId)
    .eq('accepted', false)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    members: enriched,
    pendingInvitations: pendingInvites || [],
  })
}
