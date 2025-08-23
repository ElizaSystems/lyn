import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { 
  BurnRecord, 
  BurnStats, 
  BurnLeaderboardEntry, 
  GlobalBurnStats 
} from '@/lib/models/burn'
import { integrateBurnTracking } from './activity-tracker'

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
      const userId = burn.userId.toString()
      await this.updateUserBurnStats(userId, burn.amount)
      
      // Track achievement progress
      try {
        await integrateBurnTracking.onTokensBurned(userId, {
          amount: burn.amount,
          transactionSignature: burn.transactionSignature,
          type: burn.type,
          burnAddress: burn.metadata?.burnAddress
        })
      } catch (achievementError) {
        console.error(`[BurnService] Failed to track achievement progress for burn:`, achievementError)
      }
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
    
    // Get top burners, recent burns, and verification stats
    const [topBurners, recentBurns, verificationStats] = await Promise.all([
      this.getLeaderboard(10),
      this.getRecentBurns(10),
      this.getVerificationStats()
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
      burnsByType: burnTypeMap,
      verificationStats
    }
  }

  /**
   * Verify and update burn from blockchain
   */
  static async verifyBurn(transactionSignature: string): Promise<boolean> {
    const burns = await this.getBurnsCollection()
    
    try {
      console.log(`[BurnService] Verifying transaction: ${transactionSignature}`)
      
      // Import verification service (dynamic to avoid circular imports)
      const { SolanaVerificationService } = await import('./solana-verification')
      const verificationService = new SolanaVerificationService()
      
      // Find existing burn record
      const existingBurn = await burns.findOne({ transactionSignature })
      
      if (!existingBurn) {
        console.log(`[BurnService] No burn record found for signature: ${transactionSignature}`)
        return false
      }
      
      // Skip if already verified
      if (existingBurn.verified && existingBurn.verificationStatus === 'verified') {
        console.log(`[BurnService] Burn already verified: ${transactionSignature}`)
        return true
      }
      
      // Update verification attempt
      await burns.updateOne(
        { transactionSignature },
        {
          $inc: { verificationAttempts: 1 },
          $set: { 
            lastVerificationAttempt: new Date(),
            verificationStatus: 'pending'
          }
        }
      )
      
      // Verify the burn transaction on-chain
      const burnDetails = await verificationService.verifyBurnTransaction(transactionSignature)
      
      if (burnDetails && burnDetails.isValid) {
        // Update burn record with verified data
        await burns.updateOne(
          { transactionSignature },
          {
            $set: {
              verified: true,
              verificationStatus: 'verified',
              onChainAmount: burnDetails.amount,
              blockHeight: burnDetails.slot,
              metadata: {
                ...existingBurn.metadata,
                blockTime: burnDetails.blockTime.toISOString(),
                slot: burnDetails.slot,
                confirmations: burnDetails.confirmations,
                fee: burnDetails.fee,
                burnAddress: burnDetails.burnAddress,
                tokenMint: burnDetails.tokenMint,
                verifiedAt: new Date().toISOString()
              }
            }
          }
        )
        
        console.log(`[BurnService] Successfully verified burn: ${transactionSignature}`)
        return true
      } else {
        // Mark as failed verification
        await burns.updateOne(
          { transactionSignature },
          {
            $set: {
              verified: false,
              verificationStatus: 'failed'
            }
          }
        )
        
        console.log(`[BurnService] Failed to verify burn: ${transactionSignature}`)
        return false
      }
      
    } catch (error) {
      console.error(`[BurnService] Error verifying burn ${transactionSignature}:`, error)
      
      // Update failure status
      await burns.updateOne(
        { transactionSignature },
        {
          $set: {
            verified: false,
            verificationStatus: 'failed'
          }
        }
      )
      
      return false
    }
  }

  /**
   * Submit a transaction signature for verification
   */
  static async submitForVerification(
    transactionSignature: string,
    walletAddress: string,
    expectedAmount?: number
  ): Promise<{ success: boolean; message: string; burnRecord?: BurnRecord }> {
    try {
      // Import monitoring service (dynamic to avoid circular imports)
      const { BurnMonitorService } = await import('./burn-monitor')
      const monitorService = new BurnMonitorService()
      
      // Check if burn already exists
      const burns = await this.getBurnsCollection()
      const existingBurn = await burns.findOne({ transactionSignature })
      
      if (existingBurn) {
        if (existingBurn.verified) {
          return {
            success: true,
            message: 'Burn already verified',
            burnRecord: existingBurn
          }
        }
        
        // Try to verify existing burn
        const verified = await this.verifyBurn(transactionSignature)
        const updatedBurn = await burns.findOne({ transactionSignature })
        
        return {
          success: verified,
          message: verified ? 'Burn verified successfully' : 'Burn verification failed',
          burnRecord: updatedBurn || undefined
        }
      }
      
      // Add to pending verification queue
      await monitorService.addPendingBurn(transactionSignature, walletAddress, expectedAmount)
      
      // Try immediate verification
      const { SolanaVerificationService } = await import('./solana-verification')
      const verificationService = new SolanaVerificationService()
      const burnDetails = await verificationService.verifyBurnTransaction(transactionSignature)
      
      if (burnDetails && burnDetails.isValid) {
        // Create burn record immediately
        const burnRecord: Omit<BurnRecord, '_id' | 'timestamp' | 'verified'> = {
          walletAddress,
          amount: burnDetails.amount,
          type: 'manual',
          transactionSignature,
          description: `Verified on-chain burn of ${burnDetails.amount} LYN`,
          metadata: {
            blockTime: burnDetails.blockTime.toISOString(),
            slot: burnDetails.slot,
            confirmations: burnDetails.confirmations,
            fee: burnDetails.fee,
            burnAddress: burnDetails.burnAddress,
            tokenMint: burnDetails.tokenMint,
            verifiedAt: new Date().toISOString()
          },
          blockHeight: burnDetails.slot,
          verificationStatus: 'verified',
          onChainAmount: burnDetails.amount
        }
        
        const createdBurn = await this.recordBurn(burnRecord)
        
        return {
          success: true,
          message: 'Burn verified and recorded successfully',
          burnRecord: createdBurn
        }
      }
      
      return {
        success: false,
        message: 'Transaction submitted for verification. Check back in a few minutes.'
      }
      
    } catch (error) {
      console.error('[BurnService] Error submitting burn for verification:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Get verification statistics
   */
  static async getVerificationStats(): Promise<{
    verified: number
    pending: number
    failed: number
    totalOnChainBurned: number
  }> {
    const burns = await this.getBurnsCollection()
    
    const stats = await burns.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$onChainAmount', '$amount'] } }
        }
      }
    ]).toArray()
    
    const result = {
      verified: 0,
      pending: 0,
      failed: 0,
      totalOnChainBurned: 0
    }
    
    for (const stat of stats) {
      switch (stat._id) {
        case 'verified':
          result.verified = stat.count
          result.totalOnChainBurned += stat.totalAmount
          break
        case 'pending':
          result.pending = stat.count
          break
        case 'failed':
          result.failed = stat.count
          break
        default:
          // Handle burns without verification status (legacy)
          if (stat._id === null || stat._id === undefined) {
            result.verified += stat.count
            result.totalOnChainBurned += stat.totalAmount
          }
      }
    }
    
    return result
  }

  /**
   * Get burns that need verification
   */
  static async getPendingVerificationBurns(limit = 50): Promise<BurnRecord[]> {
    const burns = await this.getBurnsCollection()
    
    return await burns.find({
      $or: [
        { verified: false },
        { verificationStatus: { $in: ['pending', 'failed'] } },
        { verificationStatus: { $exists: false }, verified: { $ne: true } }
      ],
      verificationAttempts: { $lt: 3 }
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray()
  }

  /**
   * Batch verify multiple burns
   */
  static async batchVerify(transactionSignatures: string[]): Promise<{
    verified: number
    failed: number
    errors: string[]
  }> {
    const results = {
      verified: 0,
      failed: 0,
      errors: []
    }
    
    for (const signature of transactionSignatures) {
      try {
        const success = await this.verifyBurn(signature)
        if (success) {
          results.verified++
        } else {
          results.failed++
        }
      } catch (error) {
        results.failed++
        results.errors.push(`${signature}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    return results
  }
}