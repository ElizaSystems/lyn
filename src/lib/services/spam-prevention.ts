import { db, MongoSpamDetection } from '@/lib/mongodb'

export interface SpamCheckResult {
  isSpam: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  reasons: string[]
  confidence: number
  autoAction?: 'warn' | 'throttle' | 'suspend'
  shouldBlock: boolean
}

export interface ContentAnalysis {
  duplicateScore: number
  qualityScore: number
  suspiciousPatterns: string[]
  languageFlags: string[]
}

export class SpamPreventionService {
  
  // Spam detection thresholds
  private static readonly THRESHOLDS = {
    RAPID_SUBMISSION: {
      HOUR: 10,
      DAY: 50,
      WEEK: 200
    },
    DUPLICATE_SIMILARITY: 0.8,
    MIN_CONTENT_QUALITY: 0.3,
    REPUTATION_THRESHOLD: 200
  }

  /**
   * Comprehensive spam check for feedback submission
   */
  static async checkFeedbackSpam(
    userId: string,
    walletAddress: string,
    content: {
      description: string
      feedbackType: string
      evidence?: any
      tags?: string[]
    }
  ): Promise<SpamCheckResult> {
    const checks = await Promise.all([
      this.checkSubmissionRate(userId, walletAddress),
      this.checkContentDuplication(userId, content.description),
      this.checkContentQuality(content.description),
      this.checkSuspiciousPatterns(userId, content),
      this.checkUserReputation(userId)
    ])

    const results = checks.filter(check => check !== null) as SpamCheckResult[]
    
    // Combine results
    const combinedResult = this.combineSpamResults(results)
    
    // Log spam detection if significant
    if (combinedResult.isSpam || combinedResult.severity !== 'low') {
      await this.logSpamDetection(userId, walletAddress, 'feedback_submission', combinedResult, {
        content: content.description.substring(0, 200),
        feedbackType: content.feedbackType,
        hasEvidence: !!content.evidence,
        tagCount: content.tags?.length || 0
      })
    }

    return combinedResult
  }

  /**
   * Check submission rate limits
   */
  private static async checkSubmissionRate(
    userId: string, 
    walletAddress: string
  ): Promise<SpamCheckResult | null> {
    try {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const database = await db.getDatabase()
      const feedbackCollection = database.collection('community_feedback')

      const [hourlyCount, dailyCount, weeklyCount] = await Promise.all([
        feedbackCollection.countDocuments({
          reporterUserId: userId,
          createdAt: { $gte: hourAgo }
        }),
        feedbackCollection.countDocuments({
          reporterUserId: userId,
          createdAt: { $gte: dayAgo }
        }),
        feedbackCollection.countDocuments({
          reporterUserId: userId,
          createdAt: { $gte: weekAgo }
        })
      ])

      const reasons: string[] = []
      let severity: SpamCheckResult['severity'] = 'low'
      let confidence = 0

      if (hourlyCount >= this.THRESHOLDS.RAPID_SUBMISSION.HOUR) {
        reasons.push(`${hourlyCount} submissions in the last hour (limit: ${this.THRESHOLDS.RAPID_SUBMISSION.HOUR})`)
        severity = 'high'
        confidence += 40
      }

      if (dailyCount >= this.THRESHOLDS.RAPID_SUBMISSION.DAY) {
        reasons.push(`${dailyCount} submissions in the last day (limit: ${this.THRESHOLDS.RAPID_SUBMISSION.DAY})`)
        severity = 'medium'
        confidence += 30
      }

      if (weeklyCount >= this.THRESHOLDS.RAPID_SUBMISSION.WEEK) {
        reasons.push(`${weeklyCount} submissions in the last week (limit: ${this.THRESHOLDS.RAPID_SUBMISSION.WEEK})`)
        severity = 'medium'
        confidence += 20
      }

      if (reasons.length === 0) return null

      return {
        isSpam: true,
        severity,
        reasons,
        confidence: Math.min(100, confidence),
        autoAction: severity === 'high' ? 'throttle' : 'warn',
        shouldBlock: severity === 'high'
      }

    } catch (error) {
      console.error('[SpamPrevention] Rate check failed:', error)
      return null
    }
  }

