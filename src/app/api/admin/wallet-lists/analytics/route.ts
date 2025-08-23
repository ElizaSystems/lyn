import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { isAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await isAdmin(request)
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'daily'
    const days = parseInt(searchParams.get('days') || '30')

    const db = await getDatabase()
    const analyticsCollection = db.collection('list_analytics')
    const entriesCollection = db.collection('wallet_list_entries')
    const listsCollection = db.collection('wallet_lists')

    // Get analytics data for the specified period
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const analytics = await analyticsCollection.find({
      date: { $gte: startDate, $lte: endDate },
      period: period as any
    }).sort({ date: -1 }).toArray()

    // Get overall statistics
    const totalEntries = await entriesCollection.countDocuments({})
    const globalEntries = await entriesCollection.countDocuments({ isGlobal: true })
    const publicEntries = await entriesCollection.countDocuments({ visibility: 'public' })
    const activeEntries = await entriesCollection.countDocuments({
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    })

    const totalLists = await listsCollection.countDocuments({})
    const activeLists = await listsCollection.countDocuments({ isActive: true })

    // Get category breakdown
    const categoryStats = await entriesCollection.aggregate([
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          whitelist: {
            $sum: { $cond: [{ $eq: ['$listType', 'whitelist'] }, 1, 0] }
          },
          blacklist: {
            $sum: { $cond: [{ $eq: ['$listType', 'blacklist'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$confidence' },
          globalEntries: {
            $sum: { $cond: ['$isGlobal', 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } }
    ]).toArray()

    // Get top contributing users
    const topContributors = await entriesCollection.aggregate([
      { $match: { isGlobal: false } }, // Exclude admin entries
      {
        $group: {
          _id: '$ownerId',
          ownerAddress: { $first: '$ownerAddress' },
          totalEntries: { $sum: 1 },
          whitelistEntries: {
            $sum: { $cond: [{ $eq: ['$listType', 'whitelist'] }, 1, 0] }
          },
          blacklistEntries: {
            $sum: { $cond: [{ $eq: ['$listType', 'blacklist'] }, 1, 0] }
          },
          avgConfidence: { $avg: '$confidence' },
          totalVotes: { $sum: { $add: ['$votes.upvotes', '$votes.downvotes'] } }
        }
      },
      { $sort: { totalEntries: -1 } },
      { $limit: 10 }
    ]).toArray()

    // Get recent activity trends
    const recentTrends = await entriesCollection.aggregate([
      {
        $match: {
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
      { $sort: { '_id.date': -1 } }
    ]).toArray()

    // Get voting statistics
    const votingStats = await entriesCollection.aggregate([
      {
        $match: {
          'votes.upvotes': { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalVotes: { $sum: { $add: ['$votes.upvotes', '$votes.downvotes'] } },
          totalUpvotes: { $sum: '$votes.upvotes' },
          totalDownvotes: { $sum: '$votes.downvotes' },
          avgVotesPerEntry: {
            $avg: { $add: ['$votes.upvotes', '$votes.downvotes'] }
          },
          entriesWithVotes: { $sum: 1 }
        }
      }
    ]).toArray()

    const votingData = votingStats[0] || {
      totalVotes: 0,
      totalUpvotes: 0,
      totalDownvotes: 0,
      avgVotesPerEntry: 0,
      entriesWithVotes: 0
    }

    // Calculate query statistics
    const totalQueries = analytics.reduce((sum, record) => sum + (record.queriesCount || 0), 0)
    const uniqueUsers = analytics.reduce((sum, record) => sum + (record.uniqueQueryUsers || 0), 0)

    const response = {
      overview: {
        totalEntries,
        globalEntries,
        publicEntries,
        activeEntries,
        totalLists,
        activeLists,
        expiredEntries: totalEntries - activeEntries
      },
      usage: {
        totalQueries,
        uniqueUsers: Math.floor(uniqueUsers / Math.max(analytics.length, 1)), // Average unique users
        avgQueriesPerDay: Math.floor(totalQueries / Math.max(days, 1)),
        period: `Last ${days} days`
      },
      categories: categoryStats,
      topContributors,
      recentTrends,
      voting: {
        ...votingData,
        participationRate: totalEntries > 0 ? 
          Math.round((votingData.entriesWithVotes / totalEntries) * 100) : 0
      },
      analytics: analytics.slice(0, 30) // Last 30 records
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Admin Analytics] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}