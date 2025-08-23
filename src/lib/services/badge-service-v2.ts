import { BADGE_DEFINITIONS, Badge, BadgeRequirement, getBadgeById } from './badge-definitions'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/user-mongoose'

export interface UserBadge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt: string
  category: string
  rarity: string
  reputationReward: number
  xpReward: number
}

export interface UserMetrics {
  totalScans?: number
  safeScans?: number
  threatsDetected?: number
  accountAge?: number
  referralCount?: number
  stakingAmount?: number
  burnAmount?: number
  reportsSubmitted?: number
  accurateReports?: number
  communityContributions?: number
  verifiedScans?: number
  quizScore?: number
  challengesCompleted?: number
  streak?: number
  tipsViewed?: number
  votes?: number
  walletConnections?: number
  dailyLogins?: number
  phishingReports?: number
  accuracyRate?: number
  multiChain?: number
}

export class BadgeServiceV2 {
  /**
   * Calculate which badges a user has earned based on their metrics
   */
  static async calculateUserBadges(
    userId: string,
    metrics: UserMetrics
  ): Promise<UserBadge[]> {
    const earnedBadges: UserBadge[] = []
    const now = new Date().toISOString()
    
    for (const badge of BADGE_DEFINITIONS) {
      let allRequirementsMet = true
      
      for (const requirement of badge.requirements) {
        const metricValue = this.getMetricValue(metrics, requirement.type)
        
        if (!this.checkRequirement(metricValue, requirement.value, requirement.comparison)) {
          allRequirementsMet = false
          break
        }
      }
      
      if (allRequirementsMet) {
        earnedBadges.push({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          rarity: badge.rarity,
          earnedAt: now,
          reputationReward: badge.reputationReward,
          xpReward: badge.xpReward
        })
      }
    }
    
    // Sort badges by rarity (mythic > legendary > epic > rare > common)
    const rarityOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 }
    earnedBadges.sort((a, b) => 
      rarityOrder[a.rarity as keyof typeof rarityOrder] - rarityOrder[b.rarity as keyof typeof rarityOrder]
    )
    
