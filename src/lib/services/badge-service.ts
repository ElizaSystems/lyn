
export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  category: 'security' | 'community' | 'achievement' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  requirements: BadgeRequirement[]
}

export interface BadgeRequirement {
  type: 'scans' | 'threats_detected' | 'safe_scans' | 'account_age' | 'referrals' | 'stake' | 'burn' | 'reports'
  value: number
  comparison: 'gte' | 'lte' | 'eq' // greater than or equal, less than or equal, equal
}

export interface UserBadge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt: string
  category: string
  rarity: string
}

// Badge definitions with requirements
const BADGE_DEFINITIONS: Badge[] = [
  // Security Badges
  {
    id: 'first_scan',
    name: 'First Scan',
    description: 'Completed your first security scan',
    icon: '🔍',
    category: 'security',
    rarity: 'common',
    requirements: [
      { type: 'scans', value: 1, comparison: 'gte' }
    ]
  },
  {
    id: 'scanner_novice',
    name: 'Scanner Novice',
    description: 'Completed 10 security scans',
    icon: '🛡️',
    category: 'security',
    rarity: 'common',
    requirements: [
      { type: 'scans', value: 10, comparison: 'gte' }
    ]
  },
  {
    id: 'scanner_expert',
    name: 'Scanner Expert',
    description: 'Completed 50 security scans',
    icon: '⚔️',
    category: 'security',
    rarity: 'rare',
    requirements: [
      { type: 'scans', value: 50, comparison: 'gte' }
    ]
  },
  {
    id: 'scanner_master',
    name: 'Scanner Master',
    description: 'Completed 100 security scans',
    icon: '🏆',
    category: 'security',
    rarity: 'epic',
    requirements: [
      { type: 'scans', value: 100, comparison: 'gte' }
    ]
  },
  {
    id: 'threat_hunter',
    name: 'Threat Hunter',
    description: 'Detected 10 threats',
    icon: '🎯',
    category: 'security',
    rarity: 'rare',
    requirements: [
      { type: 'threats_detected', value: 10, comparison: 'gte' }
    ]
  },
  {
    id: 'threat_eliminator',
    name: 'Threat Eliminator',
    description: 'Detected 50 threats',
    icon: '💀',
    category: 'security',
    rarity: 'epic',
    requirements: [
      { type: 'threats_detected', value: 50, comparison: 'gte' }
    ]
  },
  {
    id: 'safe_guardian',
    name: 'Safe Guardian',
    description: 'Verified 25 safe resources',
    icon: '✅',
    category: 'security',
    rarity: 'common',
    requirements: [
      { type: 'safe_scans', value: 25, comparison: 'gte' }
    ]
  },
  
  // Community Badges
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined within the first month',
    icon: '🌟',
    category: 'community',
    rarity: 'rare',
    requirements: [
      { type: 'account_age', value: 30, comparison: 'lte' }
    ]
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Account over 90 days old',
    icon: '🎖️',
    category: 'community',
    rarity: 'rare',
    requirements: [
      { type: 'account_age', value: 90, comparison: 'gte' }
    ]
  },
  {
    id: 'influencer',
    name: 'Influencer',
    description: 'Referred 5 users',
    icon: '📢',
    category: 'community',
    rarity: 'rare',
    requirements: [
      { type: 'referrals', value: 5, comparison: 'gte' }
    ]
  },
  {
    id: 'ambassador',
    name: 'Ambassador',
    description: 'Referred 20 users',
    icon: '🌐',
    category: 'community',
    rarity: 'epic',
    requirements: [
      { type: 'referrals', value: 20, comparison: 'gte' }
    ]
  },
  
  // Achievement Badges
  {
    id: 'staker',
    name: 'Staker',
    description: 'Staked LYN tokens',
    icon: '💎',
    category: 'achievement',
    rarity: 'common',
    requirements: [
      { type: 'stake', value: 1, comparison: 'gte' }
    ]
  },
  {
    id: 'whale_staker',
    name: 'Whale Staker',
    description: 'Staked over 10,000 LYN',
    icon: '🐋',
    category: 'achievement',
    rarity: 'legendary',
    requirements: [
      { type: 'stake', value: 10000, comparison: 'gte' }
    ]
  },
  {
    id: 'burner',
    name: 'Token Burner',
    description: 'Burned LYN tokens',
    icon: '🔥',
    category: 'achievement',
    rarity: 'rare',
    requirements: [
      { type: 'burn', value: 1, comparison: 'gte' }
    ]
  },
  {
    id: 'reporter',
    name: 'Security Reporter',
    description: 'Submitted 5 security reports',
    icon: '📝',
    category: 'achievement',
    rarity: 'common',
    requirements: [
      { type: 'reports', value: 5, comparison: 'gte' }
    ]
  },
  {
    id: 'vigilant',
    name: 'Vigilant Guardian',
    description: 'Submitted 25 security reports',
    icon: '👁️',
    category: 'achievement',
    rarity: 'epic',
    requirements: [
      { type: 'reports', value: 25, comparison: 'gte' }
    ]
  },
  
  // Special Badges
  {
    id: 'perfect_scanner',
    name: 'Perfect Scanner',
    description: '100 scans with 100% accuracy',
    icon: '💯',
    category: 'special',
    rarity: 'legendary',
    requirements: [
      { type: 'scans', value: 100, comparison: 'gte' },
      { type: 'safe_scans', value: 100, comparison: 'gte' }
    ]
  },
  {
    id: 'security_legend',
    name: 'Security Legend',
    description: 'Over 500 scans completed',
    icon: '🏅',
    category: 'special',
    rarity: 'legendary',
    requirements: [
      { type: 'scans', value: 500, comparison: 'gte' }
    ]
  }
]

