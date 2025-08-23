import { getDatabase } from '@/lib/mongodb'
import { Connection } from '@solana/web3.js'
import { ObjectId } from 'mongodb'
import { 
  Subscription, 
  SubscriptionStatus, 
  PaymentToken, 
  SubscriptionTier 
} from '@/lib/models/subscription'
import { EnhancedSubscriptionService } from './enhanced-subscription-service'
import { WebhookService } from './webhook-service'
import { InvoiceService } from './invoice-service'
import { RefundService } from './refund-service'
import { NotificationService } from './notification-service'

export interface RenewalNotification {
  type: 'renewal_reminder' | 'grace_period_warning' | 'subscription_expired'
  daysUntilAction: number
  subscriptionId: ObjectId
  walletAddress: string
}

export interface SubscriptionUsageLimit {
  resource: 'scans' | 'apiCalls' | 'wallets' | 'tasks'
  limit: number
  used: number
  resetDate: Date
}

export class SubscriptionManagementService {
  private enhancedService: EnhancedSubscriptionService
  private refundService: RefundService

  constructor(connection: Connection) {
    this.enhancedService = new EnhancedSubscriptionService(connection)
    this.refundService = new RefundService(connection)
  }

  /**
   * Process subscription renewals with enhanced logic
   */
  async processSubscriptionRenewals(): Promise<{
    processed: number
    renewed: number
    expired: number
    gracePeriodActivated: number
    notificationsSent: number
    failed: number
  }> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    const usersCollection = db.collection('users')

    let processed = 0
    let renewed = 0
    let expired = 0
    let gracePeriodActivated = 0
    let notificationsSent = 0
    let failed = 0

    try {
      const now = new Date()
      
      // Get subscriptions that need attention
      const subscriptionsNeedingProcessing = await subscriptionsCollection.find({
        status: SubscriptionStatus.ACTIVE,
        $or: [
          { endDate: { $lte: now } }, // Already expired
          { nextBillingDate: { $lte: now } }, // Due for renewal
          { 
            endDate: { $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, // Expires within 7 days
            renewalReminderSent: { $ne: true }
          }
        ]
      }).toArray()

      console.log(`[Subscription Management] Found ${subscriptionsNeedingProcessing.length} subscriptions needing processing`)

      for (const subscription of subscriptionsNeedingProcessing) {
        processed++

        try {
          const subscriptionEndDate = new Date(subscription.endDate)
          const gracePeriodEnd = new Date(subscription.gracePeriodEnd || subscriptionEndDate)
          
          if (now > gracePeriodEnd) {
            // Subscription has fully expired
            await this.expireSubscription(subscription)
            expired++
          } else if (now > subscriptionEndDate) {
            // Subscription is in grace period
            if (subscription.status === SubscriptionStatus.ACTIVE) {
              await this.activateGracePeriod(subscription)
              gracePeriodActivated++
            }
            
            // Send grace period warning
            await this.sendRenewalNotification(subscription, 'grace_period_warning')
            notificationsSent++
          } else {
            // Subscription is still active but approaching renewal
            const daysUntilExpiry = Math.floor((subscriptionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysUntilExpiry <= 7 && !subscription.renewalReminderSent) {
              await this.sendRenewalNotification(subscription, 'renewal_reminder')
              notificationsSent++
              
              // Mark reminder as sent
              await subscriptionsCollection.updateOne(
                { _id: subscription._id },
                { $set: { renewalReminderSent: true, updatedAt: new Date() } }
              )
            }
          }

        } catch (error) {
          console.error(`Error processing subscription ${subscription._id}:`, error)
          failed++
        }
      }

      // Process auto-renewal attempts for eligible subscriptions
      const autoRenewalResult = await this.processAutoRenewals()
      renewed = autoRenewalResult.successful

      console.log(`[Subscription Management] Processing complete: ${processed} processed, ${renewed} renewed, ${expired} expired, ${gracePeriodActivated} grace periods activated, ${notificationsSent} notifications sent, ${failed} failed`)

      return {
        processed,
        renewed,
        expired,
        gracePeriodActivated,
        notificationsSent,
        failed
      }

    } catch (error) {
      console.error('Error in subscription renewal processing:', error)
      return { processed, renewed, expired, gracePeriodActivated, notificationsSent, failed }
    }
  }

  /**
   * Expire a subscription completely
   */
  private async expireSubscription(subscription: any): Promise<void> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')
    const usersCollection = db.collection('users')

    // Update subscription status
    await subscriptionsCollection.updateOne(
      { _id: subscription._id },
      {
        $set: {
          status: SubscriptionStatus.EXPIRED,
          autoRenewal: false, // Disable auto-renewal on expiration
          updatedAt: new Date()
        }
      }
    )

    // Update user status
    await usersCollection.updateOne(
      { walletAddress: subscription.walletAddress },
      {
        $set: {
          subscriptionStatus: SubscriptionStatus.EXPIRED,
          updatedAt: new Date()
        }
      }
    )

    // Send expiration notification
    await this.sendRenewalNotification(subscription, 'subscription_expired')

    // Trigger webhook
    await WebhookService.createWebhookEvent('subscription.expired', {
      subscriptionId: subscription._id,
      walletAddress: subscription.walletAddress,
      tier: subscription.tier,
      endDate: subscription.endDate
    })

    console.log(`[Subscription Management] Expired subscription ${subscription._id} for wallet ${subscription.walletAddress}`)
  }