    return earnedBadges
  }
  
  /**
   * Award a specific badge to a user
   */
  static async awardBadge(userId: string, badgeId: string): Promise<boolean> {
    try {
      await connectToDatabase()
      const badge = getBadgeById(badgeId)
      if (!badge) return false
      
      const user = await User.findOne({ wallet: userId })
      if (!user) return false
      
      // Check if user already has this badge
      if (!user.badges) user.badges = []
      if (user.badges.some((b: any) => b.id === badgeId)) {
        return false // Already has badge
      }
      
      // Award badge
      user.badges.push({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        rarity: badge.rarity,
        earnedAt: new Date(),
        reputationReward: badge.reputationReward,
        xpReward: badge.xpReward
      })
      
      // Award reputation and XP
      user.reputation = (user.reputation || 0) + badge.reputationReward
      user.totalXp = (user.totalXp || 0) + badge.xpReward
      
      await user.save()
      return true
    } catch (error) {
      console.error('Error awarding badge:', error)
      return false
    }
  }
  
  /**
   * Get the value of a specific metric
   */
  private static getMetricValue(
    metrics: UserMetrics,
    type: BadgeRequirement['type']
  ): number {
    switch (type) {
      case 'scans':
        return metrics.totalScans || 0
      case 'threats_detected':
        return metrics.threatsDetected || 0
      case 'safe_scans':
        return metrics.safeScans || 0
      case 'account_age':
        return metrics.accountAge || 0
      case 'referrals':
        return metrics.referralCount || 0
      case 'stake':
        return metrics.stakingAmount || 0
      case 'burn':
        return metrics.burnAmount || 0
      case 'reports':
        return metrics.reportsSubmitted || 0
      case 'quiz_score':
        return metrics.quizScore || 0
      case 'challenges_completed':
        return metrics.challengesCompleted || 0
      case 'streak':
        return metrics.streak || 0
      case 'tips_viewed':
        return metrics.tipsViewed || 0
      case 'votes':
        return metrics.votes || 0
      case 'wallet_connections':
        return metrics.walletConnections || 0
      case 'daily_logins':
        return metrics.dailyLogins || 0
      case 'phishing_reports':
        return metrics.phishingReports || 0
      case 'accuracy_rate':
        return metrics.accuracyRate || 0
      case 'multi_chain':
        return metrics.multiChain || 0
      default:
        return 0
    }
  }
  
  /**
   * Check if a requirement is met
   */
  private static checkRequirement(
    value: number,
    required: number,
    comparison: BadgeRequirement['comparison']
  ): boolean {
    switch (comparison) {
      case 'gte':
        return value >= required
      case 'lte':
        return value <= required
      case 'eq':
        return value === required
      default:
        return false
    }
  }
  
  /**
   * Calculate reputation score with bonus for badges
   */
  static calculateReputationScore(
    metrics: UserMetrics,
    badges: UserBadge[]
  ): number {
    let score = 100 // Base score
    
    // Scan activity bonus (up to +100 points)
    const scanBonus = Math.min(100, (metrics.totalScans || 0) * 2)
    score += scanBonus
    
    // Account age bonus (up to +50 points)
    const ageBonus = Math.min(50, (metrics.accountAge || 0) / 2)
    score += ageBonus
    
    // Accuracy bonus (up to +80 points)
    const accuracyBonus = Math.min(80, (metrics.accurateReports || 0) * 8)
    score += accuracyBonus
    
    // Community contributions bonus (up to +60 points)
    const communityBonus = Math.min(60, (metrics.communityContributions || 0) * 10)
    score += communityBonus
    
    // Staking bonus (up to +100 points)
    const stakingBonus = Math.min(100, (metrics.stakingAmount || 0) / 100)
    score += stakingBonus
    
    // Verified scans bonus (up to +40 points)
    const verifiedBonus = Math.min(40, (metrics.verifiedScans || 0) * 2)
    score += verifiedBonus
    
    // Threat detection bonus (up to +70 points)
    const threatBonus = Math.min(70, (metrics.threatsDetected || 0) * 3.5)
    score += threatBonus
    
    // Quiz and challenge bonuses
    const quizBonus = Math.min(50, (metrics.quizScore || 0) * 5)
    score += quizBonus
    
    const challengeBonus = Math.min(60, (metrics.challengesCompleted || 0) * 6)
    score += challengeBonus
    
    // Badge bonuses based on rarity
    const badgeBonus = badges.reduce((total, badge) => {
      switch (badge.rarity) {
        case 'mythic':
          return total + 100
        case 'legendary':
          return total + 50
        case 'epic':
          return total + 30
        case 'rare':
          return total + 15
        case 'common':
          return total + 5
        default:
          return total
      }
    }, 0)
    score += badgeBonus
    
    return Math.min(10000, Math.max(0, Math.round(score)))
  }
  
  /**
   * Get badge statistics for a user
   */
  static getBadgeStats(badges: UserBadge[]) {
    const stats = {
      total: badges.length,
      totalAvailable: BADGE_DEFINITIONS.length,
      percentComplete: Math.round((badges.length / BADGE_DEFINITIONS.length) * 100),
      byCategory: {
        security: 0,
        community: 0,
        achievement: 0,
        special: 0,
        quiz: 0,
        challenge: 0,
        phishing: 0
      },
      byRarity: {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0
      },
      totalReputation: 0,
      totalXp: 0
    }
    
    for (const badge of badges) {
      stats.byCategory[badge.category as keyof typeof stats.byCategory]++
      stats.byRarity[badge.rarity as keyof typeof stats.byRarity]++
      stats.totalReputation += badge.reputationReward
      stats.totalXp += badge.xpReward
    }
    
    return stats
  }
  
  /**
   * Get next achievable badges for a user
   */
  static getNextAchievableBadges(
    currentBadges: UserBadge[],
    metrics: UserMetrics
  ): Array<{ badge: Badge; progress: number; missingRequirements: string[] }> {
    const earnedBadgeIds = new Set(currentBadges.map(b => b.id))
    const nextBadges: Array<{ badge: Badge; progress: number; missingRequirements: string[] }> = []
    
    for (const badge of BADGE_DEFINITIONS) {
      if (earnedBadgeIds.has(badge.id)) continue
      
      let minProgress = 100
      const missingRequirements: string[] = []
      
      for (const requirement of badge.requirements) {
        const currentValue = this.getMetricValue(metrics, requirement.type)
        const progress = Math.min(100, (currentValue / requirement.value) * 100)
        minProgress = Math.min(minProgress, progress)
        
        if (progress < 100) {
          const needed = requirement.value - currentValue
          missingRequirements.push(
            `Need ${needed} more ${requirement.type.replace(/_/g, ' ')}`
          )
        }
      }
      
      if (minProgress > 0 && minProgress < 100) {
        nextBadges.push({ badge, progress: minProgress, missingRequirements })
      }
    }
    
    // Sort by progress (closest to completion first)
    nextBadges.sort((a, b) => b.progress - a.progress)
    
    return nextBadges.slice(0, 5) // Return top 5 closest badges
  }
  
  /**
   * Check and auto-award badges based on user activity
   */
  static async checkAndAwardBadges(userId: string, metrics: UserMetrics): Promise<string[]> {
    try {
      await connectToDatabase()
      const user = await User.findOne({ wallet: userId })
      if (!user) return []
      
      const currentBadgeIds = new Set((user.badges || []).map((b: any) => b.id))
      const earnableBadges = await this.calculateUserBadges(userId, metrics)
      const newBadges: string[] = []
      
      for (const badge of earnableBadges) {
        if (!currentBadgeIds.has(badge.id)) {
          const awarded = await this.awardBadge(userId, badge.id)
          if (awarded) {
            newBadges.push(badge.name)
          }
        }
      }
      
      return newBadges
    } catch (error) {
      console.error('Error checking and awarding badges:', error)
      return []
    }
  }
  
  /**
   * Get badge leaderboard
   */
  static async getBadgeLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      await connectToDatabase()
      
      const users = await User.find({ badges: { $exists: true, $ne: [] } })
        .select('username wallet badges reputation totalXp')
        .lean()
      
      const leaderboard = users.map(user => ({
        username: user.username || 'Anonymous',
        wallet: user.wallet,
        badgeCount: user.badges?.length || 0,
        reputation: user.reputation || 0,
        totalXp: user.totalXp || 0,
        rareBadges: user.badges?.filter((b: any) => 
          ['mythic', 'legendary', 'epic'].includes(b.rarity)
        ).length || 0
      }))
      
      // Sort by badge count, then by rare badges, then by reputation
      leaderboard.sort((a, b) => {
        if (a.badgeCount !== b.badgeCount) return b.badgeCount - a.badgeCount
        if (a.rareBadges !== b.rareBadges) return b.rareBadges - a.rareBadges
        return b.reputation - a.reputation
      })
      
      return leaderboard.slice(0, limit)
    } catch (error) {
      console.error('Error getting badge leaderboard:', error)
      return []
    }
  }
}

// Export for backward compatibility
export const badgeService = BadgeServiceV2