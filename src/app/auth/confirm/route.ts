import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const redirectTo = request.nextUrl.clone()

  if (code) {
    const supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // For password recovery, redirect to the reset-password page
      if (type === 'recovery') {
        redirectTo.pathname = '/reset-password'
        redirectTo.searchParams.delete('code')
        redirectTo.searchParams.delete('type')
        const response = NextResponse.redirect(redirectTo)
        // Copy the session cookies from supabaseResponse to the redirect response
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          response.cookies.set(cookie.name, cookie.value, cookie)
        })
        return response
      }

      // For other auth confirmations (signup, etc.), redirect to dashboard
      redirectTo.pathname = '/dashboard'
      redirectTo.searchParams.delete('code')
      redirectTo.searchParams.delete('type')
      const response = NextResponse.redirect(redirectTo)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie)
      })
      return response
    }
  }

  // If code exchange failed or no code, redirect to login with error
  redirectTo.pathname = '/login'
  redirectTo.searchParams.delete('code')
  redirectTo.searchParams.delete('type')
  return NextResponse.redirect(redirectTo)
}
