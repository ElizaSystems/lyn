import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { 
  LeaderboardEntry, 
  UserStats, 
  AchievementCategory, 
  ActivityType 
} from '@/lib/models/achievement'

export interface LeaderboardFilters {
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time'
  category?: AchievementCategory
  tier?: string
  region?: string
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  userRank?: number
  totalParticipants: number
  lastUpdated: Date
  filters: LeaderboardFilters
}

export class LeaderboardService {
  private static async getUserStatsCollection() {
    const db = await getDatabase()
    return db.collection<UserStats>('user_stats')
  }

  private static async getUserActivitiesCollection() {
    const db = await getDatabase()
    return db.collection('user_activities')
  }

  private static async getUsersCollection() {
    const db = await getDatabase()
    return db.collection('users')
  }

  // Get XP Leaderboard
  static async getXPLeaderboard(
    filters: LeaderboardFilters = {},
    limit: number = 50,
    userId?: string
  ): Promise<LeaderboardResponse> {
    const statsCollection = await this.getUserStatsCollection()
    
    const pipeline: any[] = [
      { $sort: { totalXP: -1 } },
      { $limit: limit * 2 }, // Get extra for user rank calculation
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          userId: 1,
          totalXP: 1,
          level: 1,
          achievementsUnlocked: 1,
          updatedAt: 1,
          username: { $arrayElemAt: ['$user.profile.username', 0] },
          walletAddress: { $arrayElemAt: ['$user.walletAddress', 0] }
        }
      }
    ]

    // Apply time-based filtering if needed
    if (filters.timeframe && filters.timeframe !== 'all_time') {
      const timeFilter = this.getTimeFilter(filters.timeframe)
      pipeline.unshift({
        $match: { updatedAt: { $gte: timeFilter } }
      })
    }

    const results = await statsCollection.aggregate(pipeline).toArray()
    
    const entries: LeaderboardEntry[] = results.slice(0, limit).map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      username: result.username,
      walletAddress: result.walletAddress,
      score: result.totalXP,
      achievements: result.achievementsUnlocked,
      metadata: {
        level: result.level
      },
      updatedAt: result.updatedAt
    }))

    // Find user rank if userId provided
    let userRank: number | undefined
    if (userId) {
      const userIndex = results.findIndex(r => r.userId.toString() === userId)
      userRank = userIndex !== -1 ? userIndex + 1 : undefined
    }

    return {
      entries,
      userRank,
      totalParticipants: results.length,
      lastUpdated: new Date(),
      filters
    }
  }

  // Get Activity-Based Leaderboard
  static async getActivityLeaderboard(
    activityType: ActivityType,
    filters: LeaderboardFilters = {},
    limit: number = 50,
    userId?: string
  ): Promise<LeaderboardResponse> {
    const activitiesCollection = await this.getUserActivitiesCollection()
    const usersCollection = await this.getUsersCollection()

    const matchStage: any = { activityType }
    
    // Apply time filtering
    if (filters.timeframe && filters.timeframe !== 'all_time') {
      const timeFilter = this.getTimeFilter(filters.timeframe)
      matchStage.timestamp = { $gte: timeFilter }
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalValue: { $sum: '$value' },
          activityCount: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { totalValue: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'user_stats',
          localField: '_id',
          foreignField: 'userId',
          as: 'stats'
        }
      },
      {
        $project: {
          userId: '$_id',
          score: '$totalValue',
          activityCount: 1,
          lastActivity: 1,
          username: { $arrayElemAt: ['$user.profile.username', 0] },
          walletAddress: { $arrayElemAt: ['$user.walletAddress', 0] },
          achievements: { $arrayElemAt: ['$stats.achievementsUnlocked', 0] }
        }
      }
    ]

    const results = await activitiesCollection.aggregate(pipeline).toArray()

    const entries: LeaderboardEntry[] = results.slice(0, limit).map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      username: result.username,
      walletAddress: result.walletAddress,
      score: result.score,
      achievements: result.achievements || 0,
      metadata: {
        activityCount: result.activityCount,
        lastActivity: result.lastActivity
      },
      updatedAt: result.lastActivity
    }))

    // Find user rank
    let userRank: number | undefined
    if (userId) {
      const userIndex = results.findIndex(r => r.userId.toString() === userId)
      userRank = userIndex !== -1 ? userIndex + 1 : undefined
    }

    return {
      entries,
      userRank,
      totalParticipants: results.length,
      lastUpdated: new Date(),
      filters
    }
  }

  // Get Category-Based Achievement Leaderboard
  static async getCategoryLeaderboard(
    category: AchievementCategory,
    filters: LeaderboardFilters = {},
    limit: number = 50,
    userId?: string
  ): Promise<LeaderboardResponse> {
    const statsCollection = await this.getUserStatsCollection()

    const sortField = `achievementsByCategory.${category}`
    
    const pipeline: any[] = [
      { $match: { [sortField]: { $gt: 0 } } },
      { $sort: { [sortField]: -1, totalXP: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          userId: 1,
          score: `$${sortField}`,
          totalXP: 1,
          level: 1,
          updatedAt: 1,
          username: { $arrayElemAt: ['$user.profile.username', 0] },
          walletAddress: { $arrayElemAt: ['$user.walletAddress', 0] }
        }
      }
    ]

    const results = await statsCollection.aggregate(pipeline).toArray()

    const entries: LeaderboardEntry[] = results.slice(0, limit).map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      username: result.username,
      walletAddress: result.walletAddress,
      score: result.score,
      achievements: result.score,
      metadata: {
        category,
        level: result.level,
        totalXP: result.totalXP
      },
      updatedAt: result.updatedAt
    }))

    // Find user rank
    let userRank: number | undefined
    if (userId) {
      const userIndex = results.findIndex(r => r.userId.toString() === userId)
      userRank = userIndex !== -1 ? userIndex + 1 : undefined
    }

    return {
      entries,
      userRank,
      totalParticipants: results.length,
      lastUpdated: new Date(),
      filters: { ...filters, category }
    }
  }

  // Get Token Burn Leaderboard
  static async getTokenBurnLeaderboard(
    filters: LeaderboardFilters = {},
    limit: number = 50,
    userId?: string
  ): Promise<LeaderboardResponse> {
    const db = await getDatabase()
    const burnsCollection = db.collection('burns')

    const matchStage: any = { verified: true }
    
    // Apply time filtering
    if (filters.timeframe && filters.timeframe !== 'all_time') {
      const timeFilter = this.getTimeFilter(filters.timeframe)
      matchStage.timestamp = { $gte: timeFilter }
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$walletAddress',
          totalBurned: { $sum: '$amount' },
          burnCount: { $sum: 1 },
          lastBurn: { $max: '$timestamp' }
        }
      },
      { $sort: { totalBurned: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'walletAddress',
          as: 'user'
        }
      },
      {
        $project: {
          walletAddress: '$_id',
          score: '$totalBurned',
          burnCount: 1,
          lastBurn: 1,
          userId: { $arrayElemAt: ['$user._id', 0] },
          username: { $arrayElemAt: ['$user.profile.username', 0] }
        }
      }
    ]

    const results = await burnsCollection.aggregate(pipeline).toArray()

    const entries: LeaderboardEntry[] = results.slice(0, limit).map((result, index) => ({
      rank: index + 1,
      userId: result.userId || new ObjectId(),
      username: result.username,
      walletAddress: result.walletAddress,
      score: result.score,
      achievements: 0, // Will be filled from user stats if needed
      metadata: {
        burnCount: result.burnCount,
        lastBurn: result.lastBurn,
        category: 'token_burner' as AchievementCategory
      },
      updatedAt: result.lastBurn
    }))

    // Find user rank by wallet address
    let userRank: number | undefined
    if (userId) {
      // Get user's wallet address first
      const usersCollection = await this.getUsersCollection()
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) })
      if (user) {
        const userIndex = results.findIndex(r => r.walletAddress === user.walletAddress)
        userRank = userIndex !== -1 ? userIndex + 1 : undefined
      }
    }

    return {
      entries,
      userRank,
      totalParticipants: results.length,
      lastUpdated: new Date(),
      filters
    }
  }

  // Get Comprehensive Leaderboard (combines multiple metrics)
  static async getComprehensiveLeaderboard(
    filters: LeaderboardFilters = {},
    limit: number = 50,
    userId?: string
  ): Promise<LeaderboardResponse> {
    const statsCollection = await this.getUserStatsCollection()

    // Calculate comprehensive score: XP + (reputation * 2) + (achievements * 5)
    const pipeline: any[] = [
      {
        $addFields: {
          comprehensiveScore: {
            $add: [
              '$totalXP',
              { $multiply: ['$totalReputation', 2] },
              { $multiply: ['$achievementsUnlocked', 5] }
            ]
          }
        }
      },
      { $sort: { comprehensiveScore: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          userId: 1,
          score: '$comprehensiveScore',
          totalXP: 1,
          totalReputation: 1,
          achievementsUnlocked: 1,
          level: 1,
          updatedAt: 1,
          username: { $arrayElemAt: ['$user.profile.username', 0] },
          walletAddress: { $arrayElemAt: ['$user.walletAddress', 0] }
        }
      }
    ]

    const results = await statsCollection.aggregate(pipeline).toArray()

    const entries: LeaderboardEntry[] = results.slice(0, limit).map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      username: result.username,
      walletAddress: result.walletAddress,
      score: Math.floor(result.score),
      achievements: result.achievementsUnlocked,
      metadata: {
        totalXP: result.totalXP,
        totalReputation: result.totalReputation,
        level: result.level,
        scoreBreakdown: {
          xp: result.totalXP,
          reputation: result.totalReputation * 2,
          achievements: result.achievementsUnlocked * 5
        }
      },
      updatedAt: result.updatedAt
    }))

    // Find user rank
    let userRank: number | undefined
    if (userId) {
      const userIndex = results.findIndex(r => r.userId.toString() === userId)
      userRank = userIndex !== -1 ? userIndex + 1 : undefined
    }

    return {
      entries,
      userRank,
      totalParticipants: results.length,
      lastUpdated: new Date(),
      filters
    }
  }

  // Get User's Leaderboard Position across different categories
  static async getUserLeaderboardPositions(userId: string): Promise<{
    xp: number | null
    reputation: number | null
    achievements: number | null
    comprehensive: number | null
    categories: Record<AchievementCategory, number | null>
  }> {
    const statsCollection = await this.getUserStatsCollection()
    const userObjectId = new ObjectId(userId)

    // Get user stats
    const userStats = await statsCollection.findOne({ userId: userObjectId })
    if (!userStats) {
      return {
        xp: null,
        reputation: null,
        achievements: null,
        comprehensive: null,
        categories: {
          security_scanner: null,
          threat_hunter: null,
          community_guardian: null,
          token_burner: null,
          referral_master: null,
          streak: null,
          veteran: null,
          rare: null,
          special: null
        }
      }
    }

    // Calculate ranks
    const [xpRank, reputationRank, achievementsRank, comprehensiveRank] = await Promise.all([
      // XP Rank
      statsCollection.countDocuments({ totalXP: { $gt: userStats.totalXP } }),
      
      // Reputation Rank
      statsCollection.countDocuments({ totalReputation: { $gt: userStats.totalReputation } }),
      
      // Achievements Rank
      statsCollection.countDocuments({ achievementsUnlocked: { $gt: userStats.achievementsUnlocked } }),
      
      // Comprehensive Rank
      statsCollection.aggregate([
        {
          $addFields: {
            comprehensiveScore: {
              $add: [
                '$totalXP',
                { $multiply: ['$totalReputation', 2] },
                { $multiply: ['$achievementsUnlocked', 5] }
              ]
            }
          }
        },
        {
          $match: {
            comprehensiveScore: { 
              $gt: userStats.totalXP + (userStats.totalReputation * 2) + (userStats.achievementsUnlocked * 5)
            }
          }
        },
        { $count: 'rank' }
      ]).toArray().then(result => result[0]?.rank || 0)
    ])

    // Calculate category ranks
    const categories: Record<AchievementCategory, number | null> = {} as Record<AchievementCategory, number | null>
    
    for (const category of Object.keys(userStats.achievementsByCategory) as AchievementCategory[]) {
      const userCategoryCount = userStats.achievementsByCategory[category]
      const rank = await statsCollection.countDocuments({
        [`achievementsByCategory.${category}`]: { $gt: userCategoryCount }
      })
      categories[category] = rank + 1
    }

    return {
      xp: xpRank + 1,
      reputation: reputationRank + 1,
      achievements: achievementsRank + 1,
      comprehensive: comprehensiveRank + 1,
      categories
    }
  }

  // Helper method to get time filter
  private static getTimeFilter(timeframe: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date()
    switch (timeframe) {
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      default:
        return new Date(0)
    }
  }

  // Update leaderboard cache (for performance optimization)
  static async updateLeaderboardCache(): Promise<void> {
    // This would typically update cached leaderboard data
    // For now, we'll just log that the cache update was called
    console.log('Leaderboard cache update called')
  }

  // Get trending users (users with recent significant activity)
  static async getTrendingUsers(limit: number = 10): Promise<LeaderboardEntry[]> {
    const activitiesCollection = await this.getUserActivitiesCollection()
    
    // Get users with most activity in the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const pipeline = [
      { $match: { timestamp: { $gte: last24Hours } } },
      {
        $group: {
          _id: '$userId',
          activityScore: { $sum: '$value' },
          activityCount: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { activityScore: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'user_stats',
          localField: '_id',
          foreignField: 'userId',
          as: 'stats'
        }
      },
      {
        $project: {
          userId: '$_id',
          score: '$activityScore',
          activityCount: 1,
          lastActivity: 1,
          username: { $arrayElemAt: ['$user.profile.username', 0] },
          walletAddress: { $arrayElemAt: ['$user.walletAddress', 0] },
          achievements: { $arrayElemAt: ['$stats.achievementsUnlocked', 0] },
          level: { $arrayElemAt: ['$stats.level', 0] }
        }
      }
    ]

    const results = await activitiesCollection.aggregate(pipeline).toArray()

    return results.map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      username: result.username,
      walletAddress: result.walletAddress,
      score: result.score,
      achievements: result.achievements || 0,
      metadata: {
        activityCount: result.activityCount,
        level: result.level,
        trending: true
      },
      updatedAt: result.lastActivity
    }))
  }
}

export default LeaderboardService