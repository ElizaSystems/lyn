import { getDatabase } from '@/lib/mongodb'
import { ThreatData, ThreatPattern, ThreatType, ThreatSeverity } from '@/lib/models/threat-feed'
import { ObjectId } from 'mongodb'
import { logger } from '@/lib/logger'

interface PatternMatch {
  patternId: string
  patternName: string
  score: number
  triggeredRules: Array<{
    field: string
    operator: string
    value: string
    weight: number
    actualValue: unknown
  }>
  actions: Array<{
    type: string
    parameters: Record<string, unknown>
    applied: boolean
  }>
}

interface AnalyticsResult {
  threatTrends: {
    daily: Array<{ date: string; count: number; types: Record<ThreatType, number> }>
    weekly: Array<{ week: string; count: number; averageSeverity: number }>
    monthly: Array<{ month: string; count: number; topSources: Array<{ source: string; count: number }> }>
  }
  patternAnalysis: {
    emergingPatterns: Array<{
      description: string
      frequency: number
      samples: string[]
      recommendation: string
    }>
    topTargets: Array<{
      target: string
      threatCount: number
      severityDistribution: Record<ThreatSeverity, number>
    }>
  }
  correlationInsights: {
    strongCorrelations: Array<{
      pattern: string
      correlation: number
      examples: string[]
    }>
    anomalies: Array<{
      description: string
      deviation: number
      samples: string[]
    }>
  }
}

export class ThreatPatternService {
  private static readonly DEFAULT_PATTERNS: Omit<ThreatPattern, '_id' | 'createdAt' | 'updatedAt' | 'statistics'>[] = [
    {
      patternId: 'phishing_url_pattern',
      name: 'Phishing URL Detection',
      description: 'Detects URLs with common phishing patterns',
      category: 'identity_theft',
      indicators: [
        { field: 'target.value', operator: 'regex', value: '(paypal|amazon|google|microsoft|apple|facebook|login|secure|verify|account)', weight: 0.4 },
        { field: 'target.value', operator: 'regex', value: '\\.(tk|ml|ga|cf|info|biz)', weight: 0.3 },
        { field: 'context.title', operator: 'contains', value: 'verify', weight: 0.3 }
      ],
      threshold: 0.7,
      actions: [
        { type: 'increase_severity', parameters: { targetSeverity: 'high' } },
        { type: 'add_tag', parameters: { tag: 'phishing_suspected' } }
      ],
      isActive: true
    },
    {
      patternId: 'rugpull_token_pattern',
      name: 'Rugpull Token Detection',
      description: 'Detects potential rugpull tokens based on behavior patterns',
      category: 'financial',
      indicators: [
        { field: 'type', operator: 'equals', value: 'rugpull', weight: 0.5 },
        { field: 'target.type', operator: 'equals', value: 'contract', weight: 0.3 },
        { field: 'confidence', operator: 'regex', value: '^([8-9][0-9]|100)$', weight: 0.2 }
      ],
      threshold: 0.8,
      actions: [
        { type: 'increase_severity', parameters: { targetSeverity: 'critical' } },
        { type: 'add_tag', parameters: { tag: 'rugpull_confirmed' } },
        { type: 'correlate', parameters: { searchField: 'attribution.actor' } }
      ],
      isActive: true
    },
    {
      patternId: 'coordinated_attack_pattern',
      name: 'Coordinated Attack Detection',
      description: 'Detects coordinated attacks from same actor/campaign',
      category: 'technical',
      indicators: [
        { field: 'attribution.actor', operator: 'regex', value: '.+', weight: 0.4 },
        { field: 'timeline.firstSeen', operator: 'regex', value: '.+', weight: 0.3 }, // Time-based clustering would be implemented separately
        { field: 'context.tags', operator: 'contains', value: 'campaign', weight: 0.3 }
      ],
      threshold: 0.6,
      actions: [
        { type: 'add_tag', parameters: { tag: 'coordinated_attack' } },
        { type: 'correlate', parameters: { searchField: 'attribution.campaign' } }
      ],
      isActive: true
    },
    {
      patternId: 'high_confidence_scam_pattern',
      name: 'High Confidence Scam Detection',
      description: 'Identifies highly confident scam reports for auto-escalation',
      category: 'financial',
      indicators: [
        { field: 'type', operator: 'equals', value: 'scam', weight: 0.3 },
        { field: 'confidence', operator: 'regex', value: '^(9[0-9]|100)$', weight: 0.4 },
        { field: 'source.reliability', operator: 'regex', value: '^(8[0-9]|9[0-9]|100)$', weight: 0.3 }
      ],
      threshold: 0.9,
      actions: [
        { type: 'increase_severity', parameters: { targetSeverity: 'critical' } },
        { type: 'add_tag', parameters: { tag: 'auto_verified' } },
        { type: 'notify', parameters: { urgency: 'high' } }
      ],
      isActive: true
    },
    {
      patternId: 'wallet_drainer_pattern',
      name: 'Wallet Drainer Detection',
      description: 'Detects wallet drainer malware patterns',
      category: 'technical',
      indicators: [
        { field: 'type', operator: 'equals', value: 'drainer', weight: 0.4 },
        { field: 'target.type', operator: 'equals', value: 'wallet', weight: 0.3 },
        { field: 'context.description', operator: 'regex', value: '(drain|empty|steal|transfer)', weight: 0.3 }
      ],
      threshold: 0.7,
      actions: [
        { type: 'increase_severity', parameters: { targetSeverity: 'critical' } },
        { type: 'add_tag', parameters: { tag: 'wallet_drainer' } },
        { type: 'add_tag', parameters: { tag: 'immediate_action_required' } }
      ],
      isActive: true
    }
  ]

