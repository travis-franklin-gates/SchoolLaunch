'use client'

import { useState, useEffect, useCallback } from 'react'

interface TeamMember {
  id: string
  user_id: string
  role: string
  display_name: string | null
  email: string | null
  created_at: string
}

interface PendingInvitation {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
}

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  school_ceo: { label: 'Owner', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  school_editor: { label: 'Editor', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  school_viewer: { label: 'Viewer', className: 'bg-slate-50 text-slate-600 border-slate-200' },
}

export default function TeamSection({ schoolId, currentUserId }: { schoolId: string; currentUserId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'school_editor' | 'school_viewer'>('school_editor')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/team?schoolId=${schoolId}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setPendingInvites(data.pendingInvitations || [])
      }
    } catch (err) {
      console.error('Failed to fetch team:', err)
    }
    setLoadingTeam(false)
  }, [schoolId])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, schoolId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error || 'Failed to send invitation')
      } else {
        const fullUrl = `${window.location.origin}${data.inviteUrl}`
        setInviteSuccess(fullUrl)
        setInviteEmail('')
        await fetchTeam()
      }
    } catch {
      setInviteError('Network error. Please try again.')
    }
    setInviting(false)
  }

  async function handleChangeRole(userId: string, newRole: string) {
    const res = await fetch(`/api/team/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole, schoolId }),
    })
    if (res.ok) await fetchTeam()
  }

  async function handleRemoveMember(userId: string) {
    const res = await fetch(`/api/team/${userId}?schoolId=${schoolId}`, { method: 'DELETE' })
    if (res.ok) {
      setConfirmRemove(null)
      await fetchTeam()
    }
  }

  async function handleRevokeInvite(invitationId: string) {
    // Use service-bypassing delete — invitation policies allow org members
    const res = await fetch(`/api/team/invite?invitationId=${invitationId}&schoolId=${schoolId}`, { method: 'DELETE' })
    if (res.ok) await fetchTeam()
  }

  if (loadingTeam) {
    return (
      <div data-tour="team-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">Team Members</h2>
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <span className="ml-2 text-sm text-slate-400">Loading team...</span>
        </div>
      </div>
    )
  }

  return (
    <div data-tour="team-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
      <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Team Members</h2>
      <p className="text-sm text-slate-500 mb-5">Invite collaborators to work on your school&apos;s financial plan.</p>

      {/* Current team list */}
      <div className="space-y-2 mb-5">
        {members.map((m) => {
          const badge = ROLE_BADGES[m.role] || ROLE_BADGES.school_viewer
          const isMe = m.user_id === currentUserId
          const isCeo = m.role === 'school_ceo'
          const displayName = m.display_name || m.email || 'Unknown user'

          return (
            <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-slate-100 hover:bg-slate-50/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 flex-shrink-0">
                  {(displayName)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {displayName}{isMe && <span className="text-slate-400 font-normal"> (you)</span>}
                  </div>
                  {m.display_name && m.email && (
                    <div className="text-xs text-slate-400 truncate">{m.email}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isCeo ? (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.className}`}>{badge.label}</span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="school_editor">Editor</option>
                      <option value="school_viewer">Viewer</option>
                    </select>
                    {confirmRemove === m.user_id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(m.user_id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                        title="Remove from team"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Pending Invitations</h3>
          <div className="space-y-2">
            {pendingInvites.map((inv) => {
              const badge = ROLE_BADGES[inv.role] || ROLE_BADGES.school_viewer
              return (
                <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-600 truncate">{inv.email}</div>
                      <div className="text-xs text-slate-400">
                        Sent {new Date(inv.created_at).toLocaleDateString()}
                        {' · '}
                        <span className={`${badge.className} px-1.5 py-0.5 rounded text-[10px] font-medium border`}>{badge.label}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="text-xs text-slate-400 hover:text-red-600 px-2 py-1"
                  >
                    Revoke
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invite form */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Invite a Team Member</h3>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'school_editor' | 'school_viewer')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="school_editor">Editor</option>
            <option value="school_viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>

        {inviteError && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</div>
        )}

        {inviteSuccess && (
          <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <p className="text-xs text-emerald-700 font-medium mb-1">Invitation created! Share this link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteSuccess}
                className="flex-1 text-xs bg-white border border-emerald-200 rounded px-2 py-1.5 text-slate-700 font-mono"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(inviteSuccess); }}
                className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Editors can modify your staffing plan, revenue model, and operations budget.
          Viewers can see everything and run exports but cannot make changes.
          Only you (the school owner) can invite or remove team members.
        </p>
      </div>
    </div>
  )
}
