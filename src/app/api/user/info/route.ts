import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }
    
    const db = await getDatabase()
    const usersCollection = db.collection('users')
    
    // Find user by wallet address
    const user = await usersCollection.findOne({ walletAddress })
    
    if (!user) {
      return NextResponse.json({ 
        walletAddress,
        username: null,
        exists: false 
      })
    }
    
    return NextResponse.json({
      walletAddress: user.walletAddress,
      username: user.username || null,
      exists: true,
      createdAt: user.createdAt,
      hasSubscription: user.hasSubscription || false,
      subscriptionTier: user.subscriptionTier || null
    })
    
  } catch (error) {
    console.error('Error fetching user info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user information' },
      { status: 500 }
    )
  }
}