export class BadgeService {
  /**
   * Calculate which badges a user has earned based on their metrics
   */
  static async calculateUserBadges(
    userId: string,
    metrics: {
      totalScans: number
      safeScans: number
      threatsDetected: number
      accountAge: number
      referralCount?: number
      stakingAmount?: number
      burnAmount?: number
      reportsSubmitted?: number
    }
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
          earnedAt: now
        })
      }
    }
    
    // Sort badges by rarity (legendary > epic > rare > common)
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 }
    earnedBadges.sort((a, b) => rarityOrder[a.rarity as keyof typeof rarityOrder] - rarityOrder[b.rarity as keyof typeof rarityOrder])
    
    return earnedBadges
  }
  
  /**
   * Get the value of a specific metric
   */
  private static getMetricValue(
    metrics: {
      totalScans?: number
      safeScans?: number
      threatsDetected?: number
      accountAge?: number
      referralCount?: number
      stakingAmount?: number
      burnAmount?: number
      reportsSubmitted?: number
    },
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
    metrics: {
      totalScans?: number
      accountAge?: number
      accurateReports?: number
      communityContributions?: number
      stakingAmount?: number
      verifiedScans?: number
      threatsDetected?: number
      safeScans?: number
    },
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
    
    // Badge bonuses based on rarity
    const badgeBonus = badges.reduce((total, badge) => {
      switch (badge.rarity) {
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
    
    return Math.min(1000, Math.max(0, Math.round(score)))
  }
  
  /**
   * Get badge statistics for a user
   */
  static getBadgeStats(badges: UserBadge[]) {
    const stats = {
      total: badges.length,
      byCategory: {
        security: 0,
        community: 0,
        achievement: 0,
        special: 0
      },
      byRarity: {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0
      }
    }
    
    for (const badge of badges) {
      stats.byCategory[badge.category as keyof typeof stats.byCategory]++
      stats.byRarity[badge.rarity as keyof typeof stats.byRarity]++
    }
    
    return stats
  }
  
  /**
   * Get next achievable badges for a user
   */
  static getNextAchievableBadges(
    currentBadges: UserBadge[],
    metrics: {
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
    }
  ): Array<{ badge: Badge; progress: number }> {
    const earnedBadgeIds = new Set(currentBadges.map(b => b.id))
    const nextBadges: Array<{ badge: Badge; progress: number }> = []
    
    for (const badge of BADGE_DEFINITIONS) {
      if (earnedBadgeIds.has(badge.id)) continue
      
      let minProgress = 100
      for (const requirement of badge.requirements) {
        const currentValue = this.getMetricValue(metrics, requirement.type)
        const progress = (currentValue / requirement.value) * 100
        minProgress = Math.min(minProgress, progress)
      }
      
      if (minProgress > 0 && minProgress < 100) {
        nextBadges.push({ badge, progress: minProgress })
      }
    }
    
    // Sort by progress (closest to completion first)
    nextBadges.sort((a, b) => b.progress - a.progress)
    
    return nextBadges.slice(0, 5) // Return top 5 closest badges
  }
}