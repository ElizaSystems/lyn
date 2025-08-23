import { NextRequest, NextResponse } from 'next/server'
import { ThreatSubscriptionService } from '@/lib/services/threat-subscription-service'
import { authenticateUser } from '@/lib/middleware/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await authenticateUser(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const subscriptions = await ThreatSubscriptionService.getUserSubscriptions(authResult.user._id!.toString())

    return NextResponse.json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length
      }
    })

  } catch (error) {
    logger.error('[API] Failed to get threat subscriptions:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get threat subscriptions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check authentication (optional for anonymous subscriptions)
    const authResult = await authenticateUser(request)
    const userId = authResult.success && authResult.user ? authResult.user._id : null
    const sessionId = body.sessionId || (authResult.success ? undefined : 'anonymous')

    // Validate required fields
    if (!body.filters || !body.delivery) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          required: ['filters', 'delivery']
        },
        { status: 400 }
      )
    }

    const subscription = await ThreatSubscriptionService.createSubscription({
      userId,
      sessionId,
      subscriberId: body.subscriberId,
      filters: body.filters,
      delivery: body.delivery,
      isActive: body.isActive !== false
    })

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        message: 'Subscription created successfully'
      }
    }, { status: 201 })

  } catch (error) {
    logger.error('[API] Failed to create threat subscription:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create threat subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}