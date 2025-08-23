import { ObjectId } from 'mongodb'
import { db, MongoCommunityFeedback, MongoCommunityVote, MongoUserReputation, MongoSpamDetection } from '@/lib/mongodb'
import { SpamPreventionService } from './spam-prevention'

export interface CommunityFeedbackSubmission {
  walletAddress: string
  feedbackType: MongoCommunityFeedback['feedbackType']
  sentiment: MongoCommunityFeedback['sentiment']
  description: string
  confidence: number
  evidence?: MongoCommunityFeedback['evidence']
  tags?: string[]
}

export interface VoteSubmission {
  feedbackId: string
  voteType: 'upvote' | 'downvote'
  reason?: string
}

export interface CommunityConsensus {
  walletAddress: string
  totalFeedback: number
  consensusScore: number
  trustScore: number
  riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
  majorityFeedbackType: string | null
  recentFeedback: Array<{
    type: string
    sentiment: string
    confidence: number
    weight: number
    createdAt: Date
  }>
  topContributors: Array<{
    walletAddress: string
    reputationScore: number
    tier: string
    feedbackCount: number
  }>
}

export class CommunityFeedbackService {
  
  /**
   * Submit new community feedback for a wallet
   */
  static async submitFeedback(
    reporterUserId: string,
    reporterWalletAddress: string,
    feedbackData: CommunityFeedbackSubmission
  ): Promise<MongoCommunityFeedback> {
    console.log(`[CommunityFeedback] ${reporterWalletAddress} submitting feedback for ${feedbackData.walletAddress}`)
    
    // Check user status (suspension, throttling)
    const userStatus = await SpamPreventionService.checkUserStatus(reporterUserId)
    if (!userStatus.canSubmit) {
      throw new Error(userStatus.reason || 'Account restricted from submitting feedback')
    }
    
    // Comprehensive spam check using the new spam prevention service
    const spamCheck = await SpamPreventionService.checkFeedbackSpam(
      reporterUserId,
      reporterWalletAddress,
      {
        description: feedbackData.description,
        feedbackType: feedbackData.feedbackType,
        evidence: feedbackData.evidence,
        tags: feedbackData.tags
      }
    )
    
    if (spamCheck.shouldBlock) {
      throw new Error(`Submission blocked: ${spamCheck.reasons.join(', ')}`)
    }
    
    if (spamCheck.isSpam && spamCheck.severity === 'high') {
      throw new Error(`High spam risk detected: ${spamCheck.reasons.join(', ')}`)
    }
    
    // Get or initialize reporter reputation
    let reputation = await db.userReputation.findByUserId(reporterUserId)
    if (!reputation) {
      reputation = await db.userReputation.initializeReputation(reporterUserId, reporterWalletAddress)
    }
    
    // Calculate feedback weight based on reporter reputation and spam check
    let weight = this.calculateFeedbackWeight(reputation, feedbackData.confidence)
    
    // Apply spam penalty to weight if detected
    if (spamCheck.isSpam) {
      weight *= (1 - (spamCheck.confidence / 200)) // Reduce weight based on spam confidence
      console.log(`[CommunityFeedback] Applied spam penalty, weight reduced to ${weight}`)
    }
    
    // Create feedback entry
    const feedback = await db.communityFeedback.create({
      ...feedbackData,
      reporterUserId,
      reporterWalletAddress,
      status: 'active',
      weight: Math.max(0.1, weight), // Minimum weight of 0.1
      confidence: Math.min(100, Math.max(0, feedbackData.confidence))
    })
    
    // Update reporter reputation and statistics
    await this.updateReporterReputation(reporterUserId, 'feedback_submitted', 5)
    
    // Apply spam penalties to reputation if detected
    if (spamCheck.isSpam && spamCheck.severity !== 'low') {
      const penaltyScore = spamCheck.severity === 'critical' ? -20 : 
                          spamCheck.severity === 'high' ? -10 : -5
      await this.updateReporterReputation(reporterUserId, 'spam_penalty', penaltyScore)
      console.log(`[CommunityFeedback] Applied ${penaltyScore} reputation penalty for ${spamCheck.severity} spam`)
    }
    
    // Update statistics
    await this.updateUserStatistics(reporterUserId, 'feedback_submitted')
    
    console.log(`[CommunityFeedback] Feedback submitted with ID: ${feedback._id}, weight: ${weight}`)
    return feedback
  }
  
