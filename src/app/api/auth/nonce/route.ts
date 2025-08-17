import { NextRequest, NextResponse } from 'next/server'
import { walletAuth, checkIPRateLimit, createRateLimitHeaders, getClientIP } from '@/lib/auth'
import { db } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = await checkIPRateLimit(req, 'nonce-request', 60000, 10) // 10 per minute
    const headers = createRateLimitHeaders(rateLimit, 10)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers }
      )
    }

    const { walletAddress } = await req.json()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400, headers }
      )
    }

    const result = await walletAuth.requestNonce(walletAddress)

    // Log nonce request
    await db.audit.log({
      action: 'nonce_request',
      resource: 'authentication',
      details: { walletAddress },
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json(result, { headers })
  } catch (error) {
    console.error('Nonce request error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate nonce' },
      { status: 400 }
    )
  }
}