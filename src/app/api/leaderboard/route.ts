import { NextRequest, NextResponse } from 'next/server'
import { LeaderboardService, LeaderboardFilters } from '@/lib/services/leaderboard-service'
import { authMiddleware } from '@/lib/middleware/auth'
import { AchievementCategory, ActivityType } from '@/lib/models/achievement'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'xp'
    const category = searchParams.get('category') as AchievementCategory | null
    const timeframe = searchParams.get('timeframe') as 'daily' | 'weekly' | 'monthly' | 'all_time' || 'all_time'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const includeUserRank = searchParams.get('include_user_rank') === 'true'

    // Get user ID if authenticated and user rank is requested
    let userId: string | undefined
    if (includeUserRank) {
      try {
        const authResult = await authMiddleware(request)
        if (!authResult.error) {
          userId = authResult.userId!
        }
      } catch {
        // Ignore auth errors for public leaderboards
      }
    }

    const filters: LeaderboardFilters = {
      timeframe,
      category: category || undefined
    }

    let leaderboard
    
    switch (type) {
      case 'xp':
        leaderboard = await LeaderboardService.getXPLeaderboard(filters, limit, userId)
        break
        
      case 'comprehensive':
        leaderboard = await LeaderboardService.getComprehensiveLeaderboard(filters, limit, userId)
        break
        
      case 'burns':
      case 'token_burns':
        leaderboard = await LeaderboardService.getTokenBurnLeaderboard(filters, limit, userId)
        break
        
      case 'category':
        if (!category) {
          return NextResponse.json(
            { error: 'Category parameter required for category leaderboard' },
            { status: 400 }
          )
        }
        leaderboard = await LeaderboardService.getCategoryLeaderboard(category, filters, limit, userId)
        break
        
      case 'activity':
        const activityType = searchParams.get('activity_type') as ActivityType
        if (!activityType) {
          return NextResponse.json(
            { error: 'Activity type parameter required for activity leaderboard' },
            { status: 400 }
          )
        }
        leaderboard = await LeaderboardService.getActivityLeaderboard(activityType, filters, limit, userId)
        break
        
      case 'trending':
        const trendingUsers = await LeaderboardService.getTrendingUsers(limit)
        leaderboard = {
          entries: trendingUsers,
          userRank: undefined,
          totalParticipants: trendingUsers.length,
          lastUpdated: new Date(),
          filters
        }
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid leaderboard type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      type,
      ...leaderboard
    })
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}