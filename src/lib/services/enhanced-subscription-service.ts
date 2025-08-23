import { getDatabase } from '@/lib/mongodb'
import { Connection } from '@solana/web3.js'
import { ObjectId } from 'mongodb'
import { 
  Subscription, 
  SubscriptionTier, 
  SubscriptionStatus, 
  PaymentToken, 
  PaymentTransaction,
  PaymentMethod,
  SubscriptionAnalytics,
  PaymentInvoice,
  WebhookEvent
} from '@/lib/models/subscription'
import { CryptoPaymentService } from './crypto-payment-service'
import { PaymentVerificationService } from './payment-verification-service'
import { ReferralServiceV2 } from './referral-service-v2'

export class EnhancedSubscriptionService {
  private paymentService: CryptoPaymentService
  private verificationService: PaymentVerificationService

  constructor(connection: Connection) {
    this.paymentService = CryptoPaymentService.getInstance(connection)
    this.verificationService = new PaymentVerificationService(connection)
  }

  /**
   * Get available subscription tiers with pricing
   */
  getAvailableTiers(): Array<{
    tier: SubscriptionTier
    name: string
    description: string
    features: string[]
    pricing: {
      monthly: { SOL: number; USDC: number }
      yearly: { SOL: number; USDC: number; discountPercent: number }
    }
    limits: any
  }> {
    return this.paymentService['getPaymentConfig']().tiers
  }

  /**
   * Create a subscription payment request
   */
  async createSubscriptionPaymentRequest(
    walletAddress: string,
    tier: SubscriptionTier,
    billingCycle: 'monthly' | 'yearly',
    token: PaymentToken,
    referralCode?: string
  ): Promise<{
    paymentReference: string
    amount: number
    token: PaymentToken
    recipientAddress: string
    description: string
    expiresAt: Date
  }> {
    // Get tier pricing
    const pricing = this.paymentService.getTierPricing(tier, billingCycle)
    const amount = pricing[token]

    if (!amount) {
      throw new Error(`Price not available for tier ${tier} in ${token}`)
    }

    // Create payment transaction record
    const paymentTransaction = await this.paymentService.createPaymentTransaction(
      walletAddress,
      amount,
      token,
      PaymentMethod.CRYPTO_TRANSFER,
      `${tier.charAt(0).toUpperCase() + tier.slice(1)} subscription (${billingCycle})`
    )

    // Calculate expiration (30 minutes)
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 30)

    // Get recipient address (agent wallet)
    const config = this.paymentService['getPaymentConfig']()
    
