import type { Metadata } from 'next'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import InviteForm from './InviteForm'
import { AuthShell } from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'SchoolLaunch — Accept invitation',
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <AuthShell>
        <h1
          className="text-2xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading-var)' }}
        >
          Invitation link not found
        </h1>
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          No invitation token provided.
        </div>
      </AuthShell>
    )
  }

  // Lookup via SECURITY DEFINER RPC so we don't need service role to read invitations.
  // The RPC enforces token match + not-accepted + not-expired inside the database and
  // returns at most one row. Service role is still needed later for auth.admin.listUsers.
  const anonClient = await createClient()
  const { data: invitationRows, error } = await anonClient.rpc('get_invitation_by_token', {
    p_token: token,
  })
  const invitation = Array.isArray(invitationRows) && invitationRows.length > 0
    ? invitationRows[0]
    : null

  if (error || !invitation) {
    return (
      <AuthShell>
        <h1
          className="text-2xl font-semibold mb-4"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading-var)' }}
        >
          Invitation expired
        </h1>
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          This invitation is invalid or has expired.
        </div>
      </AuthShell>
    )
  }

  // auth.admin.listUsers requires service role; scoped to this check only.
  const admin = createServiceRoleClient()
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
  )

  // Get school name for team invites
  let schoolName: string | undefined
  if (invitation.school_id) {
    const { data: school } = await admin
      .from('schools')
      .select('name')
      .eq('id', invitation.school_id)
      .single()
    schoolName = school?.name || undefined
  }

  return (
    <InviteForm
      invitation={invitation}
      ceoName={invitation.ceo_name || undefined}
      existingUser={!!existingUser}
      schoolName={schoolName}
    />
  )
}
