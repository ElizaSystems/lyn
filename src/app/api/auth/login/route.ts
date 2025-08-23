import { NextRequest, NextResponse } from 'next/server'
import { walletAuth, checkIPRateLimit, createRateLimitHeaders, getClientIP, getUserAgent } from '@/lib/auth'
import { db } from '@/lib/mongodb'
import bs58 from 'bs58'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting (increase to 12/min)
    const MAX_PER_MINUTE = 12
    const rateLimit = await checkIPRateLimit(req, 'login', 60000, MAX_PER_MINUTE)
    const headers = createRateLimitHeaders(rateLimit, MAX_PER_MINUTE)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers }
      )
    }

    const { walletAddress, signature, signatureBytes, message } = await req.json()

    // If already authenticated via cookie token and same wallet, short-circuit
    try {
      const existing = await db.sessions.findByToken(req.cookies.get('auth-token')?.value || '')
      if (existing) {
        const user = await db.users.findById(existing.userId)
        if (user && user.walletAddress === walletAddress) {
          return NextResponse.json({
            user: {
              id: user._id!.toString(),
              walletAddress: user.walletAddress,
              tokenBalance: user.tokenBalance,
              hasTokenAccess: user.hasTokenAccess,
              questionsAsked: 0,
            },
            message: 'Already logged in',
            token: existing.token,
          }, { headers })
        }
      }
    } catch {}

    if (!walletAddress || (!signature && !signatureBytes) || !message) {
      return NextResponse.json(
        { error: 'Wallet address, signature, and message are required' },
        { status: 400, headers }
      )
    }

    // Normalize signature to base58 string
    let signatureBase58: string
    if (typeof signature === 'string') {
      // Accept base58 or base64 and normalize to base58
      try {
        bs58.decode(signature)
        signatureBase58 = signature
      } catch {
        try {
          const asBase64 = Buffer.from(signature, 'base64')
          signatureBase58 = bs58.encode(asBase64)
        } catch {
          return NextResponse.json(
            { error: 'Invalid signature string' },
            { status: 400, headers }
          )
        }
      }
    } else if (Array.isArray(signatureBytes)) {
      try {
        const bytes = new Uint8Array(signatureBytes as number[])
        signatureBase58 = bs58.encode(bytes)
      } catch {
        return NextResponse.json(
          { error: 'Invalid signature bytes' },
          { status: 400, headers }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 400, headers }
      )
    }

    const result = await walletAuth.verifyAndLogin(walletAddress, signatureBase58, message)

    // Log successful login
    await db.audit.log({
      userId: result.user.id,
      action: 'login_success',
      resource: 'authentication',
      details: { 
        walletAddress,
        hasTokenAccess: result.user.hasTokenAccess,
      },
      ipAddress: getClientIP(req),
      userAgent: getUserAgent(req),
    })

    // Set secure cookie
    const response = NextResponse.json({
      user: result.user,
      message: 'Login successful',
      token: result.token,
    }, { headers })

    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    
    // Log failed login attempt
    const { walletAddress } = await req.json().catch(() => ({}))
    await db.audit.log({
      action: 'login_failed',
      resource: 'authentication',
      details: { 
        walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      ipAddress: getClientIP(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 400 }
    )
  }
}