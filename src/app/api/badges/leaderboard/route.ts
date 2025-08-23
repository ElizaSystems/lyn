import { NextRequest, NextResponse } from 'next/server'
import { BadgeServiceV2 } from '@/lib/services/badge-service-v2'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const leaderboard = await BadgeServiceV2.getBadgeLeaderboard(limit)
    
    return NextResponse.json({
      success: true,
      leaderboard
    })
  } catch (error) {
    console.error('Error getting badge leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to get leaderboard' },
      { status: 500 }
    )
  }
}