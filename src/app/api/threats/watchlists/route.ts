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

    const watchlists = await ThreatSubscriptionService.getUserWatchlists(authResult.user._id!.toString())

    return NextResponse.json({
      success: true,
      data: {
        watchlists,
        total: watchlists.length
      }
    })

  } catch (error) {
    logger.error('[API] Failed to get threat watchlists:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get threat watchlists',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check authentication
    const authResult = await authenticateUser(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Validate required fields
    if (!body.name || !body.targets || !Array.isArray(body.targets)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          required: ['name', 'targets (array)']
        },
        { status: 400 }
      )
    }

    const watchlist = await ThreatSubscriptionService.createWatchlist({
      userId: authResult.user._id!,
      name: body.name,
      description: body.description,
      targets: body.targets,
      alertSettings: body.alertSettings || {
        realTime: true,
        minimumSeverity: 'medium',
        notificationChannels: ['in_app']
      },
      isActive: body.isActive !== false
    })

    return NextResponse.json({
      success: true,
      data: {
        watchlist,
        message: 'Watchlist created successfully'
      }
    }, { status: 201 })

  } catch (error) {
    logger.error('[API] Failed to create threat watchlist:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create threat watchlist',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}