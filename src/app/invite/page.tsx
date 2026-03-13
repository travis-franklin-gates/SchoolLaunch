import { createServiceRoleClient } from '@/lib/supabase/server'
import InviteForm from './InviteForm'

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">SchoolLaunch</h1>
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              No invitation token provided.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const supabase = createServiceRoleClient()

  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('id, email, role, school_id, organization_id')
    .eq('token', token)
    .eq('accepted', false)
    .single()

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">SchoolLaunch</h1>
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              This invitation is invalid or has expired.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Also load the school name for context
  let schoolName = ''
  if (invitation.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', invitation.school_id)
      .single()
    schoolName = school?.name || ''
  }

  return <InviteForm invitation={invitation} schoolName={schoolName} />
}
