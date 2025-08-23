import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { AchievementService } from '@/lib/services/achievement-service'
import { EnhancedBadgeService } from '@/lib/services/enhanced-badge-service'
import { REPUTATION_TIERS } from '@/lib/models/achievement'

interface ReputationDecayConfig {
  enabled: boolean
  decayStartAfterDays: number        // Days of inactivity before decay starts
  decayRatePerDay: number           // Reputation points lost per day
  minimumReputation: number         // Never decay below this amount
  maxDecayPerPeriod: number         // Maximum reputation that can be lost in one period
  decayCheckIntervalDays: number    // How often to check for decay (daily/weekly)
  exemptionTiers: string[]          // Tiers exempt from decay
  gracePeriodForNewUsers: number    // Days grace period for new users
}

interface UserReputationDecay {
  _id?: ObjectId
  userId: ObjectId
  lastActivityDate: Date
  lastDecayCheck: Date
  totalDecayApplied: number
  isDecayActive: boolean
  exemptionReason?: string
  decayHistory: Array<{
    date: Date
    reputationBefore: number
    reputationAfter: number
    decayAmount: number
    reason: string
  }>
  createdAt: Date
  updatedAt: Date
}

const DEFAULT_DECAY_CONFIG: ReputationDecayConfig = {
  enabled: true,
  decayStartAfterDays: 30,           // Start decay after 30 days of inactivity
  decayRatePerDay: 2,                // Lose 2 reputation points per day
  minimumReputation: 0,              // Can decay down to 0
  maxDecayPerPeriod: 50,            // Max 50 reputation lost per week
  decayCheckIntervalDays: 7,         // Check weekly
  exemptionTiers: ['legend'],        // Legends are exempt from decay
  gracePeriodForNewUsers: 60         // 60 day grace period for new users
}

export class ReputationDecayService {
  private static async getDecayCollection() {
    const db = await getDatabase()
    return db.collection<UserReputationDecay>('user_reputation_decay')
  }

  private static async getUserStatsCollection() {
    const db = await getDatabase()
    return db.collection('user_stats')
  }

