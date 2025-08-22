import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { 
  ReferralCode, 
  ReferralRelationship, 
  ReferralReward,
  ReferralAnalytics,
  ReferralDashboard 
} from '@/lib/models/referral'
import crypto from 'crypto'

export class ReferralService {
  private static async getReferralCodesCollection() {
    try {
      const db = await getDatabase()
      return db.collection<ReferralCode>('referral_codes')
    } catch (error) {
      console.error('[ReferralService] Failed to get referral codes collection:', error)
      throw new Error('Database connection failed')
    }
  }

  private static async getReferralRelationshipsCollection() {
    try {
      const db = await getDatabase()
      return db.collection<ReferralRelationship>('referral_relationships')
    } catch (error) {
      console.error('[ReferralService] Failed to get relationships collection:', error)
      throw new Error('Database connection failed')
    }
  }

  private static async getReferralRewardsCollection() {
    try {
      const db = await getDatabase()
      return db.collection<ReferralReward>('referral_rewards')
    } catch (error) {
      console.error('[ReferralService] Failed to get rewards collection:', error)
      throw new Error('Database connection failed')
    }
  }

  private static async getReferralAnalyticsCollection() {
    try {
      const db = await getDatabase()
      return db.collection<ReferralAnalytics>('referral_analytics')
    } catch (error) {
      console.error('[ReferralService] Failed to get analytics collection:', error)
      throw new Error('Database connection failed')
    }
  }

  /**
   * Generate a unique referral code for a user
   */
  static generateReferralCode(username?: string): string {
    const prefix = username ? username.toUpperCase().slice(0, 4) : 'LYN'
    const random = crypto.randomBytes(3).toString('hex').toUpperCase()
    return `${prefix}${random}`
  }

  /**
   * Create or get referral code for a user
   */
  static async getOrCreateReferralCode(
    userId: string,
    walletAddress: string,
    username?: string
  ): Promise<ReferralCode> {
    try {
      console.log(`[ReferralService] getOrCreateReferralCode - userId: ${userId}, walletAddress: ${walletAddress}, username: ${username}`)
      
      const codes = await this.getReferralCodesCollection()
      console.log('[ReferralService] Got referral codes collection')
    
    // Check if user already has a referral code
    // When userId is a wallet address, just search by wallet
    let existing
    
    // Check if userId is a valid ObjectId format (24 hex characters)
    const isObjectId = /^[a-f\d]{24}$/i.test(userId)
    
    if (isObjectId) {
      try {
        existing = await codes.findOne({ 
          $or: [
            { userId: new ObjectId(userId) },
            { userId: userId },
            { walletAddress }
          ]
        })
      } catch (err) {
        console.log('[ReferralService] ObjectId conversion failed, trying string search')
        existing = await codes.findOne({ 
          $or: [
            { userId: userId },
            { walletAddress }
          ]
        })
      }
    } else {
      // userId is likely a wallet address, search by wallet
      existing = await codes.findOne({ walletAddress })
    }
    
      if (existing) {
        console.log(`[ReferralService] Found existing referral code: ${existing.code}`)
        return existing
      }
      
      console.log('[ReferralService] No existing code found, creating new one')
    
    // Generate new referral code
    let code = this.generateReferralCode(username)
    
    // Ensure uniqueness (case-insensitive check)
    let attempts = 0
    while (await codes.findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') } }) && attempts < 10) {
      code = this.generateReferralCode(username)
      attempts++
    }
    
    const referralCode: ReferralCode = {
      userId: userId, // Use string directly instead of ObjectId
      code,
      walletAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalReferrals: 0,
      totalBurned: 0,
      totalRewards: 0,
      isActive: true
    }
    
      console.log(`[ReferralService] Creating referral code: ${code}`)
      const result = await codes.insertOne(referralCode)
      console.log(`[ReferralService] Successfully created referral code with ID: ${result.insertedId}`)
      
      return { ...referralCode, _id: result.insertedId }
    } catch (error) {
      console.error('[ReferralService] Error in getOrCreateReferralCode:', error)
      throw error
    }
  }

