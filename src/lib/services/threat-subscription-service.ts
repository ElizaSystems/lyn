import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { 
  ThreatSubscription, 
  ThreatData, 
  ThreatStreamEvent,
  ThreatWatchlist,
  ThreatType,
  ThreatSeverity
} from '@/lib/models/threat-feed'
import { ThreatFeedService } from './threat-feed-service'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

interface SubscriptionNotification {
  subscriptionId: string
  threatId: ObjectId
  threat: ThreatData
  deliveryMethod: 'webhook' | 'email' | 'in_app'
  timestamp: Date
}

interface WebhookPayload {
  subscription: {
    id: string
    filters: ThreatSubscription['filters']
  }
  event: ThreatStreamEvent
  threat: ThreatData
  timestamp: string
  signature?: string
}

export class ThreatSubscriptionService {
  private static readonly MAX_SUBSCRIPTIONS_PER_USER = 10
  private static readonly WEBHOOK_TIMEOUT = 10000 // 10 seconds
  private static readonly RETRY_ATTEMPTS = 3
  private static readonly RATE_LIMIT_PER_HOUR = 1000

  /**
   * Create a new threat subscription
   */
  static async createSubscription(subscriptionData: Omit<ThreatSubscription, '_id' | 'createdAt' | 'updatedAt' | 'statistics'>): Promise<ThreatSubscription> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatSubscription>('threat_subscriptions')

      // Check subscription limits
      if (subscriptionData.userId) {
        const existingCount = await collection.countDocuments({ 
          userId: subscriptionData.userId,
          isActive: true
        })
        
        if (existingCount >= this.MAX_SUBSCRIPTIONS_PER_USER) {
          throw new Error(`Maximum of ${this.MAX_SUBSCRIPTIONS_PER_USER} subscriptions allowed per user`)
        }
      }

      // Validate filters
      const validatedFilters = this.validateFilters(subscriptionData.filters)

      const now = new Date()
      const subscription: ThreatSubscription = {
        ...subscriptionData,
        subscriberId: subscriptionData.subscriberId || crypto.randomUUID(),
        filters: validatedFilters,
        statistics: {
          threatsReceived: 0,
          failedDeliveries: 0
        },
        createdAt: now,
        updatedAt: now
      }

      const result = await collection.insertOne(subscription)
      const savedSubscription = { ...subscription, _id: result.insertedId }

      // Subscribe to threat feed events
      ThreatFeedService.subscribe(savedSubscription.subscriberId, (event) => {
        this.handleThreatEvent(savedSubscription, event)
      })

