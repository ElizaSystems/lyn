import { NextResponse, NextRequest } from 'next/server'
import { rateLimitMiddleware } from '@/middleware/rate-limit'

// Paths that should be rate limited
const RATE_LIMITED_PATHS = [
  '/api/auth',
  '/api/user',
  '/api/security',
  '/api/agents',
  '/api/chat',
  '/api/referral'
]

export async function middleware(request: NextRequest) {
  const url = new URL(request.url)
  const path = request.nextUrl.pathname
  const ref = url.searchParams.get('ref')

  // Create response object
  let response = NextResponse.next()

  // Persist referral code in a cookie if present
  if (ref) {
    response.cookies.set('referral-code', ref, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax'
    })
  }

  // Apply rate limiting to API routes
  if (RATE_LIMITED_PATHS.some(limited => path.startsWith(limited))) {
    const rateLimitResponse = await rateLimitMiddleware(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
  }

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // CORS headers for API routes
  if (path.startsWith('/api')) {
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token')
    response.headers.set('Access-Control-Max-Age', '86400')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)'
  ]
}