  /**
   * Initialize default patterns in database
   */
  static async initializeDefaultPatterns(): Promise<void> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatPattern>('threat_patterns')

      for (const pattern of this.DEFAULT_PATTERNS) {
        await collection.updateOne(
          { patternId: pattern.patternId },
          {
            $setOnInsert: {
              ...pattern,
              statistics: {
                timesTriggered: 0,
                accuracy: 0,
                falsePositives: 0
              },
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        )
      }

      logger.info(`[ThreatPattern] Initialized ${this.DEFAULT_PATTERNS.length} default patterns`)

    } catch (error) {
      logger.error('[ThreatPattern] Failed to initialize default patterns:', error)
    }
  }

  /**
   * Apply pattern matching to a threat
   */
  static async applyPatterns(threat: ThreatData): Promise<PatternMatch[]> {
    try {
      const db = await getDatabase()
      const patternCollection = db.collection<ThreatPattern>('threat_patterns')

      const activePatterns = await patternCollection.find({ isActive: true }).toArray()
      const matches: PatternMatch[] = []

      for (const pattern of activePatterns) {
        const match = await this.evaluatePattern(threat, pattern)
        
        if (match.score >= pattern.threshold) {
          // Apply actions
          const appliedActions = await this.applyPatternActions(threat, pattern, match)
          match.actions = appliedActions

          matches.push(match)

          // Update pattern statistics
          await this.updatePatternStats(pattern._id!.toString(), true)
        }
      }

      return matches

    } catch (error) {
      logger.error('[ThreatPattern] Failed to apply patterns:', error)
      return []
    }
  }

  /**
   * Evaluate a single pattern against a threat
   */
  private static async evaluatePattern(threat: ThreatData, pattern: ThreatPattern): Promise<PatternMatch> {
    const match: PatternMatch = {
      patternId: pattern.patternId,
      patternName: pattern.name,
      score: 0,
      triggeredRules: [],
      actions: []
    }

    let totalWeight = 0
    let matchedWeight = 0

    for (const indicator of pattern.indicators) {
      totalWeight += indicator.weight
      const fieldValue = this.getFieldValue(threat, indicator.field)
      const isMatch = this.evaluateIndicator(fieldValue, indicator.operator, indicator.value)

      if (isMatch) {
        matchedWeight += indicator.weight
        match.triggeredRules.push({
          field: indicator.field,
          operator: indicator.operator,
          value: indicator.value,
          weight: indicator.weight,
          actualValue: fieldValue
        })
      }
    }

    match.score = totalWeight > 0 ? matchedWeight / totalWeight : 0
    return match
  }

