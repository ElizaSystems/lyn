import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, checkIPRateLimit, createRateLimitHeaders } from '@/lib/auth'
import { db } from '@/lib/mongodb'

/**
 * GET /api/community/analytics
 * Get community feedback analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('wallet')
    const period = searchParams.get('period') || 'weekly' // daily, weekly, monthly
    const limit = parseInt(searchParams.get('limit') || '30')

    // Rate limiting for analytics
    const ipRateLimit = await checkIPRateLimit(request, 'get_analytics', 60 * 1000, 50) // 50 per minute per IP
    
    if (!ipRateLimit.allowed) {
      const headers = createRateLimitHeaders(ipRateLimit, 50)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    if (walletAddress) {
      // Validate wallet address
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
        return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
      }

      // Get analytics for specific wallet
      const analytics = await db.feedbackAnalytics.findByWallet(
        walletAddress, 
        period as any, 
        limit
      )

      // Calculate trends
      const trends = calculateTrends(analytics)

      return NextResponse.json({
        walletAddress,
        period,
        analytics: analytics.map(a => ({
          date: a.periodDate,
          metrics: a.metrics,
          trend: a.trendData
        })),
        trends,
        summary: {
          totalPeriods: analytics.length,
          averageTrustScore: analytics.length > 0 
            ? Math.round(analytics.reduce((sum, a) => sum + a.metrics.trustScore, 0) / analytics.length)
            : 0,
          totalFeedback: analytics.reduce((sum, a) => sum + a.metrics.totalFeedback, 0),
          riskLevelDistribution: analytics.reduce((acc, a) => {
            acc[a.metrics.riskLevel] = (acc[a.metrics.riskLevel] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      })

    } else {
      // Get platform-wide analytics
      const authResult = await requireAuth(request)
      
      // Check if user has access to platform analytics (admin or authenticated user)
      const hasAccess = authResult.user && (
        isAdmin(authResult.user.walletAddress) || 
        authResult.user.hasTokenAccess
      )

      if (!hasAccess) {
        return NextResponse.json({
          error: 'Access denied. Platform analytics require authentication or token access.'
        }, { status: 403 })
      }

      const platformAnalytics = await getPlatformAnalytics(period as any, limit)
      
      return NextResponse.json({
        period,
        platform: platformAnalytics,
        generatedAt: new Date()
      })
    }

  } catch (error) {
    console.error('[Community Analytics API] Get error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/community/analytics/generate
 * Generate analytics for a specific period (admin only)
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
    const { period, startDate, endDate } = body

    if (!period || !startDate) {
      return NextResponse.json({
        error: 'Missing required fields: period, startDate'
      }, { status: 400 })
    }

    const validPeriods = ['daily', 'weekly', 'monthly']
    if (!validPeriods.includes(period)) {
      return NextResponse.json({
        error: 'Invalid period. Must be one of: ' + validPeriods.join(', ')
      }, { status: 400 })
    }

    console.log(`[Analytics Generation] Generating ${period} analytics from ${startDate}`)

    // Generate analytics for all wallets with feedback
    const database = await db.getDatabase()
    const feedbackCollection = database.collection('community_feedback')
    
    // Get all unique wallet addresses
    const uniqueWallets = await feedbackCollection.distinct('walletAddress')
    
    let generated = 0
    const errors: string[] = []

    for (const walletAddress of uniqueWallets) {
      try {
        const analytics = await generateWalletAnalytics(
          walletAddress, 
          period, 
          new Date(startDate),
          endDate ? new Date(endDate) : new Date()
        )
        
        if (analytics) {
          await db.feedbackAnalytics.upsertAnalytics(
            walletAddress,
            period as any,
            analytics.periodDate,
            analytics.metrics
          )
          generated++
        }
      } catch (error) {
        console.error(`Failed to generate analytics for ${walletAddress}:`, error)
        errors.push(`${walletAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated analytics for ${generated} wallets`,
      stats: {
        totalWallets: uniqueWallets.length,
        generated,
        errors: errors.length,
        errorDetails: errors.slice(0, 10) // Only show first 10 errors
      }
    })

  } catch (error) {
    console.error('[Analytics Generation API] Error:', error)
    return NextResponse.json({
      error: 'Failed to generate analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper functions

function isAdmin(walletAddress: string): boolean {
  const ADMIN_WALLETS = [
    process.env.ADMIN_WALLET_1,
    process.env.ADMIN_WALLET_2,
  ].filter(Boolean)
  
  return ADMIN_WALLETS.includes(walletAddress)
}

function calculateTrends(analytics: any[]): any {
  if (analytics.length < 2) {
    return { trend: 'stable', changePercentage: 0, dataPoints: analytics.length }
  }

  const latest = analytics[0]
  const previous = analytics[1]

  if (!latest.metrics || !previous.metrics) {
    return { trend: 'stable', changePercentage: 0, dataPoints: analytics.length }
  }

  const latestScore = latest.metrics.trustScore
  const previousScore = previous.metrics.trustScore

  const changePercentage = previousScore > 0 
    ? Math.round(((latestScore - previousScore) / previousScore) * 100)
    : 0

  let trend = 'stable'
  if (changePercentage > 5) trend = 'improving'
  else if (changePercentage < -5) trend = 'declining'

  return {
    trend,
    changePercentage,
    dataPoints: analytics.length,
    latestScore,
    previousScore,
    riskLevelChange: latest.metrics.riskLevel !== previous.metrics.riskLevel ? {
      from: previous.metrics.riskLevel,
      to: latest.metrics.riskLevel
    } : null
  }
}

async function getPlatformAnalytics(period: string, limit: number): Promise<any> {
  const database = await db.getDatabase()
  
  // Get overall feedback statistics
  const feedbackStats = await database.collection('community_feedback').aggregate([
    {
      $group: {
        _id: null,
        totalFeedback: { $sum: 1 },
        byType: { 
          $push: '$feedbackType' 
        },
        bySentiment: { 
          $push: '$sentiment' 
        },
        averageConfidence: { $avg: '$confidence' },
        totalWeight: { $sum: '$weight' }
      }
    }
  ]).toArray()

  // Get user statistics
  const userStats = await database.collection('user_reputation').aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        averageReputation: { $avg: '$reputationScore' },
        byTier: {
          $push: '$tier'
        }
      }
    }
  ]).toArray()

  // Get vote statistics
  const voteStats = await database.collection('community_votes').aggregate([
    {
      $group: {
        _id: null,
        totalVotes: { $sum: 1 },
        upvotes: {
          $sum: { $cond: [{ $eq: ['$voteType', 'upvote'] }, 1, 0] }
        },
        downvotes: {
          $sum: { $cond: [{ $eq: ['$voteType', 'downvote'] }, 1, 0] }
        },
        averageWeight: { $avg: '$weight' }
      }
    }
  ]).toArray()

  // Process type and sentiment distributions
  const feedbackData = feedbackStats[0] || {}
  const typeDistribution = (feedbackData.byType || []).reduce((acc: Record<string, number>, type: string) => {
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  const sentimentDistribution = (feedbackData.bySentiment || []).reduce((acc: Record<string, number>, sentiment: string) => {
    acc[sentiment] = (acc[sentiment] || 0) + 1
    return acc
  }, {})

  const userData = userStats[0] || {}
  const tierDistribution = (userData.byTier || []).reduce((acc: Record<string, number>, tier: string) => {
    acc[tier] = (acc[tier] || 0) + 1
    return acc
  }, {})

  const voteData = voteStats[0] || {}

  return {
    feedback: {
      total: feedbackData.totalFeedback || 0,
      averageConfidence: Math.round(feedbackData.averageConfidence || 0),
      typeDistribution,
      sentimentDistribution,
      totalWeight: feedbackData.totalWeight || 0
    },
    users: {
      total: userData.totalUsers || 0,
      averageReputation: Math.round(userData.averageReputation || 500),
      tierDistribution
    },
    votes: {
      total: voteData.totalVotes || 0,
      upvotes: voteData.upvotes || 0,
      downvotes: voteData.downvotes || 0,
      ratio: voteData.totalVotes > 0 ? Math.round((voteData.upvotes / voteData.totalVotes) * 100) : 50,
      averageWeight: Math.round((voteData.averageWeight || 1) * 100) / 100
    },
    engagement: {
      participationRate: userData.totalUsers > 0 
        ? Math.round((feedbackData.totalFeedback / userData.totalUsers) * 100) / 100
        : 0,
      voteToFeedbackRatio: feedbackData.totalFeedback > 0
        ? Math.round((voteData.totalVotes / feedbackData.totalFeedback) * 100) / 100
        : 0
    }
  }
}

async function generateWalletAnalytics(
  walletAddress: string, 
  period: string, 
  startDate: Date, 
  endDate: Date
): Promise<any> {
  const database = await db.getDatabase()
  const feedbackCollection = database.collection('community_feedback')

  // Get feedback for the period
  const feedback = await feedbackCollection.find({
    walletAddress,
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'active'
  }).toArray()

  if (feedback.length === 0) {
    return null
  }

  // Calculate metrics
  const totalFeedback = feedback.length
  const positiveCount = feedback.filter(f => f.sentiment === 'positive').length
  const negativeCount = feedback.filter(f => f.sentiment === 'negative').length
  const neutralCount = feedback.filter(f => f.sentiment === 'neutral').length

  const averageConfidence = Math.round(
    feedback.reduce((sum, f) => sum + f.confidence, 0) / totalFeedback
  )

  const consensusScore = Math.max(positiveCount, negativeCount, neutralCount) / totalFeedback * 100

  // Calculate trust score
  const weightedSentimentScore = feedback.reduce((sum, f) => {
    let sentimentValue = 50 // neutral
    if (f.sentiment === 'positive') sentimentValue = 80
    else if (f.sentiment === 'negative') sentimentValue = 20
    
    return sum + (sentimentValue * f.weight)
  }, 0)

  const totalWeight = feedback.reduce((sum, f) => sum + f.weight, 0)
  const trustScore = Math.round(weightedSentimentScore / totalWeight)

  // Determine risk level
  const negativeRatio = negativeCount / totalFeedback
  let riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical' = 'very-low'
  
  if (trustScore <= 20 || negativeRatio >= 0.8) riskLevel = 'critical'
  else if (trustScore <= 35 || negativeRatio >= 0.6) riskLevel = 'high'
  else if (trustScore <= 50 || negativeRatio >= 0.4) riskLevel = 'medium'
  else if (trustScore <= 70 || negativeRatio >= 0.2) riskLevel = 'low'

  // Get top tags
  const allTags = feedback.flatMap(f => f.tags || [])
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topTags = Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))

  // Get reporter reputation average
  const reporterUserIds = [...new Set(feedback.map(f => f.reporterUserId))]
  const reputations = await Promise.all(
    reporterUserIds.map(userId => db.userReputation.findByUserId(userId))
  )
  
  const validReputations = reputations.filter(r => r !== null)
  const reporterReputationAverage = validReputations.length > 0
    ? Math.round(validReputations.reduce((sum, r) => sum + r!.reputationScore, 0) / validReputations.length)
    : 500

  return {
    periodDate: startDate,
    metrics: {
      totalFeedback,
      positiveCount,
      negativeCount,
      neutralCount,
      averageConfidence,
      consensusScore: Math.round(consensusScore),
      riskLevel,
      trustScore,
      topTags,
      reporterReputationAverage
    }
  }
}