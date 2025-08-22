import { NextRequest, NextResponse } from 'next/server'
import { BurnService } from '@/lib/services/burn-service'

export async function GET(request: NextRequest) {
  try {
    console.log(`[Burn Recent] Fetching recent burns`)
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    
    const recentBurns = await BurnService.getRecentBurns(limit)
    console.log(`[Burn Recent] Found ${recentBurns.length} burns`)
    
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
    
    // Return empty burns instead of error to keep UI working
    return NextResponse.json({
      success: false,
      burns: [],
      count: 0,
      timestamp: new Date(),
      error: 'Failed to fetch recent burns',
      fallback: true
    }, { status: 200 })
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