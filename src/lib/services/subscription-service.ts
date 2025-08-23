import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { ReferralServiceV2 } from './referral-service-v2'
import { EnhancedSubscriptionService } from './enhanced-subscription-service'
import { CryptoPaymentService } from './crypto-payment-service'
import { SubscriptionTier, PaymentToken } from '@/lib/models/subscription'

export interface Subscription {
  _id?: ObjectId
  walletAddress: string
  userId?: string
  username?: string
  tier: 'premium' | 'basic'
  status: 'active' | 'expired' | 'cancelled'
  startDate: Date
  endDate: Date
  amount: number // in SOL
  transactionSignature: string
  referralCode?: string
  referrerWallet?: string
  tier1RewardAmount?: number
  tier2RewardAmount?: number
  createdAt: Date
  updatedAt: Date
}

export class SubscriptionService {
  static readonly SUBSCRIPTION_PRICE_SOL = 0.5
  static readonly SUBSCRIPTION_DURATION_DAYS = 30
  static readonly TIER1_REFERRAL_RATE = 0.20 // 20% to direct referrer
  static readonly TIER2_REFERRAL_RATE = 0.10 // 10% to referrer's referrer
  // Agent gets remaining 80%
  
  // Agent wallet for receiving SOL payments (85% of subscription)
  static readonly AGENT_WALLET = process.env.NEXT_PUBLIC_AGENT_WALLET || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq'
  // Treasury wallet for overflow/admin
  static readonly TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq'

  // Enhanced service instance for new payment system
  private static enhancedService: EnhancedSubscriptionService | null = null

  /**
   * Initialize enhanced service (call this once with connection)
   */
  static initializeEnhancedService(connection: Connection): void {
    if (!this.enhancedService) {
      this.enhancedService = new EnhancedSubscriptionService(connection)
    }
  }

  /**
   * Check if enhanced service is available
   */
  static isEnhancedServiceAvailable(): boolean {
    return this.enhancedService !== null
  }

  /**
   * Create a new subscription
   */
  static async createSubscription(
    walletAddress: string,
    transactionSignature: string,
    referralCode?: string
  ): Promise<Subscription> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    const usersCollection = db.collection('users')
    
    // Get user info
    const user = await usersCollection.findOne({ walletAddress })
    
