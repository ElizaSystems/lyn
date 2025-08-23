import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { NotificationService } from '@/lib/services/notification-service'
import { db } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await NotificationService.getUserPreferences(authResult.user.id)
    
    return NextResponse.json({
      success: true,
      data: preferences || {
        userId: authResult.user.id,
        email: { enabled: false, address: '', events: [] },
        webhook: { enabled: false, url: '', events: [] },
        inApp: { enabled: true, events: ['task-completed', 'task-failed', 'security-alert'] },
        frequency: { maxPerHour: 10, maxPerDay: 50 }
      }
    })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
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
    const { email, webhook, inApp, quietHours, frequency } = body

    // Validate the input
    if (email && (!email.address || !Array.isArray(email.events))) {
      return NextResponse.json({ error: 'Invalid email preferences' }, { status: 400 })
    }

    if (webhook && webhook.enabled && (!webhook.url || !Array.isArray(webhook.events))) {
      return NextResponse.json({ error: 'Invalid webhook preferences' }, { status: 400 })
    }

    if (inApp && !Array.isArray(inApp.events)) {
      return NextResponse.json({ error: 'Invalid in-app preferences' }, { status: 400 })
    }

    const preferences = await NotificationService.updateUserPreferences(authResult.user.id, {
      email,
      webhook,
      inApp,
      quietHours,
      frequency
    })

    return NextResponse.json({
      success: true,
      data: preferences
    })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}