  /**
   * Track a referral relationship
   */
  static async trackReferral(
    referralCode: string,
    referredUserId: string,
    registrationBurnAmount?: number,
    registrationBurnTx?: string
  ): Promise<ReferralRelationship | null> {
    const codes = await this.getReferralCodesCollection()
    const relationships = await this.getReferralRelationshipsCollection()
    
    // Find the referral code (case-insensitive)
    const codeDoc = await codes.findOne({ 
      code: { $regex: new RegExp(`^${referralCode}$`, 'i') }, 
      isActive: true 
    })
    if (!codeDoc) {
      console.log(`[Referral] Code not found or inactive: ${referralCode}`)
      return null
    }
    
    // Check if relationship already exists
    let existing
    try {
      existing = await relationships.findOne({
        referrerId: codeDoc.userId,
        referredId: new ObjectId(referredUserId)
      })
    } catch {
      // If ObjectId fails, try string
      existing = await relationships.findOne({
        referrerId: codeDoc.userId,
        referredId: referredUserId
      })
    }
    
    if (existing) {
      console.log(`[Referral] Relationship already exists`)
      return existing
    }
    
    // Create new relationship
    const relationship: ReferralRelationship = {
      referrerId: codeDoc.userId,
      referredId: referredUserId, // Use string directly
      referralCode,
      createdAt: new Date(),
      registrationBurnAmount,
      registrationBurnTx,
      totalBurnsByReferred: registrationBurnAmount || 0,
      totalRewardsGenerated: (registrationBurnAmount || 0) * 0.2 // 20% reward
    }
    
    const result = await relationships.insertOne(relationship)
    
    // Update referral code stats
    await codes.updateOne(
      { _id: codeDoc._id },
      {
        $inc: {
          totalReferrals: 1,
          totalBurned: registrationBurnAmount || 0,
          totalRewards: (registrationBurnAmount || 0) * 0.2
        },
        $set: { updatedAt: new Date() }
      }
    )
    
    // Create initial reward record if there was a burn
    if (registrationBurnAmount && registrationBurnTx) {
      await this.createReward(
        codeDoc.userId.toString(),
        referredUserId,
        registrationBurnTx,
        registrationBurnAmount,
        'registration'
      )
    }
    
    return { ...relationship, _id: result.insertedId }
  }

  /**
   * Create a reward record for a burn
   */
  static async createReward(
    referrerId: string,
    referredId: string,
    burnTransaction: string,
    burnAmount: number,
    rewardType: 'registration' | 'feature' | 'other'
  ): Promise<ReferralReward> {
    const rewards = await this.getReferralRewardsCollection()
    
    const reward: ReferralReward = {
      referrerId: referrerId, // Use string directly
      referredId: referredId, // Use string directly
      burnTransaction,
      burnAmount,
      rewardAmount: burnAmount * 0.2, // 20% reward
      rewardType,
      status: 'pending',
      createdAt: new Date()
    }
    
    const result = await rewards.insertOne(reward)
    
    // Update relationship stats
    const relationships = await this.getReferralRelationshipsCollection()
    await relationships.updateOne(
      { 
        $or: [
          { referrerId: referrerId, referredId: referredId },
          { referrerId: referrerId, referredId: referredId }
        ]
      },
      {
        $inc: {
          totalBurnsByReferred: burnAmount,
          totalRewardsGenerated: burnAmount * 0.2
        }
      }
    )
    
    // Update referral code stats
    const codes = await this.getReferralCodesCollection()
    await codes.updateOne(
      { 
        $or: [
          { userId: referrerId },
          { walletAddress: referrerId }
        ]
      },
      {
        $inc: {
          totalBurned: burnAmount,
          totalRewards: burnAmount * 0.2
        },
        $set: { updatedAt: new Date() }
      }
    )
    
    return { ...reward, _id: result.insertedId }
  }

  /**
   * Get referral dashboard for a user
   */
  static async getReferralDashboard(userId: string): Promise<ReferralDashboard | null> {
    const codes = await this.getReferralCodesCollection()
    const relationships = await this.getReferralRelationshipsCollection()
    const rewards = await this.getReferralRewardsCollection()
    const db = await getDatabase()
    
    // Get user's referral code
    let referralCode
    
    // Check if userId is a valid ObjectId format
    const isObjectId = /^[a-f\d]{24}$/i.test(userId)
    
    if (isObjectId) {
      try {
        referralCode = await codes.findOne({ 
          $or: [
            { userId: new ObjectId(userId) },
            { userId: userId }
          ]
        })
      } catch {
        referralCode = await codes.findOne({ userId: userId })
      }
    } else {
      // userId is likely a wallet address, search by wallet or userId
      referralCode = await codes.findOne({ 
        $or: [
          { userId: userId },
          { walletAddress: userId }
        ]
      })
    }
    
    if (!referralCode) {
      return null
    }
    
    // Get all relationships
    const allRelationships = await relationships.find({
      referrerId: referralCode.userId
    }).toArray()
    
    // Get all rewards
    const allRewards = await rewards.find({
      referrerId: referralCode.userId
    }).sort({ createdAt: -1 }).limit(10).toArray()
    
    // Calculate pending vs paid rewards
    const pendingRewards = allRewards
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + r.rewardAmount, 0)
    
