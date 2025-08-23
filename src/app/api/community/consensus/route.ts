import { NextRequest, NextResponse } from 'next/server'
import { CommunityFeedbackService } from '@/lib/services/community-feedback'
import { checkIPRateLimit, createRateLimitHeaders } from '@/lib/auth'

/**
 * GET /api/community/consensus
 * Get community consensus for a wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('wallet')
    const detailed = searchParams.get('detailed') === 'true'

    if (!walletAddress) {
      return NextResponse.json({
        error: 'Missing required parameter: wallet'
      }, { status: 400 })
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return NextResponse.json({ 
        error: 'Invalid wallet address format' 
      }, { status: 400 })
    }

    // Rate limiting for reads (more permissive for public API)
    const ipRateLimit = await checkIPRateLimit(request, 'get_consensus', 60 * 1000, 150) // 150 per minute per IP
    
    if (!ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(ipRateLimit, 150)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    console.log(`[Community Consensus API] Getting consensus for ${walletAddress}`)

    // Get comprehensive community consensus
    const consensus = await CommunityFeedbackService.getCommunityConsensus(walletAddress)

    // Basic response format
    const response: any = {
      walletAddress,
      trustScore: consensus.trustScore,
      riskLevel: consensus.riskLevel,
      consensusScore: consensus.consensusScore,
      totalFeedback: consensus.totalFeedback,
      majorityFeedbackType: consensus.majorityFeedbackType,
      summary: {
        isLegitimate: consensus.trustScore >= 70 && consensus.riskLevel === 'very-low',
        isSuspicious: consensus.trustScore < 50 || ['high', 'critical'].includes(consensus.riskLevel),
        hasEnoughData: consensus.totalFeedback >= 3,
        confidenceLevel: consensus.totalFeedback >= 10 ? 'high' : 
                        consensus.totalFeedback >= 5 ? 'medium' : 
                        consensus.totalFeedback >= 1 ? 'low' : 'none'
      },
      lastUpdated: new Date()
    }

    // Include detailed information if requested
    if (detailed) {
      response.detailed = {
        recentFeedback: consensus.recentFeedback.slice(0, 10), // Last 10 feedback entries
        topContributors: consensus.topContributors,
        breakdownByType: {
          scam: consensus.recentFeedback.filter(f => f.type === 'scam').length,
          legitimate: consensus.recentFeedback.filter(f => f.type === 'legitimate').length,
          suspicious: consensus.recentFeedback.filter(f => f.type === 'suspicious').length,
          phishing: consensus.recentFeedback.filter(f => f.type === 'phishing').length,
          other: consensus.recentFeedback.filter(f => !['scam', 'legitimate', 'suspicious', 'phishing'].includes(f.type)).length
        },
        sentimentBreakdown: {
          positive: consensus.recentFeedback.filter(f => f.sentiment === 'positive').length,
          negative: consensus.recentFeedback.filter(f => f.sentiment === 'negative').length,
          neutral: consensus.recentFeedback.filter(f => f.sentiment === 'neutral').length
        },
        averageConfidence: consensus.recentFeedback.length > 0 
          ? Math.round(consensus.recentFeedback.reduce((sum, f) => sum + f.confidence, 0) / consensus.recentFeedback.length)
          : 0,
        weightedScore: consensus.recentFeedback.length > 0
          ? Math.round(consensus.recentFeedback.reduce((sum, f) => sum + (f.confidence * f.weight), 0) / consensus.recentFeedback.length)
          : 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Community Consensus API] Get error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve community consensus',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/community/consensus/batch
 * Get community consensus for multiple wallet addresses
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddresses } = body

    if (!walletAddresses || !Array.isArray(walletAddresses)) {
      return NextResponse.json({
        error: 'Invalid request body. Expected array of wallet addresses.'
      }, { status: 400 })
    }

    if (walletAddresses.length > 50) {
      return NextResponse.json({
        error: 'Too many wallet addresses. Maximum 50 addresses per request.'
      }, { status: 400 })
    }

    // Validate all wallet addresses
    for (const address of walletAddresses) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return NextResponse.json({
          error: `Invalid wallet address format: ${address}`
        }, { status: 400 })
      }
    }

    // Rate limiting for batch requests (more restrictive)
    const ipRateLimit = await checkIPRateLimit(request, 'get_batch_consensus', 60 * 1000, 10) // 10 batch requests per minute per IP
    
    if (!ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(ipRateLimit, 10)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    console.log(`[Community Consensus API] Getting batch consensus for ${walletAddresses.length} addresses`)

    // Process addresses in parallel (with some concurrency limit)
    const BATCH_SIZE = 10
    const results: any[] = []

    for (let i = 0; i < walletAddresses.length; i += BATCH_SIZE) {
      const batch = walletAddresses.slice(i, i + BATCH_SIZE)
      
      const batchPromises = batch.map(async (address: string) => {
        try {
          const consensus = await CommunityFeedbackService.getCommunityConsensus(address)
          return {
            walletAddress: address,
            trustScore: consensus.trustScore,
            riskLevel: consensus.riskLevel,
            consensusScore: consensus.consensusScore,
            totalFeedback: consensus.totalFeedback,
            majorityFeedbackType: consensus.majorityFeedbackType,
            summary: {
              isLegitimate: consensus.trustScore >= 70 && consensus.riskLevel === 'very-low',
              isSuspicious: consensus.trustScore < 50 || ['high', 'critical'].includes(consensus.riskLevel),
              hasEnoughData: consensus.totalFeedback >= 3,
              confidenceLevel: consensus.totalFeedback >= 10 ? 'high' : 
                              consensus.totalFeedback >= 5 ? 'medium' : 
                              consensus.totalFeedback >= 1 ? 'low' : 'none'
            }
          }
        } catch (error) {
          console.error(`Error processing ${address}:`, error)
          return {
            walletAddress: address,
            error: 'Failed to process address',
            trustScore: 50, // Neutral default
            riskLevel: 'medium',
            consensusScore: 0,
            totalFeedback: 0,
            majorityFeedbackType: null
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return NextResponse.json({
      results,
      processedCount: results.length,
      requestedCount: walletAddresses.length,
      timestamp: new Date()
    })

  } catch (error) {
    console.error('[Community Consensus API] Batch error:', error)
    return NextResponse.json({
      error: 'Failed to process batch consensus request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}