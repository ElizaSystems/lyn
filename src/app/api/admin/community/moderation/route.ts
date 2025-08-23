import { NextRequest, NextResponse } from 'next/server'
import { CommunityFeedbackService } from '@/lib/services/community-feedback'
import { requireAuth, checkUserRateLimit, createRateLimitHeaders } from '@/lib/auth'
import { getClientIP, getUserAgent } from '@/lib/auth'
import { db } from '@/lib/mongodb'

// Admin wallet addresses (you can move this to config)
const ADMIN_WALLETS = [
  // Add admin wallet addresses here
  process.env.ADMIN_WALLET_1,
  process.env.ADMIN_WALLET_2,
].filter(Boolean)

function isAdmin(walletAddress: string): boolean {
  return ADMIN_WALLETS.includes(walletAddress)
}

/**
 * GET /api/admin/community/moderation
 * Get moderation queue
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error || !authResult.user?.walletAddress) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin permissions
    if (!isAdmin(authResult.user.walletAddress)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Rate limiting for admin
    const userRateLimit = await checkUserRateLimit(authResult.user.id, 'admin_moderation', 60 * 1000, 200)
    if (!userRateLimit.allowed) {
      const headers = createRateLimitHeaders(userRateLimit, 200)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers }
      )
    }

    // Get moderation queue
    const queue = await CommunityFeedbackService.getModerationQueue(status as any)
    
    // Enhance with additional metadata
    const enhancedQueue = await Promise.all(
      queue.slice(0, limit).map(async (feedback) => {
        // Get reporter reputation
        const reputation = await db.userReputation.findByUserId(feedback.reporterUserId)
        
        // Get vote statistics
        const voteStats = await db.communityVotes.getVoteStats(feedback._id!)
        
        // Get moderation history
        const moderationHistory = await db.feedbackModeration.findByFeedbackId(feedback._id!)
        
        return {
          id: feedback._id?.toString(),
          walletAddress: feedback.walletAddress,
          feedbackType: feedback.feedbackType,
          sentiment: feedback.sentiment,
          description: feedback.description,
          confidence: feedback.confidence,
          evidence: feedback.evidence,
          tags: feedback.tags,
          status: feedback.status,
          weight: feedback.weight,
          votes: feedback.votes,
          createdAt: feedback.createdAt,
          reporter: {
            userId: feedback.reporterUserId,
            walletAddress: feedback.reporterWalletAddress,
            reputation: reputation ? {
              score: reputation.reputationScore,
              tier: reputation.tier,
              accuracyScore: reputation.accuracyScore,
              totalFeedback: reputation.feedbackCount
            } : null
          },
          voteStats,
          moderationHistory: moderationHistory.map(h => ({
            action: h.action,
            reason: h.reason,
            notes: h.notes,
            moderator: h.moderatorWalletAddress,
            createdAt: h.createdAt
          })),
          riskIndicators: {
            isNewUser: reputation ? reputation.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : true,
            lowReputation: reputation ? reputation.reputationScore < 300 : true,
            hasNegativeVotes: voteStats.downvotes > voteStats.upvotes,
            suspiciousPattern: false // You can implement pattern detection
          }
        }
      })
    )

    return NextResponse.json({
      queue: enhancedQueue,
      pagination: {
        total: queue.length,
        showing: enhancedQueue.length,
        status,
        limit
      },
      stats: {
        totalPending: queue.filter(f => f.status === 'active').length,
        totalDisputed: queue.filter(f => f.status === 'disputed').length,
        totalVerified: queue.filter(f => f.status === 'verified').length,
        totalRejected: queue.filter(f => f.status === 'rejected').length
      }
    })

  } catch (error) {
    console.error('[Admin Moderation API] Get queue error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve moderation queue',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/community/moderation
 * Moderate feedback
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error || !authResult.user?.walletAddress) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin permissions
    if (!isAdmin(authResult.user.walletAddress)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { feedbackId, action, reason, notes } = body

    // Validation
    if (!feedbackId || !action || !reason) {
      return NextResponse.json({
        error: 'Missing required fields: feedbackId, action, reason'
      }, { status: 400 })
    }

    // Validate action
    const validActions = ['approve', 'reject', 'flag', 'verify', 'dispute', 'archive']
    if (!validActions.includes(action)) {
      return NextResponse.json({
        error: 'Invalid action. Must be one of: ' + validActions.join(', ')
      }, { status: 400 })
    }

    // Validate feedback ID
    if (!/^[0-9a-fA-F]{24}$/.test(feedbackId)) {
      return NextResponse.json({
        error: 'Invalid feedback ID format'
      }, { status: 400 })
    }

    // Validate reason length
    if (reason.length < 10 || reason.length > 500) {
      return NextResponse.json({
        error: 'Reason must be between 10 and 500 characters'
      }, { status: 400 })
    }

    // Rate limiting for admin actions
    const userRateLimit = await checkUserRateLimit(authResult.user.id, 'admin_moderate', 60 * 60 * 1000, 100)
    if (!userRateLimit.allowed) {
      const headers = createRateLimitHeaders(userRateLimit, 100)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers }
      )
    }

    console.log(`[Admin Moderation API] ${authResult.user.walletAddress} moderating feedback ${feedbackId}: ${action}`)

    // Perform moderation
    await CommunityFeedbackService.moderateFeedback(
      feedbackId,
      authResult.user.id,
      authResult.user.walletAddress,
      action as any,
      reason,
      notes
    )

    // Log analytics event
    await db.analytics.trackEvent({
      userId: authResult.user.id,
      eventType: 'admin_moderation_action',
      eventData: {
        feedbackId,
        action,
        hasNotes: !!notes
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    })

    // Log audit event
    await db.audit.log({
      userId: authResult.user.id,
      action: `moderate_feedback_${action}`,
      resource: 'community_feedback',
      details: {
        feedbackId,
        action,
        reason,
        hasNotes: !!notes
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    })

    return NextResponse.json({
      success: true,
      message: `Feedback ${action}ed successfully`,
      moderation: {
        feedbackId,
        action,
        reason,
        moderator: authResult.user.walletAddress,
        timestamp: new Date()
      }
    })

  } catch (error) {
    console.error('[Admin Moderation API] Moderate error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('not found') ? 404 : 500

    return NextResponse.json({
      error: 'Failed to moderate feedback',
      message: errorMessage
    }, { status })
  }
}