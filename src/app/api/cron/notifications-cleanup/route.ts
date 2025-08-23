import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/services/notification-service'
import { db } from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    // Verify the request is coming from a cron job or authorized source
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    let cleanupResults = {
      expiredInAppNotifications: 0,
      oldNotificationHistory: 0,
      expiredRateLimits: 0
    }

    // Clean up expired in-app notifications
    try {
      await NotificationService.cleanupExpiredNotifications()
      cleanupResults.expiredInAppNotifications++
      console.log('✅ Cleaned up expired in-app notifications')
    } catch (error) {
      console.error('❌ Failed to clean up expired in-app notifications:', error)
    }

    // Clean up old notification history (default: keep 90 days)
    try {
      const daysToKeep = parseInt(process.env.NOTIFICATION_CLEANUP_DAYS || '90')
      await NotificationService.cleanupOldHistory(daysToKeep)
      cleanupResults.oldNotificationHistory++
      console.log(`✅ Cleaned up old notification history (kept ${daysToKeep} days)`)
    } catch (error) {
      console.error('❌ Failed to clean up old notification history:', error)
    }

    // Clean up expired rate limits
    try {
      await db.rateLimit.cleanup()
      cleanupResults.expiredRateLimits++
      console.log('✅ Cleaned up expired rate limits')
    } catch (error) {
      console.error('❌ Failed to clean up expired rate limits:', error)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Notification cleanup completed successfully',
      results: cleanupResults,
      duration: `${duration}ms`
    })
  } catch (error) {
    console.error('Error during notification cleanup:', error)
    return NextResponse.json({ 
      error: 'Notification cleanup failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}