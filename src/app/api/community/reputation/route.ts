import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, checkIPRateLimit, createRateLimitHeaders } from '@/lib/auth'
import { db } from '@/lib/mongodb'

/**
 * GET /api/community/reputation
 * Get user reputation information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const walletAddress = searchParams.get('wallet')

    // Rate limiting for reads
    const ipRateLimit = await checkIPRateLimit(request, 'get_reputation', 60 * 1000, 100) // 100 per minute per IP
    
    if (!ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(ipRateLimit, 100)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    let reputation
    if (userId) {
      reputation = await db.userReputation.findByUserId(userId)
    } else if (walletAddress) {
      // Validate wallet address format
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
        return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
      }
      reputation = await db.userReputation.findByWalletAddress(walletAddress)
    } else {
      return NextResponse.json({
        error: 'Missing required parameter: userId or wallet'
      }, { status: 400 })
    }

    if (!reputation) {
      return NextResponse.json({
        error: 'User reputation not found'
      }, { status: 404 })
    }

    // Public reputation information (hide sensitive data)
    const publicReputation = {
      reputationScore: reputation.reputationScore,
      tier: reputation.tier,
      badges: reputation.badges,
      statistics: {
        totalFeedbackSubmitted: reputation.statistics.totalFeedbackSubmitted,
        totalVotesCast: reputation.statistics.totalVotesCast,
        accuracyRate: reputation.statistics.totalFeedbackSubmitted > 0 
          ? Math.round((reputation.statistics.accurateReports / reputation.statistics.totalFeedbackSubmitted) * 100) 
          : 0,
        lastActivityAt: reputation.statistics.lastActivityAt
      },
      feedbackCount: reputation.feedbackCount,
      votesReceived: reputation.votesReceived,
      accuracyScore: reputation.accuracyScore,
      consistencyScore: reputation.consistencyScore,
      participationScore: reputation.participationScore,
      createdAt: reputation.createdAt
    }

    return NextResponse.json({
      reputation: publicReputation,
      walletAddress: reputation.walletAddress.slice(0, 8) + '...' + reputation.walletAddress.slice(-4) // Anonymized
    })

  } catch (error) {
    console.error('[Community Reputation API] Get error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve reputation information',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/community/reputation
 * Initialize reputation for authenticated user (auto-called on first feedback/vote)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error || !authResult.user?.walletAddress) {
      return NextResponse.json(
        { error: 'Authentication required to initialize reputation' },
        { status: 401 }
      )
    }

    const user = authResult.user
    
    // Check if reputation already exists
    const existingReputation = await db.userReputation.findByUserId(user.id)
    if (existingReputation) {
      return NextResponse.json({
        message: 'Reputation already initialized',
        reputation: {
          reputationScore: existingReputation.reputationScore,
          tier: existingReputation.tier,
          feedbackCount: existingReputation.feedbackCount
        }
      })
    }

    // Initialize reputation
    const reputation = await db.userReputation.initializeReputation(user.id, user.walletAddress)

    console.log(`[Community Reputation API] Initialized reputation for ${user.walletAddress}`)

    return NextResponse.json({
      success: true,
      message: 'Reputation initialized successfully',
      reputation: {
        reputationScore: reputation.reputationScore,
        tier: reputation.tier,
        feedbackCount: reputation.feedbackCount,
        badges: reputation.badges
      }
    }, { status: 201 })

  } catch (error) {
    console.error('[Community Reputation API] Initialize error:', error)
    return NextResponse.json({
      error: 'Failed to initialize reputation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}