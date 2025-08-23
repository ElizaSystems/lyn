import { NextRequest, NextResponse } from 'next/server'
import { LeaderboardService } from '@/lib/services/leaderboard-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { userId } = params
    const requestingUserId = authResult.userId!

    // Users can only access their own leaderboard positions unless they're admin
    if (userId !== requestingUserId && !authResult.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const positions = await LeaderboardService.getUserLeaderboardPositions(userId)

    return NextResponse.json({ positions })
  } catch (error) {
    console.error('Error fetching user leaderboard positions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user leaderboard positions' },
      { status: 500 }
    )
  }
}