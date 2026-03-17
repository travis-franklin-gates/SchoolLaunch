'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [checked, setChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // The auth/confirm route exchanged the code and set session cookies.
    // Check if we have an active session from the recovery flow.
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
      }
      setChecked(true)
    }

    // Also listen for PASSWORD_RECOVERY event in case the hash-based flow is used
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setChecked(true)
      }
    })

    checkSession()
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      // Sign out so they log in fresh with the new password
      await supabase.auth.signOut()
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">SchoolLaunch</h1>
            <p className="text-slate-500 mt-2">Reset Your Password</p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg">
                Password updated successfully.
              </div>
              <Link
                href="/login"
                className="inline-block text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
              >
                Sign in with your new password
              </Link>
            </div>
          ) : ready ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  placeholder="Re-enter your password"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          ) : !checked ? (
            <div className="text-center">
              <p className="text-sm text-slate-500">Verifying your reset link...</p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-lg">
                Invalid or expired reset link.
              </div>
              <Link
                href="/login"
                className="inline-block text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
              >
                Request a new one
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
