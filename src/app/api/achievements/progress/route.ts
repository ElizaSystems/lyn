import { NextRequest, NextResponse } from 'next/server'
import { AchievementService } from '@/lib/services/achievement-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const userId = authResult.userId!
    const progress = await AchievementService.getAchievementProgress(userId)

    // Get achievement definitions for context
    const definitions = await AchievementService.getAchievementDefinitions()
    const definitionsMap = new Map(definitions.map(def => [def.key, def]))

    // Enhance progress with definition details
    const enhancedProgress = progress.map(p => ({
      ...p,
      definition: definitionsMap.get(p.achievementKey),
      percentage: Math.min(100, Math.floor((p.currentValue / p.targetValue) * 100))
    }))

    return NextResponse.json({ progress: enhancedProgress })
  } catch (error) {
    console.error('Error fetching achievement progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch achievement progress' },
      { status: 500 }
    )
  }
}