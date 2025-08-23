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
    const limit = parseInt(searchParams.get('limit') || '50')
    const onlyUnread = searchParams.get('unread') === 'true'

    const notifications = await NotificationService.getInAppNotifications(authResult.user.id, limit)
    
    // Filter for unread only if requested
    const filteredNotifications = onlyUnread 
      ? notifications.filter(n => !n.isRead)
      : notifications

    return NextResponse.json({
      success: true,
      data: filteredNotifications,
      total: filteredNotifications.length,
      unreadCount: notifications.filter(n => !n.isRead).length
    })
  } catch (error) {
    console.error('Error fetching in-app notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, eventType, priority, metadata, expiresIn } = body

    // Validate required fields
    if (!title || !content || !eventType) {
      return NextResponse.json({ 
        error: 'Missing required fields: title, content, eventType' 
      }, { status: 400 })
    }

    const notification = await NotificationService.createInAppNotification(
      authResult.user.id,
      title,
      content,
      eventType,
      {
        priority: priority || 'medium',
        metadata,
        expiresIn
      }
    )

    return NextResponse.json({
      success: true,
      data: notification
    })
  } catch (error) {
    console.error('Error creating in-app notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}