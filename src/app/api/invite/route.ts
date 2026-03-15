import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // Create invitation record only — school gets created when CEO accepts
  const token = crypto.randomUUID()
  const { error: inviteError } = await admin
    .from('invitations')
    .insert({
      token,
      email: ceoEmail,
      ceo_name: ceoName,
      role: 'school_ceo',
      organization_id: orgId,
      school_id: null,
      created_by: user.id,
      accepted: false,
    })

  if (inviteError) {
    return NextResponse.json({ error: 'Failed to create invitation', detail: inviteError }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    token,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://schoollaunch.vercel.app'}/invite?token=${token}`,
  })
}
