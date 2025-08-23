import { NextRequest, NextResponse } from 'next/server'
import { CommunityFeedbackService } from '@/lib/services/community-feedback'
import { requireAuth, checkUserRateLimit, checkIPRateLimit, createRateLimitHeaders } from '@/lib/auth'
import { getClientIP, getUserAgent } from '@/lib/auth'
import { db } from '@/lib/mongodb'

/**
 * POST /api/community/vote
 * Vote on community feedback
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error && !authResult.user?.walletAddress) {
      return NextResponse.json(
        { error: 'Authentication required to vote on feedback' },
        { status: 401 }
      )
    }

    const user = authResult.user!
    
    // Rate limiting for voting
    const userRateLimit = await checkUserRateLimit(user.id, 'vote_feedback', 60 * 60 * 1000, 50) // 50 votes per hour
    const ipRateLimit = await checkIPRateLimit(request, 'vote_feedback', 60 * 60 * 1000, 100) // 100 votes per hour per IP
    
    if (!userRateLimit.allowed || !ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(userRateLimit.allowed ? ipRateLimit : userRateLimit, userRateLimit.allowed ? 100 : 50)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    const body = await request.json()
    const { feedbackId, voteType, reason } = body

    // Validation
    if (!feedbackId || !voteType) {
      return NextResponse.json({
        error: 'Missing required fields: feedbackId, voteType'
      }, { status: 400 })
    }

    // Validate vote type
    if (!['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json({
        error: 'Invalid vote type. Must be "upvote" or "downvote"'
      }, { status: 400 })
    }

    // Validate feedback ID format (MongoDB ObjectId)
    if (!/^[0-9a-fA-F]{24}$/.test(feedbackId)) {
      return NextResponse.json({
        error: 'Invalid feedback ID format'
      }, { status: 400 })
    }

    // Validate reason length if provided
    if (reason && (reason.length > 200)) {
      return NextResponse.json({
        error: 'Reason must be 200 characters or less'
      }, { status: 400 })
    }

    console.log(`[Community Vote API] ${user.walletAddress} voting ${voteType} on feedback ${feedbackId}`)

    // Submit vote
    const result = await CommunityFeedbackService.voteFeedback(
      user.id,
      user.walletAddress,
      {
        feedbackId,
        voteType,
        reason
      }
    )

    if (!result.success) {
      return NextResponse.json({
        error: result.message
      }, { status: 400 })
    }

    // Log analytics event
    await db.analytics.trackEvent({
      userId: user.id,
      eventType: 'community_feedback_vote',
      eventData: {
        feedbackId,
        voteType,
        hasReason: !!reason
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    })

    return NextResponse.json({
      success: true,
      message: result.message,
      vote: {
        feedbackId,
        voteType,
        timestamp: new Date()
      }
    })

  } catch (error) {
    console.error('[Community Vote API] Vote error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let status = 500

    // Handle specific error types
    if (errorMessage.includes('not found')) status = 404
    else if (errorMessage.includes('Cannot vote on your own')) status = 403
    else if (errorMessage.includes('already cast')) status = 409

    return NextResponse.json({
      error: 'Failed to submit vote',
      message: errorMessage
    }, { status })
  }
}

/**
 * GET /api/community/vote
 * Get voting information for feedback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const feedbackId = searchParams.get('feedbackId')
    const userId = searchParams.get('userId')

    if (!feedbackId) {
      return NextResponse.json({
        error: 'Missing required parameter: feedbackId'
      }, { status: 400 })
    }

    // Validate feedback ID format
    if (!/^[0-9a-fA-F]{24}$/.test(feedbackId)) {
      return NextResponse.json({
        error: 'Invalid feedback ID format'
      }, { status: 400 })
    }

    // Rate limiting for reads
    const ipRateLimit = await checkIPRateLimit(request, 'get_vote_info', 60 * 1000, 200) // 200 per minute per IP
    
    if (!ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(ipRateLimit, 200)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    // Get feedback to ensure it exists
    const feedback = await db.communityFeedback.findById(feedbackId)
    if (!feedback) {
      return NextResponse.json({
        error: 'Feedback not found'
      }, { status: 404 })
    }

    // Get vote statistics
    const voteStats = await db.communityVotes.getVoteStats(feedback._id!)

    const response: any = {
      feedbackId,
      votes: {
        upvotes: voteStats.upvotes,
        downvotes: voteStats.downvotes,
        totalVotes: voteStats.totalVotes,
        score: voteStats.weightedScore,
        netVotes: voteStats.upvotes - voteStats.downvotes
      }
    }

    // If userId is provided, check if they have voted
    if (userId) {
      const existingVote = await db.communityVotes.findExistingVote(feedback._id!, userId)
      if (existingVote) {
        response.userVote = {
          voteType: existingVote.voteType,
          createdAt: existingVote.createdAt,
          weight: existingVote.weight
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Community Vote API] Get error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve vote information',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}