    const paidRewards = allRewards
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + r.rewardAmount, 0)
    
    // Get recent referrals with user details
    const recentReferralIds = allRelationships
      .slice(0, 10)
      .map(r => {
        // Convert to ObjectId if it's a string
        if (typeof r.referredId === 'string') {
          return new ObjectId(r.referredId)
        }
        return r.referredId as ObjectId
      })
    
    const users = await db.collection('users').find({
      _id: { $in: recentReferralIds }
    }).toArray()
    
    const userMap = new Map(users.map(u => [u._id.toString(), u]))
    
    const recentReferrals = allRelationships.slice(0, 10).map(rel => {
      const user = userMap.get(rel.referredId.toString())
      return {
        username: user?.username,
        walletAddress: user?.walletAddress || 'Unknown',
        joinedAt: rel.createdAt,
        burned: rel.totalBurnsByReferred,
        rewardsGenerated: rel.totalRewardsGenerated
      }
    })
    
    // Calculate conversion rate
    const activeReferrals = allRelationships.filter(r => r.totalBurnsByReferred > 0).length
    const conversionRate = allRelationships.length > 0 
      ? (activeReferrals / allRelationships.length) * 100 
      : 0
    
    // Build dashboard
    const dashboard: ReferralDashboard = {
      referralCode: referralCode.code,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${referralCode.code}`,
      stats: {
        totalReferrals: referralCode.totalReferrals,
        activeReferrals,
        totalBurned: referralCode.totalBurned,
        totalRewards: referralCode.totalRewards,
        pendingRewards,
        paidRewards,
        conversionRate
      },
      recentReferrals,
      recentRewards: allRewards,
      analytics: {
        daily: [],
        weekly: [],
        monthly: []
      }
    }
    
    return dashboard
  }

  /**
   * Process pending rewards (for payout)
   */
  static async getPendingRewards(walletAddress: string): Promise<{
    totalPending: number
    rewards: ReferralReward[]
  }> {
    const codes = await this.getReferralCodesCollection()
    const rewards = await this.getReferralRewardsCollection()
    
    // Get user's referral code
    const referralCode = await codes.findOne({ walletAddress })
    if (!referralCode) {
      return { totalPending: 0, rewards: [] }
    }
    
    // Get pending rewards
    const pendingRewards = await rewards.find({
      referrerId: referralCode.userId,
      status: 'pending'
    }).toArray()
    
    const totalPending = pendingRewards.reduce((sum, r) => sum + r.rewardAmount, 0)
    
    return {
      totalPending,
      rewards: pendingRewards
    }
  }

  /**
   * Mark rewards as paid
   */
  static async markRewardsAsPaid(
    rewardIds: string[],
    payoutTransaction: string
  ): Promise<boolean> {
    const rewards = await this.getReferralRewardsCollection()
    
    const result = await rewards.updateMany(
      { 
        _id: { $in: rewardIds.map(id => new ObjectId(id)) },
        status: 'pending'
      },
      {
        $set: {
          status: 'paid',
          payoutTransaction,
          paidAt: new Date()
        }
      }
    )
    
    return result.modifiedCount > 0
  }

  /**
   * Get referral leaderboard
   */
  static async getLeaderboard(limit: number = 10): Promise<Array<{
    rank: number
    code: string
    username?: string
    totalReferrals: number
    totalBurned: number
    totalRewards: number
  }>> {
    const codes = await this.getReferralCodesCollection()
    const db = await getDatabase()
    
    const topReferrers = await codes
      .find({ isActive: true })
      .sort({ totalRewards: -1 })
      .limit(limit)
      .toArray()
    
    // Get user details
    const userIds = topReferrers.map(r => {
      // Check if it's a valid ObjectId format
      if (typeof r.userId === 'string' && /^[a-f\d]{24}$/i.test(r.userId)) {
        try {
          return new ObjectId(r.userId)
        } catch {
          return r.userId
        }
      }
      return r.userId
    })
    
    // Separate ObjectIds from wallet addresses
    const objectIds = userIds.filter(id => id instanceof ObjectId)
    const walletAddresses = userIds.filter(id => typeof id === 'string')
    
    // Query for both ObjectIds and wallet addresses
    const users = await db.collection('users').find({
      $or: [
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
        ...(walletAddresses.length > 0 ? [{ walletAddress: { $in: walletAddresses } }] : [])
      ]
    }).toArray()
    
    // Create map with both _id and walletAddress as keys
    const userMap = new Map()
    users.forEach(u => {
      userMap.set(u._id.toString(), u)
      if (u.walletAddress) {
        userMap.set(u.walletAddress, u)
      }
    })
    
    return topReferrers.map((ref, index) => {
      const userIdStr = typeof ref.userId === 'object' ? ref.userId.toString() : ref.userId
      const user = userMap.get(userIdStr)
      return {
        rank: index + 1,
        code: ref.code,
        username: user?.username,
        totalReferrals: ref.totalReferrals,
        totalBurned: ref.totalBurned,
        totalRewards: ref.totalRewards
      }
    })
  }
}