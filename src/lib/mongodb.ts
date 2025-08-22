import { MongoClient, Db, ObjectId } from 'mongodb'
import { log } from './logger'

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
  const client = await clientPromise
  return client.db(dbName)
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
    log.error('Database health check failed', { error })
    return false
  }
}

// Collection interfaces
export interface MongoUser {
  _id?: ObjectId
  walletAddress: string
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

  // Health check
  async checkDatabaseHealth(): Promise<boolean> {
    return await checkDatabaseHealth()
  }
}