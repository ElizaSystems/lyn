import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { ThreatData, ThreatCorrelation, ThreatIndicator } from '@/lib/models/threat-feed'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

interface SimilarityScore {
  overall: number
  indicators: number
  targets: number
  attribution: number
  temporal: number
  content: number
}

interface DeduplicationResult {
  isDuplicate: boolean
  originalThreatId?: ObjectId
  similarityScore: number
  reason: string
}

export class ThreatCorrelationService {
  private static readonly DUPLICATE_THRESHOLD = 0.85
  private static readonly CORRELATION_THRESHOLD = 0.7
  private static readonly BATCH_SIZE = 100
  private static readonly MAX_CORRELATIONS_PER_THREAT = 50

  /**
   * Check for duplicates before adding a new threat
   */
  static async checkForDuplicate(newThreat: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>): Promise<DeduplicationResult> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')

      // Generate hash for exact duplicate detection
      const threatHash = this.generateThreatHash(newThreat)
      
      // Check for exact hash match first
      const exactMatch = await collection.findOne({ hash: threatHash })
      if (exactMatch) {
        return {
          isDuplicate: true,
          originalThreatId: exactMatch._id,
          similarityScore: 1.0,
          reason: 'Exact hash match'
        }
      }

      // Check for potential duplicates using similarity analysis
      const candidates = await this.findDuplicateCandidates(newThreat)
      
      for (const candidate of candidates) {
        const similarity = await this.calculateSimilarity(newThreat, candidate)
        
        if (similarity.overall >= this.DUPLICATE_THRESHOLD) {
          return {
            isDuplicate: true,
            originalThreatId: candidate._id,
            similarityScore: similarity.overall,
            reason: this.generateSimilarityReason(similarity)
          }
        }
      }

