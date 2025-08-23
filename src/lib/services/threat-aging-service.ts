import { getDatabase } from '@/lib/mongodb'
import { ThreatData, ThreatFeedStats } from '@/lib/models/threat-feed'
import { ThreatFeedService } from './threat-feed-service'
import { ThreatCorrelationService } from './threat-correlation-service'
import { logger } from '@/lib/logger'

interface AgingRule {
  threatType?: string
  severity?: string
  source?: string
  maxAge: number // in milliseconds
  conditions?: {
    minConfidence?: number
    hasCorrelations?: boolean
    voteThreshold?: number
  }
}

interface AgingJobResult {
  expired: number
  cleaned: number
  archived: number
  correlationsProcessed: number
  statsGenerated: boolean
  errors: string[]
}

export class ThreatAgingService {
  private static readonly DEFAULT_AGING_RULES: AgingRule[] = [
    // Critical threats last longer
    { severity: 'critical', maxAge: 90 * 24 * 60 * 60 * 1000 }, // 90 days
    { severity: 'high', maxAge: 60 * 24 * 60 * 60 * 1000 }, // 60 days
    { severity: 'medium', maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    { severity: 'low', maxAge: 14 * 24 * 60 * 60 * 1000 }, // 14 days
    { severity: 'info', maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days

    // Source-specific rules
    { source: 'community', maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    { source: 'external_api', maxAge: 45 * 24 * 60 * 60 * 1000 }, // 45 days
    { source: 'honeypot', maxAge: 60 * 24 * 60 * 60 * 1000 }, // 60 days

    // Type-specific rules
    { threatType: 'phishing', maxAge: 14 * 24 * 60 * 60 * 1000 }, // 14 days
    { threatType: 'scam', maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    { threatType: 'rugpull', maxAge: 90 * 24 * 60 * 60 * 1000 }, // 90 days
    { threatType: 'honeypot', maxAge: 60 * 24 * 60 * 60 * 1000 }, // 60 days

    // Low confidence threats expire sooner
    { 
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      conditions: { minConfidence: 50 }
    },

    // Default fallback
    { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  ]

  private static isRunning = false
  private static lastRun: Date | null = null
  private static jobInterval: NodeJS.Timeout | null = null

  /**
   * Start the aging service with automatic scheduling
   */
  static start(intervalHours = 6): void {
    if (this.jobInterval) {
      logger.warn('[ThreatAging] Service already running')
      return
    }

    // Run immediately on start
    this.runAgingJob().catch(error => {
      logger.error('[ThreatAging] Initial aging job failed:', error)
    })

    // Schedule periodic runs
    this.jobInterval = setInterval(() => {
      this.runAgingJob().catch(error => {
        logger.error('[ThreatAging] Scheduled aging job failed:', error)
      })
    }, intervalHours * 60 * 60 * 1000)

    logger.info(`[ThreatAging] Service started with ${intervalHours}h interval`)
  }

  /**
   * Stop the aging service
   */
  static stop(): void {
    if (this.jobInterval) {
      clearInterval(this.jobInterval)
      this.jobInterval = null
      logger.info('[ThreatAging] Service stopped')
    }
  }

  /**
   * Run the complete aging job
   */
  static async runAgingJob(): Promise<AgingJobResult> {
    if (this.isRunning) {
      logger.warn('[ThreatAging] Job already running, skipping')
      return {
        expired: 0,
        cleaned: 0,
        archived: 0,
        correlationsProcessed: 0,
        statsGenerated: false,
        errors: ['Job already running']
      }
    }

    this.isRunning = true
    const startTime = Date.now()
    const result: AgingJobResult = {
      expired: 0,
      cleaned: 0,
      archived: 0,
      correlationsProcessed: 0,
      statsGenerated: false,
      errors: []
    }

    try {
      logger.info('[ThreatAging] Starting aging job')

      // Step 1: Expire threats based on aging rules
      try {
        result.expired = await this.expireThreats()
      } catch (error) {
        result.errors.push(`Expiration failed: ${error}`)
        logger.error('[ThreatAging] Expiration step failed:', error)
      }

      // Step 2: Clean up old data
      try {
        result.cleaned = await this.cleanupOldData()
      } catch (error) {
        result.errors.push(`Cleanup failed: ${error}`)
        logger.error('[ThreatAging] Cleanup step failed:', error)
      }

      // Step 3: Archive resolved/expired threats
      try {
        result.archived = await this.archiveOldThreats()
      } catch (error) {
        result.errors.push(`Archival failed: ${error}`)
        logger.error('[ThreatAging] Archival step failed:', error)
      }

      // Step 4: Process correlations for new threats
      try {
        result.correlationsProcessed = await ThreatCorrelationService.performBulkCorrelationAnalysis()
      } catch (error) {
        result.errors.push(`Correlation processing failed: ${error}`)
        logger.error('[ThreatAging] Correlation step failed:', error)
      }

      // Step 5: Generate statistics
      try {
        await this.generateStatistics()
        result.statsGenerated = true
      } catch (error) {
        result.errors.push(`Statistics generation failed: ${error}`)
        logger.error('[ThreatAging] Statistics step failed:', error)
      }

      // Step 6: Optimize database
      try {
        await this.optimizeDatabase()
      } catch (error) {
        result.errors.push(`Database optimization failed: ${error}`)
        logger.error('[ThreatAging] Optimization step failed:', error)
      }

      const duration = Date.now() - startTime
      this.lastRun = new Date()

      logger.info(`[ThreatAging] Job completed in ${duration}ms - Expired: ${result.expired}, Cleaned: ${result.cleaned}, Archived: ${result.archived}, Correlations: ${result.correlationsProcessed}`)

    } catch (error) {
      logger.error('[ThreatAging] Aging job failed:', error)
      result.errors.push(`Job failed: ${error}`)
    } finally {
      this.isRunning = false
    }

    return result
  }

  /**
   * Expire threats based on aging rules
   */
  private static async expireThreats(): Promise<number> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')

      let totalExpired = 0
      const now = new Date()

      // Process each aging rule
      for (const rule of this.DEFAULT_AGING_RULES) {
        const query = this.buildExpirationQuery(rule, now)
        
        const result = await collection.updateMany(
          query,
          {
            $set: {
              status: 'expired',
              updatedAt: now,
              expiresAt: now
            }
          }
        )

        totalExpired += result.modifiedCount

        if (result.modifiedCount > 0) {
          logger.info(`[ThreatAging] Expired ${result.modifiedCount} threats for rule: ${JSON.stringify(rule)}`)
        }
      }

      // Also expire threats that have explicit expiry dates
      const explicitExpiryResult = await collection.updateMany(
        {
          status: 'active',
          expiresAt: { $lt: now }
        },
        {
          $set: {
            status: 'expired',
            updatedAt: now
          }
        }
      )

      totalExpired += explicitExpiryResult.modifiedCount

      return totalExpired

    } catch (error) {
      logger.error('[ThreatAging] Failed to expire threats:', error)
      throw error
    }
  }

  /**
   * Clean up old data (events, logs, etc.)
   */
  private static async cleanupOldData(): Promise<number> {
    try {
      const db = await getDatabase()
      let totalCleaned = 0

      // Clean up old stream events (keep 30 days)
      const eventsCutoff = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))
      const eventsResult = await db.collection('threat_stream_events').deleteMany({
        timestamp: { $lt: eventsCutoff }
      })
      totalCleaned += eventsResult.deletedCount

      // Clean up old rate limit records (keep 7 days)
      const rateLimitCutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000))
      const rateLimitResult = await db.collection('subscription_rate_limits').deleteMany({
        timestamp: { $lt: rateLimitCutoff }
      })
      totalCleaned += rateLimitResult.deletedCount

      // Clean up old correlation data for deleted threats
      const correlationResult = await db.collection('threat_correlations').deleteMany({
        $or: [
          { status: 'disputed' },
          { createdAt: { $lt: new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)) } }
        ]
      })
      totalCleaned += correlationResult.deletedCount

      logger.info(`[ThreatAging] Cleaned up ${totalCleaned} old records`)
      return totalCleaned

    } catch (error) {
      logger.error('[ThreatAging] Failed to cleanup old data:', error)
      throw error
    }
  }

  /**
   * Archive old threats to separate collection
   */
  private static async archiveOldThreats(): Promise<number> {
    try {
      const db = await getDatabase()
      const activeCollection = db.collection<ThreatData>('threat_feed')
      const archiveCollection = db.collection<ThreatData>('threat_feed_archive')

      // Find threats to archive (expired > 90 days ago or resolved > 30 days ago)
      const archiveCutoffExpired = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000))
      const archiveCutoffResolved = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))

      const threatsToArchive = await activeCollection.find({
        $or: [
          { 
            status: 'expired',
            updatedAt: { $lt: archiveCutoffExpired }
          },
          {
            status: 'resolved',
            updatedAt: { $lt: archiveCutoffResolved }
          },
          {
            status: 'false_positive',
            updatedAt: { $lt: archiveCutoffResolved }
          }
        ]
      }).toArray()

      if (threatsToArchive.length === 0) {
        return 0
      }

      // Add archive metadata
      const threatsWithArchiveData = threatsToArchive.map(threat => ({
        ...threat,
        archivedAt: new Date(),
        archiveReason: this.determineArchiveReason(threat)
      }))

      // Insert to archive
      await archiveCollection.insertMany(threatsWithArchiveData)

      // Remove from active collection
      const threatIds = threatsToArchive.map(t => t._id!)
      const deleteResult = await activeCollection.deleteMany({
        _id: { $in: threatIds }
      })

      logger.info(`[ThreatAging] Archived ${deleteResult.deletedCount} threats`)
      return deleteResult.deletedCount

    } catch (error) {
      logger.error('[ThreatAging] Failed to archive threats:', error)
      throw error
    }
  }

  /**
   * Generate various statistics
   */
  private static async generateStatistics(): Promise<void> {
    const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly']
    
    for (const period of periods) {
      await ThreatFeedService.generateStats(period)
    }
    
    // Generate hourly stats for the current hour
    await ThreatFeedService.generateStats('hourly')
  }

  /**
   * Optimize database performance
   */
  private static async optimizeDatabase(): Promise<void> {
    try {
      const db = await getDatabase()

      // Ensure indexes exist for better performance
      const threatCollection = db.collection<ThreatData>('threat_feed')
      
      await Promise.all([
        // Core query indexes
        threatCollection.createIndex({ status: 1, createdAt: -1 }),
        threatCollection.createIndex({ hash: 1 }),
        threatCollection.createIndex({ threatId: 1 }),
        threatCollection.createIndex({ 'target.value': 1 }),
        threatCollection.createIndex({ type: 1, severity: 1 }),
        threatCollection.createIndex({ 'source.id': 1 }),
        threatCollection.createIndex({ expiresAt: 1 }),
        
        // Correlation indexes
        db.collection('threat_correlations').createIndex({ parentThreatId: 1 }),
        db.collection('threat_correlations').createIndex({ childThreatId: 1 }),
        
        // Subscription indexes
        db.collection('threat_subscriptions').createIndex({ userId: 1 }),
        db.collection('threat_subscriptions').createIndex({ subscriberId: 1 }),
        db.collection('threat_subscriptions').createIndex({ isActive: 1 }),
        
        // Events index
        db.collection('threat_stream_events').createIndex({ timestamp: -1 })
      ])

      logger.info('[ThreatAging] Database optimization completed')

    } catch (error) {
      logger.error('[ThreatAging] Database optimization failed:', error)
      // Don't throw here as this is not critical
    }
  }

  /**
   * Build expiration query for a specific aging rule
   */
  private static buildExpirationQuery(rule: AgingRule, now: Date): Record<string, unknown> {
    const query: Record<string, unknown> = {
      status: 'active',
      createdAt: { $lt: new Date(now.getTime() - rule.maxAge) }
    }

    // Add rule-specific conditions
    if (rule.threatType) {
      query.type = rule.threatType
    }

    if (rule.severity) {
      query.severity = rule.severity
    }

    if (rule.source) {
      query['source.type'] = rule.source
    }

    // Add conditional filters
    if (rule.conditions) {
      if (rule.conditions.minConfidence !== undefined) {
        query.confidence = { $lt: rule.conditions.minConfidence }
      }

      if (rule.conditions.hasCorrelations !== undefined) {
        if (rule.conditions.hasCorrelations) {
          query.correlatedThreats = { $ne: [] }
        } else {
          query.correlatedThreats = { $size: 0 }
        }
      }

      if (rule.conditions.voteThreshold !== undefined) {
        query['votes.score'] = { $lt: rule.conditions.voteThreshold }
      }
    }

    return query
  }

  /**
   * Determine archive reason for a threat
   */
  private static determineArchiveReason(threat: ThreatData): string {
    if (threat.status === 'expired') {
      return 'Expired due to age'
    } else if (threat.status === 'resolved') {
      return 'Resolved by user or system'
    } else if (threat.status === 'false_positive') {
      return 'Marked as false positive'
    } else {
      return 'Unknown reason'
    }
  }

  /**
   * Get aging service status
   */
  static getStatus(): {
    isRunning: boolean
    lastRun: Date | null
    nextRun: Date | null
    isScheduled: boolean
  } {
    const nextRun = this.jobInterval && this.lastRun 
      ? new Date(this.lastRun.getTime() + (6 * 60 * 60 * 1000)) // Default 6h interval
      : null

    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun,
      isScheduled: this.jobInterval !== null
    }
  }

  /**
   * Force expire specific threats
   */
  static async forceExpireThreats(threatIds: string[]): Promise<number> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')

      const result = await collection.updateMany(
        { 
          _id: { $in: threatIds.map(id => new (require('mongodb').ObjectId)(id)) },
          status: 'active'
        },
        {
          $set: {
            status: 'expired',
            updatedAt: new Date(),
            expiresAt: new Date()
          }
        }
      )

      logger.info(`[ThreatAging] Force expired ${result.modifiedCount} threats`)
      return result.modifiedCount

    } catch (error) {
      logger.error('[ThreatAging] Failed to force expire threats:', error)
      throw error
    }
  }

  /**
   * Extend threat lifespan
   */
  static async extendThreatLifespan(threatId: string, additionalDays: number): Promise<boolean> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')

      const additionalMs = additionalDays * 24 * 60 * 60 * 1000
      const now = new Date()

      const result = await collection.updateOne(
        { 
          _id: new (require('mongodb').ObjectId)(threatId),
          status: 'active'
        },
        {
          $set: {
            expiresAt: new Date(now.getTime() + additionalMs),
            updatedAt: now
          }
        }
      )

      if (result.modifiedCount > 0) {
        logger.info(`[ThreatAging] Extended lifespan of threat ${threatId} by ${additionalDays} days`)
        return true
      }

      return false

    } catch (error) {
      logger.error(`[ThreatAging] Failed to extend threat lifespan for ${threatId}:`, error)
      return false
    }
  }
}