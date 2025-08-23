import { NextRequest, NextResponse } from 'next/server'
import { ScanTrackerService } from '@/lib/services/scan-tracker-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'streak' | 'total' | 'badges' || 'streak'
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const leaderboard = await ScanTrackerService.getLeaderboard(type, limit)
    
    return NextResponse.json({
      type,
      leaderboard,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Failed to get leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve leaderboard' },
      { status: 500 }
    )
  }
}