    return {
      paymentReference: paymentTransaction.paymentReference,
      amount,
      token,
      recipientAddress: config.wallets.agent,
      description: paymentTransaction.description,
      expiresAt
    }
  }

  /**
   * Confirm subscription payment and create subscription
   */
  async confirmSubscriptionPayment(
    paymentReference: string,
    transactionSignature: string,
    tier: SubscriptionTier,
    billingCycle: 'monthly' | 'yearly',
    referralCode?: string
  ): Promise<{
    success: boolean
    subscription?: Subscription
    error?: string
  }> {
    try {
      // Get payment transaction
      const payment = await this.paymentService.getPaymentTransaction(paymentReference)
      if (!payment) {
        return { success: false, error: 'Payment reference not found' }
      }

      // Confirm payment
      const confirmationResult = await this.paymentService.confirmPayment(
        paymentReference,
        transactionSignature
      )

      if (!confirmationResult.success) {
        return { success: false, error: confirmationResult.error }
      }

      // Check if user already has active subscription
      const existingSubscription = await this.getActiveSubscription(payment.walletAddress)
      if (existingSubscription) {
        return { success: false, error: 'User already has an active subscription' }
      }

      // Create subscription
      const subscription = await this.createSubscription({
        walletAddress: payment.walletAddress,
        tier,
        billingCycle,
        paymentToken: payment.token,
        amount: payment.amount,
        paymentReference,
        transactionSignature,
        referralCode,
        autoRenewal: true // Default to auto-renewal
      })

      // Trigger webhook event
      await this.triggerWebhookEvent('subscription.created', {
        subscriptionId: subscription._id,
        walletAddress: subscription.walletAddress,
        tier: subscription.tier,
        amount: subscription.amount,
        token: subscription.paymentToken
      })

      return { success: true, subscription }

    } catch (error) {
      console.error('Error confirming subscription payment:', error)
      return { 
        success: false, 
        error: `Failed to confirm subscription payment: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Create a new subscription
   */
  private async createSubscription(params: {
    walletAddress: string
    tier: SubscriptionTier
    billingCycle: 'monthly' | 'yearly'
    paymentToken: PaymentToken
    amount: number
    paymentReference: string
    transactionSignature: string
    referralCode?: string
    autoRenewal: boolean
  }): Promise<Subscription> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    const usersCollection = db.collection('users')

    // Get user info
    const user = await usersCollection.findOne({ walletAddress: params.walletAddress })

    // Calculate subscription dates
    const startDate = new Date()
    const endDate = new Date()
    
    if (params.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1)
    } else {
      endDate.setMonth(endDate.getMonth() + 1)
    }

    // Calculate next billing date (same as end date for now)
    const nextBillingDate = new Date(endDate)

    // Handle referral rewards
    let referrerWallet: string | undefined
    let tier1RewardAmount = 0
    let tier2RewardAmount = 0

    if (params.referralCode) {
      const referrerInfo = await ReferralServiceV2.getReferrerInfo(params.referralCode)
      
      if (referrerInfo?.walletAddress) {
        referrerWallet = referrerInfo.walletAddress
        const config = this.paymentService['getPaymentConfig']()
        tier1RewardAmount = params.amount * (config.fees.referralTier1Percent / 100)
        tier2RewardAmount = params.amount * (config.fees.referralTier2Percent / 100)
        
        // Track the referral
        await ReferralServiceV2.trackReferral(
          params.referralCode,
          params.walletAddress,
          params.amount
        )
      }
    }

    // Calculate grace period end
    const gracePeriodEnd = new Date(endDate)
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3) // 3-day grace period

    // Create subscription record
    const subscription: Subscription = {
      walletAddress: params.walletAddress,
      userId: user?._id?.toString(),
      username: user?.username,
      tier: params.tier,
      status: SubscriptionStatus.ACTIVE,
      paymentToken: params.paymentToken,
      startDate,
      endDate,
      billingCycle: params.billingCycle,
      amount: params.amount,
      paymentReference: params.paymentReference,
      transactionSignature: params.transactionSignature,
      paymentMethod: PaymentMethod.CRYPTO_TRANSFER,
      autoRenewal: params.autoRenewal,
      nextBillingDate,
      gracePeriodEnd,
      referralCode: params.referralCode,
      referrerWallet,
      tier1RewardAmount,
      tier2RewardAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastPaymentAt: new Date(),
      usageStats: {
        scansUsed: 0,
        apiCallsUsed: 0,
        lastResetDate: new Date()
      }
    }

    // Insert subscription
    const result = await subscriptionsCollection.insertOne(subscription)
    subscription._id = result.insertedId

    // Update user's subscription status
    await usersCollection.updateOne(
      { walletAddress: params.walletAddress },
      {
        $set: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionTier: params.tier,
          subscriptionEndDate: endDate,
          lastSubscriptionDate: startDate,
          updatedAt: new Date()
        }
      }
    )

    console.log(`[Enhanced Subscription] Created ${params.tier} subscription for ${params.walletAddress}`)
    return subscription
  }

  /**
   * Get active subscription for a wallet
   */
  async getActiveSubscription(walletAddress: string): Promise<Subscription | null> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')

    const subscription = await subscriptionsCollection.findOne({
      walletAddress,
      status: SubscriptionStatus.ACTIVE,
      $or: [
        { endDate: { $gt: new Date() } },
        { gracePeriodEnd: { $gt: new Date() } }
      ]
    })

    return subscription as Subscription | null
  }

  /**
   * Get subscription history for a wallet
   */
  async getSubscriptionHistory(walletAddress: string): Promise<Subscription[]> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')

    const subscriptions = await subscriptionsCollection
      .find({ walletAddress })
      .sort({ createdAt: -1 })
      .toArray()

    return subscriptions as unknown as Subscription[]
  }

  /**
   * Update subscription tier (upgrade/downgrade)
   */
  async updateSubscriptionTier(
    walletAddress: string,
    newTier: SubscriptionTier,
    paymentReference: string,
    transactionSignature: string
  ): Promise<{
    success: boolean
    subscription?: Subscription
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const subscriptionsCollection = db.collection('subscriptions')
      const usersCollection = db.collection('users')

      // Get current subscription
      const currentSubscription = await this.getActiveSubscription(walletAddress)
      if (!currentSubscription) {
        return { success: false, error: 'No active subscription found' }
      }

      // Verify payment for tier change
      const payment = await this.paymentService.getPaymentTransaction(paymentReference)
      if (!payment) {
        return { success: false, error: 'Payment reference not found' }
      }

      const confirmationResult = await this.paymentService.confirmPayment(
        paymentReference,
        transactionSignature
      )

      if (!confirmationResult.success) {
        return { success: false, error: confirmationResult.error }
      }

      // Update subscription tier
      const updateResult = await subscriptionsCollection.updateOne(
        { _id: currentSubscription._id },
        {
          $set: {
            tier: newTier,
            updatedAt: new Date(),
            lastPaymentAt: new Date()
          }
        }
      )

      // Update user record
      await usersCollection.updateOne(
        { walletAddress },
        {
          $set: {
            subscriptionTier: newTier,
            updatedAt: new Date()
          }
        }
      )

      if (updateResult.modifiedCount === 0) {
        return { success: false, error: 'Failed to update subscription' }
      }

      const updatedSubscription = await this.getActiveSubscription(walletAddress)

      // Trigger webhook event
      await this.triggerWebhookEvent('subscription.tier_changed', {
        subscriptionId: currentSubscription._id,
        walletAddress,
        oldTier: currentSubscription.tier,
        newTier,
        amount: payment.amount,
        token: payment.token
      })

      return { success: true, subscription: updatedSubscription! }

    } catch (error) {
      console.error('Error updating subscription tier:', error)
      return { 
        success: false, 
        error: `Failed to update subscription tier: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    walletAddress: string,
    reason?: string
  ): Promise<{
    success: boolean
    subscription?: Subscription
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const subscriptionsCollection = db.collection('subscriptions')
      const usersCollection = db.collection('users')

      const currentSubscription = await this.getActiveSubscription(walletAddress)
      if (!currentSubscription) {
        return { success: false, error: 'No active subscription found' }
      }

      // Update subscription status
      const updateResult = await subscriptionsCollection.updateOne(
        { _id: currentSubscription._id },
        {
          $set: {
            status: SubscriptionStatus.CANCELLED,
            autoRenewal: false,
            cancelledAt: new Date(),
            updatedAt: new Date()
          }
        }
      )

      // Update user record
      await usersCollection.updateOne(
        { walletAddress },
        {
          $set: {
            subscriptionStatus: SubscriptionStatus.CANCELLED,
            updatedAt: new Date()
          }
        }
      )

      if (updateResult.modifiedCount === 0) {
        return { success: false, error: 'Failed to cancel subscription' }
      }

      const cancelledSubscription = await subscriptionsCollection.findOne({ _id: currentSubscription._id })

      // Trigger webhook event
      await this.triggerWebhookEvent('subscription.cancelled', {
        subscriptionId: currentSubscription._id,
        walletAddress,
        tier: currentSubscription.tier,
        reason
      })

      return { success: true, subscription: cancelledSubscription as Subscription }

    } catch (error) {
      console.error('Error cancelling subscription:', error)
      return { 
        success: false, 
        error: `Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Process subscription renewals
   */
  async processSubscriptionRenewals(): Promise<{
    processed: number
    renewed: number
    failed: number
    expired: number
  }> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    const usersCollection = db.collection('users')

    let processed = 0
    let renewed = 0
    let failed = 0
    let expired = 0

    try {
      // Find subscriptions that need renewal
      const subscriptionsNeedingRenewal = await subscriptionsCollection.find({
        status: SubscriptionStatus.ACTIVE,
        autoRenewal: true,
        nextBillingDate: { $lte: new Date() }
      }).toArray()

      for (const subscription of subscriptionsNeedingRenewal) {
        processed++
        
        try {
          // For now, mark as expired since we don't have automated payment collection
          // In a full implementation, this would attempt to charge the user's payment method
          
          const isInGracePeriod = subscription.gracePeriodEnd && new Date() <= subscription.gracePeriodEnd
          
          if (isInGracePeriod) {
            // Keep active but notify user
            console.log(`Subscription ${subscription._id} is in grace period`)
            continue
          }

          // Expire the subscription
          await subscriptionsCollection.updateOne(
            { _id: subscription._id },
            {
              $set: {
                status: SubscriptionStatus.EXPIRED,
                autoRenewal: false,
                updatedAt: new Date()
              }
            }
          )

          await usersCollection.updateOne(
            { walletAddress: subscription.walletAddress },
            {
              $set: {
                subscriptionStatus: SubscriptionStatus.EXPIRED,
                updatedAt: new Date()
              }
            }
          )

          // Trigger webhook event
          await this.triggerWebhookEvent('subscription.expired', {
            subscriptionId: subscription._id,
            walletAddress: subscription.walletAddress,
            tier: subscription.tier
          })

          expired++

        } catch (error) {
          console.error(`Error processing renewal for subscription ${subscription._id}:`, error)
          failed++
        }
      }

      console.log(`[Enhanced Subscription] Renewal processing complete: ${processed} processed, ${renewed} renewed, ${failed} failed, ${expired} expired`)
      
      return { processed, renewed, failed, expired }

    } catch (error) {
      console.error('Error processing subscription renewals:', error)
      return { processed, renewed, failed, expired }
    }
  }

  /**
   * Get subscription analytics
   */
  async getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')

    // Get basic counts
    const [total, active, expired, cancelled] = await Promise.all([
      subscriptionsCollection.countDocuments({}),
      subscriptionsCollection.countDocuments({ status: SubscriptionStatus.ACTIVE }),
      subscriptionsCollection.countDocuments({ status: SubscriptionStatus.EXPIRED }),
      subscriptionsCollection.countDocuments({ status: SubscriptionStatus.CANCELLED })
    ])

    // Get tier distribution
    const tierDistribution = await subscriptionsCollection.aggregate([
      { $match: { status: SubscriptionStatus.ACTIVE } },
      { $group: { _id: '$tier', count: { $sum: 1 } } }
    ]).toArray()

    const tierCounts = {
      [SubscriptionTier.BASIC]: 0,
      [SubscriptionTier.PRO]: 0,
      [SubscriptionTier.ENTERPRISE]: 0
    }

    tierDistribution.forEach(item => {
      tierCounts[item._id as SubscriptionTier] = item.count
    })

    // Get revenue by token
    const revenueByToken = await subscriptionsCollection.aggregate([
      { $match: { status: { $ne: SubscriptionStatus.CANCELLED } } },
      { $group: { _id: '$paymentToken', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]).toArray()

    const totalRevenue = { SOL: 0, USDC: 0, usd: 0 }
    const averageSubscriptionValue = { SOL: 0, USDC: 0, usd: 0 }

    revenueByToken.forEach(item => {
      const token = item._id as PaymentToken
      totalRevenue[token] = item.total
      averageSubscriptionValue[token] = item.total / item.count
    })

    // Calculate churn and renewal rates
    const completedSubscriptions = await subscriptionsCollection.find({
      status: { $in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED] }
    }).toArray()

    const totalCompleted = completedSubscriptions.length
    const cancelledCount = completedSubscriptions.filter(s => s.status === SubscriptionStatus.CANCELLED).length
    const churnRate = totalCompleted > 0 ? (cancelledCount / totalCompleted) * 100 : 0
    const renewalRate = 100 - churnRate

    // Calculate average subscription length
    let averageLength = 30 // default
    if (completedSubscriptions.length > 0) {
      const totalDays = completedSubscriptions.reduce((sum, sub) => {
        const start = new Date(sub.startDate).getTime()
        const end = sub.status === SubscriptionStatus.CANCELLED && sub.cancelledAt
          ? new Date(sub.cancelledAt).getTime()
          : new Date(sub.endDate).getTime()
        return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24))
      }, 0)
      averageLength = Math.floor(totalDays / completedSubscriptions.length)
    }

    // Calculate referral rewards (simplified)
    const totalReferralRewards = { SOL: 0, USDC: 0, usd: 0 }

    return {
      totalSubscriptions: total,
      activeSubscriptions: active,
      expiredSubscriptions: expired,
      cancelledSubscriptions: cancelled,
      totalRevenue,
      tierDistribution: tierCounts,
      averageSubscriptionValue,
      averageSubscriptionLength: averageLength,
      churnRate,
      renewalRate,
      totalReferralRewards
    }
  }

  /**
   * Trigger webhook event
   */
  private async triggerWebhookEvent(
    eventType: WebhookEvent['eventType'],
    data: any
  ): Promise<void> {
    try {
      const db = await getDatabase()
      const webhooksCollection = db.collection('webhook_events')

      const webhookEvent: WebhookEvent = {
        eventId: crypto.randomUUID(),
        eventType,
        data,
        deliveryStatus: 'pending',
        deliveryAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await webhooksCollection.insertOne(webhookEvent)
      console.log(`[Enhanced Subscription] Webhook event created: ${eventType}`)

    } catch (error) {
      console.error('Error creating webhook event:', error)
    }
  }

  /**
   * Check subscription limits and usage
   */
  async checkSubscriptionLimits(
    walletAddress: string,
    resource: 'scans' | 'apiCalls' | 'wallets' | 'tasks'
  ): Promise<{
    allowed: boolean
    limit: number
    used: number
    remaining: number
    tier: SubscriptionTier
  }> {
    const subscription = await this.getActiveSubscription(walletAddress)
    
    if (!subscription) {
      return {
        allowed: false,
        limit: 0,
        used: 0,
        remaining: 0,
        tier: SubscriptionTier.BASIC
      }
    }

    const tierConfig = this.getAvailableTiers().find(t => t.tier === subscription.tier)
    if (!tierConfig) {
      return {
        allowed: false,
        limit: 0,
        used: 0,
        remaining: 0,
        tier: subscription.tier
      }
    }

    // Get limits for the resource
    const limits = tierConfig.limits
    let limit = 0
    let used = 0

    switch (resource) {
      case 'scans':
        limit = limits.maxScans || 0
        used = subscription.usageStats?.scansUsed || 0
        break
      case 'apiCalls':
        limit = limits.apiCallsPerMonth || 0
        used = subscription.usageStats?.apiCallsUsed || 0
        break
      case 'wallets':
        limit = limits.maxWallets || 0
        // Would need to query actual wallet count
        break
      case 'tasks':
        limit = limits.maxTasks || 0
        // Would need to query actual task count
        break
    }

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        limit: -1,
        used,
        remaining: -1,
        tier: subscription.tier
      }
    }

    return {
      allowed: used < limit,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      tier: subscription.tier
    }
  }
}

// Import crypto for UUID generation
import crypto from 'crypto'