import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { NotificationService } from '@/lib/services/notification-service'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const stats = await NotificationService.getNotificationStats(authResult.user.id, days)

    return NextResponse.json({
      success: true,
      data: stats,
      period: `${days} days`
    })
  } catch (error) {
    console.error('Error fetching notification stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}