import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { 
  BurnRecord, 
  BurnStats, 
  BurnLeaderboardEntry, 
  GlobalBurnStats 
} from '@/lib/models/burn'

export class BurnService {
  private static async getBurnsCollection() {
    const db = await getDatabase()
    return db.collection<BurnRecord>('burns')
  }

  /**
   * Record a burn event
   */
  static async recordBurn(burn: Omit<BurnRecord, '_id' | 'timestamp' | 'verified'>): Promise<BurnRecord> {
    const burns = await this.getBurnsCollection()
    
    const burnRecord: BurnRecord = {
      ...burn,
      timestamp: new Date(),
      verified: true // Set to true after on-chain verification
    }
    
    const result = await burns.insertOne(burnRecord)
    
    // Update user stats if userId is provided
    if (burn.userId) {
      await this.updateUserBurnStats(burn.userId.toString(), burn.amount)
    }
    
    console.log(`[BurnService] Recorded burn: ${burn.amount} LYN by ${burn.walletAddress}`)
    
    return { ...burnRecord, _id: result.insertedId }
  }

  /**
   * Update user burn statistics
   */
  private static async updateUserBurnStats(userId: string, amount: number) {
    const db = await getDatabase()
    const userStatsCollection = db.collection('user_burn_stats')
    
    await userStatsCollection.updateOne(
      { userId: new ObjectId(userId) },
      {
        $inc: {
          totalBurned: amount,
          burnCount: 1
        },
        $max: {
          largestBurn: amount
        },
        $set: {
          lastBurnDate: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId: new ObjectId(userId),
          createdAt: new Date()
        }
      },
      { upsert: true }
    )
  }

  /**
   * Get user burn statistics
   */
  static async getUserBurnStats(walletAddress: string): Promise<BurnStats> {
    const burns = await this.getBurnsCollection()
    
    const userBurns = await burns.find({ walletAddress }).toArray()
    
    if (userBurns.length === 0) {
      return {
        totalBurned: 0,
        burnCount: 0,
        lastBurnDate: null,
        largestBurn: 0,
        averageBurn: 0
      }
    }
    
    const totalBurned = userBurns.reduce((sum, burn) => sum + burn.amount, 0)
    const largestBurn = Math.max(...userBurns.map(b => b.amount))
    const lastBurnDate = userBurns
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0].timestamp
    
