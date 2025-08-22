import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/subscription-service'

export async function GET(request: NextRequest) {
  try {
    // Verify this is from a cron job or admin
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Update expired subscriptions
    const updatedCount = await SubscriptionService.updateExpiredSubscriptions()
    
    return NextResponse.json({
      success: true,
      updatedSubscriptions: updatedCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Subscription cron error:', error)
    return NextResponse.json(
      { error: 'Failed to update subscriptions' },
      { status: 500 }
    )
  }
}