  /**
   * Vote on existing feedback
   */
  static async voteFeedback(
    voterUserId: string,
    voterWalletAddress: string,
    voteData: VoteSubmission
  ): Promise<{ success: boolean; message: string }> {
    console.log(`[CommunityFeedback] ${voterWalletAddress} voting ${voteData.voteType} on ${voteData.feedbackId}`)
    
    const feedbackId = new ObjectId(voteData.feedbackId)
    const feedback = await db.communityFeedback.findById(voteData.feedbackId)
    
    if (!feedback) {
      throw new Error('Feedback not found')
    }
    
    // Prevent self-voting
    if (feedback.reporterUserId === voterUserId) {
      throw new Error('Cannot vote on your own feedback')
    }
    
    // Get voter reputation
    let voterReputation = await db.userReputation.findByUserId(voterUserId)
    if (!voterReputation) {
      voterReputation = await db.userReputation.initializeReputation(voterUserId, voterWalletAddress)
    }
    
    // Calculate vote weight based on voter reputation
    const voteWeight = this.calculateVoteWeight(voterReputation)
    
    // Check if user already voted
    const existingVote = await db.communityVotes.findExistingVote(feedbackId, voterUserId)
    
    if (existingVote) {
      if (existingVote.voteType === voteData.voteType) {
        return { success: false, message: 'You have already cast this vote' }
      }
      
      // Update existing vote
      await db.communityVotes.updateVote(existingVote._id!.toString(), voteData.voteType)
    } else {
      // Create new vote
      await db.communityVotes.create({
        feedbackId,
        voterUserId,
        voterWalletAddress,
        voteType: voteData.voteType,
        voterReputation: voterReputation.reputationScore,
        weight: voteWeight,
        reason: voteData.reason
      })
    }
    
    // Recalculate feedback vote statistics
    const voteStats = await db.communityVotes.getVoteStats(feedbackId)
    await db.communityFeedback.updateVotes(voteData.feedbackId, {
      upvotes: voteStats.upvotes,
      downvotes: voteStats.downvotes,
      totalVotes: voteStats.totalVotes,
      score: voteStats.weightedScore
    })
    
    // Update voter statistics
    await this.updateUserStatistics(voterUserId, 'vote_cast')
    await this.updateReporterReputation(voterUserId, 'vote_cast', 1)
    
    // Update feedback submitter reputation based on vote
    if (voteData.voteType === 'upvote') {
      await this.updateReporterReputation(feedback.reporterUserId, 'feedback_upvoted', 3)
    } else {
      await this.updateReporterReputation(feedback.reporterUserId, 'feedback_downvoted', -2)
    }
    
    console.log(`[CommunityFeedback] Vote recorded: ${voteData.voteType}`)
    return { success: true, message: 'Vote recorded successfully' }
  }
  
  /**
   * Get community consensus for a wallet
   */
  static async getCommunityConsensus(walletAddress: string): Promise<CommunityConsensus> {
    console.log(`[CommunityFeedback] Getting community consensus for ${walletAddress}`)
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const now = new Date()
    
    // Get consensus data
    const consensus = await db.communityFeedback.getConsensus(walletAddress, {
      start: thirtyDaysAgo,
      end: now
    })
    
    // Get recent feedback with details
    const recentFeedback = await db.communityFeedback.findByWallet(walletAddress, 20)
    const feedbackDetails = recentFeedback.map(f => ({
      type: f.feedbackType,
      sentiment: f.sentiment,
      confidence: f.confidence,
      weight: f.weight,
      createdAt: f.createdAt
    }))
    
    // Calculate trust score based on consensus and reputation of contributors
    const trustScore = this.calculateTrustScore(recentFeedback, consensus)
    
    // Determine risk level based on consensus
    const riskLevel = this.calculateRiskLevel(consensus, trustScore)
    
    // Get top contributors
    const topContributors = await this.getTopContributors(walletAddress)
    
    return {
      walletAddress,
      totalFeedback: consensus.totalFeedback,
      consensusScore: consensus.consensusScore,
      trustScore,
      riskLevel,
      majorityFeedbackType: consensus.majorityFeedbackType,
      recentFeedback: feedbackDetails,
      topContributors
    }
  }
  
  /**
   * Calculate feedback weight based on reporter reputation
   */
  private static calculateFeedbackWeight(reputation: MongoUserReputation, confidence: number): number {
    const baseWeight = 1.0
    const reputationMultiplier = Math.min(2.0, reputation.reputationScore / 500) // Max 2x multiplier
    const confidenceMultiplier = confidence / 100 // 0.0 - 1.0
    const tierMultiplier = this.getTierMultiplier(reputation.tier)
    
    return Math.round((baseWeight * reputationMultiplier * confidenceMultiplier * tierMultiplier) * 100) / 100
  }
  
