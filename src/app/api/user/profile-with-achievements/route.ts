import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { LeaderboardService } from '@/lib/services/leaderboard-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const userId = authResult.userId!

    // Get user with achievements
    const user = await UserService.getUserWithAchievements(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get leaderboard positions
    const leaderboardPositions = await LeaderboardService.getUserLeaderboardPositions(userId)

    // Get recent activity summary (placeholder for now)
    const activitySummary = {
      totalActivities: 0,
      activitiesByType: {},
      recentActivities: []
    }

    return NextResponse.json({
      user,
      leaderboardPositions,
      activitySummary
    })
  } catch (error) {
    console.error('Error fetching user profile with achievements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const body = await request.json()
    const { username, avatar, bio, currentTitle } = body
    const userId = authResult.userId!

    try {
      const updatedUser = await UserService.updateUserProfile(userId, {
        username,
        avatar,
        bio,
        currentTitle
      })

      if (!updatedUser) {
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 400 })
      }

      return NextResponse.json({ 
        user: updatedUser,
        message: 'Profile updated successfully' 
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('title')) {
        return NextResponse.json({ 
          error: error.message 
        }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    )
  }
}