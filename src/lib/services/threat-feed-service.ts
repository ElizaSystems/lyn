import crypto from 'crypto'
import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { 
  ThreatData, 
  ThreatSource, 
  ThreatType, 
  ThreatSeverity, 
  ThreatSubscription,
  ThreatCorrelation,
  ThreatStreamEvent,
  ThreatFeedStats,
  ThreatPattern,
  ThreatWatchlist,
  ThreatSourceConfig
} from '@/lib/models/threat-feed'
import { logger } from '@/lib/logger'

export class ThreatFeedService {
  private static readonly CORRELATION_THRESHOLD = 0.7
  private static readonly DEFAULT_EXPIRY_HOURS = 24 * 30 // 30 days
  private static readonly MAX_BATCH_SIZE = 100
  
  // Event emitter for real-time notifications
  private static eventListeners: Map<string, Array<(event: ThreatStreamEvent) => void>> = new Map()

  /**
   * Add a new threat to the feed
   */
  static async addThreat(threatData: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>): Promise<ThreatData> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')
      
      // Generate unique threat ID and hash
      const threatId = threatData.threatId || this.generateThreatId(threatData)
      const hash = this.generateThreatHash(threatData)
      
      // Check for duplicates
      const existing = await collection.findOne({ 
        $or: [
          { threatId },
          { hash }
        ]
      })
      
      if (existing) {
        logger.info(`[ThreatFeed] Duplicate threat detected: ${threatId}`)
        return await this.updateThreat(existing._id!.toString(), {
          ...threatData,
          timeline: {
            ...existing.timeline,
            lastSeen: new Date(),
            updatedAt: new Date()
          }
        })
      }
      
      const now = new Date()
      const expiresAt = threatData.expiresAt || new Date(now.getTime() + (this.DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000))
      
      const threat: ThreatData = {
        ...threatData,
        threatId,
        hash,
        timeline: {
          ...threatData.timeline,
          discoveredAt: threatData.timeline.discoveredAt || now
        },
        status: threatData.status || 'active',
        expiresAt,
        correlatedThreats: [],
        votes: { upvotes: 0, downvotes: 0, totalVotes: 0, score: 0 },
        createdAt: now,
        updatedAt: now
      }
      
      const result = await collection.insertOne(threat)
      const savedThreat = { ...threat, _id: result.insertedId }
      
      // Perform correlation analysis
      await this.correlateThreat(savedThreat)
      
      // Apply pattern detection
      await this.applyPatterns(savedThreat)
      
      // Emit real-time event
      await this.emitThreatEvent({
        eventId: crypto.randomUUID(),
        eventType: 'threat_added',
        threatId: savedThreat._id!,
        threat: savedThreat,
        metadata: {
          source: threatData.source.id,
          triggeredBy: 'system'
        },
        timestamp: now
      })
      