  /**
   * Calculate vote weight based on voter reputation
   */
  private static calculateVoteWeight(reputation: MongoUserReputation): number {
    const baseWeight = 1.0
    const reputationMultiplier = Math.min(1.5, reputation.reputationScore / 750) // Max 1.5x multiplier
    const tierMultiplier = this.getTierMultiplier(reputation.tier)
    const participationBonus = Math.min(0.2, reputation.statistics.totalVotesCast / 1000) // Max 20% bonus
    
    return Math.round((baseWeight * reputationMultiplier * tierMultiplier + participationBonus) * 100) / 100
  }
  
  /**
   * Get tier-based multiplier
   */
  private static getTierMultiplier(tier: MongoUserReputation['tier']): number {
    const multipliers = {
      'novice': 1.0,
      'contributor': 1.1,
      'trusted': 1.25,
      'expert': 1.5,
      'guardian': 2.0
    }
    return multipliers[tier] || 1.0
  }
  
  /**
   * Calculate trust score for a wallet based on community feedback
   */
  private static calculateTrustScore(feedback: MongoCommunityFeedback[], consensus: any): number {
    if (feedback.length === 0) return 50 // Neutral score for no feedback
    
    // Weight recent feedback more heavily
    const now = Date.now()
    let totalWeightedScore = 0
    let totalWeight = 0
    
    for (const f of feedback) {
      const ageInDays = (now - f.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      const timeDecay = Math.max(0.1, 1 - (ageInDays / 180)) // Decay over 6 months
      
      let sentimentScore = 50 // Neutral
      if (f.sentiment === 'positive') sentimentScore = 80
      else if (f.sentiment === 'negative') sentimentScore = 20
      
      const weight = f.weight * timeDecay
      totalWeightedScore += sentimentScore * weight
      totalWeight += weight
    }
    
    const baseScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 50
    
    // Apply consensus bonus/penalty
    const consensusBonus = Math.min(10, (consensus.consensusScore - 50) / 5) // ±10 points max
    
    return Math.round(Math.min(100, Math.max(0, baseScore + consensusBonus)))
  }
  
  /**
   * Calculate risk level based on consensus and trust score
   */
  private static calculateRiskLevel(consensus: any, trustScore: number): CommunityConsensus['riskLevel'] {
    const negativeRatio = consensus.totalFeedback > 0 ? consensus.negativeCount / consensus.totalFeedback : 0
    
    if (trustScore <= 20 || negativeRatio >= 0.8) return 'critical'
    if (trustScore <= 35 || negativeRatio >= 0.6) return 'high'
    if (trustScore <= 50 || negativeRatio >= 0.4) return 'medium'
    if (trustScore <= 70 || negativeRatio >= 0.2) return 'low'
    return 'very-low'
  }
  
  /**
   * Get top contributors for a wallet's feedback
   */
  private static async getTopContributors(walletAddress: string, limit = 5): Promise<CommunityConsensus['topContributors']> {
    const feedback = await db.communityFeedback.findByWallet(walletAddress, 100)
    const contributorMap = new Map<string, { count: number; walletAddress: string }>()
    
    // Count feedback by contributor
    for (const f of feedback) {
      const existing = contributorMap.get(f.reporterUserId)
      if (existing) {
        existing.count++
      } else {
        contributorMap.set(f.reporterUserId, {
          count: 1,
          walletAddress: f.reporterWalletAddress
        })
      }
    }
    
    // Get reputation data and sort
    const contributors: CommunityConsensus['topContributors'] = []
    
    for (const [userId, data] of contributorMap.entries()) {
      const reputation = await db.userReputation.findByUserId(userId)
      if (reputation) {
        contributors.push({
          walletAddress: data.walletAddress,
          reputationScore: reputation.reputationScore,
          tier: reputation.tier,
          feedbackCount: data.count
        })
      }
    }
    
    return contributors
      .sort((a, b) => b.reputationScore - a.reputationScore)
      .slice(0, limit)
  }
  
  /**
   * Update reporter reputation
   */
  private static async updateReporterReputation(
    userId: string, 
    action: string, 
    scoreChange: number
  ): Promise<void> {
    await db.userReputation.updateScore(userId, scoreChange, action)
    await db.userReputation.updateTier(userId)
  }
  
  /**
   * Update user statistics
   */
  private static async updateUserStatistics(userId: string, action: string): Promise<void> {
    const reputation = await db.userReputation.findByUserId(userId)
    if (!reputation) return
    
    const updates: any = {
      'statistics.lastActivityAt': new Date()
    }
    
    if (action === 'feedback_submitted') {
      updates['statistics.totalFeedbackSubmitted'] = reputation.statistics.totalFeedbackSubmitted + 1
      updates.feedbackCount = reputation.feedbackCount + 1
    } else if (action === 'vote_cast') {
      updates['statistics.totalVotesCast'] = reputation.statistics.totalVotesCast + 1
    }
    
    await db.userReputation.create({
      userId: reputation.userId,
      walletAddress: reputation.walletAddress,
      ...reputation,
      ...updates,
      updatedAt: new Date()
    })
  }
  
  
  /**
   * Get feedback for moderation queue
   */
  static async getModerationQueue(status: MongoCommunityFeedback['status'] = 'active'): Promise<MongoCommunityFeedback[]> {
    return await db.communityFeedback.findForModeration(status)
  }
  
  /**
   * Moderate feedback (admin action)
   */
  static async moderateFeedback(
    feedbackId: string,
    moderatorUserId: string,
    moderatorWalletAddress: string,
    action: 'approve' | 'reject' | 'flag' | 'verify' | 'dispute' | 'archive',
    reason: string,
    notes?: string
  ): Promise<void> {
    const feedback = await db.communityFeedback.findById(feedbackId)
    if (!feedback) {
      throw new Error('Feedback not found')
    }
    
    const previousStatus = feedback.status
    let newStatus: MongoCommunityFeedback['status'] = feedback.status
    
    switch (action) {
      case 'approve':
        newStatus = 'active'
        break
      case 'reject':
        newStatus = 'rejected'
        break
      case 'verify':
        newStatus = 'verified'
        break
      case 'dispute':
        newStatus = 'disputed'
        break
      case 'archive':
        newStatus = 'archived'
        break
    }
    
    // Update feedback status
    await db.communityFeedback.update(feedbackId, {
      status: newStatus,
      moderatorNotes: notes,
      moderatedBy: moderatorWalletAddress,
      moderatedAt: new Date()
    })
    
    // Record moderation action
    await db.feedbackModeration.create({
      feedbackId: new ObjectId(feedbackId),
      moderatorUserId,
      moderatorWalletAddress,
      action,
      reason,
      notes,
      previousStatus,
      newStatus
    })
    
    // Update reporter reputation based on moderation
    let reputationChange = 0
    if (action === 'verify') reputationChange = 10
    else if (action === 'reject') reputationChange = -5
    else if (action === 'flag') reputationChange = -10
    
    if (reputationChange !== 0) {
      await this.updateReporterReputation(
        feedback.reporterUserId,
        `moderation_${action}`,
        reputationChange
      )
    }
    
    console.log(`[CommunityFeedback] Feedback ${feedbackId} moderated: ${action}`)
  }
  
  /**
   * Get user's feedback history
   */
  static async getUserFeedbackHistory(userId: string, limit = 50): Promise<{
    submitted: MongoCommunityFeedback[]
    reputation: MongoUserReputation | null
    statistics: {
      totalFeedback: number
      averageConfidence: number
      mostCommonType: string | null
      reputationScore: number
      tier: string
    }
  }> {
    const database = await db.getDatabase()
    const collection = database.collection<MongoCommunityFeedback>('community_feedback')
    
    const submitted = await collection
      .find({ reporterUserId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
    
    const reputation = await db.userReputation.findByUserId(userId)
    
    // Calculate statistics
    const averageConfidence = submitted.length > 0 
      ? submitted.reduce((sum, f) => sum + f.confidence, 0) / submitted.length 
      : 0
    
    const typeCount = submitted.reduce((acc, f) => {
      acc[f.feedbackType] = (acc[f.feedbackType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const mostCommonType = Object.keys(typeCount).reduce((a, b) => 
      typeCount[a] > typeCount[b] ? a : b, null
    )
    
    return {
      submitted,
      reputation,
      statistics: {
        totalFeedback: submitted.length,
        averageConfidence: Math.round(averageConfidence),
        mostCommonType,
        reputationScore: reputation?.reputationScore || 500,
        tier: reputation?.tier || 'novice'
      }
    }
  }
}