  /**
   * Check for content duplication
   */
  private static async checkContentDuplication(
    userId: string, 
    description: string
  ): Promise<SpamCheckResult | null> {
    try {
      const database = await db.getDatabase()
      const feedbackCollection = database.collection('community_feedback')

      // Get recent feedback from the same user
      const recentFeedback = await feedbackCollection
        .find({
          reporterUserId: userId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        })
        .toArray()

      const reasons: string[] = []
      let maxSimilarity = 0
      let duplicateCount = 0

      for (const feedback of recentFeedback) {
        const similarity = this.calculateTextSimilarity(description, feedback.description)
        maxSimilarity = Math.max(maxSimilarity, similarity)
        
        if (similarity >= this.THRESHOLDS.DUPLICATE_SIMILARITY) {
          duplicateCount++
          reasons.push(`${Math.round(similarity * 100)}% similarity to previous submission`)
        }
      }

      if (duplicateCount === 0) return null

      const severity: SpamCheckResult['severity'] = 
        duplicateCount >= 3 ? 'critical' :
        duplicateCount >= 2 ? 'high' : 
        maxSimilarity >= 0.95 ? 'high' : 'medium'

      return {
        isSpam: true,
        severity,
        reasons,
        confidence: Math.round(maxSimilarity * 100),
        autoAction: severity === 'critical' ? 'suspend' : severity === 'high' ? 'throttle' : 'warn',
        shouldBlock: severity === 'critical' || severity === 'high'
      }

    } catch (error) {
      console.error('[SpamPrevention] Duplication check failed:', error)
      return null
    }
  }

  /**
   * Check content quality
   */
  private static checkContentQuality(description: string): SpamCheckResult | null {
    const analysis = this.analyzeContentQuality(description)
    
    if (analysis.qualityScore >= this.THRESHOLDS.MIN_CONTENT_QUALITY) {
      return null
    }

    const reasons = [
      `Low content quality score: ${Math.round(analysis.qualityScore * 100)}%`,
      ...analysis.suspiciousPatterns,
      ...analysis.languageFlags
    ]

    const severity: SpamCheckResult['severity'] = 
      analysis.qualityScore < 0.1 ? 'high' :
      analysis.qualityScore < 0.2 ? 'medium' : 'low'

    return {
      isSpam: analysis.qualityScore < 0.15,
      severity,
      reasons,
      confidence: Math.round((1 - analysis.qualityScore) * 100),
      autoAction: severity === 'high' ? 'warn' : undefined,
      shouldBlock: false // Don't block based on quality alone
    }
  }