      logger.info(`[ThreatFeed] Added new threat: ${threatId} with severity ${threatData.severity}`)
      return savedThreat
      
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to add threat:`, error)
      throw new Error('Failed to add threat to feed')
    }
  }

  /**
   * Update existing threat
   */
  static async updateThreat(threatId: string, updates: Partial<ThreatData>): Promise<ThreatData | null> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')
      
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(threatId) },
        { 
          $set: { 
            ...updates, 
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      )
      
      if (result) {
        // Emit update event
        await this.emitThreatEvent({
          eventId: crypto.randomUUID(),
          eventType: 'threat_updated',
          threatId: result._id!,
          threat: result,
          changes: updates,
          metadata: {
            source: result.source.id,
            triggeredBy: 'system'
          },
          timestamp: new Date()
        })
        
        logger.info(`[ThreatFeed] Updated threat: ${result.threatId}`)
      }
      
      return result
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to update threat ${threatId}:`, error)
      return null
    }
  }

  /**
   * Query threats with advanced filtering
   */
  static async queryThreats(filters: {
    types?: ThreatType[]
    severities?: ThreatSeverity[]
    sources?: string[]
    targetType?: string
    targetValue?: string
    status?: ThreatData['status'][]
    dateRange?: { start: Date; end: Date }
    minimumConfidence?: number
    tags?: string[]
    limit?: number
    offset?: number
    sortBy?: 'createdAt' | 'severity' | 'confidence' | 'votes'
    sortOrder?: 'asc' | 'desc'
  }): Promise<{ threats: ThreatData[]; total: number }> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')
      
      // Build query
      const query: Record<string, unknown> = {}
      
      if (filters.types?.length) {
        query.type = { $in: filters.types }
      }
      
      if (filters.severities?.length) {
        query.severity = { $in: filters.severities }
      }
      
      if (filters.sources?.length) {
        query['source.id'] = { $in: filters.sources }
      }
      
      if (filters.targetType) {
        query['target.type'] = filters.targetType
      }
      
      if (filters.targetValue) {
        query['target.value'] = { $regex: filters.targetValue, $options: 'i' }
      }
      
      if (filters.status?.length) {
        query.status = { $in: filters.status }
      }
      
      if (filters.dateRange) {
        query.createdAt = {
          $gte: filters.dateRange.start,
          $lte: filters.dateRange.end
        }
      }
      
      if (filters.minimumConfidence) {
        query.confidence = { $gte: filters.minimumConfidence }
      }
      
      if (filters.tags?.length) {
        query['context.tags'] = { $in: filters.tags }
      }
      
      // Get total count
      const total = await collection.countDocuments(query)
      
      // Build sort criteria
      const sortCriteria: Record<string, 1 | -1> = {}
      if (filters.sortBy === 'severity') {
        // Custom severity sorting
        sortCriteria['severityOrder'] = filters.sortOrder === 'asc' ? 1 : -1
      } else {
        const sortField = filters.sortBy || 'createdAt'
        sortCriteria[sortField] = filters.sortOrder === 'asc' ? 1 : -1
      }
      
      // Execute query
      const threats = await collection
        .find(query)
        .sort(sortCriteria)
        .skip(filters.offset || 0)
        .limit(Math.min(filters.limit || 50, this.MAX_BATCH_SIZE))
        .toArray()
      
      return { threats, total }
      
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to query threats:`, error)
      throw new Error('Failed to query threat feed')
    }
  }

  /**
   * Get threat statistics
   */
  static async getThreatStats(period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<ThreatFeedStats | null> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatFeedStats>('threat_feed_stats')
      
      const periodDate = this.getPeriodDate(new Date(), period)
      
      return await collection.findOne({
        period,
        periodDate
      })
      
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to get threat stats:`, error)
      return null
    }
  }

  /**
   * Generate threat statistics for a period
   */
  static async generateStats(period: 'hourly' | 'daily' | 'weekly' | 'monthly'): Promise<void> {
    try {
      const db = await getDatabase()
      const threatCollection = db.collection<ThreatData>('threat_feed')
      const statsCollection = db.collection<ThreatFeedStats>('threat_feed_stats')
      
      const now = new Date()
      const periodDate = this.getPeriodDate(now, period)
      const periodRange = this.getPeriodRange(periodDate, period)
      
      // Aggregate threat data for the period
      const pipeline = [
        {
          $match: {
            createdAt: { $gte: periodRange.start, $lt: periodRange.end }
          }
        },
        {
          $group: {
            _id: null,
            totalThreats: { $sum: 1 },
            newThreats: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            expiredThreats: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
            resolvedThreats: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            falsePositives: { $sum: { $cond: [{ $eq: ['$status', 'false_positive'] }, 1, 0] } },
            uniqueTargets: { $addToSet: '$target.value' },
            threatTypes: { $push: '$type' },
            severities: { $push: '$severity' },
            sources: { $push: '$source.id' },
            confidences: { $push: '$confidence' },
            correlatedCount: { $sum: { $cond: [{ $gt: [{ $size: '$correlatedThreats' }, 0] }, 1, 0] } }
          }
        },
        {
          $project: {
            totalThreats: 1,
            newThreats: 1,
            expiredThreats: 1,
            resolvedThreats: 1,
            falsePositives: 1,
            uniqueTargets: { $size: '$uniqueTargets' },
            averageConfidence: { $avg: '$confidences' },
            correlationRate: { $multiply: [{ $divide: ['$correlatedCount', '$totalThreats'] }, 100] },
            threatTypes: 1,
            severities: 1,
            sources: 1
          }
        }
      ]
      
      const [result] = await threatCollection.aggregate(pipeline).toArray()
      
      if (result) {
        // Calculate top categories
        const topThreatTypes = this.calculateTopCategories(result.threatTypes)
        const topSeverities = this.calculateTopCategories(result.severities)
        const topSources = this.calculateTopCategories(result.sources)
        
        const stats: Omit<ThreatFeedStats, '_id'> = {
          period,
          periodDate,
          metrics: {
            totalThreats: result.totalThreats || 0,
            newThreats: result.newThreats || 0,
            expiredThreats: result.expiredThreats || 0,
            resolvedThreats: result.resolvedThreats || 0,
            falsePositives: result.falsePositives || 0,
            uniqueTargets: result.uniqueTargets || 0,
            topThreatTypes,
            topSeverities,
            topSources,
            averageConfidence: result.averageConfidence || 0,
            correlationRate: result.correlationRate || 0
          },
          createdAt: now,
          updatedAt: now
        }
        
        // Upsert stats
        await statsCollection.replaceOne(
          { period, periodDate },
          stats,
          { upsert: true }
        )
        
        logger.info(`[ThreatFeed] Generated ${period} stats for ${periodDate.toISOString()}`)
      }
      
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to generate stats:`, error)
    }
  }

  /**
   * Correlate threat with existing threats
   */
  static async correlateThreat(threat: ThreatData): Promise<void> {
    try {
      const db = await getDatabase()
      const threatCollection = db.collection<ThreatData>('threat_feed')
      const correlationCollection = db.collection<ThreatCorrelation>('threat_correlations')
      
      // Find potential correlations based on various criteria
      const correlationQuery = {
        _id: { $ne: threat._id },
        status: 'active',
        $or: [
          // Same target
          { 'target.value': threat.target.value },
          // Same attribution
          { 'attribution.actor': threat.attribution?.actor },
          { 'attribution.campaign': threat.attribution?.campaign },
          // Similar indicators
          { 'indicators.value': { $in: threat.indicators.map(i => i.value) } },
          // Same tags
          { 'context.tags': { $in: threat.context.tags } }
        ]
      }
      
      const potentialCorrelations = await threatCollection.find(correlationQuery).toArray()
      
      for (const candidate of potentialCorrelations) {
        const correlation = await this.calculateCorrelation(threat, candidate)
        
        if (correlation.confidence >= this.CORRELATION_THRESHOLD) {
          // Save correlation
          const correlationData: Omit<ThreatCorrelation, '_id'> = {
            parentThreatId: threat._id!,
            childThreatId: candidate._id!,
            correlationType: correlation.type,
            confidence: correlation.confidence,
            evidence: correlation.evidence,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          }
          
          await correlationCollection.insertOne(correlationData)
          
          // Update both threats with correlation references
          await threatCollection.updateOne(
            { _id: threat._id },
            { $addToSet: { correlatedThreats: candidate._id } }
          )
          
          await threatCollection.updateOne(
            { _id: candidate._id },
            { $addToSet: { correlatedThreats: threat._id } }
          )
          
          logger.info(`[ThreatFeed] Correlated threats: ${threat.threatId} <-> ${candidate.threatId}`)
        }
      }
      
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to correlate threat:`, error)
    }
  }

  /**
   * Apply pattern detection to threat
   */
  static async applyPatterns(threat: ThreatData): Promise<void> {
    try {
      const db = await getDatabase()
      const patternCollection = db.collection<ThreatPattern>('threat_patterns')
      const threatCollection = db.collection<ThreatData>('threat_feed')
      
      const activePatterns = await patternCollection.find({ isActive: true }).toArray()
      
      for (const pattern of activePatterns) {
        const score = this.evaluatePattern(threat, pattern)
        
        if (score >= pattern.threshold) {
          // Apply pattern actions
          const updates: Partial<ThreatData> = {}
          let needsUpdate = false
          
          for (const action of pattern.actions) {
            switch (action.type) {
              case 'increase_severity':
                if (this.shouldIncreaseSeverity(threat.severity, action.parameters.targetSeverity as ThreatSeverity)) {
                  updates.severity = action.parameters.targetSeverity as ThreatSeverity
                  needsUpdate = true
                }
                break
                
              case 'add_tag':
                const newTag = action.parameters.tag as string
                if (!threat.context.tags.includes(newTag)) {
                  updates['context.tags'] = [...threat.context.tags, newTag]
                  needsUpdate = true
                }
                break
            }
          }
          
          if (needsUpdate) {
            await threatCollection.updateOne(
              { _id: threat._id },
              { $set: { ...updates, updatedAt: new Date() } }
            )
            
            // Update pattern statistics
            await patternCollection.updateOne(
              { _id: pattern._id },
              { 
                $inc: { 'statistics.timesTriggered': 1 },
                $set: { 'statistics.lastTriggered': new Date() }
              }
            )
            
            logger.info(`[ThreatFeed] Applied pattern ${pattern.name} to threat ${threat.threatId}`)
          }
        }
      }
      
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to apply patterns:`, error)
    }
  }

  /**
   * Expire old threats
   */
  static async expireThreats(): Promise<number> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')
      
      const now = new Date()
      const result = await collection.updateMany(
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
      
      if (result.modifiedCount > 0) {
        logger.info(`[ThreatFeed] Expired ${result.modifiedCount} threats`)
        
        // Emit expiration events for real-time subscribers
        const expiredThreats = await collection.find({
          status: 'expired',
          updatedAt: now
        }).toArray()
        
        for (const threat of expiredThreats) {
          await this.emitThreatEvent({
            eventId: crypto.randomUUID(),
            eventType: 'threat_expired',
            threatId: threat._id!,
            threat,
            metadata: {
              source: 'system',
              triggeredBy: 'system'
            },
            timestamp: now
          })
        }
      }
      
      return result.modifiedCount
      
    } catch (error) {
      logger.error(`[ThreatFeed] Failed to expire threats:`, error)
      return 0
    }
  }

  /**
   * Subscribe to threat events
   */
  static subscribe(subscriberId: string, callback: (event: ThreatStreamEvent) => void): void {
    if (!this.eventListeners.has(subscriberId)) {
      this.eventListeners.set(subscriberId, [])
    }
    this.eventListeners.get(subscriberId)!.push(callback)
  }

  /**
   * Unsubscribe from threat events
   */
  static unsubscribe(subscriberId: string): void {
    this.eventListeners.delete(subscriberId)
  }

  /**
   * Emit threat event to all subscribers
   */
  private static async emitThreatEvent(event: ThreatStreamEvent): Promise<void> {
    // Store event for persistence
    const db = await getDatabase()
    await db.collection('threat_stream_events').insertOne(event)
    
    // Notify all listeners
    for (const [subscriberId, callbacks] of this.eventListeners.entries()) {
      for (const callback of callbacks) {
        try {
          callback(event)
        } catch (error) {
          logger.error(`[ThreatFeed] Failed to notify subscriber ${subscriberId}:`, error)
        }
      }
    }
  }

  // Helper methods
  private static generateThreatId(threat: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>): string {
    const data = `${threat.source.id}:${threat.type}:${threat.target.value}:${threat.timeline.firstSeen.getTime()}`
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)
  }

  private static generateThreatHash(threat: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>): string {
    const data = JSON.stringify({
      source: threat.source.id,
      type: threat.type,
      target: threat.target,
      context: threat.context.description,
      indicators: threat.indicators.map(i => `${i.type}:${i.value}`)
    })
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  private static async calculateCorrelation(threat1: ThreatData, threat2: ThreatData): Promise<{
    type: ThreatCorrelation['correlationType']
    confidence: number
    evidence: ThreatCorrelation['evidence']
  }> {
    let confidence = 0
    const evidence: ThreatCorrelation['evidence'] = { commonIndicators: [] }
    
    // Check for common indicators
    const commonIndicators = threat1.indicators.filter(i1 => 
      threat2.indicators.some(i2 => i1.value === i2.value)
    ).map(i => i.value)
    
    if (commonIndicators.length > 0) {
      confidence += 0.3 * (commonIndicators.length / Math.max(threat1.indicators.length, threat2.indicators.length))
      evidence.commonIndicators = commonIndicators
    }
    
    // Check target similarity
    if (threat1.target.value === threat2.target.value) {
      confidence += 0.4
      evidence.targetSimilarity = 1.0
    }
    
    // Check attribution similarity
    if (threat1.attribution?.actor === threat2.attribution?.actor) {
      confidence += 0.2
      evidence.attributionSimilarity = 1.0
    }
    
    // Check timeline similarity
    const timeDiff = Math.abs(threat1.timeline.firstSeen.getTime() - threat2.timeline.firstSeen.getTime())
    const timeScore = Math.max(0, 1 - (timeDiff / (24 * 60 * 60 * 1000))) // 24 hour window
    confidence += 0.1 * timeScore
    evidence.timelineSimilarity = timeScore
    
    // Determine correlation type
    let type: ThreatCorrelation['correlationType'] = 'related'
    if (confidence > 0.9) type = 'duplicate'
    else if (threat1.attribution?.campaign === threat2.attribution?.campaign) type = 'campaign'
    else if (threat1.attribution?.actor === threat2.attribution?.actor) type = 'attribution'
    else if (evidence.targetSimilarity === 1.0) type = 'target_overlap'
    
    return { type, confidence, evidence }
  }

  private static evaluatePattern(threat: ThreatData, pattern: ThreatPattern): number {
    let score = 0
    
    for (const indicator of pattern.indicators) {
      const value = this.getFieldValue(threat, indicator.field)
      const matches = this.evaluateIndicator(value, indicator.operator, indicator.value)
      
      if (matches) {
        score += indicator.weight
      }
    }
    
    return score
  }

  private static getFieldValue(threat: ThreatData, field: string): unknown {
    const parts = field.split('.')
    let value: unknown = threat
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }
    
    return value
  }

  private static evaluateIndicator(value: unknown, operator: string, targetValue: string): boolean {
    if (typeof value !== 'string') return false
    
    switch (operator) {
      case 'equals':
        return value === targetValue
      case 'contains':
        return value.includes(targetValue)
      case 'starts_with':
        return value.startsWith(targetValue)
      case 'ends_with':
        return value.endsWith(targetValue)
      case 'regex':
        try {
          const regex = new RegExp(targetValue, 'i')
          return regex.test(value)
        } catch {
          return false
        }
      default:
        return false
    }
  }

  private static shouldIncreaseSeverity(current: ThreatSeverity, target: ThreatSeverity): boolean {
    const severityOrder: ThreatSeverity[] = ['info', 'low', 'medium', 'high', 'critical']
    return severityOrder.indexOf(target) > severityOrder.indexOf(current)
  }

  private static getPeriodDate(date: Date, period: 'hourly' | 'daily' | 'weekly' | 'monthly'): Date {
    const periodDate = new Date(date)
    
    switch (period) {
      case 'hourly':
        periodDate.setMinutes(0, 0, 0)
        break
      case 'daily':
        periodDate.setHours(0, 0, 0, 0)
        break
      case 'weekly':
        const day = periodDate.getDay()
        periodDate.setDate(periodDate.getDate() - day)
        periodDate.setHours(0, 0, 0, 0)
        break
      case 'monthly':
        periodDate.setDate(1)
        periodDate.setHours(0, 0, 0, 0)
        break
    }
    
    return periodDate
  }

  private static getPeriodRange(periodDate: Date, period: 'hourly' | 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date } {
    const start = new Date(periodDate)
    const end = new Date(periodDate)
    
    switch (period) {
      case 'hourly':
        end.setHours(end.getHours() + 1)
        break
      case 'daily':
        end.setDate(end.getDate() + 1)
        break
      case 'weekly':
        end.setDate(end.getDate() + 7)
        break
      case 'monthly':
        end.setMonth(end.getMonth() + 1)
        break
    }
    
    return { start, end }
  }

  private static calculateTopCategories<T extends string>(items: T[]): Array<{ type: T; count: number }> {
    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1
      return acc
    }, {} as Record<T, number>)
    
    return Object.entries(counts)
      .map(([type, count]) => ({ type: type as T, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }
}