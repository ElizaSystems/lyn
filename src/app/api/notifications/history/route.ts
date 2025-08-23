import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { db } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const channel = searchParams.get('channel')
    const status = searchParams.get('status')
    const eventType = searchParams.get('eventType')

    // Build query
    const query: any = { userId: authResult.user.id }
    
    if (channel) query.channel = channel
    if (status) query.status = status
    if (eventType) query.eventType = eventType

    const history = await db.notificationHistory.findByUserId(authResult.user.id, limit)

    // Filter by additional criteria if provided
    let filteredHistory = history
    if (channel) filteredHistory = filteredHistory.filter(h => h.channel === channel)
    if (status) filteredHistory = filteredHistory.filter(h => h.status === status)
    if (eventType) filteredHistory = filteredHistory.filter(h => h.eventType === eventType)

    return NextResponse.json({
      success: true,
      data: filteredHistory,
      total: filteredHistory.length
    })
  } catch (error) {
    console.error('Error fetching notification history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}