import { NextRequest, NextResponse } from 'next/server'
import { BurnService } from '@/lib/services/burn-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    
    const recentBurns = await BurnService.getRecentBurns(limit)
    
    // Format burns for display
    const formattedBurns = recentBurns.map(burn => ({
      id: burn._id?.toString(),
      walletAddress: burn.walletAddress,
      username: burn.username,
      amount: burn.amount,
      type: burn.type,
      description: burn.description || getDefaultDescription(burn.type),
      transactionSignature: burn.transactionSignature,
      timestamp: burn.timestamp,
      verified: burn.verified
    }))
    
    return NextResponse.json({
      success: true,
      burns: formattedBurns,
      count: formattedBurns.length,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Recent burns fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent burns' },
      { status: 500 }
    )
  }
}

function getDefaultDescription(type: string): string {
  switch (type) {
    case 'username_registration':
      return 'Username Registration'
    case 'feature_unlock':
      return 'Feature Unlock'
    case 'community_event':
      return 'Community Event'
    case 'manual':
      return 'Manual Burn'
    default:
      return 'Token Burn'
  }
}