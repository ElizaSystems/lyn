import { NextRequest, NextResponse } from 'next/server'
import { ThreatAgingService } from '@/lib/services/threat-aging-service'
import { ExternalThreatSourceService } from '@/lib/services/external-threat-sources'
import { ThreatPatternService } from '@/lib/services/threat-pattern-service'
import { ThreatWebSocketService } from '@/lib/services/threat-websocket-service'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            agingService: ThreatAgingService.getStatus(),
            externalSources: ExternalThreatSourceService.getSourceStats(),
            websocketStats: ThreatWebSocketService.getInstance().getStats(),
            timestamp: new Date().toISOString()
          }
        })

      case 'sources':
        return NextResponse.json({
          success: true,
          data: {
            sources: ExternalThreatSourceService.getActiveSources(),
            stats: ExternalThreatSourceService.getSourceStats()
          }
        })

      case 'patterns':
        const patterns = await ThreatPatternService.getAllPatterns()
        return NextResponse.json({
          success: true,
          data: { patterns }
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available actions: status, sources, patterns'
        }, { status: 400 })
    }

  } catch (error) {
    logger.error('[API] Failed to get admin info:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get admin information',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'initialize':
        // Initialize all services
        await ThreatPatternService.initializeDefaultPatterns()
        ExternalThreatSourceService.initialize()
        ThreatAgingService.start()
        
        return NextResponse.json({
          success: true,
          data: { message: 'Threat feed system initialized' }
        })

      case 'run_aging':
        const agingResult = await ThreatAgingService.runAgingJob()
        return NextResponse.json({
          success: true,
          data: { 
            message: 'Aging job completed',
            result: agingResult
          }
        })

      case 'fetch_external':
        const sourceId = body.sourceId
        if (!sourceId) {
          return NextResponse.json({
            success: false,
            error: 'Source ID required'
          }, { status: 400 })
        }

        const fetchResult = await ExternalThreatSourceService.manualFetch(sourceId)
        return NextResponse.json({
          success: fetchResult.success,
          data: fetchResult
        })

      case 'generate_analytics':
        const days = body.days || 30
        const analytics = await ThreatPatternService.generateAnalytics(days)
        return NextResponse.json({
          success: true,
          data: { 
            analytics,
            period: `${days} days`
          }
        })

      case 'emergency_alert':
        const { title, message, severity, targetType, targetValue } = body
        if (!title || !message || !severity) {
          return NextResponse.json({
            success: false,
            error: 'Title, message, and severity are required'
          }, { status: 400 })
        }

        await ThreatWebSocketService.getInstance().broadcastEmergencyAlert({
          title,
          message,
          severity,
          targetType,
          targetValue
        })

        return NextResponse.json({
          success: true,
          data: { message: 'Emergency alert broadcasted' }
        })

      case 'update_source':
        const { sourceId: updateSourceId, updates } = body
        if (!updateSourceId || !updates) {
          return NextResponse.json({
            success: false,
            error: 'Source ID and updates are required'
          }, { status: 400 })
        }

        const updateSuccess = ExternalThreatSourceService.updateSource(updateSourceId, updates)
        return NextResponse.json({
          success: updateSuccess,
          data: { message: updateSuccess ? 'Source updated' : 'Source not found' }
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available actions: initialize, run_aging, fetch_external, generate_analytics, emergency_alert, update_source'
        }, { status: 400 })
    }

  } catch (error) {
    logger.error('[API] Failed to execute admin action:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to execute admin action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}