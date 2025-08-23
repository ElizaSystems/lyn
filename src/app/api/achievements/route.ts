import { NextRequest, NextResponse } from 'next/server'
import { AchievementService } from '@/lib/services/achievement-service'
import { authMiddleware } from '@/lib/middleware/auth'
import { AchievementCategory, AchievementTier, AchievementType } from '@/lib/models/achievement'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as AchievementCategory | null
    const tier = searchParams.get('tier') as AchievementTier | null
    const type = searchParams.get('type') as AchievementType | null
    const isActive = searchParams.get('active') === 'true'
    const includeProgress = searchParams.get('include_progress') === 'true'
    const userId = authResult.userId!

    // Get achievement definitions
    const filters: any = {}
    if (category) filters.category = category
    if (tier) filters.tier = tier
    if (type) filters.type = type
    if (isActive) filters.isActive = true

    const definitions = await AchievementService.getAchievementDefinitions(filters)

    // If progress is requested, get user's progress for each achievement
    let response: any = { achievements: definitions }

    if (includeProgress) {
      const userAchievements = await AchievementService.getUserAchievements(userId)
      const progressData = await AchievementService.getAchievementProgress(userId)

      // Map progress to achievements
      const achievementsWithProgress = definitions.map(def => {
        const userAchievement = userAchievements.find(ua => ua.achievementKey === def.key)
        const progress = progressData.find(p => p.achievementKey === def.key)

        return {
          ...def,
          userProgress: userAchievement || null,
          progress: progress ? {
            current: progress.currentValue,
            target: progress.targetValue,
            percentage: Math.min(100, Math.floor((progress.currentValue / progress.targetValue) * 100))
          } : null
        }
      })

      response = { achievements: achievementsWithProgress }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch achievements' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    // Only allow admin users to create achievements
    // This would typically check for admin role
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      key,
      name,
      description,
      category,
      tier,
      type,
      rarity,
      requirements,
      rewards,
      metadata,
      isActive = true
    } = body

    // Validate required fields
    if (!key || !name || !description || !category || !tier || !type || !requirements || !rewards) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const achievement = await AchievementService.createAchievementDefinition({
      key,
      name,
      description,
      category,
      tier,
      type,
      rarity,
      requirements,
      rewards,
      metadata: metadata || {},
      isActive
    })

    return NextResponse.json({ achievement }, { status: 201 })
  } catch (error) {
    console.error('Error creating achievement:', error)
    return NextResponse.json(
      { error: 'Failed to create achievement' },
      { status: 500 }
    )
  }
}