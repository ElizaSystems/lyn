import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { CommunityVotingService } from '@/lib/services/community-voting-service'
import { authMiddleware } from '@/lib/middleware/auth'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const period = searchParams.get('period') || 'weekly'
    const userId = new ObjectId(authResult.user.userId)

    const db = await getDatabase()

    switch (type) {
      case 'overview': {
        // Get user's overall statistics
        const entriesCollection = db.collection('wallet_list_entries')
        const listsCollection = db.collection('wallet_lists')
        
        const [
          userEntries,
          userLists,
          userWhitelist,
          userBlacklist,
          publicContributions,
          votingProfile
        ] = await Promise.all([
          entriesCollection.countDocuments({ ownerId: userId }),
          listsCollection.countDocuments({ ownerId: userId }),
          entriesCollection.countDocuments({ ownerId: userId, listType: 'whitelist' }),
          entriesCollection.countDocuments({ ownerId: userId, listType: 'blacklist' }),
          entriesCollection.countDocuments({ 
            ownerId: userId, 
            visibility: 'public',
            'votes.upvotes': { $gt: 0 }
          }),
          CommunityVotingService.getUserVotingProfile(userId)
        ])

        return NextResponse.json({
          user: {
            totalEntries: userEntries,
            totalLists: userLists,
            whitelistEntries: userWhitelist,
            blacklistEntries: userBlacklist,
            publicContributions,
            communityReputation: votingProfile.reputation.reputationScore,
            trustLevel: votingProfile.reputation.trustLevel
          },
          voting: {
            totalVotes: votingProfile.statistics.totalVotes,
            accuracyRate: votingProfile.statistics.accuracyRate,
            proposalsSubmitted: votingProfile.statistics.proposalsSubmitted,
            proposalSuccessRate: votingProfile.statistics.proposalSuccessRate
          }
        })
      }

      case 'usage': {
        // Get usage analytics
        const days = parseInt(searchParams.get('days') || '30')
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const analyticsCollection = db.collection('list_analytics')
        const entriesCollection = db.collection('wallet_list_entries')

        // Get query statistics
        const queryStats = await analyticsCollection.aggregate([
          {
            $match: {
              date: { $gte: startDate },
              period: 'daily'
            }
          },
          {
            $group: {
              _id: null,
              totalQueries: { $sum: '$queriesCount' },
              uniqueUsers: { $sum: '$uniqueQueryUsers' },
              avgQueryTime: { $avg: '$averageQueryTime' }
            }
          }
        ]).toArray()

        // Get user's entry performance
        const entryPerformance = await entriesCollection.aggregate([
          {
            $match: {
              ownerId: userId,
              createdAt: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              avgConfidence: { $avg: '$confidence' },
              totalQueries: { $sum: '$timesQueried' },
              avgVotes: { $avg: { $add: ['$votes.upvotes', '$votes.downvotes'] } }
            }
          },
          { $sort: { count: -1 } }
        ]).toArray()

        // Get trend data
        const trendData = await entriesCollection.aggregate([
          {
            $match: {
              ownerId: userId,
              createdAt: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                listType: '$listType'
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1 } }
        ]).toArray()

        return NextResponse.json({
          period: `Last ${days} days`,
          queries: queryStats[0] || { totalQueries: 0, uniqueUsers: 0, avgQueryTime: 0 },
          entryPerformance,
          trends: trendData
        })
      }

      case 'effectiveness': {
        // Get effectiveness metrics for user's entries
        const entriesCollection = db.collection('wallet_list_entries')
        
        const effectiveness = await entriesCollection.aggregate([
          { $match: { ownerId: userId } },
          {
            $addFields: {
              effectivenessScore: {
                $multiply: [
                  { $divide: ['$confidence', 100] },
                  { $add: [1, { $divide: ['$timesQueried', 10] }] },
                  { $add: [1, { $divide: [{ $add: ['$votes.upvotes', '$votes.downvotes'] }, 5] }] }
                ]
              }
            }
          },
          {
            $group: {
              _id: '$category',
              avgEffectiveness: { $avg: '$effectivenessScore' },
              count: { $sum: 1 },
              totalQueries: { $sum: '$timesQueried' },
              avgConfidence: { $avg: '$confidence' },
              positiveVotes: { $sum: '$votes.upvotes' },
              negativeVotes: { $sum: '$votes.downvotes' }
            }
          },
          { $sort: { avgEffectiveness: -1 } }
        ]).toArray()

        // Get comparison with global averages
        const globalAverages = await entriesCollection.aggregate([
          { $match: { visibility: 'public' } },
          {
            $group: {
              _id: '$category',
              avgConfidence: { $avg: '$confidence' },
              avgQueries: { $avg: '$timesQueried' },
              avgVotes: { $avg: { $add: ['$votes.upvotes', '$votes.downvotes'] } }
            }
          }
        ]).toArray()

        return NextResponse.json({
          userEffectiveness: effectiveness,
          globalAverages,
          recommendations: this.generateEffectivenessRecommendations(effectiveness, globalAverages)
        })
      }

      case 'community': {
        // Get community engagement analytics
        const entriesCollection = db.collection('wallet_list_entries')
        const proposalsCollection = db.collection('vote_proposals')

        const [
          communityEngagement,
          votingActivity,
          topContributions
        ] = await Promise.all([
          entriesCollection.aggregate([
            {
              $match: {
                ownerId: userId,
                visibility: 'public'
              }
            },
            {
              $group: {
                _id: null,
                totalPublicEntries: { $sum: 1 },
                totalUpvotes: { $sum: '$votes.upvotes' },
                totalDownvotes: { $sum: '$votes.downvotes' },
                avgConfidence: { $avg: '$confidence' }
              }
            }
          ]).toArray(),

          proposalsCollection.aggregate([
            {
              $match: {
                'votes.voters.userId': userId
              }
            },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]).toArray(),

          entriesCollection.find(
            { 
              ownerId: userId,
              visibility: 'public',
              'votes.upvotes': { $gt: 0 }
            },
            { 
              sort: { 'votes.upvotes': -1 },
              limit: 10,
              projection: {
                walletAddress: 1,
                category: 1,
                reason: 1,
                'votes.upvotes': 1,
                'votes.downvotes': 1,
                timesQueried: 1
              }
            }
          ).toArray()
        ])

        return NextResponse.json({
          engagement: communityEngagement[0] || {
            totalPublicEntries: 0,
            totalUpvotes: 0,
            totalDownvotes: 0,
            avgConfidence: 0
          },
          votingActivity: votingActivity,
          topContributions: topContributions,
          reputationLevel: (await CommunityVotingService.getUserVotingProfile(userId)).reputation.trustLevel
        })
      }

      case 'comparison': {
        // Compare user's performance with platform averages
        const entriesCollection = db.collection('wallet_list_entries')

        const [userStats, platformStats] = await Promise.all([
          entriesCollection.aggregate([
            { $match: { ownerId: userId } },
            {
              $group: {
                _id: null,
                totalEntries: { $sum: 1 },
                avgConfidence: { $avg: '$confidence' },
                avgQueries: { $avg: '$timesQueried' },
                avgUpvotes: { $avg: '$votes.upvotes' },
                whitelistRatio: { 
                  $avg: { $cond: [{ $eq: ['$listType', 'whitelist'] }, 1, 0] }
                }
              }
            }
          ]).toArray(),

          entriesCollection.aggregate([
            { $match: { visibility: 'public' } },
            {
              $group: {
                _id: null,
                totalEntries: { $sum: 1 },
                avgConfidence: { $avg: '$confidence' },
                avgQueries: { $avg: '$timesQueried' },
                avgUpvotes: { $avg: '$votes.upvotes' },
                whitelistRatio: { 
                  $avg: { $cond: [{ $eq: ['$listType', 'whitelist'] }, 1, 0] }
                }
              }
            }
          ]).toArray()
        ])

        const userMetrics = userStats[0] || {}
        const platformMetrics = platformStats[0] || {}

        const comparison = {
          confidence: {
            user: userMetrics.avgConfidence || 0,
            platform: platformMetrics.avgConfidence || 0,
            percentile: this.calculatePercentile(userMetrics.avgConfidence || 0, platformMetrics.avgConfidence || 0)
          },
          engagement: {
            user: userMetrics.avgQueries || 0,
            platform: platformMetrics.avgQueries || 0,
            percentile: this.calculatePercentile(userMetrics.avgQueries || 0, platformMetrics.avgQueries || 0)
          },
          communityApproval: {
            user: userMetrics.avgUpvotes || 0,
            platform: platformMetrics.avgUpvotes || 0,
            percentile: this.calculatePercentile(userMetrics.avgUpvotes || 0, platformMetrics.avgUpvotes || 0)
          }
        }

        return NextResponse.json({
          comparison,
          totalEntries: {
            user: userMetrics.totalEntries || 0,
            platform: platformMetrics.totalEntries || 0
          },
          insights: this.generateComparisonInsights(comparison)
        })
      }

      default:
        return NextResponse.json({
          error: 'Invalid analytics type',
          validTypes: ['overview', 'usage', 'effectiveness', 'community', 'comparison']
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[Wallet Lists Analytics] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    )
  }

  // Helper methods
  function generateEffectivenessRecommendations(
    userMetrics: any[],
    globalMetrics: any[]
  ): string[] {
    const recommendations: string[] = []

    for (const userMetric of userMetrics) {
      const global = globalMetrics.find(g => g._id === userMetric._id)
      
      if (!global) continue

      if (userMetric.avgConfidence < global.avgConfidence - 10) {
        recommendations.push(`Increase confidence levels for ${userMetric._id} entries - currently ${Math.round(userMetric.avgConfidence)}% vs ${Math.round(global.avgConfidence)}% average`)
      }

      if (userMetric.totalQueries < global.avgQueries * 0.5) {
        recommendations.push(`Your ${userMetric._id} entries have low usage - consider improving visibility or relevance`)
      }

      if (userMetric.positiveVotes < userMetric.negativeVotes) {
        recommendations.push(`Your ${userMetric._id} entries are receiving more negative votes - review entry quality`)
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Your entries are performing well! Keep up the good work.')
    }

    return recommendations
  }

  function calculatePercentile(userValue: number, averageValue: number): number {
    if (averageValue === 0) return 50
    const ratio = userValue / averageValue
    
    // Simplified percentile calculation
    if (ratio >= 2.0) return 95
    if (ratio >= 1.5) return 85
    if (ratio >= 1.2) return 75
    if (ratio >= 1.0) return 60
    if (ratio >= 0.8) return 40
    if (ratio >= 0.5) return 25
    return 10
  }

  function generateComparisonInsights(comparison: any): string[] {
    const insights: string[] = []

    if (comparison.confidence.percentile > 75) {
      insights.push('You provide highly confident assessments compared to other users')
    } else if (comparison.confidence.percentile < 25) {
      insights.push('Consider increasing confidence levels in your assessments')
    }

    if (comparison.engagement.percentile > 75) {
      insights.push('Your entries are frequently referenced by the community')
    } else if (comparison.engagement.percentile < 25) {
      insights.push('Focus on creating more relevant and discoverable entries')
    }

    if (comparison.communityApproval.percentile > 75) {
      insights.push('Your entries receive strong community approval')
    } else if (comparison.communityApproval.percentile < 25) {
      insights.push('Consider reviewing entry quality to improve community reception')
    }

    return insights
  }
}