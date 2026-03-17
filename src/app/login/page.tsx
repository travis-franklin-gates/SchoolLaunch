'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type View = 'login' | 'forgot' | 'reset' | 'reset-success'

export default function LoginPage() {
  const [view, setView] = useState<View>('login')

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Reset password state (shown after recovery link click)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // Listen for PASSWORD_RECOVERY event — fires when Supabase processes
  // the recovery token from the email link redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset')
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      const userId = authData.user.id

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, school_id')
        .eq('user_id', userId)
        .single()

      if (roleError || !roleData) {
        setError('No role assigned to this account.')
        setLoading(false)
        return
      }

      const { role, school_id } = roleData

      if (role === 'super_admin' || role === 'org_admin') {
        router.push('/portfolio')
        return
      }

      if (role === 'school_ceo' && school_id) {
        const { data: profile } = await supabase
          .from('school_profiles')
          .select('onboarding_complete')
          .eq('school_id', school_id)
          .single()

        if (profile?.onboarding_complete) {
          router.push('/dashboard')
        } else {
          router.push('/onboarding')
        }
        return
      }

      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendResetLink(e: React.FormEvent) {
    e.preventDefault()
    setResetLoading(true)
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    })
    setResetSent(true)
    setResetLoading(false)
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setResetError('')

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.')
      return
    }

    setResetSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setResetSubmitting(false)

    if (error) {
      setResetError(error.message)
    } else {
      await supabase.auth.signOut()
      setView('reset-success')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">SchoolLaunch</h1>
            <p className="text-slate-500 mt-2">
              {view === 'login' && 'Charter School Financial Planning'}
              {view === 'forgot' && 'Reset Your Password'}
              {view === 'reset' && 'Choose a New Password'}
              {view === 'reset-success' && 'Password Updated'}
            </p>
          </div>

          {/* ---- LOGIN FORM ---- */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setResetEmail(email); setResetSent(false) }}
                    className="text-xs text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
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
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ---- FORGOT PASSWORD (send reset email) ---- */}
          {view === 'forgot' && (
            resetSent ? (
              <div className="text-center space-y-4">
                <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg">
                  If an account exists with that email, you&apos;ll receive a reset link shortly.
                </div>
                <button
                  onClick={() => { setView('login'); setResetSent(false) }}
                  className="text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResetLink} className="space-y-5">
                <p className="text-sm text-slate-600">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </p>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )
          )}

          {/* ---- RESET PASSWORD (new password form) ---- */}
          {view === 'reset' && (
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  placeholder="Re-enter your password"
                />
              </div>

              {resetError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                  {resetError}
                </div>
              )}

              <button
                type="submit"
                disabled={resetSubmitting}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          {/* ---- RESET SUCCESS ---- */}
          {view === 'reset-success' && (
            <div className="text-center space-y-4">
              <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg">
                Password updated successfully.
              </div>
              <button
                onClick={() => setView('login')}
                className="text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
              >
                Sign in with your new password
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
