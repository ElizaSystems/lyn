import { NextRequest, NextResponse } from 'next/server'
import { ThreatFeedService } from '@/lib/services/threat-feed-service'
import { ThreatCorrelationService } from '@/lib/services/threat-correlation-service'
import { ThreatType, ThreatSeverity, ThreatData } from '@/lib/models/threat-feed'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const types = searchParams.get('types')?.split(',') as ThreatType[] || undefined
    const severities = searchParams.get('severities')?.split(',') as ThreatSeverity[] || undefined
    const sources = searchParams.get('sources')?.split(',') || undefined
    const targetType = searchParams.get('targetType') || undefined
    const targetValue = searchParams.get('targetValue') || undefined
    const status = searchParams.get('status')?.split(',') as ThreatData['status'][] || undefined
    const minimumConfidence = searchParams.get('minimumConfidence') ? 
      parseInt(searchParams.get('minimumConfidence')!) : undefined
    const tags = searchParams.get('tags')?.split(',') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sortBy') as 'createdAt' | 'severity' | 'confidence' | 'votes' || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc'

    // Date range filter
    let dateRange: { start: Date; end: Date } | undefined
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      }
    }

    // Query threats
    const result = await ThreatFeedService.queryThreats({
      types,
      severities,
      sources,
      targetType,
      targetValue,
      status,
      dateRange,
      minimumConfidence,
      tags,
      limit,
      offset,
      sortBy,
      sortOrder
    })

    return NextResponse.json({
      success: true,
      data: {
        threats: result.threats,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total
      }
    })

  } catch (error) {
    logger.error('[API] Failed to query threats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to query threats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.source || !body.type || !body.target || !body.context) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          required: ['source', 'type', 'target', 'context']
        },
        { status: 400 }
      )
    }

    // Check for duplicates first
    const duplicateCheck = await ThreatCorrelationService.checkForDuplicate(body)
    
    if (duplicateCheck.isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Duplicate threat detected',
          duplicate: {
            originalThreatId: duplicateCheck.originalThreatId,
            similarityScore: duplicateCheck.similarityScore,
            reason: duplicateCheck.reason
          }
        },
        { status: 409 }
      )
    }

    // Add threat to feed
    const threat = await ThreatFeedService.addThreat({
      threatId: body.threatId,
      source: body.source,
      type: body.type,
      category: body.category || 'financial',
      severity: body.severity || 'medium',
      confidence: Math.min(100, Math.max(0, body.confidence || 50)),
      target: body.target,
      indicators: body.indicators || [],
      context: body.context,
      attribution: body.attribution,
      impact: body.impact || {},
      timeline: {
        firstSeen: new Date(body.timeline?.firstSeen || Date.now()),
        lastSeen: new Date(body.timeline?.lastSeen || Date.now()),
        discoveredAt: new Date(body.timeline?.discoveredAt || Date.now()),
        reportedAt: body.timeline?.reportedAt ? new Date(body.timeline.reportedAt) : undefined,
        verifiedAt: body.timeline?.verifiedAt ? new Date(body.timeline.verifiedAt) : undefined
      },
      status: body.status || 'active',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
    })

    return NextResponse.json({
      success: true,
      data: {
        threat,
        message: 'Threat added successfully'
      }
    }, { status: 201 })

  } catch (error) {
    logger.error('[API] Failed to create threat:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create threat',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}