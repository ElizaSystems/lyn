import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// Notification Types and Interfaces
export type NotificationChannel = 'email' | 'webhook' | 'in-app'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'
export type NotificationEventType = 
  | 'task-completed'
  | 'task-failed'
  | 'security-alert'
  | 'price-alert'
  | 'wallet-activity'
  | 'system-alert'
  | 'account-activity'

export interface NotificationTemplate {
  _id?: ObjectId
  name: string
  eventType: NotificationEventType
  channel: NotificationChannel
  subject?: string // For emails
  content: string
  variables: string[] // Variables that can be used in the template
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface NotificationPreferences {
  _id?: ObjectId
  userId: string
  email?: {
    enabled: boolean
    address: string
    events: NotificationEventType[]
  }
  webhook?: {
    enabled: boolean
    url: string
    secret?: string
    events: NotificationEventType[]
  }
  inApp?: {
    enabled: boolean
    events: NotificationEventType[]
  }
  quietHours?: {
    enabled: boolean
    startTime: string // HH:mm format
    endTime: string // HH:mm format
    timezone: string
  }
  frequency?: {
    maxPerHour: number
    maxPerDay: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface NotificationHistory {
  _id?: ObjectId
  userId: string
  channel: NotificationChannel
  eventType: NotificationEventType
  status: 'sent' | 'failed' | 'pending' | 'rate-limited'
  recipient: string // email, webhook URL, or user ID for in-app
  subject?: string
  content: string
  metadata?: Record<string, unknown>
  error?: string
  sentAt?: Date
  createdAt: Date
}

export interface NotificationRateLimit {
  _id?: ObjectId
  userId: string
  channel: NotificationChannel
  count: number
  windowStart: Date
  expiresAt: Date
}

export interface InAppNotification {
  _id?: ObjectId
  userId: string
  title: string
  content: string
  eventType: NotificationEventType
  priority: NotificationPriority
  isRead: boolean
  metadata?: Record<string, unknown>
  expiresAt?: Date
  createdAt: Date
}

// Email Provider Interface
interface EmailProvider {
  sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean>
}

// Resend Email Provider Implementation
class ResendEmailProvider implements EmailProvider {
  private apiKey: string
  private fromAddress: string

  constructor(apiKey: string, fromAddress: string) {
    this.apiKey = apiKey
    this.fromAddress = fromAddress
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
        }),
      })

      if (!response.ok) {
        console.error('Resend API error:', await response.text())
        return false
      }

      return true
    } catch (error) {
      console.error('Email sending error:', error)
      return false
    }
  }
}

// SMTP Email Provider Implementation (fallback)
class SMTPEmailProvider implements EmailProvider {
  private config: {
    host: string
    port: number
    user: string
    pass: string
    from: string
  }

  constructor(config: { host: string; port: number; user: string; pass: string; from: string }) {
    this.config = config
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    // Note: In a real implementation, you would use nodemailer or similar
    // For now, we'll just log and return true for development
    console.log(`[SMTP] Sending email to ${to}:`, { subject, html, text })
    return true
  }
}

// Notification Service
export class NotificationService {
  private static emailProvider: EmailProvider | null = null

  private static async getTemplatesCollection() {
    const db = await getDatabase()
    return db.collection<NotificationTemplate>('notification_templates')
  }

  private static async getPreferencesCollection() {
    const db = await getDatabase()
    return db.collection<NotificationPreferences>('notification_preferences')
  }

  private static async getHistoryCollection() {
    const db = await getDatabase()
    return db.collection<NotificationHistory>('notification_history')
  }

  private static async getRateLimitCollection() {
    const db = await getDatabase()
    return db.collection<NotificationRateLimit>('notification_rate_limits')
  }

  private static async getInAppCollection() {
    const db = await getDatabase()
    return db.collection<InAppNotification>('in_app_notifications')
  }

  // Initialize email provider
  private static getEmailProvider(): EmailProvider | null {
    if (this.emailProvider) return this.emailProvider

    // Try Resend first
    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      this.emailProvider = new ResendEmailProvider(
        process.env.RESEND_API_KEY,
        process.env.EMAIL_FROM
      )
      return this.emailProvider
    }

