import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { NotificationService } from '@/lib/services/notification-service'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updatedCount = await NotificationService.markAllNotificationsAsRead(authResult.user.id)

    return NextResponse.json({
      success: true,
      message: `${updatedCount} notifications marked as read`,
      updatedCount
    })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}