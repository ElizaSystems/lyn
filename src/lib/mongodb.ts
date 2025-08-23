import { MongoClient, Db, ObjectId } from 'mongodb'

if (!process.env.MONGODB_URI) {
  console.warn('MONGODB_URI not found, using fallback connection')
}

if (!process.env.MONGODB_DB_NAME) {
  console.warn('MONGODB_DB_NAME not found, using default database name')
}

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.MONGODB_DB_NAME || 'lyn_ai'
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

export async function getDatabase(): Promise<Db> {
  try {
    const client = await clientPromise
    return client.db(dbName)
  } catch (error) {
    console.error('Database connection failed:', error)
    throw new Error('Database connection failed')
  }
}

export async function closeConnection(): Promise<void> {
  const client = await clientPromise
  await client.close()
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = await getDatabase()
    await db.admin().ping()
    return true
  } catch (error) {
    console.error('Database health check failed', error)
    return false
  }
}

// Collection interfaces
export interface MongoUser {
  _id?: ObjectId
  walletAddress: string
  username?: string
  usernameRegisteredAt?: Date
  registrationBurnAmount?: number
  registrationBurnTx?: string
  nonce: string
  tokenBalance: number
  hasTokenAccess: boolean
  lastLoginAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface MongoSession {
  _id?: ObjectId
  userId: string
  token: string
  expiresAt: Date
  ipAddress?: string
  userAgent?: string
  createdAt: Date
  updatedAt: Date
}

export interface MongoTask {
  _id?: ObjectId
  userId: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  type: 'security-scan' | 'wallet-monitor' | 'price-alert' | 'auto-trade'
  frequency: string
  lastRun?: Date
  nextRun?: Date | null
  successRate: number
  config?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface MongoSecurityScan {
  _id?: ObjectId
  userId: string
  scanType: 'url' | 'document' | 'wallet' | 'contract'
  target: string
  status: 'pending' | 'scanning' | 'completed' | 'failed'
  results?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    threats: string[]
    recommendations: string[]
    score: number
  }
  ipAddress?: string
  userAgent?: string
  createdAt: Date
  updatedAt: Date
}

export interface MongoAnalyticsEvent {
  _id?: ObjectId
  userId?: string
  sessionId?: string
  eventType: string
  eventData: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

export interface MongoAuditLog {
  _id?: ObjectId
  userId?: string
  action: string
  resource: string
  details: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

export interface MongoRateLimit {
  _id?: ObjectId
  key: string
  count: number
  windowStart: Date
  expiresAt: Date
}

// Notification-related interfaces
export interface MongoNotificationTemplate {
  _id?: ObjectId
  name: string
  eventType: string
  channel: 'email' | 'webhook' | 'in-app'
  subject?: string
  content: string
  variables: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MongoNotificationPreferences {
  _id?: ObjectId
  userId: string
  email?: {
    enabled: boolean
    address: string
    events: string[]
  }
  webhook?: {
    enabled: boolean
    url: string
    secret?: string
    events: string[]
  }
  inApp?: {
    enabled: boolean
    events: string[]
  }
  quietHours?: {
    enabled: boolean
    startTime: string
    endTime: string
    timezone: string
  }
  frequency?: {
    maxPerHour: number
    maxPerDay: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface MongoNotificationHistory {
  _id?: ObjectId
  userId: string
  channel: 'email' | 'webhook' | 'in-app'
  eventType: string
  status: 'sent' | 'failed' | 'pending' | 'rate-limited'
  recipient: string
  subject?: string
  content: string
  metadata?: Record<string, unknown>
  error?: string
  sentAt?: Date
  createdAt: Date
}

export interface MongoInAppNotification {
  _id?: ObjectId
  userId: string
  title: string
  content: string
  eventType: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  isRead: boolean
  metadata?: Record<string, unknown>
  expiresAt?: Date
  createdAt: Date
}

// Community feedback system interfaces
export interface MongoCommunityFeedback {
  _id?: ObjectId
  walletAddress: string
  reporterUserId: string
  reporterWalletAddress: string
  feedbackType: 'scam' | 'legitimate' | 'suspicious' | 'phishing' | 'rugpull' | 'impersonation' | 'bot' | 'mixer' | 'verified' | 'other'
  sentiment: 'positive' | 'negative' | 'neutral'
  description: string
  evidence?: {
    transactionHashes?: string[]
    screenshotUrls?: string[]
    additionalUrls?: string[]
    additionalInfo?: string
  }
  confidence: number // 0-100
  tags?: string[]
  metadata?: Record<string, unknown>
  status: 'active' | 'archived' | 'disputed' | 'verified' | 'rejected'
  moderatorNotes?: string
  moderatedBy?: string
  moderatedAt?: Date
  votes: {
    upvotes: number
    downvotes: number
    totalVotes: number
    score: number // weighted score considering voter reputation
  }
  weight: number // calculated weight based on reporter reputation and age
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface MongoCommunityVote {
  _id?: ObjectId
  feedbackId: ObjectId
  voterUserId: string
  voterWalletAddress: string
  voteType: 'upvote' | 'downvote'
  voterReputation: number // at time of vote
  weight: number // calculated vote weight
  reason?: string
  createdAt: Date
}

export interface MongoUserReputation {
  _id?: ObjectId
  userId: string
  walletAddress: string
  reputationScore: number // 0-1000, starts at 500
  feedbackCount: number
  votesReceived: number
  accuracyScore: number // percentage of feedback that was deemed accurate
  consistencyScore: number // how consistent user's feedback is
  participationScore: number // based on activity level
  moderatorBonus: number // bonus points from moderator actions
  penaltyPoints: number // negative points for spam/false reports
  tier: 'novice' | 'contributor' | 'trusted' | 'expert' | 'guardian' // reputation tiers
  badges: string[] // achievement badges
  statistics: {
    totalFeedbackSubmitted: number
    totalVotesCast: number
    accurateReports: number
    inaccurateReports: number
    spamReports: number
    lastActivityAt: Date
  }
  createdAt: Date
  updatedAt: Date
}

export interface MongoFeedbackModeration {
  _id?: ObjectId
  feedbackId: ObjectId
  moderatorUserId: string
  moderatorWalletAddress: string
  action: 'approve' | 'reject' | 'flag' | 'verify' | 'dispute' | 'archive'
  reason: string
  notes?: string
  previousStatus: string
  newStatus: string
  evidence?: string[]
  createdAt: Date
}

export interface MongoSpamDetection {
  _id?: ObjectId
  userId: string
  walletAddress: string
  detectionType: 'duplicate_content' | 'rapid_submission' | 'low_quality' | 'suspicious_pattern' | 'reputation_based'
  severity: 'low' | 'medium' | 'high' | 'critical'
  evidence: Record<string, unknown>
  autoAction?: 'warn' | 'throttle' | 'suspend'
  status: 'active' | 'resolved' | 'false_positive'
  resolvedBy?: string
  resolvedAt?: Date
  createdAt: Date
}

export interface MongoFeedbackAnalytics {
  _id?: ObjectId
  walletAddress: string
  period: 'daily' | 'weekly' | 'monthly'
  periodDate: Date
  metrics: {
    totalFeedback: number
    positiveCount: number
    negativeCount: number
    neutralCount: number
    averageConfidence: number
    consensusScore: number // 0-100, higher means more agreement
    riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
    trustScore: number // calculated trust score based on community feedback
    topTags: Array<{ tag: string; count: number }>
    reporterReputationAverage: number
  }
  trendData: {
    previousPeriodScore?: number
    trend: 'improving' | 'declining' | 'stable'
    changePercentage?: number
  }
  createdAt: Date
  updatedAt: Date
}

// Database service layer
export const db = {
  // Users
  users: {
    async findByWalletAddress(walletAddress: string): Promise<MongoUser | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoUser>('users')
      return await collection.findOne({ walletAddress })
    },

    async create(userData: Omit<MongoUser, '_id' | 'createdAt' | 'updatedAt'>): Promise<MongoUser> {
      const database = await getDatabase()
      const collection = database.collection<MongoUser>('users')
      const now = new Date()
      const user: MongoUser = {
        ...userData,
        createdAt: now,
        updatedAt: now
      }
      const result = await collection.insertOne(user)
      return { ...user, _id: result.insertedId }
    },

    async update(id: string, updates: Partial<MongoUser>): Promise<MongoUser | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoUser>('users')
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      return result || null
    },

    async updateNonce(walletAddress: string, nonce: string): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoUser>('users')
      await collection.updateOne(
        { walletAddress },
        { $set: { nonce, updatedAt: new Date() } },
        { upsert: true }
      )
    }
  },

  // Sessions
  sessions: {
    async create(sessionData: Omit<MongoSession, '_id' | 'createdAt' | 'updatedAt'>): Promise<MongoSession> {
      const database = await getDatabase()
      const collection = database.collection<MongoSession>('sessions')
      const now = new Date()
      const session: MongoSession = {
        ...sessionData,
        createdAt: now,
        updatedAt: now
      }
      const result = await collection.insertOne(session)
      return { ...session, _id: result.insertedId }
    },

    async findByToken(token: string): Promise<MongoSession | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoSession>('sessions')
      return await collection.findOne({ 
        token, 
        expiresAt: { $gt: new Date() } 
      })
    },

    async deleteByToken(token: string): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoSession>('sessions')
      await collection.deleteOne({ token })
    },

