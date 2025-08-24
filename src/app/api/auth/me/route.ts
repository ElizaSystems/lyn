import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'

export async function GET(req: NextRequest) {
  try {
    // Check for token in BOTH cookie and Authorization header
    let token: string | null = null
    
    // First check cookie
    const cookieToken = req.cookies.get('auth-token')?.value
    if (cookieToken) {
      token = cookieToken
      console.log('[Auth Me] Found token in cookie')
    }
    
    // Also check Authorization header
    if (!token) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1]
        console.log('[Auth Me] Found token in Authorization header')
      }
    }
    
    // Also check localStorage token passed as custom header
    if (!token) {
      token = req.headers.get('x-auth-token') || null
      if (token) {
        console.log('[Auth Me] Found token in x-auth-token header')
      }
    }
    
    let user = null
    
    // If we have a token, try to get user
    if (token) {
      try {
        user = await getCurrentUser(req)
      } catch (e) {
        console.log('[Auth Me] getCurrentUser failed, trying direct token lookup')
        // Try direct session lookup with normalized token
        const db = await getDatabase()
        const normalizedToken = token.trim()
        const session = await db.collection('sessions').findOne({ 
          token: normalizedToken,
          expiresAt: { $gt: new Date() }
        })
        
        if (session) {
          const dbUser = await db.collection('users').findOne({ 
            $or: [
              { _id: session.userId },
              { walletAddress: session.userId } // Sometimes userId is wallet
            ]
          })
          
          if (dbUser) {
            user = {
              id: dbUser._id.toString(),
              walletAddress: dbUser.walletAddress,
              username: dbUser.username || dbUser.profile?.username,
              tokenBalance: dbUser.tokenBalance || 0,
              hasTokenAccess: dbUser.hasTokenAccess !== false,
              questionsAsked: 0
            }
          }
        }
      }
    }
    
    // If we have a user, ensure we have complete info from DB
    if (user) {
      const db = await getDatabase()
      const dbUser = await db.collection('users').findOne({ walletAddress: user.walletAddress })
      if (dbUser) {
        user.username = dbUser.username || user.username
        console.log(`[Auth Me] Found username ${dbUser.username} for wallet ${user.walletAddress}`)
        
        // Also get referral code
        const referralCode = await db.collection('referral_codes_v2').findOne({ walletAddress: user.walletAddress })
        if (referralCode) {
          user.referralCode = referralCode.code
          user.referralLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${referralCode.code}`
        }
      }
    }
    
    // Fallback: check wallet address header
    if (!user) {
      const walletAddress = req.headers.get('x-wallet-address')
      if (walletAddress) {
        const db = await getDatabase()
        const dbUser = await db.collection('users').findOne({ walletAddress })
        if (dbUser) {
          user = {
            id: dbUser._id.toString(),
            walletAddress: dbUser.walletAddress,
            username: dbUser.username || dbUser.profile?.username,
            tokenBalance: dbUser.tokenBalance || 0,
            hasTokenAccess: dbUser.hasTokenAccess !== false,
            questionsAsked: 0,
            referralCode: dbUser.referralCode,
            referralLink: dbUser.referralCode ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${dbUser.referralCode}` : undefined
          }
        }
      }
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 500 }
    )
  }
}