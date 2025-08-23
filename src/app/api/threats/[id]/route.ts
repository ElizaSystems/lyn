import { NextRequest, NextResponse } from 'next/server'
import { ThreatFeedService } from '@/lib/services/threat-feed-service'
import { getDatabase } from '@/lib/mongodb'
import { ThreatData } from '@/lib/models/threat-feed'
import { ObjectId } from 'mongodb'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const threatId = params.id

    if (!ObjectId.isValid(threatId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid threat ID' },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const collection = db.collection<ThreatData>('threat_feed')
    
    const threat = await collection.findOne({ _id: new ObjectId(threatId) })

    if (!threat) {
      return NextResponse.json(
        { success: false, error: 'Threat not found' },
        { status: 404 }
      )
    }

    // Get correlations
    const correlationsCollection = db.collection('threat_correlations')
    const correlations = await correlationsCollection.find({
      $or: [
        { parentThreatId: threat._id },
        { childThreatId: threat._id }
      ]
    }).toArray()

    return NextResponse.json({
      success: true,
      data: {
        threat,
        correlations: correlations.length,
        relatedThreats: threat.correlatedThreats
      }
    })

  } catch (error) {
    logger.error(`[API] Failed to get threat ${params.id}:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get threat',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const threatId = params.id
    const body = await request.json()

    if (!ObjectId.isValid(threatId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid threat ID' },
        { status: 400 }
      )
    }

    // Update threat
    const updatedThreat = await ThreatFeedService.updateThreat(threatId, body)

    if (!updatedThreat) {
      return NextResponse.json(
        { success: false, error: 'Threat not found or update failed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        threat: updatedThreat,
        message: 'Threat updated successfully'
      }
    })

  } catch (error) {
    logger.error(`[API] Failed to update threat ${params.id}:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update threat',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const threatId = params.id

    if (!ObjectId.isValid(threatId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid threat ID' },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const collection = db.collection<ThreatData>('threat_feed')
    
    // Instead of deleting, mark as resolved
    const result = await collection.updateOne(
      { _id: new ObjectId(threatId) },
      { 
        $set: { 
          status: 'resolved',
          updatedAt: new Date(),
          timeline: {
            resolvedAt: new Date()
          }
        } 
      }
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Threat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Threat resolved successfully'
      }
    })

  } catch (error) {
    logger.error(`[API] Failed to delete threat ${params.id}:`, error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resolve threat',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}