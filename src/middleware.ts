import { NextResponse, NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = new URL(request.url)
  const ref = url.searchParams.get('ref')

  // Persist referral code in a cookie if present
  if (ref) {
    const response = NextResponse.next()
    response.cookies.set('referral-code', ref, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax'
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)'
  ]
}