  /**
   * Check for suspicious patterns
   */
  private static async checkSuspiciousPatterns(
    userId: string, 
    content: any
  ): Promise<SpamCheckResult | null> {
    try {
      const database = await db.getDatabase()
      const feedbackCollection = database.collection('community_feedback')

      // Get user's feedback history
      const userFeedback = await feedbackCollection
        .find({ reporterUserId: userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray()

      const reasons: string[] = []
      let suspicionScore = 0

      // Check for bot-like patterns
      const feedbackTypes = userFeedback.map(f => f.feedbackType)
      const uniqueTypes = new Set(feedbackTypes)
      
      if (feedbackTypes.length > 5 && uniqueTypes.size === 1) {
        reasons.push('Only submits one type of feedback')
        suspicionScore += 30
      }

      // Check for timing patterns (submissions at exact intervals)
      if (userFeedback.length >= 3) {
        const intervals = []
        for (let i = 1; i < Math.min(userFeedback.length, 10); i++) {
          const interval = userFeedback[i-1].createdAt.getTime() - userFeedback[i].createdAt.getTime()
          intervals.push(interval)
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const variance = intervals.reduce((sum, interval) => {
          return sum + Math.pow(interval - avgInterval, 2)
        }, 0) / intervals.length

        // Low variance indicates regular timing (potential bot)
        if (variance < avgInterval * 0.1) {
          reasons.push('Suspiciously regular submission timing')
          suspicionScore += 25
        }
      }

      // Check for excessive negative feedback
      const negativeCount = userFeedback.filter(f => f.sentiment === 'negative').length
      const negativeRatio = userFeedback.length > 0 ? negativeCount / userFeedback.length : 0
      
      if (negativeRatio > 0.9 && userFeedback.length >= 5) {
        reasons.push('Exclusively submits negative feedback')
        suspicionScore += 20
      }

      if (reasons.length === 0) return null

      const severity: SpamCheckResult['severity'] = 
        suspicionScore >= 50 ? 'high' :
        suspicionScore >= 30 ? 'medium' : 'low'

      return {
        isSpam: suspicionScore >= 40,
        severity,
        reasons,
        confidence: Math.min(100, suspicionScore * 2),
        autoAction: severity === 'high' ? 'warn' : undefined,
        shouldBlock: false
      }

    } catch (error) {
      console.error('[SpamPrevention] Pattern check failed:', error)
      return null
    }
  }

  /**
   * Check user reputation
   */
  private static async checkUserReputation(userId: string): Promise<SpamCheckResult | null> {
    try {
      const reputation = await db.userReputation.findByUserId(userId)
      
      if (!reputation) return null
      
      const reasons: string[] = []
      let riskScore = 0

      if (reputation.reputationScore < this.THRESHOLDS.REPUTATION_THRESHOLD) {
        reasons.push(`Low reputation score: ${reputation.reputationScore}`)
        riskScore += 20
      }

      if (reputation.penaltyPoints > 0) {
        reasons.push(`Has ${reputation.penaltyPoints} penalty points`)
        riskScore += reputation.penaltyPoints
      }

      if (reputation.statistics.spamReports > 0) {
        reasons.push(`Previously flagged for spam (${reputation.statistics.spamReports} times)`)
        riskScore += reputation.statistics.spamReports * 15
      }

      if (reasons.length === 0) return null

      const severity: SpamCheckResult['severity'] = 
        riskScore >= 60 ? 'high' :
        riskScore >= 30 ? 'medium' : 'low'

      return {
        isSpam: riskScore >= 50,
        severity,
        reasons,
        confidence: Math.min(100, riskScore),
        autoAction: riskScore >= 60 ? 'throttle' : 'warn',
        shouldBlock: riskScore >= 80
      }

    } catch (error) {
      console.error('[SpamPrevention] Reputation check failed:', error)
      return null
    }
  }

  /**
   * Combine multiple spam detection results
   */
  private static combineSpamResults(results: SpamCheckResult[]): SpamCheckResult {
    if (results.length === 0) {
      return {
        isSpam: false,
        severity: 'low',
        reasons: [],
        confidence: 0,
        shouldBlock: false
      }
    }

    const allReasons = results.flatMap(r => r.reasons)
    const maxSeverity = this.getMaxSeverity(results.map(r => r.severity))
    const avgConfidence = Math.round(
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    )
    
    const isSpam = results.some(r => r.isSpam)
    const shouldBlock = results.some(r => r.shouldBlock)
    
    // Determine auto action
    const actions = results.map(r => r.autoAction).filter(Boolean)
    const autoAction = actions.includes('suspend') ? 'suspend' :
                      actions.includes('throttle') ? 'throttle' :
                      actions.includes('warn') ? 'warn' : undefined

    return {
      isSpam,
      severity: maxSeverity,
      reasons: [...new Set(allReasons)], // Remove duplicates
      confidence: avgConfidence,
      autoAction,
      shouldBlock
    }
  }

  /**
   * Get the maximum severity level
   */
  private static getMaxSeverity(severities: SpamCheckResult['severity'][]): SpamCheckResult['severity'] {
    const order = ['low', 'medium', 'high', 'critical']
    const maxIndex = Math.max(...severities.map(s => order.indexOf(s)))
    return order[maxIndex] as SpamCheckResult['severity']
  }

  /**
   * Calculate text similarity using simple algorithm
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    
    if (words1.length === 0 && words2.length === 0) return 1
    if (words1.length === 0 || words2.length === 0) return 0
    
    const intersection = words1.filter(word => words2.includes(word))
    const union = new Set([...words1, ...words2])
    
    return intersection.length / union.size
  }

  /**
   * Analyze content quality
   */
  private static analyzeContentQuality(text: string): ContentAnalysis {
    let qualityScore = 1.0
    const suspiciousPatterns: string[] = []
    const languageFlags: string[] = []

    // Length check
    if (text.length < 10) {
      qualityScore -= 0.3
      suspiciousPatterns.push('Very short content')
    } else if (text.length > 1000) {
      qualityScore -= 0.1
      suspiciousPatterns.push('Unusually long content')
    }

    // Repetition check
    const words = text.toLowerCase().split(/\s+/)
    const uniqueWords = new Set(words)
    const repetitionRatio = 1 - (uniqueWords.size / words.length)
    
    if (repetitionRatio > 0.5) {
      qualityScore -= 0.4
      suspiciousPatterns.push('High word repetition')
    }

    // All caps check
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length
    if (capsRatio > 0.5) {
      qualityScore -= 0.2
      suspiciousPatterns.push('Excessive capitalization')
    }

    // Special character spam
    const specialChars = (text.match(/[!@#$%^&*()_+=\[\]{}|;:,.<>?]/g) || []).length
    const specialRatio = specialChars / text.length
    if (specialRatio > 0.1) {
      qualityScore -= 0.3
      suspiciousPatterns.push('Excessive special characters')
    }

    // URL spam check
    const urls = text.match(/https?:\/\/[^\s]+/g) || []
    if (urls.length > 3) {
      qualityScore -= 0.2
      suspiciousPatterns.push('Multiple URLs')
    }

    // Language quality (basic checks)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    if (sentences.length > 0) {
      const avgSentenceLength = words.length / sentences.length
      if (avgSentenceLength < 3) {
        qualityScore -= 0.1
        languageFlags.push('Very short sentences')
      }
    }

    return {
      duplicateScore: repetitionRatio,
      qualityScore: Math.max(0, qualityScore),
      suspiciousPatterns,
      languageFlags
    }
  }

  /**
   * Log spam detection
   */
  private static async logSpamDetection(
    userId: string,
    walletAddress: string,
    detectionType: string,
    result: SpamCheckResult,
    evidence: Record<string, any>
  ): Promise<void> {
    try {
      await db.spamDetection.create({
        userId,
        walletAddress,
        detectionType: detectionType as any,
        severity: result.severity,
        evidence: {
          reasons: result.reasons,
          confidence: result.confidence,
          autoAction: result.autoAction,
          ...evidence
        },
        status: 'active',
        autoAction: result.autoAction
      })
    } catch (error) {
      console.error('[SpamPrevention] Failed to log spam detection:', error)
    }
  }

  /**
   * Check if user is currently suspended or throttled
   */
  static async checkUserStatus(userId: string): Promise<{
    isSuspended: boolean
    isThrottled: boolean
    canSubmit: boolean
    reason?: string
    expiresAt?: Date
  }> {
    try {
      // Check for active suspensions
      const database = await db.getDatabase()
      const usersCollection = database.collection('users')
      
      const user = await usersCollection.findOne({ _id: new db.ObjectId(userId) })
      
      if (user?.suspended) {
        const suspendedUntil = user.suspendedUntil
        if (!suspendedUntil || suspendedUntil > new Date()) {
          return {
            isSuspended: true,
            isThrottled: false,
            canSubmit: false,
            reason: user.suspensionReason || 'Account suspended',
            expiresAt: suspendedUntil
          }
        }
      }

      // Check for active spam detections requiring throttling
      const spamDetections = await db.spamDetection.findActiveByUser(userId)
      const throttleDetection = spamDetections.find(d => 
        d.autoAction === 'throttle' && 
        d.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      )

      if (throttleDetection) {
        return {
          isSuspended: false,
          isThrottled: true,
          canSubmit: false,
          reason: 'Rate limited due to spam detection',
          expiresAt: new Date(throttleDetection.createdAt.getTime() + 24 * 60 * 60 * 1000)
        }
      }

      return {
        isSuspended: false,
        isThrottled: false,
        canSubmit: true
      }

    } catch (error) {
      console.error('[SpamPrevention] User status check failed:', error)
      // Fail safe - allow submission
      return {
        isSuspended: false,
        isThrottled: false,
        canSubmit: true
      }
    }
  }
}