      logger.info(`[ThreatSubscription] Created subscription: ${savedSubscription.subscriberId}`)
      return savedSubscription

    } catch (error) {
      logger.error('[ThreatSubscription] Failed to create subscription:', error)
      throw new Error('Failed to create threat subscription')
    }
  }

  /**
   * Update existing subscription
   */
  static async updateSubscription(subscriptionId: string, updates: Partial<ThreatSubscription>): Promise<ThreatSubscription | null> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatSubscription>('threat_subscriptions')

      // Validate filters if they're being updated
      if (updates.filters) {
        updates.filters = this.validateFilters(updates.filters)
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(subscriptionId) },
        { 
          $set: { 
            ...updates, 
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      )

      if (result) {
        logger.info(`[ThreatSubscription] Updated subscription: ${result.subscriberId}`)
      }

      return result

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to update subscription ${subscriptionId}:`, error)
      return null
    }
  }

  /**
   * Delete subscription
   */
  static async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatSubscription>('threat_subscriptions')

      const subscription = await collection.findOne({ _id: new ObjectId(subscriptionId) })
      if (!subscription) {
        return false
      }

      // Unsubscribe from threat feed events
      ThreatFeedService.unsubscribe(subscription.subscriberId)

      const result = await collection.deleteOne({ _id: new ObjectId(subscriptionId) })
      
      if (result.deletedCount > 0) {
        logger.info(`[ThreatSubscription] Deleted subscription: ${subscription.subscriberId}`)
        return true
      }

      return false

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to delete subscription ${subscriptionId}:`, error)
      return false
    }
  }

  /**
   * Get user subscriptions
   */
  static async getUserSubscriptions(userId: string): Promise<ThreatSubscription[]> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatSubscription>('threat_subscriptions')

      return await collection
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray()

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to get user subscriptions for ${userId}:`, error)
      return []
    }
  }

  /**
   * Get subscription by ID
   */
  static async getSubscription(subscriptionId: string): Promise<ThreatSubscription | null> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatSubscription>('threat_subscriptions')

      return await collection.findOne({ _id: new ObjectId(subscriptionId) })

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to get subscription ${subscriptionId}:`, error)
      return null
    }
  }

  /**
   * Handle threat feed event for subscriptions
   */
  private static async handleThreatEvent(subscription: ThreatSubscription, event: ThreatStreamEvent): Promise<void> {
    try {
      if (!event.threat || !this.matchesSubscriptionFilters(event.threat, subscription.filters)) {
        return
      }

      // Check rate limiting
      if (!(await this.checkRateLimit(subscription.subscriberId))) {
        logger.warn(`[ThreatSubscription] Rate limit exceeded for subscription ${subscription.subscriberId}`)
        return
      }

      const notification: SubscriptionNotification = {
        subscriptionId: subscription.subscriberId,
        threatId: event.threat._id!,
        threat: event.threat,
        deliveryMethod: 'webhook', // Will be determined by delivery preferences
        timestamp: new Date()
      }

      // Deliver via configured channels
      const deliveryPromises: Promise<boolean>[] = []

      if (subscription.delivery.webhook?.enabled && subscription.delivery.webhook.url) {
        deliveryPromises.push(this.deliverViaWebhook(subscription, notification))
      }

      if (subscription.delivery.email?.enabled && subscription.delivery.email.address) {
        deliveryPromises.push(this.deliverViaEmail(subscription, notification))
      }

      if (subscription.delivery.inApp) {
        deliveryPromises.push(this.deliverViaInApp(subscription, notification))
      }

      // Wait for all deliveries
      const results = await Promise.allSettled(deliveryPromises)
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length
      const failureCount = results.length - successCount

      // Update subscription statistics
      await this.updateSubscriptionStats(subscription._id!.toString(), successCount, failureCount)

      if (successCount > 0) {
        logger.info(`[ThreatSubscription] Delivered threat ${event.threat.threatId} to subscription ${subscription.subscriberId}`)
      }

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to handle threat event for subscription ${subscription.subscriberId}:`, error)
    }
  }

  /**
   * Check if threat matches subscription filters
   */
  private static matchesSubscriptionFilters(threat: ThreatData, filters: ThreatSubscription['filters']): boolean {
    // Check threat types
    if (filters.types?.length && !filters.types.includes(threat.type)) {
      return false
    }

    // Check severities
    if (filters.severities?.length && !filters.severities.includes(threat.severity)) {
      return false
    }

    // Check sources
    if (filters.sources?.length && !filters.sources.includes(threat.source.id)) {
      return false
    }

    // Check specific targets
    if (filters.targets?.length && !filters.targets.includes(threat.target.value)) {
      return false
    }

    // Check minimum confidence
    if (filters.minimumConfidence !== undefined && threat.confidence < filters.minimumConfidence) {
      return false
    }

    // Check tags
    if (filters.tags?.length) {
      const hasMatchingTag = filters.tags.some(tag => threat.context.tags.includes(tag))
      if (!hasMatchingTag) {
        return false
      }
    }

    return true
  }

  /**
   * Deliver notification via webhook
   */
  private static async deliverViaWebhook(subscription: ThreatSubscription, notification: SubscriptionNotification): Promise<boolean> {
    try {
      if (!subscription.delivery.webhook?.url) {
        return false
      }

      const payload: WebhookPayload = {
        subscription: {
          id: subscription.subscriberId,
          filters: subscription.filters
        },
        event: {
          eventId: crypto.randomUUID(),
          eventType: 'threat_added',
          threatId: notification.threatId,
          threat: notification.threat,
          metadata: {
            source: 'subscription',
            triggeredBy: 'system'
          },
          timestamp: notification.timestamp
        },
        threat: notification.threat,
        timestamp: notification.timestamp.toISOString()
      }

      // Add signature if secret is provided
      if (subscription.delivery.webhook.secret) {
        payload.signature = this.generateWebhookSignature(JSON.stringify(payload), subscription.delivery.webhook.secret)
      }

      const response = await fetch(subscription.delivery.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LYN-ThreatFeed/1.0',
          'X-LYN-Signature': payload.signature || '',
          'X-LYN-Event-Type': 'threat_notification'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.WEBHOOK_TIMEOUT)
      })

      if (response.ok) {
        logger.info(`[ThreatSubscription] Webhook delivered successfully to ${subscription.delivery.webhook.url}`)
        return true
      } else {
        logger.warn(`[ThreatSubscription] Webhook delivery failed: ${response.status} ${response.statusText}`)
        return false
      }

    } catch (error) {
      logger.error('[ThreatSubscription] Webhook delivery failed:', error)
      return false
    }
  }

  /**
   * Deliver notification via email
   */
  private static async deliverViaEmail(subscription: ThreatSubscription, notification: SubscriptionNotification): Promise<boolean> {
    try {
      // This would integrate with your email service
      // For now, we'll just log the email that would be sent
      
      const emailContent = {
        to: subscription.delivery.email?.address,
        subject: `Threat Alert: ${notification.threat.context.title}`,
        body: this.generateEmailBody(notification.threat),
        severity: notification.threat.severity
      }

      // Here you would integrate with your email service (SendGrid, SES, etc.)
      logger.info(`[ThreatSubscription] Email notification would be sent to ${emailContent.to}`)
      
      // For demonstration, we'll simulate success
      return true

    } catch (error) {
      logger.error('[ThreatSubscription] Email delivery failed:', error)
      return false
    }
  }

  /**
   * Deliver notification via in-app notification
   */
  private static async deliverViaInApp(subscription: ThreatSubscription, notification: SubscriptionNotification): Promise<boolean> {
    try {
      if (!subscription.userId) {
        return false
      }

      const db = await getDatabase()
      const collection = db.collection('in_app_notifications')

      const inAppNotification = {
        userId: subscription.userId.toString(),
        title: `Threat Alert: ${notification.threat.severity.toUpperCase()}`,
        content: notification.threat.context.description,
        eventType: 'threat_alert',
        priority: this.mapSeverityToPriority(notification.threat.severity),
        isRead: false,
        metadata: {
          threatId: notification.threatId.toString(),
          subscriptionId: subscription.subscriberId,
          threatType: notification.threat.type,
          targetValue: notification.threat.target.value
        },
        createdAt: new Date()
      }

      await collection.insertOne(inAppNotification)
      logger.info(`[ThreatSubscription] In-app notification created for user ${subscription.userId}`)
      return true

    } catch (error) {
      logger.error('[ThreatSubscription] In-app delivery failed:', error)
      return false
    }
  }

  /**
   * Create a watchlist for specific targets
   */
  static async createWatchlist(watchlistData: Omit<ThreatWatchlist, '_id' | 'createdAt' | 'updatedAt' | 'statistics'>): Promise<ThreatWatchlist> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatWatchlist>('threat_watchlists')

      const now = new Date()
      const watchlist: ThreatWatchlist = {
        ...watchlistData,
        statistics: {
          totalAlerts: 0,
          threatsDetected: 0
        },
        createdAt: now,
        updatedAt: now
      }

      const result = await collection.insertOne(watchlist)
      const savedWatchlist = { ...watchlist, _id: result.insertedId }

      logger.info(`[ThreatSubscription] Created watchlist: ${savedWatchlist.name}`)
      return savedWatchlist

    } catch (error) {
      logger.error('[ThreatSubscription] Failed to create watchlist:', error)
      throw new Error('Failed to create threat watchlist')
    }
  }

  /**
   * Get user watchlists
   */
  static async getUserWatchlists(userId: string): Promise<ThreatWatchlist[]> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatWatchlist>('threat_watchlists')

      return await collection
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray()

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to get watchlists for user ${userId}:`, error)
      return []
    }
  }

  /**
   * Check threats against all active watchlists
   */
  static async checkWatchlists(threat: ThreatData): Promise<void> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatWatchlist>('threat_watchlists')

      const watchlists = await collection.find({ 
        isActive: true,
        targets: {
          $elemMatch: {
            value: threat.target.value
          }
        }
      }).toArray()

      for (const watchlist of watchlists) {
        if (this.shouldTriggerWatchlistAlert(threat, watchlist)) {
          await this.triggerWatchlistAlert(watchlist, threat)
        }
      }

    } catch (error) {
      logger.error('[ThreatSubscription] Failed to check watchlists:', error)
    }
  }

  // Helper methods

  /**
   * Validate subscription filters
   */
  private static validateFilters(filters: ThreatSubscription['filters']): ThreatSubscription['filters'] {
    const validated: ThreatSubscription['filters'] = {}

    if (filters.types) {
      validated.types = filters.types.filter(type => typeof type === 'string') as ThreatType[]
    }

    if (filters.severities) {
      validated.severities = filters.severities.filter(severity => 
        ['info', 'low', 'medium', 'high', 'critical'].includes(severity)
      ) as ThreatSeverity[]
    }

    if (filters.sources) {
      validated.sources = filters.sources.filter(source => typeof source === 'string')
    }

    if (filters.targets) {
      validated.targets = filters.targets.filter(target => typeof target === 'string')
    }

    if (filters.minimumConfidence !== undefined) {
      validated.minimumConfidence = Math.max(0, Math.min(100, filters.minimumConfidence))
    }

    if (filters.tags) {
      validated.tags = filters.tags.filter(tag => typeof tag === 'string')
    }

    return validated
  }

  /**
   * Generate webhook signature
   */
  private static generateWebhookSignature(payload: string, secret: string): string {
    const crypto = require('crypto')
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  }

  /**
   * Generate email body for threat notification
   */
  private static generateEmailBody(threat: ThreatData): string {
    return `
Threat Alert: ${threat.context.title}

Severity: ${threat.severity.toUpperCase()}
Type: ${threat.type}
Target: ${threat.target.value}
Confidence: ${threat.confidence}%

Description:
${threat.context.description}

Source: ${threat.source.name}
First Seen: ${threat.timeline.firstSeen.toISOString()}

View threat details: ${process.env.NEXT_PUBLIC_APP_URL}/threats/${threat._id}
    `.trim()
  }

  /**
   * Map threat severity to notification priority
   */
  private static mapSeverityToPriority(severity: ThreatSeverity): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'info':
      case 'low':
        return 'low'
      case 'medium':
        return 'medium'
      case 'high':
        return 'high'
      case 'critical':
        return 'critical'
      default:
        return 'medium'
    }
  }

  /**
   * Check rate limiting for subscription
   */
  private static async checkRateLimit(subscriberId: string): Promise<boolean> {
    try {
      const db = await getDatabase()
      const collection = db.collection('subscription_rate_limits')

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const count = await collection.countDocuments({
        subscriberId,
        timestamp: { $gte: hourAgo }
      })

      if (count >= this.RATE_LIMIT_PER_HOUR) {
        return false
      }

      // Record this delivery attempt
      await collection.insertOne({
        subscriberId,
        timestamp: new Date()
      })

      return true

    } catch (error) {
      logger.error('[ThreatSubscription] Rate limit check failed:', error)
      return true // Default to allowing delivery
    }
  }

  /**
   * Update subscription statistics
   */
  private static async updateSubscriptionStats(subscriptionId: string, successes: number, failures: number): Promise<void> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatSubscription>('threat_subscriptions')

      await collection.updateOne(
        { _id: new ObjectId(subscriptionId) },
        {
          $inc: {
            'statistics.threatsReceived': successes,
            'statistics.failedDeliveries': failures
          },
          $set: {
            'statistics.lastDelivery': new Date(),
            updatedAt: new Date()
          }
        }
      )

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to update stats for subscription ${subscriptionId}:`, error)
    }
  }

  /**
   * Check if watchlist alert should be triggered
   */
  private static shouldTriggerWatchlistAlert(threat: ThreatData, watchlist: ThreatWatchlist): boolean {
    const severityOrder: ThreatSeverity[] = ['info', 'low', 'medium', 'high', 'critical']
    const threatSeverityIndex = severityOrder.indexOf(threat.severity)
    const minimumSeverityIndex = severityOrder.indexOf(watchlist.alertSettings.minimumSeverity)

    return threatSeverityIndex >= minimumSeverityIndex
  }

  /**
   * Trigger watchlist alert
   */
  private static async triggerWatchlistAlert(watchlist: ThreatWatchlist, threat: ThreatData): Promise<void> {
    try {
      const db = await getDatabase()

      // Update watchlist statistics
      await db.collection<ThreatWatchlist>('threat_watchlists').updateOne(
        { _id: watchlist._id },
        {
          $inc: { 
            'statistics.totalAlerts': 1,
            'statistics.threatsDetected': 1
          },
          $set: { 
            'statistics.lastAlert': new Date(),
            updatedAt: new Date()
          }
        }
      )

      // Send notifications based on watchlist settings
      for (const channel of watchlist.alertSettings.notificationChannels) {
        if (channel === 'in_app') {
          await db.collection('in_app_notifications').insertOne({
            userId: watchlist.userId.toString(),
            title: `Watchlist Alert: ${watchlist.name}`,
            content: `Threat detected on watched target: ${threat.target.value}`,
            eventType: 'watchlist_alert',
            priority: this.mapSeverityToPriority(threat.severity),
            isRead: false,
            metadata: {
              watchlistId: watchlist._id!.toString(),
              threatId: threat._id!.toString(),
              targetValue: threat.target.value
            },
            createdAt: new Date()
          })
        }
        // Add webhook and email delivery here if needed
      }

      logger.info(`[ThreatSubscription] Triggered watchlist alert for ${watchlist.name}`)

    } catch (error) {
      logger.error(`[ThreatSubscription] Failed to trigger watchlist alert for ${watchlist.name}:`, error)
    }
  }
}