import { NextRequest, NextResponse } from 'next/server'
import { AchievementService } from '@/lib/services/achievement-service'
import { authMiddleware } from '@/lib/middleware/auth'
import { AchievementCategory, AchievementTier } from '@/lib/models/achievement'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as AchievementCategory | null
    const tier = searchParams.get('tier') as AchievementTier | null
    const isCompleted = searchParams.get('completed')
    const includeStats = searchParams.get('include_stats') === 'true'
    const userId = authResult.userId!

    // Build filters
    const filters: any = {}
    if (category) filters.category = category
    if (tier) filters.tier = tier
    if (isCompleted !== null) filters.isCompleted = isCompleted === 'true'

    // Get user achievements
    const achievements = await AchievementService.getUserAchievements(userId, filters)
    
    let response: any = { achievements }

    // Include user stats if requested
    if (includeStats) {
      const userStats = await AchievementService.getUserStats(userId)
      response.stats = userStats
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching user achievements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user achievements' },
      { status: 500 }
    )
  }
}