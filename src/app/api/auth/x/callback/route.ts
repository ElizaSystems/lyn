import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

const X_CLIENT_ID = process.env.X_CLIENT_ID
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET
const CALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`
  : 'http://localhost:3000/api/auth/x/callback'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (!code) {
      return NextResponse.redirect(new URL('/scans?error=x_auth_failed', request.url))
    }

    // Decode state to get user wallet address
    let walletAddress: string | null = null
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())
        walletAddress = decodedState.walletAddress
      } catch (e) {
        console.error('Failed to decode state:', e)
      }
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK_URL,
        code_verifier: 'challenge' // For PKCE flow
      })
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(new URL('/scans?error=x_token_failed', request.url))
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Get user info from X
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!userResponse.ok) {
      console.error('Failed to get user info:', await userResponse.text())
      return NextResponse.redirect(new URL('/scans?error=x_user_failed', request.url))
    }

    const userData = await userResponse.json()
    const xUsername = userData.data.username
    const xUserId = userData.data.id
    const xName = userData.data.name

    // Update user in database
    const db = await getDatabase()
    const usersCollection = db.collection('users')
    
    if (walletAddress) {
      // Update existing user with X info
      const updateResult = await usersCollection.updateOne(
        { walletAddress },
        {
          $set: {
            xUsername,
            xUserId,
            xName,
            xConnectedAt: new Date(),
            xAccessToken: accessToken, // Store encrypted in production
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      )

      // Grant monthly free scans
      const scansCollection = db.collection('user_scan_quotas')
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
      
      await scansCollection.updateOne(
        { 
          walletAddress,
          month: currentMonth
        },
        {
          $setOnInsert: {
            xFreeScans: 5,
            xFreeScansUsed: 0,
            createdAt: new Date()
          },
          $set: {
            xUsername,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      )

      // Award 50 reputation points for connecting X account (only on first connection)
      const reputationCollection = db.collection('user_reputation')
      const existingRep = await reputationCollection.findOne({ walletAddress })
      
      if (!updateResult.value?.xConnectedAt) { // First time connecting X
        if (existingRep) {
          await reputationCollection.updateOne(
            { walletAddress },
            { 
              $inc: { reputationScore: 50 },
              $push: { 
                achievements: {
                  type: 'x_connected',
                  points: 50,
                  earnedAt: new Date(),
                  description: 'Connected X account'
                }
              }
            }
          )
        } else {
          // Create new reputation record with 50 points
          await reputationCollection.insertOne({
            walletAddress,
            xUsername,
            reputationScore: 50,
            tier: 'novice',
            achievements: [{
              type: 'x_connected',
              points: 50,
              earnedAt: new Date(),
              description: 'Connected X account'
            }],
            createdAt: new Date()
          })
        }
        console.log(`[X OAuth] Awarded 50 reputation points for first X connection`)
      }
      
      console.log(`[X OAuth] Connected X account @${xUsername} to wallet ${walletAddress}`)
    }

    // Create session token
    const token = jwt.sign(
      { 
        walletAddress,
        xUsername,
        xUserId
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    )

    // Set cookie and redirect
    const response = NextResponse.redirect(new URL('/scans?x_connected=true', request.url))
    response.cookies.set('x-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return response
  } catch (error) {
    console.error('X OAuth callback error:', error)
    return NextResponse.redirect(new URL('/scans?error=x_auth_error', request.url))
  }
}