  /**
   * Activate grace period for a subscription
   */
  private async activateGracePeriod(subscription: any): Promise<void> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')

    // Update subscription to indicate grace period
    await subscriptionsCollection.updateOne(
      { _id: subscription._id },
      {
        $set: {
          status: SubscriptionStatus.ACTIVE, // Keep active during grace period
          inGracePeriod: true,
          updatedAt: new Date()
        }
      }
    )

    console.log(`[Subscription Management] Activated grace period for subscription ${subscription._id}`)
  }

  /**
   * Process auto-renewal attempts
   */
  private async processAutoRenewals(): Promise<{
    attempted: number
    successful: number
    failed: number
  }> {
    // For now, auto-renewal requires manual payment initiation
    // In a full implementation, this would attempt to charge saved payment methods
    
    console.log('[Subscription Management] Auto-renewal requires manual payment - sending notifications')
    
    return {
      attempted: 0,
      successful: 0,
      failed: 0
    }
  }

  /**
   * Send renewal notification
   */
  private async sendRenewalNotification(
    subscription: any,
    type: RenewalNotification['type']
  ): Promise<void> {
    try {
      let message = ''
      let title = ''
      let daysUntilAction = 0

      const now = new Date()
      const endDate = new Date(subscription.endDate)
      const gracePeriodEnd = new Date(subscription.gracePeriodEnd || endDate)

      switch (type) {
        case 'renewal_reminder':
          daysUntilAction = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          title = 'Subscription Renewal Reminder'
          message = `Your ${subscription.tier} subscription expires in ${daysUntilAction} days. Renew now to avoid service interruption.`
          break
          
        case 'grace_period_warning':
          daysUntilAction = Math.floor((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          title = 'Subscription Grace Period Active'
          message = `Your subscription has expired but you have ${daysUntilAction} days of grace period remaining. Please renew to continue service.`
          break
          
        case 'subscription_expired':
          title = 'Subscription Expired'
          message = 'Your subscription has expired. Please purchase a new subscription to continue using LYN AI services.'
          break
      }

      // Send in-app notification
      if (NotificationService) {
        await NotificationService.createNotification(
          subscription.walletAddress,
          title,
          message,
          'subscription',
          {
            subscriptionId: subscription._id.toString(),
            tier: subscription.tier,
            type: type
          }
        )
      }

      // Trigger webhook
      await WebhookService.createWebhookEvent('subscription.renewal_notification', {
        subscriptionId: subscription._id,
        walletAddress: subscription.walletAddress,
        tier: subscription.tier,
        notificationType: type,
        daysUntilAction,
        message
      })

      console.log(`[Subscription Management] Sent ${type} notification for subscription ${subscription._id}`)

    } catch (error) {
      console.error(`Error sending renewal notification:`, error)
    }
  }

  /**
   * Check and update subscription usage limits
   */
  async updateSubscriptionUsage(
    walletAddress: string,
    resource: 'scans' | 'apiCalls' | 'wallets' | 'tasks',
    increment: number = 1
  ): Promise<{
    success: boolean
    newUsage: number
    limit: number
    remaining: number
    resetDate: Date
    tier: SubscriptionTier
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const subscriptionsCollection = db.collection('subscriptions')

      // Get active subscription
      const subscription = await this.enhancedService.getActiveSubscription(walletAddress)
      if (!subscription) {
        return {
          success: false,
          newUsage: 0,
          limit: 0,
          remaining: 0,
          resetDate: new Date(),
          tier: SubscriptionTier.BASIC,
          error: 'No active subscription found'
        }
      }

      // Check current limits
      const limitsCheck = await this.enhancedService.checkSubscriptionLimits(walletAddress, resource)
      
      if (!limitsCheck.allowed && limitsCheck.limit !== -1) {
        return {
          success: false,
          newUsage: limitsCheck.used,
          limit: limitsCheck.limit,
          remaining: limitsCheck.remaining,
          resetDate: subscription.usageStats?.lastResetDate || new Date(),
          tier: subscription.tier,
          error: 'Usage limit exceeded'
        }
      }

      // Update usage
      const updateField = resource === 'scans' ? 'usageStats.scansUsed' : 'usageStats.apiCallsUsed'
      const newUsage = limitsCheck.used + increment

      await subscriptionsCollection.updateOne(
        { _id: subscription._id },
        {
          $set: {
            [updateField]: newUsage,
            'usageStats.lastResetDate': subscription.usageStats?.lastResetDate || new Date(),
            updatedAt: new Date()
          }
        }
      )

      const remaining = limitsCheck.limit === -1 ? -1 : Math.max(0, limitsCheck.limit - newUsage)

      return {
        success: true,
        newUsage,
        limit: limitsCheck.limit,
        remaining,
        resetDate: subscription.usageStats?.lastResetDate || new Date(),
        tier: subscription.tier
      }

    } catch (error) {
      console.error('Error updating subscription usage:', error)
      return {
        success: false,
        newUsage: 0,
        limit: 0,
        remaining: 0,
        resetDate: new Date(),
        tier: SubscriptionTier.BASIC,
        error: `Failed to update usage: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Reset monthly usage counters
   */
  async resetMonthlyUsage(): Promise<{
    resetCount: number
    errors: string[]
  }> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')

    let resetCount = 0
    const errors: string[] = []

    try {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))

      // Find subscriptions that need usage reset
      const subscriptionsToReset = await subscriptionsCollection.find({
        status: SubscriptionStatus.ACTIVE,
        $or: [
          { 'usageStats.lastResetDate': { $lt: thirtyDaysAgo } },
          { 'usageStats.lastResetDate': { $exists: false } }
        ]
      }).toArray()

      for (const subscription of subscriptionsToReset) {
        try {
          await subscriptionsCollection.updateOne(
            { _id: subscription._id },
            {
              $set: {
                'usageStats.scansUsed': 0,
                'usageStats.apiCallsUsed': 0,
                'usageStats.lastResetDate': now,
                updatedAt: now
              }
            }
          )

          resetCount++
          console.log(`[Subscription Management] Reset usage for subscription ${subscription._id}`)

        } catch (error) {
          const errorMsg = `Failed to reset usage for subscription ${subscription._id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.error(errorMsg)
        }
      }

      console.log(`[Subscription Management] Usage reset complete: ${resetCount} subscriptions processed`)
      
      return { resetCount, errors }

    } catch (error) {
      const errorMsg = `Error in monthly usage reset: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      console.error(errorMsg)
      
      return { resetCount, errors }
    }
  }

  /**
   * Get subscription health metrics
   */
  async getSubscriptionHealthMetrics(): Promise<{
    totalActive: number
    expiringWithin7Days: number
    inGracePeriod: number
    autoRenewalEnabled: number
    highUsageWarnings: number
    recentCancellations: number
    averageLongevity: number
    tierDistribution: { [key in SubscriptionTier]: number }
    retentionRate: number
  }> {
    const db = await getDatabase()
    const subscriptionsCollection = db.collection('subscriptions')

    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000))
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))

    // Get various metrics in parallel
    const [
      totalActive,
      expiringWithin7Days,
      inGracePeriod,
      autoRenewalEnabled,
      recentCancellations,
      tierDistributionData,
      allSubscriptions
    ] = await Promise.all([
      subscriptionsCollection.countDocuments({ status: SubscriptionStatus.ACTIVE }),
      subscriptionsCollection.countDocuments({
        status: SubscriptionStatus.ACTIVE,
        endDate: { $lte: sevenDaysFromNow, $gt: now }
      }),
      subscriptionsCollection.countDocuments({
        status: SubscriptionStatus.ACTIVE,
        inGracePeriod: true
      }),
      subscriptionsCollection.countDocuments({
        status: SubscriptionStatus.ACTIVE,
        autoRenewal: true
      }),
      subscriptionsCollection.countDocuments({
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: { $gte: thirtyDaysAgo }
      }),
      subscriptionsCollection.aggregate([
        { $match: { status: SubscriptionStatus.ACTIVE } },
        { $group: { _id: '$tier', count: { $sum: 1 } } }
      ]).toArray(),
      subscriptionsCollection.find({}).toArray()
    ])

    // Process tier distribution
    const tierDistribution = {
      [SubscriptionTier.BASIC]: 0,
      [SubscriptionTier.PRO]: 0,
      [SubscriptionTier.ENTERPRISE]: 0
    }

    tierDistributionData.forEach(item => {
      tierDistribution[item._id as SubscriptionTier] = item.count
    })

    // Calculate average longevity
    const completedSubscriptions = allSubscriptions.filter(sub => 
      sub.status === SubscriptionStatus.EXPIRED || sub.status === SubscriptionStatus.CANCELLED
    )

    let averageLongevity = 30 // Default to 30 days
    if (completedSubscriptions.length > 0) {
      const totalDays = completedSubscriptions.reduce((sum, sub) => {
        const start = new Date(sub.startDate).getTime()
        const end = sub.cancelledAt 
          ? new Date(sub.cancelledAt).getTime()
          : new Date(sub.endDate).getTime()
        return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24))
      }, 0)
      averageLongevity = Math.floor(totalDays / completedSubscriptions.length)
    }

    // Calculate retention rate (simplified)
    const totalSubscriptions = allSubscriptions.length
    const retentionRate = totalSubscriptions > 0 
      ? ((totalActive / totalSubscriptions) * 100)
      : 100

    // Calculate high usage warnings (subscriptions using >80% of limits)
    let highUsageWarnings = 0
    const activeSubscriptions = allSubscriptions.filter(sub => sub.status === SubscriptionStatus.ACTIVE)
    
    for (const subscription of activeSubscriptions) {
      const limitsCheck = await this.enhancedService.checkSubscriptionLimits(
        subscription.walletAddress, 
        'scans'
      )
      
      if (limitsCheck.limit > 0 && limitsCheck.used / limitsCheck.limit > 0.8) {
        highUsageWarnings++
      }
    }

    return {
      totalActive,
      expiringWithin7Days,
      inGracePeriod,
      autoRenewalEnabled,
      highUsageWarnings,
      recentCancellations,
      averageLongevity,
      tierDistribution,
      retentionRate: Math.round(retentionRate * 100) / 100
    }
  }

  /**
   * Handle subscription downgrades/upgrades
   */
  async processSubscriptionTierChange(
    walletAddress: string,
    newTier: SubscriptionTier,
    paymentReference: string,
    prorationCredit?: number
  ): Promise<{
    success: boolean
    subscription?: Subscription
    prorationAmount?: number
    error?: string
  }> {
    try {
      const currentSubscription = await this.enhancedService.getActiveSubscription(walletAddress)
      if (!currentSubscription) {
        return { success: false, error: 'No active subscription found' }
      }

      // Calculate proration if downgrading
      let prorationAmount = 0
      if (prorationCredit && prorationCredit > 0) {
        prorationAmount = prorationCredit
        
        // Create credit for future use or refund
        await this.refundService.createRefundRequest(
          currentSubscription.paymentReference,
          'user_request',
          `Proration credit for tier change from ${currentSubscription.tier} to ${newTier}`,
          'system'
        )
      }

      // Update subscription through enhanced service
      const result = await this.enhancedService.updateSubscriptionTier(
        walletAddress,
        newTier,
        paymentReference,
        currentSubscription.transactionSignature // Use existing signature for now
      )

      if (result.success) {
        // Trigger webhook for tier change
        await WebhookService.createWebhookEvent('subscription.tier_changed', {
          subscriptionId: currentSubscription._id,
          walletAddress,
          oldTier: currentSubscription.tier,
          newTier,
          prorationAmount
        })
      }

      return {
        success: result.success,
        subscription: result.subscription,
        prorationAmount,
        error: result.error
      }

    } catch (error) {
      console.error('Error processing subscription tier change:', error)
      return { 
        success: false, 
        error: `Failed to change subscription tier: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }
}