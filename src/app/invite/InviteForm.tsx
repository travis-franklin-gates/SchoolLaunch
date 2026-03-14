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

export default function InviteForm({ invitation, ceoName }: { invitation: Invitation; ceoName?: string }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
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

      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: invitation.role,
        school_id: invitation.school_id,
        organization_id: invitation.organization_id,
      })

      if (roleError) {
        setError('Failed to assign role. Please contact support.')
        setLoading(false)
        return
      }

      await supabase
        .from('invitations')
        .update({ accepted: true, accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      if (invitation.role === 'school_ceo') {
        router.push('/onboarding')
      } else {
        router.push('/portfolio')
      }
    } catch {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">SchoolLaunch</h1>
            <p className="text-slate-500 mt-2">Set up your account</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            {ceoName && (
              <p className="text-sm text-slate-700 font-medium mb-1">
                Welcome, {ceoName}!
              </p>
            )}
            <p className="text-sm text-slate-600">
              You&apos;ve been invited to plan finances for your school on SchoolLaunch.
            </p>
            <p className="text-sm text-slate-500 mt-1">{invitation.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
        </div>
      </div>
    </div>
  )
}