    async deleteExpired(): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoSession>('sessions')
      await collection.deleteMany({ expiresAt: { $lt: new Date() } })
    }
  },

  // Security scans
  securityScans: {
    async create(scanData: Omit<MongoSecurityScan, '_id' | 'createdAt' | 'updatedAt'>): Promise<MongoSecurityScan> {
      const database = await getDatabase()
      const collection = database.collection<MongoSecurityScan>('security_scans')
      const now = new Date()
      const scan: MongoSecurityScan = {
        ...scanData,
        createdAt: now,
        updatedAt: now
      }
      const result = await collection.insertOne(scan)
      return { ...scan, _id: result.insertedId }
    },

    async findByUserId(userId: string, limit = 50): Promise<MongoSecurityScan[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoSecurityScan>('security_scans')
      return await collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
    },

    async update(id: string, updates: Partial<MongoSecurityScan>): Promise<MongoSecurityScan | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoSecurityScan>('security_scans')
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      return result || null
    }
  },

  // Analytics
  analytics: {
    async trackEvent(eventData: Omit<MongoAnalyticsEvent, '_id' | 'timestamp'>): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoAnalyticsEvent>('analytics_events')
      await collection.insertOne({
        ...eventData,
        timestamp: new Date()
      })
    },

    async getMetrics(userId?: string, timeRange?: { start: Date; end: Date }) {
      const database = await getDatabase()
      const collection = database.collection<MongoAnalyticsEvent>('analytics_events')
      const match: Record<string, unknown> = {}
      
      if (userId) match.userId = userId
      if (timeRange) {
        match.timestamp = {
          $gte: timeRange.start,
          $lte: timeRange.end
        }
      }

      return await collection.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            lastEvent: { $max: '$timestamp' }
          }
        }
      ]).toArray()
    }
  },

  // Audit logs
  audit: {
    async log(auditData: Omit<MongoAuditLog, '_id' | 'timestamp'>): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoAuditLog>('audit_logs')
      await collection.insertOne({
        ...auditData,
        timestamp: new Date()
      })
    },

    async findByUserId(userId: string, limit = 100): Promise<MongoAuditLog[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoAuditLog>('audit_logs')
      return await collection
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
    }
  },

  // Rate limiting
  rateLimit: {
    async get(key: string): Promise<MongoRateLimit | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoRateLimit>('rate_limits')
      return await collection.findOne({ 
        key, 
        expiresAt: { $gt: new Date() } 
      })
    },

    async increment(key: string, windowMs: number): Promise<{ count: number; expiresAt: Date }> {
      const database = await getDatabase()
      const collection = database.collection<MongoRateLimit>('rate_limits')
      const now = new Date()
      const expiresAt = new Date(now.getTime() + windowMs)

      const result = await collection.findOneAndUpdate(
        { key },
        {
          $inc: { count: 1 },
          $setOnInsert: { 
            windowStart: now,
            expiresAt
          }
        },
        { 
          upsert: true, 
          returnDocument: 'after' 
        }
      )

      if (!result) {
        // Fallback if findOneAndUpdate fails
        await collection.updateOne(
          { key },
          {
            $set: {
              count: 1,
              windowStart: now,
              expiresAt
            }
          },
          { upsert: true }
        )
        return { count: 1, expiresAt }
      }

      return {
        count: result.count,
        expiresAt: result.expiresAt
      }
    },

    async cleanup(): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoRateLimit>('rate_limits')
      await collection.deleteMany({ expiresAt: { $lt: new Date() } })
    }
  },

  // Notification Templates
  notificationTemplates: {
    async create(template: Omit<MongoNotificationTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<MongoNotificationTemplate> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationTemplate>('notification_templates')
      const now = new Date()
      const newTemplate: MongoNotificationTemplate = {
        ...template,
        createdAt: now,
        updatedAt: now
      }
      const result = await collection.insertOne(newTemplate)
      return { ...newTemplate, _id: result.insertedId }
    },

    async findByEventAndChannel(eventType: string, channel: 'email' | 'webhook' | 'in-app'): Promise<MongoNotificationTemplate | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationTemplate>('notification_templates')
      return await collection.findOne({ eventType, channel, isActive: true })
    },

    async update(id: string, updates: Partial<MongoNotificationTemplate>): Promise<MongoNotificationTemplate | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationTemplate>('notification_templates')
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      return result || null
    },

    async findAll(): Promise<MongoNotificationTemplate[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationTemplate>('notification_templates')
      return await collection.find({}).sort({ createdAt: -1 }).toArray()
    }
  },

  // Notification Preferences
  notificationPreferences: {
    async findByUserId(userId: string): Promise<MongoNotificationPreferences | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationPreferences>('notification_preferences')
      return await collection.findOne({ userId })
    },

    async update(userId: string, preferences: Partial<MongoNotificationPreferences>): Promise<MongoNotificationPreferences> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationPreferences>('notification_preferences')
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
  },

  // Notification History
  notificationHistory: {
    async create(history: Omit<MongoNotificationHistory, '_id' | 'createdAt'>): Promise<MongoNotificationHistory> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationHistory>('notification_history')
      const newHistory: MongoNotificationHistory = {
        ...history,
        createdAt: new Date()
      }
      const result = await collection.insertOne(newHistory)
      return { ...newHistory, _id: result.insertedId }
    },

    async findByUserId(userId: string, limit = 100): Promise<MongoNotificationHistory[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationHistory>('notification_history')
      return await collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
    },

    async cleanup(daysToKeep = 90): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoNotificationHistory>('notification_history')
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      await collection.deleteMany({
        createdAt: { $lt: cutoffDate }
      })
    }
  },

  // In-App Notifications
  inAppNotifications: {
    async create(notification: Omit<MongoInAppNotification, '_id' | 'createdAt'>): Promise<MongoInAppNotification> {
      const database = await getDatabase()
      const collection = database.collection<MongoInAppNotification>('in_app_notifications')
      const newNotification: MongoInAppNotification = {
        ...notification,
        createdAt: new Date()
      }
      const result = await collection.insertOne(newNotification)
      return { ...newNotification, _id: result.insertedId }
    },

    async findByUserId(userId: string, limit = 50): Promise<MongoInAppNotification[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoInAppNotification>('in_app_notifications')
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
    },

    async markAsRead(id: string): Promise<boolean> {
      const database = await getDatabase()
      const collection = database.collection<MongoInAppNotification>('in_app_notifications')
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isRead: true } }
      )
      return result.modifiedCount > 0
    },

    async markAllAsRead(userId: string): Promise<number> {
      const database = await getDatabase()
      const collection = database.collection<MongoInAppNotification>('in_app_notifications')
      const result = await collection.updateMany(
        { userId, isRead: false },
        { $set: { isRead: true } }
      )
      return result.modifiedCount
    },

    async cleanup(): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoInAppNotification>('in_app_notifications')
      await collection.deleteMany({ 
        expiresAt: { $lt: new Date() }
      })
    }
  },

  // Community Feedback
  communityFeedback: {
    async create(feedbackData: Omit<MongoCommunityFeedback, '_id' | 'createdAt' | 'updatedAt' | 'votes' | 'weight'>): Promise<MongoCommunityFeedback> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityFeedback>('community_feedback')
      const now = new Date()
      
      const feedback: MongoCommunityFeedback = {
        ...feedbackData,
        votes: { upvotes: 0, downvotes: 0, totalVotes: 0, score: 0 },
        weight: 1.0, // Default weight, will be calculated based on reporter reputation
        createdAt: now,
        updatedAt: now
      }
      
      const result = await collection.insertOne(feedback)
      return { ...feedback, _id: result.insertedId }
    },

    async findByWallet(walletAddress: string, limit = 50, offset = 0): Promise<MongoCommunityFeedback[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityFeedback>('community_feedback')
      return await collection
        .find({ walletAddress, status: 'active' })
        .sort({ createdAt: -1, weight: -1 })
        .skip(offset)
        .limit(limit)
        .toArray()
    },

    async findById(id: string): Promise<MongoCommunityFeedback | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityFeedback>('community_feedback')
      return await collection.findOne({ _id: new ObjectId(id) })
    },

    async update(id: string, updates: Partial<MongoCommunityFeedback>): Promise<MongoCommunityFeedback | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityFeedback>('community_feedback')
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      return result || null
    },

    async updateVotes(id: string, votes: MongoCommunityFeedback['votes']): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityFeedback>('community_feedback')
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { votes, updatedAt: new Date() } }
      )
    },

    async findForModeration(status: MongoCommunityFeedback['status'] = 'active', limit = 20): Promise<MongoCommunityFeedback[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityFeedback>('community_feedback')
      return await collection
        .find({ status })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray()
    },

    async getConsensus(walletAddress: string, timeRange: { start: Date; end: Date }): Promise<{
      totalFeedback: number
      positiveCount: number
      negativeCount: number
      neutralCount: number
      averageConfidence: number
      consensusScore: number
      majorityFeedbackType: string | null
    }> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityFeedback>('community_feedback')
      
      const pipeline = [
        {
          $match: {
            walletAddress,
            status: 'active',
            createdAt: { $gte: timeRange.start, $lte: timeRange.end }
          }
        },
        {
          $group: {
            _id: null,
            totalFeedback: { $sum: 1 },
            positiveCount: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] }
            },
            negativeCount: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] }
            },
            neutralCount: {
              $sum: { $cond: [{ $eq: ['$sentiment', 'neutral'] }, 1, 0] }
            },
            averageConfidence: { $avg: '$confidence' },
            feedbackTypes: { $push: '$feedbackType' },
            weightedScores: { $push: { $multiply: ['$confidence', '$weight'] } }
          }
        }
      ]
      
      const result = await collection.aggregate(pipeline).toArray()
      if (result.length === 0) {
        return {
          totalFeedback: 0,
          positiveCount: 0,
          negativeCount: 0,
          neutralCount: 0,
          averageConfidence: 0,
          consensusScore: 0,
          majorityFeedbackType: null
        }
      }
      
      const data = result[0]
      const consensusScore = data.totalFeedback > 0 ? 
        Math.max(data.positiveCount, data.negativeCount, data.neutralCount) / data.totalFeedback * 100 : 0
      
      // Find majority feedback type
      const typeCount = data.feedbackTypes.reduce((acc: Record<string, number>, type: string) => {
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})
      
      const majorityFeedbackType = Object.keys(typeCount).reduce((a, b) => 
        typeCount[a] > typeCount[b] ? a : b, null
      )
      
      return {
        totalFeedback: data.totalFeedback,
        positiveCount: data.positiveCount,
        negativeCount: data.negativeCount,
        neutralCount: data.neutralCount,
        averageConfidence: data.averageConfidence || 0,
        consensusScore,
        majorityFeedbackType
      }
    }
  },

  // Community Votes
  communityVotes: {
    async create(voteData: Omit<MongoCommunityVote, '_id' | 'createdAt'>): Promise<MongoCommunityVote> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityVote>('community_votes')
      const now = new Date()
      
      const vote: MongoCommunityVote = {
        ...voteData,
        createdAt: now
      }
      
      const result = await collection.insertOne(vote)
      return { ...vote, _id: result.insertedId }
    },

    async findExistingVote(feedbackId: ObjectId, voterUserId: string): Promise<MongoCommunityVote | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityVote>('community_votes')
      return await collection.findOne({ feedbackId, voterUserId })
    },

    async updateVote(id: string, voteType: MongoCommunityVote['voteType']): Promise<MongoCommunityVote | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityVote>('community_votes')
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { voteType } },
        { returnDocument: 'after' }
      )
      return result || null
    },

    async getVoteStats(feedbackId: ObjectId): Promise<{
      upvotes: number
      downvotes: number
      totalVotes: number
      weightedScore: number
    }> {
      const database = await getDatabase()
      const collection = database.collection<MongoCommunityVote>('community_votes')
      
      const pipeline = [
        { $match: { feedbackId } },
        {
          $group: {
            _id: null,
            upvotes: {
              $sum: { $cond: [{ $eq: ['$voteType', 'upvote'] }, 1, 0] }
            },
            downvotes: {
              $sum: { $cond: [{ $eq: ['$voteType', 'downvote'] }, 1, 0] }
            },
            totalVotes: { $sum: 1 },
            weightedScore: {
              $sum: {
                $cond: [
                  { $eq: ['$voteType', 'upvote'] },
                  '$weight',
                  { $multiply: ['$weight', -1] }
                ]
              }
            }
          }
        }
      ]
      
      const result = await collection.aggregate(pipeline).toArray()
      if (result.length === 0) {
        return { upvotes: 0, downvotes: 0, totalVotes: 0, weightedScore: 0 }
      }
      
      return result[0]
    }
  },

  // User Reputation
  userReputation: {
    async create(reputationData: Omit<MongoUserReputation, '_id' | 'createdAt' | 'updatedAt'>): Promise<MongoUserReputation> {
      const database = await getDatabase()
      const collection = database.collection<MongoUserReputation>('user_reputation')
      const now = new Date()
      
      const reputation: MongoUserReputation = {
        ...reputationData,
        createdAt: now,
        updatedAt: now
      }
      
      const result = await collection.insertOne(reputation)
      return { ...reputation, _id: result.insertedId }
    },

    async findByUserId(userId: string): Promise<MongoUserReputation | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoUserReputation>('user_reputation')
      return await collection.findOne({ userId })
    },

    async findByWalletAddress(walletAddress: string): Promise<MongoUserReputation | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoUserReputation>('user_reputation')
      return await collection.findOne({ walletAddress })
    },

    async updateScore(userId: string, scoreChange: number, reason: string): Promise<MongoUserReputation | null> {
      const database = await getDatabase()
      const collection = database.collection<MongoUserReputation>('user_reputation')
      
      const result = await collection.findOneAndUpdate(
        { userId },
        {
          $inc: { reputationScore: scoreChange },
          $set: { updatedAt: new Date() },
          $push: { 
            scoreHistory: { 
              change: scoreChange, 
              reason, 
              timestamp: new Date() 
            } 
          }
        },
        { returnDocument: 'after' }
      )
      
      return result || null
    },

    async initializeReputation(userId: string, walletAddress: string): Promise<MongoUserReputation> {
      const database = await getDatabase()
      const collection = database.collection<MongoUserReputation>('user_reputation')
      
      const defaultReputation: MongoUserReputation = {
        userId,
        walletAddress,
        reputationScore: 0, // Starting from zero - users earn reputation through activities
        feedbackCount: 0,
        votesReceived: 0,
        accuracyScore: 0,
        consistencyScore: 0,
        participationScore: 0,
        moderatorBonus: 0,
        penaltyPoints: 0,
        tier: 'novice',
        badges: [],
        statistics: {
          totalFeedbackSubmitted: 0,
          totalVotesCast: 0,
          accurateReports: 0,
          inaccurateReports: 0,
          spamReports: 0,
          lastActivityAt: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const result = await collection.findOneAndUpdate(
        { userId },
        { $setOnInsert: defaultReputation },
        { upsert: true, returnDocument: 'after' }
      )
      
      return result!
    },

    async updateTier(userId: string): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoUserReputation>('user_reputation')
      const reputation = await collection.findOne({ userId })
      
      if (!reputation) return
      
      let newTier: MongoUserReputation['tier'] = 'novice'
      const score = reputation.reputationScore
      
      if (score >= 1500) newTier = 'guardian' // Legend tier
      else if (score >= 1000) newTier = 'expert'    // Elite tier
      else if (score >= 600) newTier = 'trusted'    // Expert tier
      else if (score >= 300) newTier = 'contributor' // Guardian tier
      // else 'novice' (0-99 range)
      
      await collection.updateOne(
        { userId },
        { $set: { tier: newTier, updatedAt: new Date() } }
      )
    }
  },

  // Feedback Moderation
  feedbackModeration: {
    async create(moderationData: Omit<MongoFeedbackModeration, '_id' | 'createdAt'>): Promise<MongoFeedbackModeration> {
      const database = await getDatabase()
      const collection = database.collection<MongoFeedbackModeration>('feedback_moderation')
      
      const moderation: MongoFeedbackModeration = {
        ...moderationData,
        createdAt: new Date()
      }
      
      const result = await collection.insertOne(moderation)
      return { ...moderation, _id: result.insertedId }
    },

    async findByFeedbackId(feedbackId: ObjectId): Promise<MongoFeedbackModeration[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoFeedbackModeration>('feedback_moderation')
      return await collection
        .find({ feedbackId })
        .sort({ createdAt: -1 })
        .toArray()
    },

    async findByModerator(moderatorUserId: string, limit = 50): Promise<MongoFeedbackModeration[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoFeedbackModeration>('feedback_moderation')
      return await collection
        .find({ moderatorUserId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
    }
  },

  // Spam Detection
  spamDetection: {
    async create(spamData: Omit<MongoSpamDetection, '_id' | 'createdAt'>): Promise<MongoSpamDetection> {
      const database = await getDatabase()
      const collection = database.collection<MongoSpamDetection>('spam_detection')
      
      const spam: MongoSpamDetection = {
        ...spamData,
        createdAt: new Date()
      }
      
      const result = await collection.insertOne(spam)
      return { ...spam, _id: result.insertedId }
    },

    async findActiveByUser(userId: string): Promise<MongoSpamDetection[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoSpamDetection>('spam_detection')
      return await collection
        .find({ userId, status: 'active' })
        .sort({ createdAt: -1 })
        .toArray()
    },

    async checkUserSpamStatus(userId: string): Promise<{
      isSpammer: boolean
      severity: MongoSpamDetection['severity'] | null
      activeDetections: number
    }> {
      const database = await getDatabase()
      const collection = database.collection<MongoSpamDetection>('spam_detection')
      
      const activeDetections = await collection.find({ 
        userId, 
        status: 'active' 
      }).toArray()
      
      const highSeverityCount = activeDetections.filter(d => 
        d.severity === 'high' || d.severity === 'critical'
      ).length
      
      return {
        isSpammer: highSeverityCount > 0 || activeDetections.length >= 3,
        severity: highSeverityCount > 0 ? 'high' : (activeDetections.length > 0 ? 'medium' : null),
        activeDetections: activeDetections.length
      }
    }
  },

  // Feedback Analytics
  feedbackAnalytics: {
    async create(analyticsData: Omit<MongoFeedbackAnalytics, '_id' | 'createdAt' | 'updatedAt'>): Promise<MongoFeedbackAnalytics> {
      const database = await getDatabase()
      const collection = database.collection<MongoFeedbackAnalytics>('feedback_analytics')
      const now = new Date()
      
      const analytics: MongoFeedbackAnalytics = {
        ...analyticsData,
        createdAt: now,
        updatedAt: now
      }
      
      const result = await collection.insertOne(analytics)
      return { ...analytics, _id: result.insertedId }
    },

    async findByWallet(walletAddress: string, period: MongoFeedbackAnalytics['period'], limit = 30): Promise<MongoFeedbackAnalytics[]> {
      const database = await getDatabase()
      const collection = database.collection<MongoFeedbackAnalytics>('feedback_analytics')
      return await collection
        .find({ walletAddress, period })
        .sort({ periodDate: -1 })
        .limit(limit)
        .toArray()
    },

    async upsertAnalytics(walletAddress: string, period: MongoFeedbackAnalytics['period'], periodDate: Date, metrics: MongoFeedbackAnalytics['metrics']): Promise<void> {
      const database = await getDatabase()
      const collection = database.collection<MongoFeedbackAnalytics>('feedback_analytics')
      
      await collection.updateOne(
        { walletAddress, period, periodDate },
        {
          $set: {
            metrics,
            updatedAt: new Date()
          },
          $setOnInsert: {
            walletAddress,
            period,
            periodDate,
            createdAt: new Date()
          }
        },
        { upsert: true }
      )
    }
  },

  // Health check
  async checkDatabaseHealth(): Promise<boolean> {
    return await checkDatabaseHealth()
  }
}