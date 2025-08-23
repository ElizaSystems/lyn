import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const X_CLIENT_ID = process.env.X_CLIENT_ID
const CALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`
  : 'http://localhost:3000/api/auth/x/callback'

export async function GET(request: NextRequest) {
  try {
    // Get current user session
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const walletAddress = authResult.user.walletAddress

    // Create state parameter with user info
    const state = Buffer.from(JSON.stringify({
      walletAddress,
      timestamp: Date.now()
    })).toString('base64')

    // X OAuth 2.0 authorization URL
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', X_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', CALLBACK_URL)
    authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', 'challenge')
    authUrl.searchParams.set('code_challenge_method', 'plain')

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('X OAuth connect error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate X authentication' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Alternative POST endpoint for client-side initiation
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const walletAddress = authResult.user.walletAddress

    // Create state parameter
    const state = Buffer.from(JSON.stringify({
      walletAddress,
      timestamp: Date.now()
    })).toString('base64')

    // Return auth URL for client-side redirect
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', X_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', CALLBACK_URL)
    authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', 'challenge')
    authUrl.searchParams.set('code_challenge_method', 'plain')

    return NextResponse.json({
      authUrl: authUrl.toString()
    })
  } catch (error) {
    console.error('X OAuth connect error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate X authentication' },
      { status: 500 }
    )
  }
}