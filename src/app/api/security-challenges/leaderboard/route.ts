import { NextRequest, NextResponse } from 'next/server'
import { securityChallengeService } from '@/lib/services/security-challenge-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const leaderboard = await securityChallengeService.getChallengeLeaderboard(limit)
    
    return NextResponse.json({
      success: true,
      leaderboard
    })
  } catch (error) {
    console.error('Error getting challenge leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to get leaderboard' },
      { status: 500 }
    )
  }
}