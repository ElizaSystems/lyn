import { NextRequest, NextResponse } from 'next/server'
import { BurnService } from '@/lib/services/burn-service'
import { ObjectId } from 'mongodb'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const walletAddress = searchParams.get('wallet')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const verified = searchParams.get('verified')
    const minAmount = searchParams.get('min_amount')
    const maxAmount = searchParams.get('max_amount')
    const fromDate = searchParams.get('from_date')
    const toDate = searchParams.get('to_date')
    const includeMetadata = searchParams.get('include_metadata') === 'true'
    
    console.log('[BurnVerified] Querying verified burns with filters:', {
      walletAddress,
      verified,
      limit,
      offset
    })
    
    const burns = await BurnService['getBurnsCollection']()
    
    // Build query
    const query: any = {}
    
    if (walletAddress) {
      query.walletAddress = walletAddress
    }
    
    if (verified === 'true') {
      query.verified = true
    } else if (verified === 'false') {
      query.verified = false
    }
    
    if (minAmount || maxAmount) {
      query.amount = {}
      if (minAmount) query.amount.$gte = parseFloat(minAmount)
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount)
    }
    
    if (fromDate || toDate) {
      query.timestamp = {}
      if (fromDate) query.timestamp.$gte = new Date(fromDate)
      if (toDate) query.timestamp.$lte = new Date(toDate)
    }
    
    // Execute query with aggregation for better performance
    const pipeline = [
      { $match: query },
      { $sort: { timestamp: -1 } },
      { $skip: offset },
      { $limit: limit }
    ]
    
    if (!includeMetadata) {
      pipeline.push({
        $project: {
          walletAddress: 1,
          username: 1,
          amount: 1,
          onChainAmount: 1,
          type: 1,
          transactionSignature: 1,
          description: 1,
          timestamp: 1,
          blockHeight: 1,
          verified: 1,
          verificationStatus: 1
        }
      } as any)
    }
    
    const results = await burns.aggregate(pipeline).toArray()
    
    // Get total count for pagination
    const totalCount = await burns.countDocuments(query)
    
    // Get summary statistics
    const summaryPipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalOnChainAmount: { $sum: { $ifNull: ['$onChainAmount', '$amount'] } },
          averageAmount: { $avg: '$amount' },
          count: { $sum: 1 },
          verifiedCount: {
            $sum: {
              $cond: [{ $eq: ['$verified', true] }, 1, 0]
            }
          }
        }
      }
    ]
    
    const summary = await burns.aggregate(summaryPipeline).toArray()
    const stats = summary[0] || {
      totalAmount: 0,
      totalOnChainAmount: 0,
      averageAmount: 0,
      count: 0,
      verifiedCount: 0
    }
    
    return NextResponse.json({
      success: true,
      burns: results,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      summary: {
        totalAmount: stats.totalAmount,
        totalOnChainAmount: stats.totalOnChainAmount,
        averageAmount: stats.averageAmount,
        count: stats.count,
        verifiedCount: stats.verifiedCount,
        verificationRate: stats.count > 0 ? (stats.verifiedCount / stats.count) * 100 : 0
      },
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('[BurnVerified] Query error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query burns'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { signatures } = await request.json()
    
    if (!Array.isArray(signatures) || signatures.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Array of transaction signatures is required'
      }, { status: 400 })
    }
    
    if (signatures.length > 50) {
      return NextResponse.json({
        success: false,
        error: 'Maximum 50 signatures allowed per request'
      }, { status: 400 })
    }
    
    console.log(`[BurnVerified] Bulk query for ${signatures.length} signatures`)
    
    const burns = await BurnService['getBurnsCollection']()
    
    const results = await burns.find({
      transactionSignature: { $in: signatures }
    }).toArray()
    
    // Create a map for quick lookup
    const burnMap = new Map(
      results.map(burn => [burn.transactionSignature, burn])
    )
    
    // Return results in the same order as requested
    const orderedResults = signatures.map(signature => ({
      signature,
      burn: burnMap.get(signature) || null,
      found: burnMap.has(signature)
    }))
    
    const foundCount = results.length
    const verifiedCount = results.filter(burn => burn.verified).length
    
    return NextResponse.json({
      success: true,
      results: orderedResults,
      summary: {
        requested: signatures.length,
        found: foundCount,
        verified: verifiedCount,
        notFound: signatures.length - foundCount
      },
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('[BurnVerified] Bulk query error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query burns'
    }, { status: 500 })
  }
}