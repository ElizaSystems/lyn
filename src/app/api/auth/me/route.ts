import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'

export async function GET(req: NextRequest) {
  try {
    // Try to get user from auth token first
    let user = await getCurrentUser(req)
    
    // If we have a user but no username, fetch it from DB
    if (user && !user.username) {
      const db = await getDatabase()
      const dbUser = await db.collection('users').findOne({ walletAddress: user.walletAddress })
      if (dbUser && dbUser.username) {
        user.username = dbUser.username
        console.log(`[Auth Me] Found username ${dbUser.username} for wallet ${user.walletAddress}`)
      }
    }
    
    // If no user from token, check if we have wallet in header and get from DB
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
            questionsAsked: 0
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