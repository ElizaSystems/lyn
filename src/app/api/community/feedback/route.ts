import { NextRequest, NextResponse } from 'next/server'
import { CommunityFeedbackService } from '@/lib/services/community-feedback'
import { requireAuth, checkUserRateLimit, checkIPRateLimit, createRateLimitHeaders } from '@/lib/auth'
import { getClientIP, getUserAgent } from '@/lib/auth'
import { db } from '@/lib/mongodb'

/**
 * POST /api/community/feedback
 * Submit new community feedback for a wallet
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error && !authResult.user?.walletAddress) {
      return NextResponse.json(
        { error: 'Authentication required to submit feedback' },
        { status: 401 }
      )
    }

    const user = authResult.user!
    
    // Rate limiting
    const userRateLimit = await checkUserRateLimit(user.id, 'submit_feedback', 60 * 60 * 1000, 10) // 10 per hour
    const ipRateLimit = await checkIPRateLimit(request, 'submit_feedback', 60 * 60 * 1000, 20) // 20 per hour per IP
    
    if (!userRateLimit.allowed || !ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(userRateLimit.allowed ? ipRateLimit : userRateLimit, userRateLimit.allowed ? 20 : 10)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    const body = await request.json()
    const {
      walletAddress,
      feedbackType,
      sentiment,
      description,
      confidence,
      evidence,
      tags
    } = body

    // Validation
    if (!walletAddress || !feedbackType || !sentiment || !description) {
      return NextResponse.json({
        error: 'Missing required fields: walletAddress, feedbackType, sentiment, description'
      }, { status: 400 })
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
    }

    // Validate feedback type
    const validFeedbackTypes = [
      'scam', 'legitimate', 'suspicious', 'phishing', 'rugpull', 
      'impersonation', 'bot', 'mixer', 'verified', 'other'
    ]
    if (!validFeedbackTypes.includes(feedbackType)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    // Validate sentiment
    const validSentiments = ['positive', 'negative', 'neutral']
    if (!validSentiments.includes(sentiment)) {
      return NextResponse.json({ error: 'Invalid sentiment' }, { status: 400 })
    }

    // Validate confidence
    const confidenceNum = Number(confidence)
    if (isNaN(confidenceNum) || confidenceNum < 0 || confidenceNum > 100) {
      return NextResponse.json({ 
        error: 'Confidence must be a number between 0 and 100' 
      }, { status: 400 })
    }

    // Validate description length
    if (description.length < 10 || description.length > 1000) {
      return NextResponse.json({ 
        error: 'Description must be between 10 and 1000 characters' 
      }, { status: 400 })
    }

    console.log(`[Community Feedback API] ${user.walletAddress} submitting ${feedbackType} feedback for ${walletAddress}`)

    // Submit feedback
    const feedback = await CommunityFeedbackService.submitFeedback(
      user.id,
      user.walletAddress,
      {
        walletAddress,
        feedbackType,
        sentiment,
        description,
        confidence: confidenceNum,
        evidence,
        tags
      }
    )

    // Log analytics event
    await db.analytics.trackEvent({
      userId: user.id,
      eventType: 'community_feedback_submitted',
      eventData: {
        targetWallet: walletAddress,
        feedbackType,
        sentiment,
        confidence: confidenceNum
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    })

    return NextResponse.json({
      success: true,
      feedbackId: feedback._id?.toString(),
      message: 'Community feedback submitted successfully',
      feedback: {
        id: feedback._id?.toString(),
        type: feedback.feedbackType,
        sentiment: feedback.sentiment,
        confidence: feedback.confidence,
        weight: feedback.weight,
        createdAt: feedback.createdAt
      }
    }, { status: 201 })

  } catch (error) {
    console.error('[Community Feedback API] Submission error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('Rate limit') || errorMessage.includes('spam') ? 429 : 500

    return NextResponse.json({
      error: 'Failed to submit community feedback',
      message: errorMessage
    }, { status })
  }
}

/**
 * GET /api/community/feedback
 * Get community feedback for a wallet or user's feedback history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('wallet')
    const userId = searchParams.get('user')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Rate limiting for reads (more permissive)
    const ipRateLimit = await checkIPRateLimit(request, 'get_feedback', 60 * 1000, 100) // 100 per minute per IP
    
    if (!ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(ipRateLimit, 100)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    if (walletAddress) {
      // Get community feedback for a specific wallet
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
        return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
      }

      const feedback = await db.communityFeedback.findByWallet(walletAddress, limit, offset)
      const consensus = await CommunityFeedbackService.getCommunityConsensus(walletAddress)

      return NextResponse.json({
        walletAddress,
        consensus,
        feedback: feedback.map(f => ({
          id: f._id?.toString(),
          type: f.feedbackType,
          sentiment: f.sentiment,
          description: f.description,
          confidence: f.confidence,
          weight: f.weight,
          votes: f.votes,
          tags: f.tags,
          reporterWallet: f.reporterWalletAddress.slice(0, 8) + '...' + f.reporterWalletAddress.slice(-4), // Anonymized
          createdAt: f.createdAt,
          status: f.status
        })),
        pagination: {
          limit,
          offset,
          hasMore: feedback.length === limit
        }
      })

    } else if (userId) {
      // Get user's feedback history (requires authentication)
      const authResult = await requireAuth(request)
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Authentication required to view user feedback history' },
          { status: 401 }
        )
      }

      // Users can only view their own history unless they're admin
      if (authResult.user.id !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized to view other user\'s feedback history' },
          { status: 403 }
        )
      }

      const history = await CommunityFeedbackService.getUserFeedbackHistory(userId, limit)

      return NextResponse.json({
        userId,
        ...history,
        submitted: history.submitted.map(f => ({
          id: f._id?.toString(),
          walletAddress: f.walletAddress,
          type: f.feedbackType,
          sentiment: f.sentiment,
          description: f.description,
          confidence: f.confidence,
          weight: f.weight,
          votes: f.votes,
          tags: f.tags,
          status: f.status,
          createdAt: f.createdAt
        }))
      })

    } else {
      return NextResponse.json({
        error: 'Missing required parameter: wallet or user'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('[Community Feedback API] Get error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve community feedback',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}