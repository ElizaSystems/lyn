import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ThreatData } from '@/lib/models/threat-feed'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!query || query.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const collection = db.collection<ThreatData>('threat_feed')

    // Create search index if it doesn't exist
    try {
      await collection.createIndex({
        'context.title': 'text',
        'context.description': 'text',
        'target.value': 'text',
        'context.tags': 'text'
      }, { name: 'threat_search_index' })
    } catch (error) {
      // Index might already exist, that's fine
    }

    // Perform text search
    const searchResults = await collection.find(
      {
        $and: [
          {
            $text: {
              $search: query,
              $caseSensitive: false,
              $diacriticSensitive: false
            }
          },
          {
            status: { $in: ['active', 'under_review'] }
          }
        ]
      },
      {
        score: { $meta: 'textScore' }
      }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .toArray()

    // Also search by exact target value match
    const targetResults = await collection.find({
      'target.value': { $regex: query, $options: 'i' },
      status: { $in: ['active', 'under_review'] }
    })
    .limit(5)
    .toArray()

    // Combine and deduplicate results
    const combinedResults = [...searchResults]
    for (const targetResult of targetResults) {
      if (!combinedResults.find(r => r._id!.toString() === targetResult._id!.toString())) {
        combinedResults.push(targetResult)
      }
    }

    // Limit final results
    const finalResults = combinedResults.slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        threats: finalResults,
        total: finalResults.length,
        query,
        searchMethods: {
          textSearch: searchResults.length,
          targetMatch: targetResults.length
        }
      }
    })

  } catch (error) {
    logger.error('[API] Failed to search threats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to search threats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.query) {
      return NextResponse.json(
        { success: false, error: 'Missing query parameter' },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const collection = db.collection<ThreatData>('threat_feed')

    // Advanced search with filters
    const searchQuery: any = {}
    
    // Text search
    if (body.query) {
      searchQuery.$text = {
        $search: body.query,
        $caseSensitive: false
      }
    }

    // Additional filters
    const filters: any = { status: { $in: ['active', 'under_review'] } }
    
    if (body.filters) {
      if (body.filters.types) {
        filters.type = { $in: body.filters.types }
      }
      if (body.filters.severities) {
        filters.severity = { $in: body.filters.severities }
      }
      if (body.filters.sources) {
        filters['source.id'] = { $in: body.filters.sources }
      }
      if (body.filters.dateRange) {
        filters.createdAt = {
          $gte: new Date(body.filters.dateRange.start),
          $lte: new Date(body.filters.dateRange.end)
        }
      }
      if (body.filters.minimumConfidence) {
        filters.confidence = { $gte: body.filters.minimumConfidence }
      }
    }

    const finalQuery = { $and: [searchQuery, filters] }
    
    const results = await collection.find(
      finalQuery,
      {
        score: body.query ? { $meta: 'textScore' } : undefined
      }
    )
    .sort(body.query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
    .limit(body.limit || 50)
    .toArray()

    return NextResponse.json({
      success: true,
      data: {
        threats: results,
        total: results.length,
        query: body.query,
        filters: body.filters
      }
    })

  } catch (error) {
    logger.error('[API] Failed to perform advanced search:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform advanced search',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}