    // Fallback to SMTP
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM) {
      this.emailProvider = new SMTPEmailProvider({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.EMAIL_FROM,
      })
      return this.emailProvider
    }

    console.warn('No email provider configured. Email notifications will be disabled.')
    return null
  }

  // Template Management
  static async createTemplate(template: Omit<NotificationTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    const collection = await this.getTemplatesCollection()
    const now = new Date()
    
    const newTemplate: NotificationTemplate = {
      ...template,
      createdAt: now,
      updatedAt: now,
    }

    const result = await collection.insertOne(newTemplate)
    return { ...newTemplate, _id: result.insertedId }
  }

  static async getTemplate(eventType: NotificationEventType, channel: NotificationChannel): Promise<NotificationTemplate | null> {
    const collection = await this.getTemplatesCollection()
    return await collection.findOne({ eventType, channel, isActive: true })
  }

  static async updateTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate | null> {
    const collection = await this.getTemplatesCollection()
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    return result || null
  }

  // User Preferences Management
  static async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const collection = await this.getPreferencesCollection()
    return await collection.findOne({ userId })
  }

  static async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const collection = await this.getPreferencesCollection()
    const now = new Date()
    
    const result = await collection.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          ...preferences, 
          updatedAt: now 
        },
        $setOnInsert: {
          userId,
          createdAt: now,
          email: { enabled: true, address: '', events: [] },
          webhook: { enabled: false, url: '', events: [] },
          inApp: { enabled: true, events: [] },
          frequency: { maxPerHour: 10, maxPerDay: 50 }
        }
      },
      { upsert: true, returnDocument: 'after' }
    )

    return result!
  }

  // Rate Limiting
  static async checkRateLimit(userId: string, channel: NotificationChannel, maxPerHour: number = 10): Promise<boolean> {
    const collection = await this.getRateLimitCollection()
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    // Clean up expired rate limits
    await collection.deleteMany({ expiresAt: { $lt: now } })
    
    // Get current count for this hour
    const rateLimit = await collection.findOne({ 
      userId, 
      channel,
      windowStart: { $gte: hourAgo }
    })
    
    if (rateLimit && rateLimit.count >= maxPerHour) {
      return false // Rate limited
    }
    
    // Increment counter
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    await collection.findOneAndUpdate(
      { userId, channel, windowStart: { $gte: hourAgo } },
      { 
        $inc: { count: 1 },
        $setOnInsert: { 
          windowStart: now,
          expiresAt
        }
      },
      { upsert: true }
    )
    
    return true
  }

  // Template Rendering
  private static renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      rendered = rendered.replace(regex, String(value))
    })
    
    return rendered
  }

  // Check quiet hours
  private static isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours?.enabled) return false
    
    const now = new Date()
    const timezone = preferences.quietHours.timezone || 'UTC'
    
    // Simple timezone handling - in production you'd use a proper library
    const timeString = now.toLocaleTimeString('en-US', { 
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
    
    const currentTime = timeString
    const startTime = preferences.quietHours.startTime
    const endTime = preferences.quietHours.endTime
    
    // Handle overnight quiet hours (e.g., 22:00 - 06:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime
    }
    
    return currentTime >= startTime && currentTime <= endTime
  }

  // Email Notifications
  static async sendEmailNotification(
    userId: string, 
    eventType: NotificationEventType, 
    variables: Record<string, any>,
    options: { priority?: NotificationPriority; forceNotification?: boolean } = {}
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId)
      
      if (!preferences?.email?.enabled || !preferences.email.events.includes(eventType)) {
        console.log(`Email notifications disabled for user ${userId} and event ${eventType}`)
        return false
      }

      // Check quiet hours unless it's critical or forced
      if (!options.forceNotification && options.priority !== 'critical' && this.isInQuietHours(preferences)) {
        console.log(`Skipping email notification due to quiet hours for user ${userId}`)
        return false
      }

      // Check rate limits
      const maxPerHour = preferences.frequency?.maxPerHour || 10
      if (!await this.checkRateLimit(userId, 'email', maxPerHour)) {
        await this.logNotification(userId, 'email', eventType, '', '', 'rate-limited', preferences.email.address)
        return false
      }

      // Get template
      const template = await this.getTemplate(eventType, 'email')
      if (!template) {
        console.error(`No email template found for event type: ${eventType}`)
        return false
      }

      // Render template
      const subject = template.subject ? this.renderTemplate(template.subject, variables) : `LYN Security Alert: ${eventType}`
      const content = this.renderTemplate(template.content, variables)

      // Send email
      const emailProvider = this.getEmailProvider()
      if (!emailProvider) {
        console.error('No email provider available')
        return false
      }

      const success = await emailProvider.sendEmail(preferences.email.address, subject, content)
      
      // Log notification
      await this.logNotification(
        userId, 
        'email', 
        eventType, 
        subject, 
        content, 
        success ? 'sent' : 'failed',
        preferences.email.address,
        variables
      )

      return success
    } catch (error) {
      console.error('Email notification error:', error)
      await this.logNotification(userId, 'email', eventType, '', '', 'failed', '', {}, String(error))
      return false
    }
  }

  // Webhook Notifications
  static async sendWebhookNotification(
    userId: string, 
    eventType: NotificationEventType, 
    variables: Record<string, any>,
    options: { priority?: NotificationPriority } = {}
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId)
      
      if (!preferences?.webhook?.enabled || !preferences.webhook.events.includes(eventType)) {
        return false
      }

      // Check rate limits
      const maxPerHour = preferences.frequency?.maxPerHour || 10
      if (!await this.checkRateLimit(userId, 'webhook', maxPerHour)) {
        await this.logNotification(userId, 'webhook', eventType, '', '', 'rate-limited', preferences.webhook.url)
        return false
      }

      // Get template
      const template = await this.getTemplate(eventType, 'webhook')
      const content = template ? this.renderTemplate(template.content, variables) : JSON.stringify(variables)

      // Prepare webhook payload
      const payload = {
        eventType,
        userId,
        timestamp: new Date().toISOString(),
        priority: options.priority || 'medium',
        data: variables,
        message: content
      }

      // Send webhook
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'LYN-Security/1.0'
      }

      // Add signature if secret is configured
      if (preferences.webhook.secret) {
        // Simple HMAC signature - in production use proper crypto
        const signature = Buffer.from(preferences.webhook.secret + JSON.stringify(payload)).toString('base64')
        headers['X-LYN-Signature'] = signature
      }

      const response = await fetch(preferences.webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      const success = response.ok

      // Log notification
      await this.logNotification(
        userId, 
        'webhook', 
        eventType, 
        '', 
        content, 
        success ? 'sent' : 'failed',
        preferences.webhook.url,
        variables,
        success ? undefined : `HTTP ${response.status}: ${response.statusText}`
      )

      return success
    } catch (error) {
      console.error('Webhook notification error:', error)
      await this.logNotification(userId, 'webhook', eventType, '', '', 'failed', '', {}, String(error))
      return false
    }
  }

  // In-App Notifications
  static async createInAppNotification(
    userId: string,
    title: string,
    content: string,
    eventType: NotificationEventType,
    options: {
      priority?: NotificationPriority
      metadata?: Record<string, unknown>
      expiresIn?: number // Minutes
    } = {}
  ): Promise<InAppNotification> {
    const collection = await this.getInAppCollection()
    const now = new Date()
    
    const notification: InAppNotification = {
      userId,
      title,
      content,
      eventType,
      priority: options.priority || 'medium',
      isRead: false,
      metadata: options.metadata,
      expiresAt: options.expiresIn ? new Date(now.getTime() + options.expiresIn * 60 * 1000) : undefined,
      createdAt: now,
    }

    const result = await collection.insertOne(notification)
    return { ...notification, _id: result.insertedId }
  }

  static async getInAppNotifications(userId: string, limit: number = 50): Promise<InAppNotification[]> {
    const collection = await this.getInAppCollection()
    return await collection
      .find({ 
        userId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  static async markNotificationAsRead(id: string): Promise<boolean> {
    const collection = await this.getInAppCollection()
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isRead: true } }
    )
    return result.modifiedCount > 0
  }

  static async markAllNotificationsAsRead(userId: string): Promise<number> {
    const collection = await this.getInAppCollection()
    const result = await collection.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    )
    return result.modifiedCount
  }

  // Unified Send Method
  static async sendNotification(
    userId: string,
    eventType: NotificationEventType,
    variables: Record<string, any>,
    options: {
      priority?: NotificationPriority
      channels?: NotificationChannel[]
      forceNotification?: boolean
    } = {}
  ): Promise<{
    email: boolean
    webhook: boolean
    inApp: boolean
  }> {
    const preferences = await this.getUserPreferences(userId)
    const channels = options.channels || ['email', 'webhook', 'in-app']
    const results = {
      email: false,
      webhook: false,
      inApp: false
    }

    // Send to each enabled channel
    const promises: Promise<any>[] = []

    if (channels.includes('email') && preferences?.email?.enabled) {
      promises.push(
        this.sendEmailNotification(userId, eventType, variables, options)
          .then(result => { results.email = result })
      )
    }

    if (channels.includes('webhook') && preferences?.webhook?.enabled) {
      promises.push(
        this.sendWebhookNotification(userId, eventType, variables, options)
          .then(result => { results.webhook = result })
      )
    }

    if (channels.includes('in-app') && preferences?.inApp?.enabled && preferences.inApp.events.includes(eventType)) {
      const title = variables.title || `${eventType} Alert`
      const content = variables.message || `A ${eventType} event has occurred.`
      
      promises.push(
        this.createInAppNotification(userId, title, content, eventType, {
          priority: options.priority,
          metadata: variables
        }).then(() => { results.inApp = true })
      )
    }

    await Promise.allSettled(promises)
    return results
  }

  // Logging
  private static async logNotification(
    userId: string,
    channel: NotificationChannel,
    eventType: NotificationEventType,
    subject: string,
    content: string,
    status: 'sent' | 'failed' | 'pending' | 'rate-limited',
    recipient: string,
    metadata: Record<string, unknown> = {},
    error?: string
  ): Promise<void> {
    try {
      const collection = await this.getHistoryCollection()
      const now = new Date()

      await collection.insertOne({
        userId,
        channel,
        eventType,
        status,
        recipient,
        subject,
        content,
        metadata,
        error,
        sentAt: status === 'sent' ? now : undefined,
        createdAt: now,
      })
    } catch (err) {
      console.error('Failed to log notification:', err)
    }
  }

  // Cleanup Methods
  static async cleanupExpiredNotifications(): Promise<void> {
    const collection = await this.getInAppCollection()
    await collection.deleteMany({ 
      expiresAt: { $lt: new Date() }
    })
  }

  static async cleanupOldHistory(daysToKeep: number = 90): Promise<void> {
    const collection = await this.getHistoryCollection()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    await collection.deleteMany({
      createdAt: { $lt: cutoffDate }
    })
  }

  // Analytics
  static async getNotificationStats(userId: string, days: number = 30): Promise<{
    totalSent: number
    byChannel: Record<NotificationChannel, number>
    byEventType: Record<NotificationEventType, number>
    successRate: number
  }> {
    const collection = await this.getHistoryCollection()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const results = await collection.aggregate([
      { 
        $match: { 
          userId, 
          createdAt: { $gte: cutoffDate } 
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successful: { 
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          byChannel: {
            $push: {
              channel: '$channel',
              status: '$status'
            }
          },
          byEventType: {
            $push: {
              eventType: '$eventType',
              status: '$status'
            }
          }
        }
      }
    ]).toArray()

    if (results.length === 0) {
      return {
        totalSent: 0,
        byChannel: { email: 0, webhook: 0, 'in-app': 0 },
        byEventType: {} as Record<NotificationEventType, number>,
        successRate: 0
      }
    }

    const result = results[0]
    const byChannel: Record<NotificationChannel, number> = { email: 0, webhook: 0, 'in-app': 0 }
    const byEventType: Record<NotificationEventType, number> = {} as Record<NotificationEventType, number>

    result.byChannel.forEach((item: any) => {
      if (item.status === 'sent') {
        byChannel[item.channel] = (byChannel[item.channel] || 0) + 1
      }
    })

    result.byEventType.forEach((item: any) => {
      if (item.status === 'sent') {
        byEventType[item.eventType] = (byEventType[item.eventType] || 0) + 1
      }
    })

    return {
      totalSent: result.successful,
      byChannel,
      byEventType,
      successRate: result.total > 0 ? (result.successful / result.total) * 100 : 0
    }
  }
}

export default NotificationService