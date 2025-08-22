import { NextRequest, NextResponse } from 'next/server'
import { BurnService } from '@/lib/services/burn-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const leaderboard = await BurnService.getLeaderboard(limit)
    
    return NextResponse.json({
      success: true,
      leaderboard,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Leaderboard fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch burn leaderboard' },
      { status: 500 }
    )
  }
}