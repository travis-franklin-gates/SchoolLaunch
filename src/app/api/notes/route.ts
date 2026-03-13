import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

  const { schoolId, content } = await request.json()
  if (!schoolId || !content?.trim()) {
    return NextResponse.json({ error: 'Missing schoolId or content' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('org_notes')
    .insert({
      school_id: schoolId,
      organization_id: roleData.organization_id,
      author_id: user.id,
      content: content.trim(),
    })
    .select('id, content, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save note', detail: error }, { status: 500 })
  }

  return NextResponse.json(data)
}
