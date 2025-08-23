import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDatabase()
    const usersCollection = db.collection('users')
    const subscriptionsCollection = db.collection('subscriptions')
    
    // Get user data
    const user = await usersCollection.findOne({ 
      walletAddress: auth.walletAddress 
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Check for active subscription
    const activeSubscription = await subscriptionsCollection.findOne({
      walletAddress: auth.walletAddress,
      status: 'active',
      endDate: { $gt: new Date() }
    })
    
    const profileData = {
      walletAddress: user.walletAddress,
      username: user.username || null,
      xUsername: user.xUsername || null,
      isPremium: !!activeSubscription,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      hasTokenAccess: user.hasTokenAccess || false,
      tokenBalance: user.tokenBalance || 0
    }
    
    return NextResponse.json(profileData)
    
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    )
  }
}