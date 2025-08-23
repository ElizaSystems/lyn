import { NextRequest, NextResponse } from 'next/server'
import { AchievementService } from '@/lib/services/achievement-service'
import { authMiddleware } from '@/lib/middleware/auth'
import { ActivityType } from '@/lib/models/achievement'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const body = await request.json()
    const { activityType, value = 1, metadata } = body
    const userId = authResult.userId!

    // Validate activity type
    const validActivityTypes: ActivityType[] = [
      'scan_completed',
      'threat_detected',
      'wallet_analyzed',
      'document_scanned',
      'url_checked',
      'tokens_burned',
      'referral_completed',
      'community_vote',
      'feedback_submitted',
      'daily_login',
      'profile_updated',
      'subscription_purchased',
      'streak_maintained'
    ]

    if (!validActivityTypes.includes(activityType)) {
      return NextResponse.json(
        { error: 'Invalid activity type' },
        { status: 400 }
      )
    }

    // Track the activity
    await AchievementService.trackActivity(userId, activityType, value, metadata)

    // Get updated user stats
    const userStats = await AchievementService.getUserStats(userId)

    return NextResponse.json({
      message: 'Activity tracked successfully',
      stats: userStats
    })
  } catch (error) {
    console.error('Error tracking activity:', error)
    return NextResponse.json(
      { error: 'Failed to track activity' },
      { status: 500 }
    )
  }
}