'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500 text-sm">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Detect recovery codes — Supabase PKCE always redirects to Site URL (login page)
  // regardless of redirectTo. Intercept and forward to /reset-password.
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setRedirecting(true)
      router.replace(`/reset-password?code=${code}`)
      return
    }
    // Also check hash fragment for non-PKCE flow
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      setRedirecting(true)
      router.replace(`/reset-password${hash}`)
    }
  }, [searchParams, router])

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setResetLoading(true)
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSent(true)
    setResetLoading(false)
  }

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

      // Fetch user role
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
        // Check if school profile is complete
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

  // Don't flash login form while redirecting to reset-password
  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Redirecting...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">SchoolLaunch</h1>
            <p className="text-slate-500 mt-2">Charter School Financial Planning</p>
          </div>

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
                  onClick={() => { setShowReset(true); setResetEmail(email); setResetSent(false) }}
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

          {/* Forgot password inline form */}
          {showReset && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              {resetSent ? (
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    If an account exists with that email, you&apos;ll receive a reset link shortly.
                  </p>
                  <button
                    onClick={() => setShowReset(false)}
                    className="mt-3 text-sm text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-sm text-slate-600">Enter your email to receive a password reset link.</p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                    placeholder="you@example.com"
                  />
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {resetLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