  // Initialize decay tracking for a user
  static async initializeDecayTracking(userId: string): Promise<void> {
    const collection = await this.getDecayCollection()
    const userObjectId = new ObjectId(userId)

    const existing = await collection.findOne({ userId: userObjectId })
    if (existing) {
      return // Already initialized
    }

    const decayRecord: UserReputationDecay = {
      userId: userObjectId,
      lastActivityDate: new Date(),
      lastDecayCheck: new Date(),
      totalDecayApplied: 0,
      isDecayActive: false,
      decayHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await collection.insertOne(decayRecord)
  }

  // Update user's last activity date (call this whenever user performs any action)
  static async updateLastActivity(userId: string): Promise<void> {
    const collection = await this.getDecayCollection()
    const userObjectId = new ObjectId(userId)

    await collection.updateOne(
      { userId: userObjectId },
      {
        $set: {
          lastActivityDate: new Date(),
          isDecayActive: false,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )
  }

  // Check if user is exempt from decay
  private static async isUserExemptFromDecay(userId: string): Promise<{ exempt: boolean; reason?: string }> {
    const userStats = await AchievementService.getUserStats(userId)
    const reputationTier = EnhancedBadgeService.getReputationTierInfo(userStats.totalReputation)
    
    // Check if tier is exempt
    if (reputationTier && DEFAULT_DECAY_CONFIG.exemptionTiers.includes(reputationTier.tier)) {
      return { exempt: true, reason: `${reputationTier.title} tier exemption` }
    }

    // Check if user is in grace period (new user)
    const accountCreationDate = await this.getAccountCreationDate(userId)
    if (accountCreationDate) {
      const daysSinceCreation = Math.floor((Date.now() - accountCreationDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceCreation < DEFAULT_DECAY_CONFIG.gracePeriodForNewUsers) {
        return { exempt: true, reason: 'New user grace period' }
      }
    }

    return { exempt: false }
  }

  // Get account creation date
  private static async getAccountCreationDate(userId: string): Promise<Date | null> {
    try {
      const db = await getDatabase()
      const usersCollection = db.collection('users')
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) })
      return user?.createdAt || null
    } catch (error) {
      console.error('Error getting account creation date:', error)
      return null
    }
  }

  // Calculate decay amount for a user
  private static calculateDecayAmount(
    daysSinceLastActivity: number,
    currentReputation: number,
    totalPreviousDecay: number
  ): number {
    if (!DEFAULT_DECAY_CONFIG.enabled) {
      return 0
    }

    // No decay if user hasn't been inactive long enough
    if (daysSinceLastActivity < DEFAULT_DECAY_CONFIG.decayStartAfterDays) {
      return 0
    }

    // Calculate days of decay to apply
    const decayDays = daysSinceLastActivity - DEFAULT_DECAY_CONFIG.decayStartAfterDays
    let totalDecay = decayDays * DEFAULT_DECAY_CONFIG.decayRatePerDay

    // Respect maximum decay per period
    totalDecay = Math.min(totalDecay, DEFAULT_DECAY_CONFIG.maxDecayPerPeriod)

    // Don't decay below minimum reputation
    const finalReputation = currentReputation - totalDecay
    if (finalReputation < DEFAULT_DECAY_CONFIG.minimumReputation) {
      totalDecay = currentReputation - DEFAULT_DECAY_CONFIG.minimumReputation
    }

    // Ensure decay amount is positive
    return Math.max(0, totalDecay)
  }

  // Apply decay to a single user
  static async applyDecayToUser(userId: string): Promise<{
    decayApplied: number
    newReputation: number
    wasExempt: boolean
    exemptionReason?: string
  }> {
    const decayCollection = await this.getDecayCollection()
    const statsCollection = await this.getUserStatsCollection()
    const userObjectId = new ObjectId(userId)

    // Initialize decay tracking if not exists
    await this.initializeDecayTracking(userId)

    // Check if user is exempt
    const exemption = await this.isUserExemptFromDecay(userId)
    if (exemption.exempt) {
      await decayCollection.updateOne(
        { userId: userObjectId },
        {
          $set: {
            exemptionReason: exemption.reason,
            lastDecayCheck: new Date(),
            updatedAt: new Date()
          }
        }
      )
      
      const userStats = await AchievementService.getUserStats(userId)
      return {
        decayApplied: 0,
        newReputation: userStats.totalReputation,
        wasExempt: true,
        exemptionReason: exemption.reason
      }
    }

    // Get user's current data
    const [decayRecord, userStats] = await Promise.all([
      decayCollection.findOne({ userId: userObjectId }),
      AchievementService.getUserStats(userId)
    ])

    if (!decayRecord) {
      throw new Error('Decay record not found after initialization')
    }

    // Calculate days since last activity
    const daysSinceLastActivity = Math.floor(
      (Date.now() - decayRecord.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Calculate decay amount
    const decayAmount = this.calculateDecayAmount(
      daysSinceLastActivity,
      userStats.totalReputation,
      decayRecord.totalDecayApplied
    )

    if (decayAmount === 0) {
      // Update last decay check
      await decayCollection.updateOne(
        { userId: userObjectId },
        {
          $set: {
            lastDecayCheck: new Date(),
            updatedAt: new Date()
          }
        }
      )
      
      return {
        decayApplied: 0,
        newReputation: userStats.totalReputation,
        wasExempt: false
      }
    }

    // Apply reputation decay
    const newReputation = Math.max(
      DEFAULT_DECAY_CONFIG.minimumReputation,
      userStats.totalReputation - decayAmount
    )

    // Update user stats
    await statsCollection.updateOne(
      { userId: userObjectId },
      {
        $set: {
          totalReputation: newReputation,
          updatedAt: new Date()
        }
      }
    )

    // Update decay record
    await decayCollection.updateOne(
      { userId: userObjectId },
      {
        $set: {
          lastDecayCheck: new Date(),
          totalDecayApplied: decayRecord.totalDecayApplied + decayAmount,
          isDecayActive: true,
          updatedAt: new Date()
        },
        $push: {
          decayHistory: {
            date: new Date(),
            reputationBefore: userStats.totalReputation,
            reputationAfter: newReputation,
            decayAmount,
            reason: `Inactivity for ${daysSinceLastActivity} days`
          }
        }
      }
    )

    console.log(`Applied ${decayAmount} reputation decay to user ${userId}`)

    return {
      decayApplied: decayAmount,
      newReputation,
      wasExempt: false
    }
  }

  // Run decay process for all users
  static async runDecayProcess(): Promise<{
    usersProcessed: number
    totalDecayApplied: number
    exemptUsers: number
    errors: string[]
  }> {
    console.log('Starting reputation decay process...')
    
    const statsCollection = await this.getUserStatsCollection()
    const decayCollection = await this.getDecayCollection()
    
    // Get all users who haven't been checked recently
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_DECAY_CONFIG.decayCheckIntervalDays)

    const usersToCheck = await statsCollection.find({
      $or: [
        // Users never checked for decay
        { _id: { $nin: await decayCollection.distinct('userId') } },
        // Users not checked recently
        { _id: { $in: await decayCollection.distinct('userId', { lastDecayCheck: { $lt: cutoffDate } }) } }
      ]
    }).toArray()

    const results = {
      usersProcessed: 0,
      totalDecayApplied: 0,
      exemptUsers: 0,
      errors: [] as string[]
    }

    for (const user of usersToCheck) {
      try {
        const result = await this.applyDecayToUser(user.userId.toString())
        results.usersProcessed++
        results.totalDecayApplied += result.decayApplied
        if (result.wasExempt) {
          results.exemptUsers++
        }
      } catch (error) {
        const errorMsg = `Failed to process decay for user ${user.userId}: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    console.log(`Reputation decay process completed: ${results.usersProcessed} users processed, ${results.totalDecayApplied} total reputation decayed, ${results.exemptUsers} exempt users`)

    return results
  }

  // Get decay status for a user
  static async getUserDecayStatus(userId: string): Promise<{
    isTracking: boolean
    lastActivityDate?: Date
    daysSinceLastActivity: number
    isDecayActive: boolean
    totalDecayApplied: number
    nextDecayCheck?: Date
    isExempt: boolean
    exemptionReason?: string
    projectedDecay: number
  }> {
    const collection = await this.getDecayCollection()
    const userObjectId = new ObjectId(userId)

    const decayRecord = await collection.findOne({ userId: userObjectId })
    
    if (!decayRecord) {
      return {
        isTracking: false,
        daysSinceLastActivity: 0,
        isDecayActive: false,
        totalDecayApplied: 0,
        isExempt: false,
        projectedDecay: 0
      }
    }

    const daysSinceLastActivity = Math.floor(
      (Date.now() - decayRecord.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const exemption = await this.isUserExemptFromDecay(userId)
    const userStats = await AchievementService.getUserStats(userId)
    const projectedDecay = this.calculateDecayAmount(
      daysSinceLastActivity,
      userStats.totalReputation,
      decayRecord.totalDecayApplied
    )

    const nextDecayCheck = new Date(decayRecord.lastDecayCheck)
    nextDecayCheck.setDate(nextDecayCheck.getDate() + DEFAULT_DECAY_CONFIG.decayCheckIntervalDays)

    return {
      isTracking: true,
      lastActivityDate: decayRecord.lastActivityDate,
      daysSinceLastActivity,
      isDecayActive: decayRecord.isDecayActive,
      totalDecayApplied: decayRecord.totalDecayApplied,
      nextDecayCheck,
      isExempt: exemption.exempt,
      exemptionReason: exemption.reason || decayRecord.exemptionReason,
      projectedDecay
    }
  }

  // Reset decay for a user (admin function)
  static async resetUserDecay(userId: string): Promise<void> {
    const collection = await this.getDecayCollection()
    const userObjectId = new ObjectId(userId)

    await collection.updateOne(
      { userId: userObjectId },
      {
        $set: {
          lastActivityDate: new Date(),
          lastDecayCheck: new Date(),
          totalDecayApplied: 0,
          isDecayActive: false,
          updatedAt: new Date()
        },
        $unset: {
          exemptionReason: 1
        },
        $push: {
          decayHistory: {
            date: new Date(),
            reputationBefore: 0,
            reputationAfter: 0,
            decayAmount: 0,
            reason: 'Manual reset by admin'
          }
        }
      }
    )

    console.log(`Reset decay for user ${userId}`)
  }

  // Get decay statistics
  static async getDecayStatistics(): Promise<{
    totalUsersTracked: number
    activeDecayUsers: number
    exemptUsers: number
    totalReputationDecayed: number
    averageDecayPerUser: number
    decayTrends: {
      period: string
      usersAffected: number
      totalDecay: number
    }[]
  }> {
    const collection = await this.getDecayCollection()
    
    const [totalUsers, activeDecay, stats] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ isDecayActive: true }),
      collection.aggregate([
        {
          $group: {
            _id: null,
            totalDecay: { $sum: '$totalDecayApplied' },
            exemptUsers: {
              $sum: { $cond: [{ $ne: ['$exemptionReason', null] }, 1, 0] }
            }
          }
        }
      ]).toArray()
    ])

    const totalDecay = stats[0]?.totalDecay || 0
    const exemptUsers = stats[0]?.exemptUsers || 0

    return {
      totalUsersTracked: totalUsers,
      activeDecayUsers: activeDecay,
      exemptUsers,
      totalReputationDecayed: totalDecay,
      averageDecayPerUser: totalUsers > 0 ? totalDecay / totalUsers : 0,
      decayTrends: [] // Could be expanded with historical data
    }
  }

  // Configuration methods
  static getDecayConfig(): ReputationDecayConfig {
    return { ...DEFAULT_DECAY_CONFIG }
  }

  // Enable/disable decay system (admin function)
  static async setDecayEnabled(enabled: boolean): Promise<void> {
    DEFAULT_DECAY_CONFIG.enabled = enabled
    console.log(`Reputation decay system ${enabled ? 'enabled' : 'disabled'}`)
  }
}