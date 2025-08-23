import { getDatabase } from '@/lib/mongodb'
import crypto from 'crypto'

export class ReferralServiceV2 {
  /**
   * Generate a unique referral code
   */
  static generateCode(walletAddress: string, username?: string): string {
    // Use username prefix if available, otherwise use last 4 chars of wallet
    const prefix = username 
      ? username.toUpperCase().slice(0, 4).padEnd(4, 'X')
      : walletAddress.slice(-4).toUpperCase()
    
    const random = crypto.randomBytes(3).toString('hex').toUpperCase()
    return `${prefix}${random}`
  }

  /**
   * Get or create referral code - simplified version
   * Returns username as code if available (vanity URL), otherwise generates a code
   */
  static async getOrCreateReferralCode(
    walletAddress: string,
    username?: string
  ): Promise<{ success: boolean; code?: string; isVanity?: boolean; error?: string }> {
    try {
      console.log(`[ReferralV2] Getting code for wallet: ${walletAddress}`)
      
      const db = await getDatabase()
      const collection = db.collection('referral_codes_v2')
      
      // First check if user has a username in the users collection
      const usersCollection = db.collection('users')
      const user = await usersCollection.findOne({ walletAddress })
      
      // If user has a username, that's their vanity referral code
      if (user?.username) {
        console.log(`[ReferralV2] Using username as vanity code: ${user.username}`)
        
        // Update or create referral code document with username
        await collection.updateOne(
          { walletAddress },
          {
            $set: {
              walletAddress,
              code: user.username,
              username: user.username,
              isVanity: true,
              updatedAt: new Date()
            },
            $setOnInsert: {
              totalReferrals: 0,
              totalBurned: 0,
              totalRewards: 0,
              isActive: true,
              createdAt: new Date()
            }
          },
          { upsert: true }
        )
        
        return {
          success: true,
          code: user.username,
          isVanity: true
        }
      }
      
      // Check for existing non-vanity code
      const existing = await collection.findOne({ walletAddress, isVanity: { $ne: true } })
      
      if (existing) {
        console.log(`[ReferralV2] Found existing code: ${existing.code}`)
        return {
          success: true,
          code: existing.code,
          isVanity: false
        }
      }
      
      // Generate new code
      let code = this.generateCode(walletAddress, username)
      let attempts = 0
      
      // Ensure uniqueness (case-insensitive check)
      while (await collection.findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') } }) && attempts < 10) {
        code = this.generateCode(walletAddress, username)
        attempts++
      }
      
      // Create new referral code document
      const newCode = {
        walletAddress,
        code,
        username,
        totalReferrals: 0,
        totalBurned: 0,
        totalRewards: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await collection.insertOne(newCode as Record<string, unknown>)
      console.log(`[ReferralV2] Created new code: ${code}`)
      
      return {
        success: true,
        code,
        isVanity: false
      }
    } catch (error) {
      console.error('[ReferralV2] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get referral stats including tier 2
   */
  static async getReferralStats(walletAddress: string): Promise<{
    totalReferrals: number
    totalBurned: number
    totalRewards: number
    totalTier2Referrals?: number
    totalTier2Rewards?: number
  }> {
    try {
      const db = await getDatabase()
      const collection = db.collection('referral_codes_v2')
      
      const code = await collection.findOne({ walletAddress })
      
      if (!code) {
        return {
          totalReferrals: 0,
          totalBurned: 0,
          totalRewards: 0,
          totalTier2Referrals: 0,
          totalTier2Rewards: 0
        }
      }
      
      return {
        totalReferrals: code.totalReferrals || 0,
        totalBurned: code.totalBurned || 0,
        totalRewards: code.totalRewards || 0,
        totalTier2Referrals: code.totalTier2Referrals || 0,
        totalTier2Rewards: code.totalTier2Rewards || 0
      }
    } catch (error) {
      console.error('[ReferralV2] Error getting stats:', error)
      return {
        totalReferrals: 0,
        totalBurned: 0,
        totalRewards: 0,
        totalTier2Referrals: 0,
        totalTier2Rewards: 0
      }
    }
  }

  /**
   * Track a referral with 2-tier reward system
   * 30% to direct referrer, 20% to referrer's referrer
   */
  static async trackReferral(
    referralCode: string,
    referredWallet: string,
    burnAmount?: number
  ): Promise<boolean> {
    try {
      const db = await getDatabase()
      const codesCollection = db.collection('referral_codes_v2')
      const relationshipsCollection = db.collection('referral_relationships_v2')
      
      // Find the referral code (tier 1 - direct referrer) - case-insensitive
      const codeDoc = await codesCollection.findOne({ 
        code: { $regex: new RegExp(`^${referralCode}$`, 'i') }, 
        isActive: true 
      })
      
      if (!codeDoc) {
        console.log(`[ReferralV2] Code not found: ${referralCode}`)
        return false
      }
      
      // Check if relationship already exists
      const existing = await relationshipsCollection.findOne({
        referrerWallet: codeDoc.walletAddress,
        referredWallet
      })
      
      if (existing) {
        console.log(`[ReferralV2] Relationship already exists`)
        return true
      }
      
      // Calculate rewards for 2-tier system
      const tier1Reward = (burnAmount || 0) * 0.3  // 30% to direct referrer
      const tier2Reward = (burnAmount || 0) * 0.2  // 20% to referrer's referrer
      
      // Find tier 2 referrer (the person who referred tier 1)
      let tier2ReferrerWallet = null
      const tier1Relationship = await relationshipsCollection.findOne({
        referredWallet: codeDoc.walletAddress
      })
      
      if (tier1Relationship) {
        tier2ReferrerWallet = tier1Relationship.referrerWallet
        console.log(`[ReferralV2] Found tier 2 referrer: ${tier2ReferrerWallet}`)
      }
      
      // Create new relationship with tier info
      await relationshipsCollection.insertOne({
        referrerWallet: codeDoc.walletAddress,
        referredWallet,
        referralCode,
        burnAmount: burnAmount || 0,
        rewardAmount: tier1Reward,
        tier: 1,
        tier2ReferrerWallet,
        tier2RewardAmount: tier2ReferrerWallet ? tier2Reward : 0,
        createdAt: new Date()
      })
      
      // Update tier 1 referral code stats
      await codesCollection.updateOne(
        { walletAddress: codeDoc.walletAddress },
        {
          $inc: {
            totalReferrals: 1,
            totalBurned: burnAmount || 0,
            totalRewards: tier1Reward
          },
          $set: { updatedAt: new Date() }
        }
      )
      
      // Update tier 2 referral code stats if exists
      if (tier2ReferrerWallet) {
        await codesCollection.updateOne(
          { walletAddress: tier2ReferrerWallet },
          {
            $inc: {
              totalTier2Referrals: 1,
              totalTier2Burned: burnAmount || 0,
              totalTier2Rewards: tier2Reward
            },
            $set: { updatedAt: new Date() }
          }
        )
        
        console.log(`[ReferralV2] Updated tier 2 referrer stats for: ${tier2ReferrerWallet}`)
      }
      
      console.log(`[ReferralV2] Tracked 2-tier referral successfully - Tier 1: ${tier1Reward} LYN, Tier 2: ${tier2ReferrerWallet ? tier2Reward : 0} LYN`)
      return true
    } catch (error) {
      console.error('[ReferralV2] Error tracking referral:', error)
      return false
    }
  }

  /**
   * Get referrer info from code (supports both regular codes and usernames)
   */
  static async getReferrerInfo(code: string): Promise<{
    walletAddress?: string
    username?: string
    isVanity?: boolean
  } | null> {
    try {
      const db = await getDatabase()
      const collection = db.collection('referral_codes_v2')
      
      // First try to find by exact code match (could be username or generated code)
      let codeDoc = await collection.findOne({ 
        code: code, 
        isActive: true 
      })
      
      // If not found, try uppercase version for generated codes
      if (!codeDoc) {
        codeDoc = await collection.findOne({ 
          code: code.toUpperCase(), 
          isActive: true 
        })
      }
      
      // If still not found, check if it's a username
      if (!codeDoc) {
        const usersCollection = db.collection('users')
        const user = await usersCollection.findOne({ username: code })
        if (user) {
          return {
            walletAddress: user.walletAddress,
            username: user.username,
            isVanity: true
          }
        }
        return null
      }
      
      return {
        walletAddress: codeDoc.walletAddress,
        username: codeDoc.username,
        isVanity: codeDoc.isVanity || false
      }
    } catch (error) {
      console.error('[ReferralV2] Error getting referrer info:', error)
      return null
    }
  }

  /**
   * Resolve referral chain (tier1 and optional tier2) from a referral code
   */
  static async getReferralChainByCode(code: string): Promise<{
    tier1Wallet?: string
    tier2Wallet?: string
  }> {
    const db = await getDatabase()
    const codes = db.collection('referral_codes_v2')
    const relationships = db.collection('referral_relationships_v2')

    // Case-insensitive code match
    const codeDoc = await codes.findOne({ code: { $regex: new RegExp(`^${code}$`, 'i') }, isActive: true })
    if (!codeDoc) return {}

    // Find tier2 by looking for who referred the tier1 wallet
    const tier1Wallet = codeDoc.walletAddress as string | undefined
    if (!tier1Wallet) return { tier1Wallet }

    const tier1Rel = await relationships.findOne({ referredWallet: tier1Wallet })
    const tier2Wallet = tier1Rel?.referrerWallet as string | undefined
    return { tier1Wallet, tier2Wallet }
  }

  /**
   * Resolve referral chain given a tier1 referrer wallet
   */
  static async getReferralChainByTier1Wallet(wallet: string): Promise<{
    tier1Wallet?: string
    tier2Wallet?: string
  }> {
    const db = await getDatabase()
    const relationships = db.collection('referral_relationships_v2')
    const tier1Rel = await relationships.findOne({ referredWallet: wallet })
    return { tier1Wallet: wallet, tier2Wallet: tier1Rel?.referrerWallet }
  }
}