    return {
      totalBurned,
      burnCount: userBurns.length,
      lastBurnDate,
      largestBurn,
      averageBurn: totalBurned / userBurns.length
    }
  }

  /**
   * Get burn leaderboard
   */
  static async getLeaderboard(limit: number = 10): Promise<BurnLeaderboardEntry[]> {
    const burns = await this.getBurnsCollection()
    const db = await getDatabase()
    const usersCollection = db.collection('users')
    
    // Aggregate burns by wallet address
    const pipeline = [
      {
        $group: {
          _id: '$walletAddress',
          totalBurned: { $sum: '$amount' },
          burnCount: { $sum: 1 },
          largestBurn: { $max: '$amount' },
          lastBurnDate: { $max: '$timestamp' }
        }
      },
      { $sort: { totalBurned: -1 } },
      { $limit: limit }
    ]
    
    const results = await burns.aggregate(pipeline).toArray()
    
    // Get usernames for the wallets
    const walletAddresses = results.map(r => r._id)
    const users = await usersCollection.find({ 
      walletAddress: { $in: walletAddresses } 
    }).toArray()
    
    const userMap = new Map(users.map(u => [u.walletAddress, u.username]))
    
    // Build leaderboard
    return results.map((result, index) => {
      const badges = this.calculateBadges(result.totalBurned, result.burnCount)
      
      return {
        rank: index + 1,
        walletAddress: result._id,
        username: userMap.get(result._id),
        totalBurned: result.totalBurned,
        burnCount: result.burnCount,
        largestBurn: result.largestBurn,
        lastBurnDate: result.lastBurnDate,
        badges
      }
    })
  }

  /**
   * Calculate badges based on burn activity
   */
  private static calculateBadges(totalBurned: number, burnCount: number): string[] {
    const badges: string[] = []
    
    // Total burned badges
    if (totalBurned >= 1000000) badges.push('🔥 Inferno Lord')
    else if (totalBurned >= 500000) badges.push('💎 Diamond Burner')
    else if (totalBurned >= 100000) badges.push('🏆 Burn Champion')
    else if (totalBurned >= 50000) badges.push('⭐ Star Burner')
    else if (totalBurned >= 10000) badges.push('🎯 Active Burner')
    
    // Burn count badges
    if (burnCount >= 100) badges.push('💯 Century Club')
    else if (burnCount >= 50) badges.push('🎮 Frequent Burner')
    else if (burnCount >= 10) badges.push('🚀 Regular Burner')
    
    return badges
  }

  /**
   * Get recent burns
   */
  static async getRecentBurns(limit: number = 10): Promise<BurnRecord[]> {
    const burns = await this.getBurnsCollection()
    const db = await getDatabase()
    const usersCollection = db.collection('users')
    
    const recentBurns = await burns
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()
    
    // Get usernames for the burns
    const walletAddresses = [...new Set(recentBurns.map(b => b.walletAddress))]
    const users = await usersCollection.find({ 
      walletAddress: { $in: walletAddresses } 
    }).toArray()
    
    const userMap = new Map(users.map(u => [u.walletAddress, u.username]))
    
    // Add usernames to burns
    return recentBurns.map(burn => ({
      ...burn,
      username: userMap.get(burn.walletAddress)
    }))
  }

  /**
   * Get global burn statistics
   */
  static async getGlobalStats(): Promise<GlobalBurnStats> {
    const burns = await this.getBurnsCollection()
    
    // Get total stats
    const totalStats = await burns.aggregate([
      {
        $group: {
          _id: null,
          totalBurned: { $sum: '$amount' },
          totalBurnEvents: { $sum: 1 },
          uniqueBurners: { $addToSet: '$walletAddress' }
        }
      }
    ]).toArray()
    
    const stats = totalStats[0] || {
      totalBurned: 0,
      totalBurnEvents: 0,
      uniqueBurners: []
    }
    
    // Calculate burn rates
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const [dailyBurns, weeklyBurns, monthlyBurns] = await Promise.all([
      burns.aggregate([
        { $match: { timestamp: { $gte: dayAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray(),
      burns.aggregate([
        { $match: { timestamp: { $gte: weekAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray(),
      burns.aggregate([
        { $match: { timestamp: { $gte: monthAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray()
    ])
    
    // Get burns by type
    const burnsByType = await burns.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]).toArray()
    
    const burnTypeMap = burnsByType.reduce((acc, curr) => {
      acc[curr._id] = curr.total
      return acc
    }, {} as Record<string, number>)
    
    // Get top burners and recent burns
    const [topBurners, recentBurns] = await Promise.all([
      this.getLeaderboard(10),
      this.getRecentBurns(10)
    ])
    
    return {
      totalBurned: stats.totalBurned,
      totalBurnEvents: stats.totalBurnEvents,
      uniqueBurners: stats.uniqueBurners.length,
      burnRate: {
        daily: dailyBurns[0]?.total || 0,
        weekly: weeklyBurns[0]?.total || 0,
        monthly: monthlyBurns[0]?.total || 0
      },
      topBurners,
      recentBurns,
      burnsByType: burnTypeMap
    }
  }

  /**
   * Verify and update burn from blockchain
   */
  static async verifyBurn(transactionSignature: string): Promise<boolean> {
    const burns = await this.getBurnsCollection()
    
    // TODO: Implement actual on-chain verification
    // For now, just mark as verified
    await burns.updateOne(
      { transactionSignature },
      { $set: { verified: true } }
    )
    
    return true
  }
}