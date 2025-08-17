import { NextRequest, NextResponse } from 'next/server'
import { extractToken, walletAuth, getClientIP, getUserAgent } from '@/lib/auth'
import { db } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req)
    
    if (token) {
      await walletAuth.logout(token)
      
      // Log logout
      await db.audit.log({
        action: 'logout',
        resource: 'authentication',
        details: { token: token.substring(0, 8) + '...' },
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
      })
    }

    const response = NextResponse.json({ message: 'Logged out successfully' })
    
    // Clear cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}