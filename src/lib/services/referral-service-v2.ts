import { getDatabase } from '@/lib/mongodb'
import crypto from 'crypto'

interface SimpleReferralCode {
  _id?: unknown
  walletAddress: string
  code: string
  username?: string
  totalReferrals: number
  totalBurned: number
  totalRewards: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

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
   */
  static async getOrCreateReferralCode(
    walletAddress: string,
    username?: string
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      console.log(`[ReferralV2] Getting code for wallet: ${walletAddress}`)
      
      const db = await getDatabase()
      const collection = db.collection('referral_codes_v2')
      
      // Check for existing code
      const existing = await collection.findOne({ walletAddress })
      
      if (existing) {
        console.log(`[ReferralV2] Found existing code: ${existing.code}`)
        return {
          success: true,
          code: existing.code
        }
      }
      
      // Generate new code
      let code = this.generateCode(walletAddress, username)
      let attempts = 0
      
      // Ensure uniqueness
      while (await collection.findOne({ code }) && attempts < 10) {
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
      
      await collection.insertOne(newCode as any)
      console.log(`[ReferralV2] Created new code: ${code}`)
      
      return {
        success: true,
        code
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
   * Get referral stats
   */
  static async getReferralStats(walletAddress: string): Promise<{
    totalReferrals: number
    totalBurned: number
    totalRewards: number
  }> {
    try {
      const db = await getDatabase()
      const collection = db.collection('referral_codes_v2')
      
      const code = await collection.findOne({ walletAddress })
      
      if (!code) {
        return {
          totalReferrals: 0,
          totalBurned: 0,
          totalRewards: 0
        }
      }
      
      return {
        totalReferrals: code.totalReferrals || 0,
        totalBurned: code.totalBurned || 0,
        totalRewards: code.totalRewards || 0
      }
    } catch (error) {
      console.error('[ReferralV2] Error getting stats:', error)
      return {
        totalReferrals: 0,
        totalBurned: 0,
        totalRewards: 0
      }
    }
  }

  /**
   * Track a referral
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
      
      // Find the referral code
      const codeDoc = await codesCollection.findOne({ code: referralCode, isActive: true })
      
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
      
      // Create new relationship
      await relationshipsCollection.insertOne({
        referrerWallet: codeDoc.walletAddress,
        referredWallet,
        referralCode,
        burnAmount: burnAmount || 0,
        rewardAmount: (burnAmount || 0) * 0.2,
        createdAt: new Date()
      })
      
      // Update referral code stats
      await codesCollection.updateOne(
        { walletAddress: codeDoc.walletAddress },
        {
          $inc: {
            totalReferrals: 1,
            totalBurned: burnAmount || 0,
            totalRewards: (burnAmount || 0) * 0.2
          },
          $set: { updatedAt: new Date() }
        }
      )
      
      console.log(`[ReferralV2] Tracked referral successfully`)
      return true
    } catch (error) {
      console.error('[ReferralV2] Error tracking referral:', error)
      return false
    }
  }

  /**
   * Get referrer info from code
   */
  static async getReferrerInfo(code: string): Promise<{
    walletAddress?: string
    username?: string
  } | null> {
    try {
      const db = await getDatabase()
      const collection = db.collection('referral_codes_v2')
      
      const codeDoc = await collection.findOne({ code: code.toUpperCase(), isActive: true })
      
      if (!codeDoc) {
        return null
      }
      
      return {
        walletAddress: codeDoc.walletAddress,
        username: codeDoc.username
      }
    } catch (error) {
      console.error('[ReferralV2] Error getting referrer info:', error)
      return null
    }
  }
}