  /**
   * Apply pattern actions to a threat
   */
  private static async applyPatternActions(threat: ThreatData, pattern: ThreatPattern, match: PatternMatch): Promise<PatternMatch['actions']> {
    const appliedActions: PatternMatch['actions'] = []

    try {
      const db = await getDatabase()
      const threatCollection = db.collection<ThreatData>('threat_feed')

      for (const action of pattern.actions) {
        let applied = false

        try {
          switch (action.type) {
            case 'increase_severity':
              const targetSeverity = action.parameters.targetSeverity as ThreatSeverity
              if (this.shouldIncreaseSeverity(threat.severity, targetSeverity)) {
                await threatCollection.updateOne(
                  { _id: threat._id },
                  { $set: { severity: targetSeverity, updatedAt: new Date() } }
                )
                applied = true
              }
              break

            case 'add_tag':
              const tag = action.parameters.tag as string
              if (!threat.context.tags.includes(tag)) {
                await threatCollection.updateOne(
                  { _id: threat._id },
                  { 
                    $addToSet: { 'context.tags': tag },
                    $set: { updatedAt: new Date() }
                  }
                )
                applied = true
              }
              break

            case 'correlate':
              // Trigger correlation analysis
              applied = await this.triggerCorrelation(threat, action.parameters)
              break

            case 'notify':
              // Trigger notification
              applied = await this.triggerNotification(threat, action.parameters)
              break

            case 'auto_resolve':
              // Auto-resolve low confidence false positives
              if (threat.confidence < 30) {
                await threatCollection.updateOne(
                  { _id: threat._id },
                  { $set: { status: 'false_positive', updatedAt: new Date() } }
                )
                applied = true
              }
              break
          }

        } catch (actionError) {
          logger.error(`[ThreatPattern] Failed to apply action ${action.type}:`, actionError)
        }

        appliedActions.push({
          type: action.type,
          parameters: action.parameters,
          applied
        })
      }

    } catch (error) {
      logger.error('[ThreatPattern] Failed to apply pattern actions:', error)
    }

    return appliedActions
  }

  /**
   * Generate comprehensive threat analytics
   */
  static async generateAnalytics(days = 30): Promise<AnalyticsResult> {
    try {
      const db = await getDatabase()
      const threatCollection = db.collection<ThreatData>('threat_feed')

      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))

      // Generate trend analysis
      const threatTrends = await this.generateTrendAnalysis(threatCollection, startDate, endDate)

      // Generate pattern analysis
      const patternAnalysis = await this.generatePatternAnalysis(threatCollection, startDate, endDate)

      // Generate correlation insights
      const correlationInsights = await this.generateCorrelationInsights(threatCollection, startDate, endDate)