      return {
        isDuplicate: false,
        similarityScore: 0,
        reason: 'No duplicates found'
      }

    } catch (error) {
      logger.error('[ThreatCorrelation] Failed to check for duplicates:', error)
      throw new Error('Failed to check for duplicates')
    }
  }

  /**
   * Find correlation candidates for a threat
   */
  static async findCorrelationCandidates(threat: ThreatData): Promise<ThreatData[]> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')

      // Build query to find potential correlations
      const query = {
        _id: { $ne: threat._id },
        status: 'active',
        $or: [
          // Same target value
          { 'target.value': threat.target.value },
          // Same indicators
          { 'indicators.value': { $in: threat.indicators.map(i => i.value) } },
          // Same attribution
          ...(threat.attribution?.actor ? [{ 'attribution.actor': threat.attribution.actor }] : []),
          ...(threat.attribution?.campaign ? [{ 'attribution.campaign': threat.attribution.campaign }] : []),
          // Similar tags
          { 'context.tags': { $in: threat.context.tags } },
          // Same source type and category
          { 
            $and: [
              { 'source.type': threat.source.type },
              { 'category': threat.category }
            ]
          }
        ]
      }

      const candidates = await collection
        .find(query)
        .limit(this.BATCH_SIZE)
        .toArray()

      return candidates

    } catch (error) {
      logger.error('[ThreatCorrelation] Failed to find correlation candidates:', error)
      return []
    }
  }

  /**
   * Perform comprehensive correlation analysis
   */
  static async performCorrelationAnalysis(threat: ThreatData): Promise<ThreatCorrelation[]> {
    try {
      const candidates = await this.findCorrelationCandidates(threat)
      const correlations: ThreatCorrelation[] = []

      for (const candidate of candidates) {
        const similarity = await this.calculateSimilarity(threat, candidate)
        
        if (similarity.overall >= this.CORRELATION_THRESHOLD) {
          const correlation = await this.createCorrelation(threat, candidate, similarity)
          correlations.push(correlation)
          
          if (correlations.length >= this.MAX_CORRELATIONS_PER_THREAT) {
            break
          }
        }
      }

      // Save correlations to database
      if (correlations.length > 0) {
        await this.saveCorrelations(correlations)
        await this.updateThreatCorrelations(threat, correlations)
      }

      logger.info(`[ThreatCorrelation] Found ${correlations.length} correlations for threat ${threat.threatId}`)
      return correlations

    } catch (error) {
      logger.error('[ThreatCorrelation] Failed to perform correlation analysis:', error)
      return []
    }
  }

  /**
   * Calculate comprehensive similarity score between two threats
   */
  static async calculateSimilarity(threat1: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'> | ThreatData, threat2: ThreatData): Promise<SimilarityScore> {
    const scores: SimilarityScore = {
      overall: 0,
      indicators: 0,
      targets: 0,
      attribution: 0,
      temporal: 0,
      content: 0
    }

    // Calculate indicator similarity
    scores.indicators = this.calculateIndicatorSimilarity(threat1.indicators, threat2.indicators)

    // Calculate target similarity
    scores.targets = this.calculateTargetSimilarity(threat1.target, threat2.target)

    // Calculate attribution similarity
    scores.attribution = this.calculateAttributionSimilarity(threat1.attribution, threat2.attribution)

    // Calculate temporal similarity
    scores.temporal = this.calculateTemporalSimilarity(threat1.timeline, threat2.timeline)

    // Calculate content similarity
    scores.content = this.calculateContentSimilarity(threat1.context, threat2.context)

    // Calculate weighted overall score
    scores.overall = (
      scores.indicators * 0.25 +
      scores.targets * 0.25 +
      scores.attribution * 0.2 +
      scores.temporal * 0.15 +
      scores.content * 0.15
    )

    return scores
  }

  /**
   * Calculate indicator similarity
   */
  private static calculateIndicatorSimilarity(indicators1: ThreatIndicator[], indicators2: ThreatIndicator[]): number {
    if (indicators1.length === 0 && indicators2.length === 0) return 1.0
    if (indicators1.length === 0 || indicators2.length === 0) return 0.0

    const set1 = new Set(indicators1.map(i => `${i.type}:${i.value}`))
    const set2 = new Set(indicators2.map(i => `${i.type}:${i.value}`))

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size // Jaccard similarity
  }

  /**
   * Calculate target similarity
   */
  private static calculateTargetSimilarity(target1: ThreatData['target'], target2: ThreatData['target']): number {
    let score = 0

    // Exact match
    if (target1.value === target2.value && target1.type === target2.type) {
      return 1.0
    }

    // Type match
    if (target1.type === target2.type) {
      score += 0.3
    }

    // Network match (for blockchain targets)
    if (target1.network && target2.network && target1.network === target2.network) {
      score += 0.2
    }

    // Value similarity for addresses/domains
    const valueSimilarity = this.calculateStringSimilarity(target1.value, target2.value)
    score += valueSimilarity * 0.5

    return Math.min(score, 1.0)
  }

  /**
   * Calculate attribution similarity
   */
  private static calculateAttributionSimilarity(attr1?: ThreatData['attribution'], attr2?: ThreatData['attribution']): number {
    if (!attr1 && !attr2) return 0.5 // Neutral score when both are undefined
    if (!attr1 || !attr2) return 0.0

    let score = 0
    let factors = 0

    // Actor similarity
    if (attr1.actor || attr2.actor) {
      factors++
      if (attr1.actor === attr2.actor) {
        score += 1.0
      } else if (attr1.actor && attr2.actor) {
        score += this.calculateStringSimilarity(attr1.actor, attr2.actor)
      }
    }

    // Campaign similarity
    if (attr1.campaign || attr2.campaign) {
      factors++
      if (attr1.campaign === attr2.campaign) {
        score += 1.0
      } else if (attr1.campaign && attr2.campaign) {
        score += this.calculateStringSimilarity(attr1.campaign, attr2.campaign)
      }
    }

    // Malware family similarity
    if (attr1.malwareFamily || attr2.malwareFamily) {
      factors++
      if (attr1.malwareFamily === attr2.malwareFamily) {
        score += 1.0
      } else if (attr1.malwareFamily && attr2.malwareFamily) {
        score += this.calculateStringSimilarity(attr1.malwareFamily, attr2.malwareFamily)
      }
    }

    // Techniques similarity
    if (attr1.techniques || attr2.techniques) {
      factors++
      if (attr1.techniques && attr2.techniques) {
        const set1 = new Set(attr1.techniques)
        const set2 = new Set(attr2.techniques)
        const intersection = new Set([...set1].filter(x => set2.has(x)))
        const union = new Set([...set1, ...set2])
        score += intersection.size / union.size
      }
    }

    return factors > 0 ? score / factors : 0.0
  }

  /**
   * Calculate temporal similarity
   */
  private static calculateTemporalSimilarity(timeline1: ThreatData['timeline'], timeline2: ThreatData['timeline']): number {
    const timeDiff = Math.abs(timeline1.firstSeen.getTime() - timeline2.firstSeen.getTime())
    const maxDiff = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

    // Similarity decreases over time, 0 after 30 days
    return Math.max(0, 1 - (timeDiff / maxDiff))
  }

  /**
   * Calculate content similarity
   */
  private static calculateContentSimilarity(context1: ThreatData['context'], context2: ThreatData['context']): number {
    let score = 0

    // Title similarity
    const titleSimilarity = this.calculateStringSimilarity(context1.title, context2.title)
    score += titleSimilarity * 0.4

    // Description similarity
    const descSimilarity = this.calculateStringSimilarity(context1.description, context2.description)
    score += descSimilarity * 0.4

    // Tags similarity
    const tagsSimilarity = this.calculateArraySimilarity(context1.tags, context2.tags)
    score += tagsSimilarity * 0.2

    return score
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0
    if (!str1 || !str2) return 0.0

    const maxLen = Math.max(str1.length, str2.length)
    if (maxLen === 0) return 1.0

    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase())
    return 1 - (distance / maxLen)
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Calculate array similarity (Jaccard index)
   */
  private static calculateArraySimilarity(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 && arr2.length === 0) return 1.0
    if (arr1.length === 0 || arr2.length === 0) return 0.0

    const set1 = new Set(arr1)
    const set2 = new Set(arr2)
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size
  }

  /**
   * Find duplicate candidates using efficient queries
   */
  private static async findDuplicateCandidates(threat: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>): Promise<ThreatData[]> {
    const db = await getDatabase()
    const collection = db.collection<ThreatData>('threat_feed')

    // Build a more targeted query for duplicates
    const query = {
      status: 'active',
      $or: [
        // Same target and type
        {
          'target.value': threat.target.value,
          'type': threat.type
        },
        // Same title with high similarity threshold
        {
          'context.title': { $regex: this.escapeRegExp(threat.context.title), $options: 'i' }
        },
        // Same indicators
        {
          'indicators.value': { $in: threat.indicators.slice(0, 5).map(i => i.value) }
        }
      ]
    }

    return await collection
      .find(query)
      .limit(20) // Limit for performance
      .toArray()
  }

  /**
   * Create correlation object
   */
  private static async createCorrelation(threat1: ThreatData, threat2: ThreatData, similarity: SimilarityScore): Promise<ThreatCorrelation> {
    const correlationType = this.determineCorrelationType(threat1, threat2, similarity)
    
    return {
      parentThreatId: threat1._id!,
      childThreatId: threat2._id!,
      correlationType,
      confidence: similarity.overall,
      evidence: {
        commonIndicators: this.getCommonIndicators(threat1.indicators, threat2.indicators),
        timelineSimilarity: similarity.temporal,
        attributionSimilarity: similarity.attribution,
        targetSimilarity: similarity.targets
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  /**
   * Determine correlation type based on similarity scores
   */
  private static determineCorrelationType(threat1: ThreatData, threat2: ThreatData, similarity: SimilarityScore): ThreatCorrelation['correlationType'] {
    if (similarity.overall >= 0.9) {
      return 'duplicate'
    } else if (threat1.attribution?.campaign === threat2.attribution?.campaign && threat1.attribution.campaign) {
      return 'campaign'
    } else if (threat1.attribution?.actor === threat2.attribution?.actor && threat1.attribution.actor) {
      return 'attribution'
    } else if (similarity.targets >= 0.8) {
      return 'target_overlap'
    } else {
      return 'related'
    }
  }

  /**
   * Get common indicators between two threats
   */
  private static getCommonIndicators(indicators1: ThreatIndicator[], indicators2: ThreatIndicator[]): string[] {
    const values1 = indicators1.map(i => i.value)
    const values2 = indicators2.map(i => i.value)
    
    return values1.filter(value => values2.includes(value))
  }

  /**
   * Save correlations to database
   */
  private static async saveCorrelations(correlations: ThreatCorrelation[]): Promise<void> {
    const db = await getDatabase()
    const collection = db.collection<ThreatCorrelation>('threat_correlations')

    await collection.insertMany(correlations)
  }

  /**
   * Update threat documents with correlation references
   */
  private static async updateThreatCorrelations(threat: ThreatData, correlations: ThreatCorrelation[]): Promise<void> {
    const db = await getDatabase()
    const collection = db.collection<ThreatData>('threat_feed')

    const correlatedThreatIds = correlations.map(c => c.childThreatId)

    // Update the main threat
    await collection.updateOne(
      { _id: threat._id },
      { $addToSet: { correlatedThreats: { $each: correlatedThreatIds } } }
    )

    // Update correlated threats with bidirectional reference
    for (const correlatedId of correlatedThreatIds) {
      await collection.updateOne(
        { _id: correlatedId },
        { $addToSet: { correlatedThreats: threat._id } }
      )
    }
  }

  /**
   * Generate threat hash for exact duplicate detection
   */
  private static generateThreatHash(threat: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>): string {
    const hashData = {
      type: threat.type,
      target: threat.target,
      indicators: threat.indicators.map(i => ({ type: i.type, value: i.value })),
      title: threat.context.title.toLowerCase().trim()
    }

    return crypto.createHash('sha256').update(JSON.stringify(hashData)).digest('hex')
  }

  /**
   * Generate similarity reason string
   */
  private static generateSimilarityReason(similarity: SimilarityScore): string {
    const reasons: string[] = []

    if (similarity.indicators > 0.7) reasons.push('similar indicators')
    if (similarity.targets > 0.7) reasons.push('same target')
    if (similarity.attribution > 0.7) reasons.push('same attribution')
    if (similarity.temporal > 0.8) reasons.push('similar timeframe')
    if (similarity.content > 0.7) reasons.push('similar content')

    return reasons.length > 0 ? reasons.join(', ') : 'high overall similarity'
  }

  /**
   * Escape special regex characters
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Bulk correlation analysis for existing threats
   */
  static async performBulkCorrelationAnalysis(batchSize: number = 50): Promise<number> {
    try {
      const db = await getDatabase()
      const collection = db.collection<ThreatData>('threat_feed')

      // Get threats that don't have correlations yet
      const uncorrelatedThreats = await collection
        .find({
          status: 'active',
          correlatedThreats: { $size: 0 }
        })
        .limit(batchSize)
        .toArray()

      let totalCorrelations = 0

      for (const threat of uncorrelatedThreats) {
        const correlations = await this.performCorrelationAnalysis(threat)
        totalCorrelations += correlations.length
      }

      logger.info(`[ThreatCorrelation] Bulk correlation analysis completed. Found ${totalCorrelations} correlations for ${uncorrelatedThreats.length} threats`)
      return totalCorrelations

    } catch (error) {
      logger.error('[ThreatCorrelation] Failed to perform bulk correlation analysis:', error)
      return 0
    }
  }
}