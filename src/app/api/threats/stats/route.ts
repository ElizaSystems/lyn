import { NextRequest, NextResponse } from 'next/server'
import { ThreatFeedService } from '@/lib/services/threat-feed-service'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') as 'hourly' | 'daily' | 'weekly' | 'monthly' || 'daily'

    const stats = await ThreatFeedService.getThreatStats(period)

    if (!stats) {
      return NextResponse.json(
        { success: false, error: 'No statistics available for the specified period' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        period
      }
    })

  } catch (error) {
    logger.error('[API] Failed to get threat statistics:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get threat statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const period = body.period as 'hourly' | 'daily' | 'weekly' | 'monthly' || 'daily'

    // Generate statistics for the specified period
    await ThreatFeedService.generateStats(period)

    return NextResponse.json({
      success: true,
      data: {
        message: `Statistics generated for ${period} period`
      }
    })

  } catch (error) {
    logger.error('[API] Failed to generate threat statistics:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate threat statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}