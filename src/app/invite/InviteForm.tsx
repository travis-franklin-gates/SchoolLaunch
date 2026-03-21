'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Invitation {
  id: string
  email: string
  role: string
  school_id: string | null
  organization_id: string
}

const ROLE_LABELS: Record<string, string> = {
  school_ceo: 'Owner',
  school_editor: 'Editor',
  school_viewer: 'Viewer',
  org_admin: 'Organization Admin',
}

export default function InviteForm({
  invitation,
  ceoName,
  existingUser,
  schoolName,
}: {
  invitation: Invitation
  ceoName?: string
  existingUser?: boolean
  schoolName?: string
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isTeamInvite = !!invitation.school_id
  const roleLabel = ROLE_LABELS[invitation.role] || invitation.role

  async function acceptInvitation(userId: string) {
    const acceptRes = await fetch('/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: invitation.id, userId }),
    })

    if (!acceptRes.ok) {
      const acceptData = await acceptRes.json()
      throw new Error(acceptData.error || 'Failed to accept invitation.')
    }

    return acceptRes.json()
  }

  // Existing user: sign in and accept
  async function handleSignInAndJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 1) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      })

      if (signInError || !authData.user) {
        setError(signInError?.message || 'Sign in failed. Check your password.')
        setLoading(false)
        return
      }

      await acceptInvitation(authData.user.id)

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setLoading(false)
    }
  }

  // New user: create account and accept
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
      })

      if (signUpError || !authData.user) {
        setError(signUpError?.message || 'Failed to create account.')
        setLoading(false)
        return
      }

      const result = await acceptInvitation(authData.user.id)

      if (invitation.role === 'school_ceo') {
        router.push('/onboarding')
      } else if (result.isTeamInvite) {
        router.push('/dashboard')
      } else {
        router.push('/portfolio')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">SchoolLaunch</h1>
            <p className="text-slate-500 mt-2">
              {existingUser ? 'Join a school' : 'Set up your account'}
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            {isTeamInvite ? (
              <>
                <p className="text-sm text-slate-700 font-medium mb-1">
                  You&apos;ve been invited to join {schoolName || 'a school'} as {roleLabel === 'Editor' ? 'an' : 'a'} <strong>{roleLabel}</strong>.
                </p>
                {existingUser ? (
                  <p className="text-sm text-slate-500 mt-1">
                    Sign in with your existing account to accept.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-1">
                    Create an account to get started.
                  </p>
                )}
              </>
            ) : (
              <>
                {ceoName && (
                  <p className="text-sm text-slate-700 font-medium mb-1">
                    Welcome, {ceoName}!
                  </p>
                )}
                <p className="text-sm text-slate-600">
                  You&apos;ve been invited to plan finances for your school on SchoolLaunch.
                </p>
              </>
            )}
            <p className="text-sm text-slate-500 mt-1">{invitation.email}</p>
          </div>

          {existingUser ? (
            /* STATE B: Existing user — sign in to join */
            <form onSubmit={handleSignInAndJoin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={invitation.email}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 text-sm"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  placeholder="Enter your password"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Joining...' : `Sign In & Join ${schoolName || 'School'}`}
              </button>
            </form>
          ) : (
            /* STATE A: New user — create account */
            <form onSubmit={handleCreateAccount} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  placeholder="Re-enter your password"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