    // Calculate subscription dates
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + this.SUBSCRIPTION_DURATION_DAYS)
    
    // Handle referral rewards
    let referrerWallet: string | undefined
    let tier1RewardAmount = 0
    const tier2RewardAmount = 0
    
    if (referralCode) {
      // Get referrer info
      const referrerInfo = await ReferralServiceV2.getReferrerInfo(referralCode)
      
      if (referrerInfo?.walletAddress) {
        referrerWallet = referrerInfo.walletAddress
        tier1RewardAmount = this.SUBSCRIPTION_PRICE_SOL * this.TIER1_REFERRAL_RATE
        
        // Track the referral with the subscription amount
        await ReferralServiceV2.trackReferral(
          referralCode,
          walletAddress,
          this.SUBSCRIPTION_PRICE_SOL * LAMPORTS_PER_SOL // Convert to lamports for consistency
        )
        
        // Note: The actual SOL distribution:
        // - 10% (2 SOL) to direct referrer
        // - 10% (2 SOL) to referrer's referrer
        // - 80% (16 SOL) to Agent wallet
        // This tracking is for display/analytics
      }
    }
    
    // Create subscription record
    const subscription: Subscription = {
      walletAddress,
      userId: user?._id?.toString(),
      username: user?.username,
      tier: 'premium',
      status: 'active',
      startDate,
      endDate,
      amount: this.SUBSCRIPTION_PRICE_SOL,
      transactionSignature,
      referralCode,
      referrerWallet,
      tier1RewardAmount,
      tier2RewardAmount: referrerWallet ? this.SUBSCRIPTION_PRICE_SOL * this.TIER2_REFERRAL_RATE : 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Insert subscription
    await subscriptionsCollection.insertOne(subscription)
    
    // Update user's subscription status
    await usersCollection.updateOne(
      { walletAddress },
      {
        $set: {
          subscriptionStatus: 'active',
          subscriptionTier: 'premium',
          subscriptionEndDate: endDate,
          lastSubscriptionDate: startDate,
          updatedAt: new Date()
        }
      }
    )
    
    console.log(`[Subscription] Created subscription for ${walletAddress} - Tier 1 reward: ${tier1RewardAmount} SOL`)
    
    return subscription
  }

  /**
   * Check if a wallet has an active subscription
   */
  static async hasActiveSubscription(walletAddress: string): Promise<boolean> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    
    const activeSubscription = await subscriptionsCollection.findOne({
      walletAddress,
      status: 'active',
      endDate: { $gt: new Date() }
    })
    
    return !!activeSubscription
  }

  /**
   * Get subscription details for a wallet
   */
  static async getSubscription(walletAddress: string): Promise<Subscription | null> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    
    const subscription = await subscriptionsCollection.findOne(
      { walletAddress },
      { sort: { createdAt: -1 } }
    )
    
    return subscription as Subscription | null
  }

  /**
   * Get all subscriptions (admin)
   */
  static async getAllSubscriptions(limit = 100): Promise<Subscription[]> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    
    const subscriptions = await subscriptionsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
    
    return subscriptions as unknown as Subscription[]
  }

  /**
   * Update expired subscriptions
   */
  static async updateExpiredSubscriptions(): Promise<number> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    const usersCollection = db.collection('users')
    
    // Find all active subscriptions that have expired
    const expiredSubscriptions = await subscriptionsCollection.find({
      status: 'active',
      endDate: { $lt: new Date() }
    }).toArray()
    
    let updatedCount = 0
    
    for (const sub of expiredSubscriptions) {
      // Update subscription status
      await subscriptionsCollection.updateOne(
        { _id: sub._id },
        {
          $set: {
            status: 'expired',
            updatedAt: new Date()
          }
        }
      )
      
      // Update user's subscription status
      await usersCollection.updateOne(
        { walletAddress: sub.walletAddress },
        {
          $set: {
            subscriptionStatus: 'expired',
            updatedAt: new Date()
          }
        }
      )
      
      updatedCount++
    }
    
    console.log(`[Subscription] Updated ${updatedCount} expired subscriptions`)
    return updatedCount
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(walletAddress: string): Promise<boolean> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    const usersCollection = db.collection('users')
    
    // Update subscription status
    const result = await subscriptionsCollection.updateOne(
      { walletAddress, status: 'active' },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      }
    )
    
    if (result.modifiedCount > 0) {
      // Update user's subscription status
      await usersCollection.updateOne(
        { walletAddress },
        {
          $set: {
            subscriptionStatus: 'cancelled',
            updatedAt: new Date()
          }
        }
      )
      
      return true
    }
    
    return false
  }

  /**
   * Get subscription statistics
   */
  static async getSubscriptionStats(): Promise<{
    totalSubscriptions: number
    activeSubscriptions: number
    expiredSubscriptions: number
    totalRevenue: number
    totalReferralRewards: number
    averageSubscriptionLength: number
  }> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    
    const [total, active, expired] = await Promise.all([
      subscriptionsCollection.countDocuments({}),
      subscriptionsCollection.countDocuments({ status: 'active' }),
      subscriptionsCollection.countDocuments({ status: 'expired' })
    ])
    
    // Calculate total revenue and rewards
    const allSubscriptions = await subscriptionsCollection.find({}).toArray()
    
    const totalRevenue = allSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0)
    const totalReferralRewards = allSubscriptions.reduce(
      (sum, sub) => sum + (sub.tier1RewardAmount || 0) + (sub.tier2RewardAmount || 0),
      0
    )
    
    // Calculate average subscription length
    const completedSubscriptions = allSubscriptions.filter(sub => 
      sub.status === 'expired' || sub.status === 'cancelled'
    )
    
    let averageLength = 30 // default to 30 days
    if (completedSubscriptions.length > 0) {
      const totalDays = completedSubscriptions.reduce((sum, sub) => {
        const start = new Date(sub.startDate).getTime()
        const end = sub.status === 'cancelled' 
          ? new Date(sub.updatedAt).getTime()
          : new Date(sub.endDate).getTime()
        return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24))
      }, 0)
      averageLength = Math.floor(totalDays / completedSubscriptions.length)
    }
    
    return {
      totalSubscriptions: total,
      activeSubscriptions: active,
      expiredSubscriptions: expired,
      totalRevenue,
      totalReferralRewards,
      averageSubscriptionLength: averageLength
    }
  }

  /**
   * Verify SOL payment transaction
   */
  static async verifyPayment(
    connection: Connection,
    signature: string,
    expectedAmount: number = this.SUBSCRIPTION_PRICE_SOL
  ): Promise<boolean> {
    try {
      const transaction = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })
      
      if (!transaction || !transaction.meta) {
        return false
      }
      
      // Check if transaction was successful
      if (transaction.meta.err !== null) {
        return false
      }
      
      // Get the agent wallet public key (primary recipient)
      const agentPubkey = new PublicKey(this.AGENT_WALLET)
      
      // Check post balances to verify payment
      const accountKeys = transaction.transaction.message.getAccountKeys()
      const agentIndex = accountKeys.staticAccountKeys.findIndex(
        key => key.equals(agentPubkey)
      )
      
      if (agentIndex === -1) {
        return false
      }
      
      // Calculate the amount received by agent wallet
      const preBalance = transaction.meta.preBalances[agentIndex]
      const postBalance = transaction.meta.postBalances[agentIndex]
      const amountReceived = (postBalance - preBalance) / LAMPORTS_PER_SOL
      
      // Verify amount (allow small difference for fees)
      return amountReceived >= expectedAmount * 0.99
    } catch (error) {
      console.error('[Subscription] Error verifying payment:', error)
      return false
    }
  }

  /**
   * Verify SOL payment where amount is distributed across agent, fee wallet, and optional referrer
   */
  static async verifyDistributedPayment(
    connection: Connection,
    signature: string,
    expectedAmount: number = this.SUBSCRIPTION_PRICE_SOL,
    referralCode?: string
  ): Promise<boolean> {
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      if (!tx || !tx.meta) return false
      if (tx.meta.err !== null) return false

      const accountKeys = tx.transaction.message.getAccountKeys()

      const agentAddress = this.AGENT_WALLET
      const feeAddress = process.env.NEXT_PUBLIC_FEE_WALLET || 'LYNAIfees111111111111111111111111111111111'

      let referrerWallet: string | undefined
      if (referralCode) {
        try {
          const refInfo = await ReferralServiceV2.getReferrerInfo(referralCode)
          if (refInfo?.walletAddress) {
            referrerWallet = refInfo.walletAddress
          }
        } catch {
          // ignore
        }
      }

      const indexOf = (address: string) => {
        try {
          return accountKeys.staticAccountKeys.findIndex(k => k.toBase58() === address)
        } catch {
          return -1
        }
      }

      const agentIndex = indexOf(agentAddress)
      const feeIndex = indexOf(feeAddress)
      const refIndex = referrerWallet ? indexOf(referrerWallet) : -1

      const getDelta = (idx: number) => idx >= 0 ? (tx.meta!.postBalances[idx] - tx.meta!.preBalances[idx]) / LAMPORTS_PER_SOL : 0

      const agentDelta = getDelta(agentIndex)
      const feeDelta = getDelta(feeIndex)
      const refDelta = getDelta(refIndex)

      const hasReferral = !!referrerWallet
      const expectedFee = expectedAmount * 0.05
      const expectedRef = hasReferral ? expectedAmount * 0.20 : 0
      const expectedAgent = expectedAmount - expectedFee - expectedRef

      const within = (value: number, target: number) => Math.abs(value - target) <= Math.max(0.0005, target * 0.02) // ~2% tolerance or 0.0005 SOL

      const agentOk = within(agentDelta, expectedAgent)
      const feeOk = within(feeDelta, expectedFee)
      const refOk = hasReferral ? within(refDelta, expectedRef) : true

      const totalReceived = agentDelta + feeDelta + refDelta
      const totalOk = within(totalReceived, expectedAmount)

      return agentOk && feeOk && refOk && totalOk
    } catch (error) {
      console.error('[Subscription] Error verifying distributed payment:', error)
      return false
    }
  }

  /**
   * Create subscription using enhanced payment system (new method)
   */
  static async createEnhancedSubscription(
    walletAddress: string,
    tier: SubscriptionTier = SubscriptionTier.PRO, // Default to Pro for backward compatibility
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    token: PaymentToken = PaymentToken.SOL,
    paymentReference: string,
    transactionSignature: string,
    referralCode?: string
  ): Promise<any> {
    if (!this.enhancedService) {
      throw new Error('Enhanced service not initialized. Call initializeEnhancedService() first.')
    }

    return this.enhancedService.confirmSubscriptionPayment(
      paymentReference,
      transactionSignature,
      tier,
      billingCycle,
      referralCode
    )
  }

  /**
   * Get subscription status with enhanced system fallback
   */
  static async getEnhancedSubscriptionStatus(walletAddress: string): Promise<{
    hasActiveSubscription: boolean
    subscription: any | null
    isLegacy: boolean
  }> {
    // Try enhanced system first
    if (this.enhancedService) {
      const enhancedSubscription = await this.enhancedService.getActiveSubscription(walletAddress)
      if (enhancedSubscription) {
        return {
          hasActiveSubscription: true,
          subscription: enhancedSubscription,
          isLegacy: false
        }
      }
    }

    // Fall back to legacy system
    const hasActive = await this.hasActiveSubscription(walletAddress)
    const legacySubscription = await this.getSubscription(walletAddress)

    return {
      hasActiveSubscription: hasActive,
      subscription: legacySubscription,
      isLegacy: true
    }
  }

  /**
   * Migrate legacy subscription to enhanced system
   */
  static async migrateLegacySubscription(
    walletAddress: string,
    connection: Connection
  ): Promise<{
    success: boolean
    newSubscription?: any
    error?: string
  }> {
    try {
      if (!this.enhancedService) {
        this.initializeEnhancedService(connection)
      }

      // Get legacy subscription
      const legacySubscription = await this.getSubscription(walletAddress)
      if (!legacySubscription) {
        return { success: false, error: 'No legacy subscription found' }
      }

      if (legacySubscription.status !== 'active') {
        return { success: false, error: 'Legacy subscription is not active' }
      }

      // Create equivalent enhanced subscription
      const db = await getDatabase()
      const enhancedSubscriptionsCollection = db.collection('subscriptions')

      // Map legacy tier to new tier system
      const tier = legacySubscription.tier === 'premium' ? SubscriptionTier.PRO : SubscriptionTier.BASIC

      const enhancedSubscription = {
        walletAddress: legacySubscription.walletAddress,
        userId: legacySubscription.userId,
        username: legacySubscription.username,
        tier,
        status: 'active',
        paymentToken: PaymentToken.SOL,
        startDate: legacySubscription.startDate,
        endDate: legacySubscription.endDate,
        billingCycle: 'monthly',
        amount: legacySubscription.amount,
        paymentReference: `LEGACY-${legacySubscription.transactionSignature}`,
        transactionSignature: legacySubscription.transactionSignature,
        paymentMethod: 'crypto_transfer',
        autoRenewal: false, // Disable auto-renewal for migrated subscriptions
        gracePeriodEnd: new Date(legacySubscription.endDate.getTime() + (3 * 24 * 60 * 60 * 1000)), // 3-day grace period
        referralCode: legacySubscription.referralCode,
        referrerWallet: legacySubscription.referrerWallet,
        tier1RewardAmount: legacySubscription.tier1RewardAmount,
        tier2RewardAmount: legacySubscription.tier2RewardAmount,
        createdAt: legacySubscription.createdAt,
        updatedAt: new Date(),
        lastPaymentAt: legacySubscription.createdAt,
        migrated: true,
        originalLegacyId: legacySubscription._id,
        usageStats: {
          scansUsed: 0,
          apiCallsUsed: 0,
          lastResetDate: new Date()
        }
      }

      // Insert enhanced subscription
      const result = await enhancedSubscriptionsCollection.insertOne(enhancedSubscription)

      // Mark legacy subscription as migrated (don't delete for audit trail)
      const legacyCollection = db.collection('legacy_subscriptions')
      await legacyCollection.updateOne(
        { walletAddress },
        { 
          $set: { 
            migrated: true, 
            migratedAt: new Date(),
            newSubscriptionId: result.insertedId
          } 
        }
      )

      console.log(`[Subscription] Successfully migrated legacy subscription for ${walletAddress}`)

      return {
        success: true,
        newSubscription: { ...enhancedSubscription, _id: result.insertedId }
      }

    } catch (error) {
      console.error('[Subscription] Error migrating legacy subscription:', error)
      return { 
        success: false, 
        error: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Get subscription tiers for backward compatibility
   */
  static getSubscriptionTiers(): any[] {
    if (this.enhancedService) {
      return this.enhancedService.getAvailableTiers()
    }

    // Fallback to legacy tier information
    return [
      {
        tier: 'basic',
        name: 'Basic',
        description: 'Basic subscription features',
        features: ['Basic wallet scanning', 'Community support'],
        pricing: {
          monthly: { SOL: this.SUBSCRIPTION_PRICE_SOL, USDC: 30 },
          yearly: { SOL: this.SUBSCRIPTION_PRICE_SOL * 10, USDC: 300, discountPercent: 17 }
        },
        limits: {
          maxScans: 50,
          maxWallets: 5,
          maxTasks: 10,
          apiCallsPerMonth: 1000
        }
      }
    ]
  }

  /**
   * Enhanced subscription statistics that combines legacy and new data
   */
  static async getEnhancedSubscriptionStats(): Promise<{
    totalSubscriptions: number
    activeSubscriptions: number
    expiredSubscriptions: number
    totalRevenue: { SOL: number; USDC: number }
    totalReferralRewards: { SOL: number; USDC: number }
    averageSubscriptionLength: number
    legacySubscriptions: number
    migratedSubscriptions: number
  }> {
    const db = await getDatabase()
    
    // Get legacy stats
    const legacyStats = await this.getSubscriptionStats()

    // Get enhanced stats if available
    let enhancedStats = {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      expiredSubscriptions: 0,
      totalRevenue: { SOL: 0, USDC: 0, usd: 0 },
      averageSubscriptionLength: 30,
      tierDistribution: {},
      churnRate: 0,
      renewalRate: 0,
      totalReferralRewards: { SOL: 0, USDC: 0, usd: 0 }
    }

    if (this.enhancedService) {
      enhancedStats = await this.enhancedService.getSubscriptionAnalytics()
    }

    // Count migrated subscriptions
    const migratedCount = await db.collection('subscriptions').countDocuments({ migrated: true })

    return {
      totalSubscriptions: legacyStats.totalSubscriptions + enhancedStats.totalSubscriptions,
      activeSubscriptions: legacyStats.activeSubscriptions + enhancedStats.activeSubscriptions,
      expiredSubscriptions: legacyStats.expiredSubscriptions + enhancedStats.expiredSubscriptions,
      totalRevenue: {
        SOL: legacyStats.totalRevenue + enhancedStats.totalRevenue.SOL,
        USDC: enhancedStats.totalRevenue.USDC
      },
      totalReferralRewards: {
        SOL: legacyStats.totalReferralRewards + enhancedStats.totalReferralRewards.SOL,
        USDC: enhancedStats.totalReferralRewards.USDC
      },
      averageSubscriptionLength: Math.round(
        (legacyStats.averageSubscriptionLength + enhancedStats.averageSubscriptionLength) / 2
      ),
      legacySubscriptions: legacyStats.totalSubscriptions - migratedCount,
      migratedSubscriptions: migratedCount
    }
  }
}