      return {
        threatTrends,
        patternAnalysis,
        correlationInsights
      }

    } catch (error) {
      logger.error('[ThreatPattern] Failed to generate analytics:', error)
      throw error
    }
  }

  /**
   * Generate threat trend analysis
   */
  private static async generateTrendAnalysis(collection: any, startDate: Date, endDate: Date) {
    // Daily trends
    const dailyPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          types: { $push: "$type" }
        }
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          types: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: "$types" },
                as: "type",
                in: {
                  k: "$$type",
                  v: {
                    $size: {
                      $filter: {
                        input: "$types",
                        cond: { $eq: ["$$this", "$$type"] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      { $sort: { date: 1 } }
    ]

    const daily = await collection.aggregate(dailyPipeline).toArray()

    // Weekly trends
    const weeklyPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-W%U", date: "$createdAt" } },
          count: { $sum: 1 },
          averageSeverity: { $avg: { $switch: {
            branches: [
              { case: { $eq: ["$severity", "info"] }, then: 1 },
              { case: { $eq: ["$severity", "low"] }, then: 2 },
              { case: { $eq: ["$severity", "medium"] }, then: 3 },
              { case: { $eq: ["$severity", "high"] }, then: 4 },
              { case: { $eq: ["$severity", "critical"] }, then: 5 }
            ],
            default: 3
          }}}
        }
      },
      {
        $project: {
          week: "$_id",
          count: 1,
          averageSeverity: { $round: ["$averageSeverity", 2] }
        }
      },
      { $sort: { week: 1 } }
    ]

    const weekly = await collection.aggregate(weeklyPipeline).toArray()

    // Monthly trends with top sources
    const monthlyPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
          sources: { $push: "$source.id" }
        }
      },
      {
        $project: {
          month: "$_id",
          count: 1,
          topSources: {
            $map: {
              input: { $slice: [
                {
                  $map: {
                    input: { $setUnion: "$sources" },
                    as: "source",
                    in: {
                      source: "$$source",
                      count: {
                        $size: {
                          $filter: {
                            input: "$sources",
                            cond: { $eq: ["$$this", "$$source"] }
                          }
                        }
                      }
                    }
                  }
                },
                5
              ] },
              as: "item",
              in: "$$item"
            }
          }
        }
      },
      { $sort: { month: 1 } }
    ]

    const monthly = await collection.aggregate(monthlyPipeline).toArray()

    return { daily, weekly, monthly }
  }

  /**
   * Generate pattern analysis
   */
  private static async generatePatternAnalysis(collection: any, startDate: Date, endDate: Date) {
    // Emerging patterns - look for sudden increases in specific threat patterns
    const emergingPatterns = await this.detectEmergingPatterns(collection, startDate, endDate)

    // Top targets analysis
    const topTargetsPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$target.value",
          threatCount: { $sum: 1 },
          severities: { $push: "$severity" }
        }
      },
      {
        $project: {
          target: "$_id",
          threatCount: 1,
          severityDistribution: {
            $arrayToObject: {
              $map: {
                input: ["info", "low", "medium", "high", "critical"],
                as: "severity",
                in: {
                  k: "$$severity",
                  v: {
                    $size: {
                      $filter: {
                        input: "$severities",
                        cond: { $eq: ["$$this", "$$severity"] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      { $sort: { threatCount: -1 } },
      { $limit: 10 }
    ]

    const topTargets = await collection.aggregate(topTargetsPipeline).toArray()

    return { emergingPatterns, topTargets }
  }

  /**
   * Detect emerging patterns in threat data
   */
  private static async detectEmergingPatterns(collection: any, startDate: Date, endDate: Date) {
    // This is a simplified version - in production, you'd use more sophisticated ML algorithms
    const patterns = []

    // Look for unusual spikes in specific threat types
    const typeSpikePipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { 
            type: "$type",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
          },
          count: { $sum: 1 },
          samples: { $push: "$threatId" }
        }
      },
      {
        $group: {
          _id: "$_id.type",
          dailyCounts: { $push: "$count" },
          avgDaily: { $avg: "$count" },
          maxDaily: { $max: "$count" },
          samples: { $first: { $slice: ["$samples", 3] } }
        }
      },
      {
        $match: {
          $expr: { $gt: ["$maxDaily", { $multiply: ["$avgDaily", 2] }] }
        }
      }
    ]

    const spikes = await collection.aggregate(typeSpikePipeline).toArray()

    for (const spike of spikes) {
      patterns.push({
        description: `Unusual spike in ${spike._id} threats`,
        frequency: spike.maxDaily,
        samples: spike.samples,
        recommendation: `Investigate recent ${spike._id} activity and consider additional monitoring`
      })
    }

    return patterns
  }

  /**
   * Generate correlation insights
   */
  private static async generateCorrelationInsights(collection: any, startDate: Date, endDate: Date) {
    const strongCorrelations = []
    const anomalies = []

    // Look for strong correlations between threat attributes
    const attributeCorrelationPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            type: "$type",
            severity: "$severity"
          },
          count: { $sum: 1 },
          examples: { $push: "$threatId" }
        }
      },
      {
        $match: {
          count: { $gte: 5 }
        }
      },
      {
        $project: {
          pattern: { $concat: ["$_id.type", " + ", "$_id.severity"] },
          correlation: { $divide: ["$count", 10] }, // Simplified correlation score
          examples: { $slice: ["$examples", 3] }
        }
      }
    ]

    const correlations = await collection.aggregate(attributeCorrelationPipeline).toArray()
    strongCorrelations.push(...correlations.slice(0, 5))

    // Detect anomalies (threats that don't fit common patterns)
    const anomalyPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            type: "$type",
            severity: "$severity",
            sourceType: "$source.type"
          },
          count: { $sum: 1 },
          avgConfidence: { $avg: "$confidence" },
          samples: { $push: "$threatId" }
        }
      },
      {
        $match: {
          $or: [
            { count: 1 }, // Unique combinations
            { avgConfidence: { $lt: 30 } } // Low confidence
          ]
        }
      },
      {
        $project: {
          description: { $concat: ["Unusual ", "$_id.type", " with ", "$_id.severity", " severity"] },
          deviation: { $subtract: [50, "$avgConfidence"] },
          samples: { $slice: ["$samples", 2] }
        }
      },
      { $limit: 5 }
    ]

    const detectedAnomalies = await collection.aggregate(anomalyPipeline).toArray()
    anomalies.push(...detectedAnomalies)

    return { strongCorrelations, anomalies }
  }

  // Utility methods
  
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
    if (typeof value !== 'string' && typeof value !== 'number') return false

    const stringValue = String(value)

    switch (operator) {
      case 'equals':
        return stringValue === targetValue
      case 'contains':
        return stringValue.toLowerCase().includes(targetValue.toLowerCase())
      case 'starts_with':
        return stringValue.toLowerCase().startsWith(targetValue.toLowerCase())
      case 'ends_with':
        return stringValue.toLowerCase().endsWith(targetValue.toLowerCase())
      case 'regex':
        try {
          const regex = new RegExp(targetValue, 'i')
          return regex.test(stringValue)
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

  private static async updatePatternStats(patternId: string, wasTriggered: boolean): Promise<void> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatPattern>('threat_patterns')

      const update: any = {
        $set: { 'statistics.lastTriggered': new Date() }
      }

      if (wasTriggered) {
        update.$inc = { 'statistics.timesTriggered': 1 }
      }

      await collection.updateOne(
        { _id: new ObjectId(patternId) },
        update
      )

    } catch (error) {
      logger.error('[ThreatPattern] Failed to update pattern statistics:', error)
    }
  }

  private static async triggerCorrelation(threat: ThreatData, parameters: Record<string, unknown>): Promise<boolean> {
    try {
      // This would trigger additional correlation analysis
      // For now, just return true
      return true
    } catch (error) {
      logger.error('[ThreatPattern] Failed to trigger correlation:', error)
      return false
    }
  }

  private static async triggerNotification(threat: ThreatData, parameters: Record<string, unknown>): Promise<boolean> {
    try {
      // This would trigger urgent notifications
      // For now, just log it
      logger.warn(`[ThreatPattern] High priority threat detected: ${threat.threatId}`)
      return true
    } catch (error) {
      logger.error('[ThreatPattern] Failed to trigger notification:', error)
      return false
    }
  }

  /**
   * Create custom pattern
   */
  static async createPattern(pattern: Omit<ThreatPattern, '_id' | 'createdAt' | 'updatedAt' | 'statistics'>): Promise<ThreatPattern> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatPattern>('threat_patterns')

      const now = new Date()
      const newPattern: ThreatPattern = {
        ...pattern,
        statistics: {
          timesTriggered: 0,
          accuracy: 0,
          falsePositives: 0
        },
        createdAt: now,
        updatedAt: now
      }

      const result = await collection.insertOne(newPattern)
      return { ...newPattern, _id: result.insertedId }

    } catch (error) {
      logger.error('[ThreatPattern] Failed to create pattern:', error)
      throw error
    }
  }

  /**
   * Get all patterns
   */
  static async getAllPatterns(): Promise<ThreatPattern[]> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatPattern>('threat_patterns')

      return await collection.find({}).sort({ createdAt: -1 }).toArray()

    } catch (error) {
      logger.error('[ThreatPattern] Failed to get patterns:', error)
      return []
    }
  }

  /**
   * Update pattern
   */
  static async updatePattern(patternId: string, updates: Partial<ThreatPattern>): Promise<ThreatPattern | null> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatPattern>('threat_patterns')

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(patternId) },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )

      return result

    } catch (error) {
      logger.error('[ThreatPattern] Failed to update pattern:', error)
      return null
    }
  }
}