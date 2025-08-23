import { NextRequest, NextResponse } from 'next/server'
import { securityQuizService } from '@/lib/services/security-quiz-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const leaderboard = await securityQuizService.getQuizLeaderboard(limit)
    
    return NextResponse.json({
      success: true,
      leaderboard
    })
  } catch (error) {
    console.error('Error getting quiz leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to get leaderboard' },
      { status: 500 }
    )
  }
}