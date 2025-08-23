import { NextRequest, NextResponse } from 'next/server'
import { AchievementService } from '@/lib/services/achievement-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    // Only allow admin users to initialize achievements
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await AchievementService.initializeDefaultAchievements()

    return NextResponse.json({ 
      message: 'Default achievements initialized successfully' 
    })
  } catch (error) {
    console.error('Error initializing achievements:', error)
    return NextResponse.json(
      { error: 'Failed to initialize achievements' },
      { status: 500 }
    )
  }
}