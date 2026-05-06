'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SELECTED_SCHOOL_KEY } from '@/lib/useSchoolData'
import Link from 'next/link'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthShell } from '@/components/auth/AuthShell'

export default function SignupPage() {
  useDocumentTitle('Sign up')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const passwordHasLength = password.length >= 8
  const passwordHasNumberOrSymbol = /[\d\W_]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const canSubmit = fullName.trim().length > 0 && passwordHasLength && passwordHasNumberOrSymbol && passwordsMatch
  const confirmMismatch = confirmPassword.length > 0 && !passwordsMatch

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!canSubmit) return

    setLoading(true)

    try {
      // Call the server-side signup API
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName: fullName.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create account.')
        setLoading(false)
        return
      }

      // Sign in the user client-side
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('Account created but sign-in failed. Please go to the login page.')
        setLoading(false)
        return
      }

      // Set the new school as selected
      if (data.schoolId) {
        sessionStorage.setItem(SELECTED_SCHOOL_KEY, data.schoolId)
      }

      router.push('/onboarding')
    } catch {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading-var)' }}
        >
          Create your account
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Start modeling your school&rsquo;s finances in minutes.
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                placeholder="Jane Smith"
              />
            </div>

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
                aria-describedby="password-rules"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                placeholder="At least 8 characters"
              />
              <ul id="password-rules" className="mt-2 space-y-1 text-xs">
                <PasswordRule satisfied={passwordHasLength}>At least 8 characters</PasswordRule>
                <PasswordRule satisfied={passwordHasNumberOrSymbol}>Contains a number or symbol</PasswordRule>
              </ul>
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
                aria-invalid={confirmMismatch}
                aria-describedby={confirmMismatch ? 'confirm-error' : undefined}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 ${
                  confirmMismatch ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                }`}
                placeholder="Re-enter your password"
              />
              {confirmMismatch && (
                <p id="confirm-error" role="alert" className="text-xs text-rose-600 mt-1">
                  Passwords do not match.
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

      <div className="text-center mt-6">
        <Link
          href="/login"
          className="text-sm text-slate-600 hover:text-teal-700 underline-offset-4 hover:underline transition-colors"
        >
          Already have an account? <span className="text-teal-600 font-medium">Sign in</span>
        </Link>
      </div>
    </AuthShell>
  )
}

function PasswordRule({ satisfied, children }: { satisfied: boolean; children: React.ReactNode }) {
  return (
    <li
      className="flex items-center gap-1.5 transition-colors"
      style={{ color: satisfied ? 'var(--teal-700)' : 'var(--text-tertiary)' }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3.5 h-3.5 shrink-0"
        aria-hidden="true"
      >
        {satisfied ? (
          <path d="M5 13l4 4L19 7" />
        ) : (
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
        )}
      </svg>
      <span>{children}</span>
    </li>
  )
}
