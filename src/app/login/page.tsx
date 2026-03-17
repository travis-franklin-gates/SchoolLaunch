'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type View = 'login' | 'forgot' | 'verify' | 'reset'

export default function LoginPage() {
  const [view, setView] = useState<View>('login')

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState('')

  // OTP verify state
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const digitRefs = useRef<(HTMLInputElement | null)[]>([])

  // Reset password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

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

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault()
    setForgotLoading(true)
    setForgotMessage('')

    await supabase.auth.signInWithOtp({
      email: resetEmail,
      options: { shouldCreateUser: false },
    })

    // Always show success message — don't reveal if account exists
    setForgotLoading(false)
    setForgotMessage('A 6-digit code has been sent to your email.')
    setDigits(['', '', '', '', '', ''])
    setVerifyError('')
    setTimeout(() => {
      setView('verify')
      setForgotMessage('')
    }, 1500)
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return
    setVerifyError('')
    await supabase.auth.signInWithOtp({
      email: resetEmail,
      options: { shouldCreateUser: false },
    })
    setResendCooldown(30)
  }

  const handleVerify = useCallback(async (code: string) => {
    setVerifyError('')
    setVerifyLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email: resetEmail,
      token: code,
      type: 'email',
    })

    setVerifyLoading(false)

    if (error) {
      setVerifyError('Invalid or expired code. Please try again.')
    } else {
      setNewPassword('')
      setConfirmPassword('')
      setResetError('')
      setResetSuccess(false)
      setView('reset')
    }
  }, [supabase, resetEmail])

  function handleDigitChange(index: number, value: string) {
    // Handle paste of full code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6)
      if (pasted.length > 0) {
        const newDigits = [...digits]
        for (let i = 0; i < 6; i++) {
          newDigits[i] = pasted[i] || ''
        }
        setDigits(newDigits)
        // Focus last filled digit or submit
        const lastIndex = Math.min(pasted.length - 1, 5)
        digitRefs.current[lastIndex]?.focus()
        if (pasted.length === 6) {
          handleVerify(pasted)
        }
        return
      }
    }

    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...digits]
    newDigits[index] = digit
    setDigits(newDigits)

    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const code = newDigits.join('')
      if (code.length === 6) {
        handleVerify(code)
      }
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus()
    }
  }

  function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 6) {
      setVerifyError('Please enter all 6 digits.')
      return
    }
    handleVerify(code)
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
      setResetSuccess(true)
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
              {view === 'verify' && 'Enter Verification Code'}
              {view === 'reset' && (resetSuccess ? 'Password Updated' : 'Choose a New Password')}
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
                    onClick={() => { setView('forgot'); setResetEmail(email); setForgotMessage('') }}
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

          {/* ---- FORGOT PASSWORD (send OTP) ---- */}
          {view === 'forgot' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <p className="text-sm text-slate-600">
                Enter your email address and we&apos;ll send you a verification code.
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

              {forgotMessage && (
                <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg">
                  {forgotMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotLoading ? 'Sending...' : 'Send Verification Code'}
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
          )}

          {/* ---- VERIFY OTP CODE ---- */}
          {view === 'verify' && (
            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <p className="text-sm text-slate-600 text-center">
                Check your email for a 6-digit code
              </p>

              <div className="flex justify-center gap-2">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { digitRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    autoFocus={i === 0}
                    className="w-11 h-13 text-2xl text-center font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                  />
                ))}
              </div>

              {verifyError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                  {verifyError}
                </div>
              )}

              <button
                type="submit"
                disabled={verifyLoading}
                className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyLoading ? 'Verifying...' : 'Verify'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Back to Sign In
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0}
                  className="text-teal-600 hover:text-teal-800 transition-colors disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {/* ---- RESET PASSWORD ---- */}
          {view === 'reset' && !resetSuccess && (
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
          {view === 'reset' && resetSuccess && (
            <div className="text-center space-y-4">
              <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg">
                Password updated successfully.
              </div>
              <button
                onClick={() => { setResetSuccess(false); setView('login') }}
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
