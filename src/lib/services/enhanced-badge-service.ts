import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { AchievementCategory, AchievementTier, AchievementRarity, ACHIEVEMENT_CATEGORIES, REPUTATION_TIERS } from '@/lib/models/achievement'

// Enhanced Badge Definition Interface
export interface EnhancedBadge {
  _id?: ObjectId
  key: string                    // Unique identifier
  name: string
  description: string
  category: AchievementCategory
  tier: AchievementTier
  rarity: AchievementRarity
  emoji: string                  // Visual emoji icon
  requirements: {
    type: string
    threshold: number
    conditions?: Record<string, any>
  }[]
  rewards: {
    reputation: number
    xp: number
    title?: string
    unlocks?: string[]
  }
  visual: {
    color: string
    borderColor?: string
    glowEffect?: boolean
    animationType?: 'pulse' | 'glow' | 'sparkle' | 'none'
  }
  progress?: {
    showProgress: boolean
    progressText?: string
  }
  metadata: {
    isSecret: boolean
    maxEarnings: number          // -1 for unlimited
    prerequisites?: string[]     // Required badge keys
    difficulty: 'easy' | 'medium' | 'hard' | 'extreme'
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// User Badge Progress Interface
export interface UserBadgeProgress {
  _id?: ObjectId
  userId: ObjectId
  badgeKey: string
  currentProgress: number
  targetProgress: number
  percentage: number
  isCompleted: boolean
  completedAt?: Date
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

// Badge Tier Colors and Visual Settings
export const BADGE_TIER_CONFIG = {
  bronze: {
    color: '#CD7F32',
    borderColor: '#A0622A',
    glowColor: '#CD7F32',
    textColor: '#FFFFFF'
  },
  silver: {
    color: '#C0C0C0',
    borderColor: '#A0A0A0',
    glowColor: '#C0C0C0',
    textColor: '#000000'
  },
  gold: {
    color: '#FFD700',
    borderColor: '#E6C200',
    glowColor: '#FFD700',
    textColor: '#000000'
  },
  diamond: {
    color: '#B9F2FF',
    borderColor: '#87CEEB',
    glowColor: '#B9F2FF',
    textColor: '#000000'
  },
  platinum: {
    color: '#E5E4E2',
    borderColor: '#D3D3D3',
    glowColor: '#E5E4E2',
    textColor: '#000000'
  }
}

export class EnhancedBadgeService {
  private static async getBadgesCollection() {
    const db = await getDatabase()
    return db.collection<EnhancedBadge>('enhanced_badges')
  }

  private static async getUserBadgeProgressCollection() {
    const db = await getDatabase()
    return db.collection<UserBadgeProgress>('user_badge_progress')
  }

  // Create a new badge definition
  static async createBadge(badge: Omit<EnhancedBadge, '_id' | 'createdAt' | 'updatedAt'>): Promise<EnhancedBadge> {
    const collection = await this.getBadgesCollection()
    const now = new Date()

    const newBadge: EnhancedBadge = {
      ...badge,
      createdAt: now,
      updatedAt: now
    }

    const result = await collection.insertOne(newBadge)
    return { ...newBadge, _id: result.insertedId }
  }

  // Get all badge definitions
  static async getAllBadges(filters: {
    category?: AchievementCategory
    tier?: AchievementTier
    rarity?: AchievementRarity
    isActive?: boolean
  } = {}): Promise<EnhancedBadge[]> {
    const collection = await this.getBadgesCollection()
    return await collection.find(filters).toArray()
  }

  // Get badge by key
  static async getBadgeByKey(key: string): Promise<EnhancedBadge | null> {
    const collection = await this.getBadgesCollection()
    return await collection.findOne({ key, isActive: true })
  }

  // Calculate user badge progress
  static async calculateUserBadgeProgress(
    userId: string,
    userMetrics: Record<string, number>
  ): Promise<UserBadgeProgress[]> {
    const badges = await this.getAllBadges({ isActive: true })
    const progressCollection = await this.getUserBadgeProgressCollection()
    const userObjectId = new ObjectId(userId)
    const progressRecords: UserBadgeProgress[] = []

    for (const badge of badges) {
      let totalProgress = 0
      let targetProgress = 0
      let isCompleted = false

      // Calculate progress for each requirement
      for (const requirement of badge.requirements) {
        const currentValue = userMetrics[requirement.type] || 0
        totalProgress += currentValue
        targetProgress += requirement.threshold

        if (currentValue >= requirement.threshold) {
          // Check if all requirements are met
          const allRequirementsMet = badge.requirements.every(req => 
            (userMetrics[req.type] || 0) >= req.threshold
          )
          if (allRequirementsMet) {
            isCompleted = true
          }
        }
      }

      const percentage = targetProgress > 0 ? Math.min(100, (totalProgress / targetProgress) * 100) : 0

      // Update or create progress record
      const existingProgress = await progressCollection.findOne({
        userId: userObjectId,
        badgeKey: badge.key
      })

      const progressData: UserBadgeProgress = {
        userId: userObjectId,
        badgeKey: badge.key,
        currentProgress: totalProgress,
        targetProgress,
        percentage,
        isCompleted,
        completedAt: isCompleted && !existingProgress?.isCompleted ? new Date() : existingProgress?.completedAt,
        metadata: {
          badgeName: badge.name,
          tier: badge.tier,
          category: badge.category
        },
        createdAt: existingProgress?.createdAt || new Date(),
        updatedAt: new Date()
      }

      if (existingProgress) {
        await progressCollection.updateOne(
          { _id: existingProgress._id },
          { $set: progressData }
        )
      } else {
        const result = await progressCollection.insertOne(progressData)
        progressData._id = result.insertedId
      }

      progressRecords.push(progressData)
    }

    return progressRecords
  }

  // Get user's earned badges
  static async getUserEarnedBadges(userId: string): Promise<(EnhancedBadge & { earnedAt: Date })[]> {
    const progressCollection = await this.getUserBadgeProgressCollection()
    const badgesCollection = await this.getBadgesCollection()
    
    const earnedProgress = await progressCollection.find({
      userId: new ObjectId(userId),
      isCompleted: true
    }).toArray()

    const earnedBadges: (EnhancedBadge & { earnedAt: Date })[] = []

    for (const progress of earnedProgress) {
      const badge = await badgesCollection.findOne({ key: progress.badgeKey })
      if (badge) {
        earnedBadges.push({
          ...badge,
          earnedAt: progress.completedAt!
        })
      }
    }

    return earnedBadges.sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())
  }

  // Get user's badge progress for incomplete badges
  static async getUserBadgeProgress(userId: string): Promise<UserBadgeProgress[]> {
    const collection = await this.getUserBadgeProgressCollection()
    return await collection.find({
      userId: new ObjectId(userId),
      isCompleted: false,
      percentage: { $gt: 0 }
    }).sort({ percentage: -1 }).limit(10).toArray()
  }

  // Get next achievable badges
  static async getNextAchievableBadges(userId: string): Promise<UserBadgeProgress[]> {
    const collection = await this.getUserBadgeProgressCollection()
    return await collection.find({
      userId: new ObjectId(userId),
      isCompleted: false,
      percentage: { $gte: 25 } // At least 25% progress
    }).sort({ percentage: -1 }).limit(5).toArray()
  }

  // Initialize comprehensive badge definitions
  static async initializeComprehensiveBadges(): Promise<void> {
    const existing = await this.getAllBadges()
    
    if (existing.length > 0) {
      console.log('Enhanced badges already exist, skipping initialization')
      return
    }

    console.log('Initializing comprehensive badge definitions...')

    const badges: Array<Omit<EnhancedBadge, '_id' | 'createdAt' | 'updatedAt'>> = [
      // Security Scanner Badges
      {
        key: 'security_scanner_first_scan',
        name: 'First Scan',
        description: 'Complete your first security scan',
        category: 'security_scanner',
        tier: 'bronze',
        rarity: 'common',
        emoji: '🔍',
        requirements: [
          { type: 'scan_completed', threshold: 1 }
        ],
        rewards: { reputation: 5, xp: 10 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Scans completed' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'security_scanner_url_specialist',
        name: 'URL Security Specialist',
        description: 'Complete 25 URL security scans',
        category: 'security_scanner',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '🌐',
        requirements: [
          { type: 'url_checked', threshold: 25 }
        ],
        rewards: { reputation: 15, xp: 50, title: 'URL Specialist' },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'URL scans completed' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },
      {
        key: 'security_scanner_wallet_guardian',
        name: 'Wallet Guardian',
        description: 'Analyze 50 cryptocurrency wallets',
        category: 'security_scanner',
        tier: 'gold',
        rarity: 'rare',
        emoji: '💼',
        requirements: [
          { type: 'wallet_analyzed', threshold: 50 }
        ],
        rewards: { reputation: 30, xp: 100, title: 'Wallet Guardian' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Wallets analyzed' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },
      {
        key: 'security_scanner_contract_auditor',
        name: 'Smart Contract Auditor',
        description: 'Audit 100 smart contracts',
        category: 'security_scanner',
        tier: 'diamond',
        rarity: 'epic',
        emoji: '📋',
        requirements: [
          { type: 'contract_analyzed', threshold: 100 }
        ],
        rewards: { reputation: 50, xp: 200, title: 'Contract Auditor' },
        visual: {
          color: BADGE_TIER_CONFIG.diamond.color,
          borderColor: BADGE_TIER_CONFIG.diamond.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Contracts audited' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'extreme' },
        isActive: true
      },
      {
        key: 'security_scanner_document_detective',
        name: 'Document Detective',
        description: 'Scan 75 documents for security threats',
        category: 'security_scanner',
        tier: 'gold',
        rarity: 'rare',
        emoji: '📄',
        requirements: [
          { type: 'document_scanned', threshold: 75 }
        ],
        rewards: { reputation: 25, xp: 75, title: 'Document Detective' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Documents scanned' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },

      // Cross-Chain Explorer Badges
      {
        key: 'cross_chain_explorer_multi_network',
        name: 'Multi-Network Explorer',
        description: 'Perform scans across 3 different blockchains',
        category: 'cross_chain_explorer',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '⛓️',
        requirements: [
          { type: 'multi_chain_scan', threshold: 3 }
        ],
        rewards: { reputation: 20, xp: 60 },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Networks explored' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },
      {
        key: 'cross_chain_explorer_omnichain_master',
        name: 'Omnichain Master',
        description: 'Complete 500 cross-chain activities',
        category: 'cross_chain_explorer',
        tier: 'platinum',
        rarity: 'legendary',
        emoji: '🌌',
        requirements: [
          { type: 'cross_chain_activity', threshold: 500 }
        ],
        rewards: { reputation: 100, xp: 500, title: 'Omnichain Master' },
        visual: {
          color: BADGE_TIER_CONFIG.platinum.color,
          borderColor: BADGE_TIER_CONFIG.platinum.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Cross-chain activities' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'extreme' },
        isActive: true
      },

      // Threat Hunter Badges
      {
        key: 'threat_hunter_first_threat',
        name: 'First Threat Detected',
        description: 'Detect your first security threat',
        category: 'threat_hunter',
        tier: 'bronze',
        rarity: 'common',
        emoji: '🎯',
        requirements: [
          { type: 'threat_detected', threshold: 1 }
        ],
        rewards: { reputation: 10, xp: 20 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Threats detected' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'threat_hunter_security_sentinel',
        name: 'Security Sentinel',
        description: 'Detect 50 security threats',
        category: 'threat_hunter',
        tier: 'gold',
        rarity: 'rare',
        emoji: '🛡️',
        requirements: [
          { type: 'threat_detected', threshold: 50 }
        ],
        rewards: { reputation: 35, xp: 150, title: 'Security Sentinel' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Threats detected' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },
      {
        key: 'threat_hunter_cyber_guardian',
        name: 'Cyber Guardian',
        description: 'Detect 200 security threats',
        category: 'threat_hunter',
        tier: 'diamond',
        rarity: 'epic',
        emoji: '🦾',
        requirements: [
          { type: 'threat_detected', threshold: 200 }
        ],
        rewards: { reputation: 75, xp: 300, title: 'Cyber Guardian' },
        visual: {
          color: BADGE_TIER_CONFIG.diamond.color,
          borderColor: BADGE_TIER_CONFIG.diamond.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Threats detected' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'extreme' },
        isActive: true
      },

      // Community Guardian Badges
      {
        key: 'community_guardian_first_vote',
        name: 'Democracy Participant',
        description: 'Cast your first community vote',
        category: 'community_guardian',
        tier: 'bronze',
        rarity: 'common',
        emoji: '🗳️',
        requirements: [
          { type: 'community_vote', threshold: 1 }
        ],
        rewards: { reputation: 5, xp: 15 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Votes cast' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'community_guardian_feedback_contributor',
        name: 'Feedback Contributor',
        description: 'Submit 25 pieces of community feedback',
        category: 'community_guardian',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '💬',
        requirements: [
          { type: 'feedback_submitted', threshold: 25 }
        ],
        rewards: { reputation: 20, xp: 75 },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Feedback submitted' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },
      {
        key: 'community_guardian_whitelist_curator',
        name: 'Whitelist Curator',
        description: 'Contribute 50 whitelist entries',
        category: 'community_guardian',
        tier: 'gold',
        rarity: 'rare',
        emoji: '✅',
        requirements: [
          { type: 'whitelist_contribution', threshold: 50 }
        ],
        rewards: { reputation: 40, xp: 120, title: 'Whitelist Curator' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Whitelist contributions' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },
      {
        key: 'community_guardian_blacklist_defender',
        name: 'Blacklist Defender',
        description: 'Contribute 100 blacklist entries',
        category: 'community_guardian',
        tier: 'diamond',
        rarity: 'epic',
        emoji: '🚫',
        requirements: [
          { type: 'blacklist_contribution', threshold: 100 }
        ],
        rewards: { reputation: 60, xp: 250, title: 'Blacklist Defender' },
        visual: {
          color: BADGE_TIER_CONFIG.diamond.color,
          borderColor: BADGE_TIER_CONFIG.diamond.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Blacklist contributions' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'extreme' },
        isActive: true
      },

      // Burn Master Badges
      {
        key: 'burn_master_first_burn',
        name: 'Fire Starter',
        description: 'Burn your first LYN tokens',
        category: 'burn_master',
        tier: 'bronze',
        rarity: 'common',
        emoji: '🔥',
        requirements: [
          { type: 'tokens_burned', threshold: 1 }
        ],
        rewards: { reputation: 10, xp: 25 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Tokens burned' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'burn_master_committed_burner',
        name: 'Committed Burner',
        description: 'Burn 1,000 LYN tokens',
        category: 'burn_master',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '🔥',
        requirements: [
          { type: 'tokens_burned', threshold: 1000 }
        ],
        rewards: { reputation: 25, xp: 100 },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Tokens burned' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },
      {
        key: 'burn_master_inferno_master',
        name: 'Inferno Master',
        description: 'Burn 10,000 LYN tokens',
        category: 'burn_master',
        tier: 'gold',
        rarity: 'rare',
        emoji: '🌋',
        requirements: [
          { type: 'tokens_burned', threshold: 10000 }
        ],
        rewards: { reputation: 50, xp: 250, title: 'Inferno Master' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Tokens burned' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },
      {
        key: 'burn_master_phoenix_legend',
        name: 'Phoenix Legend',
        description: 'Burn 100,000 LYN tokens',
        category: 'burn_master',
        tier: 'platinum',
        rarity: 'legendary',
        emoji: '🔥',
        requirements: [
          { type: 'tokens_burned', threshold: 100000 }
        ],
        rewards: { reputation: 150, xp: 750, title: 'Phoenix Legend' },
        visual: {
          color: BADGE_TIER_CONFIG.platinum.color,
          borderColor: BADGE_TIER_CONFIG.platinum.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Tokens burned' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'extreme' },
        isActive: true
      },
      {
        key: 'burn_master_verification_expert',
        name: 'Verification Expert',
        description: 'Complete 50 burn verifications',
        category: 'burn_master',
        tier: 'diamond',
        rarity: 'epic',
        emoji: '✅',
        requirements: [
          { type: 'burn_verified', threshold: 50 }
        ],
        rewards: { reputation: 40, xp: 200, title: 'Verification Expert' },
        visual: {
          color: BADGE_TIER_CONFIG.diamond.color,
          borderColor: BADGE_TIER_CONFIG.diamond.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Burns verified' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'extreme' },
        isActive: true
      },

      // Achievement Hunter Badges
      {
        key: 'achievement_hunter_badge_collector',
        name: 'Badge Collector',
        description: 'Collect 5 badges',
        category: 'achievement_hunter',
        tier: 'bronze',
        rarity: 'common',
        emoji: '🏆',
        requirements: [
          { type: 'badge_collected', threshold: 5 }
        ],
        rewards: { reputation: 15, xp: 50 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Badges collected' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'achievement_hunter_completion_master',
        name: 'Completion Master',
        description: 'Unlock 25 achievements',
        category: 'achievement_hunter',
        tier: 'gold',
        rarity: 'rare',
        emoji: '🎯',
        requirements: [
          { type: 'achievement_unlocked', threshold: 25 }
        ],
        rewards: { reputation: 50, xp: 200, title: 'Completion Master' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Achievements unlocked' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },

      // Task Automation Badges
      {
        key: 'task_automation_first_task',
        name: 'Automation Beginner',
        description: 'Create your first automated task',
        category: 'task_automation',
        tier: 'bronze',
        rarity: 'common',
        emoji: '⚙️',
        requirements: [
          { type: 'task_created', threshold: 1 }
        ],
        rewards: { reputation: 10, xp: 30 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Tasks created' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'task_automation_workflow_master',
        name: 'Workflow Master',
        description: 'Successfully run 100 automated tasks',
        category: 'task_automation',
        tier: 'gold',
        rarity: 'rare',
        emoji: '🔄',
        requirements: [
          { type: 'task_automated', threshold: 100 }
        ],
        rewards: { reputation: 45, xp: 180, title: 'Workflow Master' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Tasks automated' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },

      // Notification Expert Badges
      {
        key: 'notification_expert_webhook_setup',
        name: 'Webhook Wizard',
        description: 'Configure 5 webhooks',
        category: 'notification_expert',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '🔔',
        requirements: [
          { type: 'webhook_configured', threshold: 5 }
        ],
        rewards: { reputation: 20, xp: 70 },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Webhooks configured' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },
      {
        key: 'notification_expert_alert_master',
        name: 'Alert Master',
        description: 'Set up 25 notification alerts',
        category: 'notification_expert',
        tier: 'gold',
        rarity: 'rare',
        emoji: '📢',
        requirements: [
          { type: 'notification_setup', threshold: 25 }
        ],
        rewards: { reputation: 35, xp: 140, title: 'Alert Master' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Notifications configured' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },

      // Payment Pioneer Badges
      {
        key: 'payment_pioneer_first_subscription',
        name: 'Subscription Starter',
        description: 'Purchase your first platform subscription',
        category: 'payment_pioneer',
        tier: 'bronze',
        rarity: 'common',
        emoji: '💳',
        requirements: [
          { type: 'subscription_purchased', threshold: 1 }
        ],
        rewards: { reputation: 15, xp: 40 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Subscriptions purchased' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'payment_pioneer_crypto_veteran',
        name: 'Crypto Payment Veteran',
        description: 'Make 10 crypto payments',
        category: 'payment_pioneer',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '💰',
        requirements: [
          { type: 'crypto_payment_made', threshold: 10 }
        ],
        rewards: { reputation: 25, xp: 90 },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Crypto payments made' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },

      // Referral Network Badges
      {
        key: 'referral_network_first_referral',
        name: 'Network Builder',
        description: 'Successfully refer your first user',
        category: 'referral_network',
        tier: 'bronze',
        rarity: 'common',
        emoji: '🌐',
        requirements: [
          { type: 'referral_completed', threshold: 1 }
        ],
        rewards: { reputation: 20, xp: 60 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Referrals completed' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'referral_network_growth_catalyst',
        name: 'Growth Catalyst',
        description: 'Build a referral network of 25 users',
        category: 'referral_network',
        tier: 'gold',
        rarity: 'rare',
        emoji: '🚀',
        requirements: [
          { type: 'referral_network_growth', threshold: 25 }
        ],
        rewards: { reputation: 60, xp: 300, title: 'Growth Catalyst' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Network size' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },

      // Real-time Defender Badges
      {
        key: 'realtime_defender_threat_monitor',
        name: 'Threat Monitor',
        description: 'Monitor threat feeds for 30 days',
        category: 'realtime_defender',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '📡',
        requirements: [
          { type: 'threat_feed_monitored', threshold: 30 }
        ],
        rewards: { reputation: 30, xp: 120 },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Days monitored' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },

      // AI Assistant Badges
      {
        key: 'ai_assistant_chat_explorer',
        name: 'AI Chat Explorer',
        description: 'Have 50 interactions with the AI assistant',
        category: 'ai_assistant',
        tier: 'bronze',
        rarity: 'common',
        emoji: '🤖',
        requirements: [
          { type: 'ai_chat_interaction', threshold: 50 }
        ],
        rewards: { reputation: 15, xp: 50 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'AI interactions' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },

      // Streak Master Badges
      {
        key: 'streak_master_daily_dedication',
        name: 'Daily Dedication',
        description: 'Maintain a 7-day activity streak',
        category: 'streak_master',
        tier: 'bronze',
        rarity: 'common',
        emoji: '📅',
        requirements: [
          { type: 'daily_login', threshold: 7 }
        ],
        rewards: { reputation: 20, xp: 70 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Days in streak' },
        metadata: { isSecret: false, maxEarnings: -1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'streak_master_monthly_champion',
        name: 'Monthly Champion',
        description: 'Maintain a 30-day activity streak',
        category: 'streak_master',
        tier: 'silver',
        rarity: 'uncommon',
        emoji: '🏆',
        requirements: [
          { type: 'daily_login', threshold: 30 }
        ],
        rewards: { reputation: 50, xp: 200 },
        visual: {
          color: BADGE_TIER_CONFIG.silver.color,
          borderColor: BADGE_TIER_CONFIG.silver.borderColor,
          glowEffect: true,
          animationType: 'glow'
        },
        progress: { showProgress: true, progressText: 'Days in streak' },
        metadata: { isSecret: false, maxEarnings: -1, difficulty: 'medium' },
        isActive: true
      },
      {
        key: 'streak_master_consistency_legend',
        name: 'Consistency Legend',
        description: 'Maintain a 100-day activity streak',
        category: 'streak_master',
        tier: 'gold',
        rarity: 'rare',
        emoji: '👑',
        requirements: [
          { type: 'daily_login', threshold: 100 }
        ],
        rewards: { reputation: 100, xp: 500, title: 'Consistency Legend' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Days in streak' },
        metadata: { isSecret: false, maxEarnings: -1, difficulty: 'hard' },
        isActive: true
      },

      // Veteran Badges
      {
        key: 'veteran_platform_explorer',
        name: 'Platform Explorer',
        description: 'Be active on the platform for 30 days',
        category: 'veteran',
        tier: 'bronze',
        rarity: 'common',
        emoji: '⭐',
        requirements: [
          { type: 'account_age_days', threshold: 30 }
        ],
        rewards: { reputation: 25, xp: 75 },
        visual: {
          color: BADGE_TIER_CONFIG.bronze.color,
          borderColor: BADGE_TIER_CONFIG.bronze.borderColor,
          animationType: 'pulse'
        },
        progress: { showProgress: true, progressText: 'Days active' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'easy' },
        isActive: true
      },
      {
        key: 'veteran_seasoned_guardian',
        name: 'Seasoned Guardian',
        description: 'Be active on the platform for 180 days',
        category: 'veteran',
        tier: 'gold',
        rarity: 'rare',
        emoji: '🎖️',
        requirements: [
          { type: 'account_age_days', threshold: 180 }
        ],
        rewards: { reputation: 75, xp: 300, title: 'Seasoned Guardian' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Days active' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'medium' },
        isActive: true
      },
      {
        key: 'veteran_platform_legend',
        name: 'Platform Legend',
        description: 'Be active on the platform for 365 days',
        category: 'veteran',
        tier: 'platinum',
        rarity: 'legendary',
        emoji: '👑',
        requirements: [
          { type: 'account_age_days', threshold: 365 }
        ],
        rewards: { reputation: 150, xp: 750, title: 'Platform Legend' },
        visual: {
          color: BADGE_TIER_CONFIG.platinum.color,
          borderColor: BADGE_TIER_CONFIG.platinum.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: true, progressText: 'Days active' },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      },

      // Special Event Badges
      {
        key: 'special_event_launch_participant',
        name: 'Launch Participant',
        description: 'Participated in the platform launch event',
        category: 'special_event',
        tier: 'gold',
        rarity: 'rare',
        emoji: '🎉',
        requirements: [
          { type: 'special_event_participation', threshold: 1 }
        ],
        rewards: { reputation: 50, xp: 200, title: 'Launch Pioneer' },
        visual: {
          color: BADGE_TIER_CONFIG.gold.color,
          borderColor: BADGE_TIER_CONFIG.gold.borderColor,
          glowEffect: true,
          animationType: 'sparkle'
        },
        progress: { showProgress: false },
        metadata: { isSecret: false, maxEarnings: 1, difficulty: 'hard' },
        isActive: true
      }
    ]

    // Insert all badge definitions
    for (const badge of badges) {
      await this.createBadge(badge)
    }

    console.log(`Initialized ${badges.length} comprehensive badge definitions`)
  }

  // Get reputation multiplier based on user's tier
  static getReputationMultiplier(userReputation: number): number {
    const tier = REPUTATION_TIERS.find(t => 
      userReputation >= t.minReputation && userReputation <= t.maxReputation
    )
    return tier?.multiplier || 1.0
  }

  // Get reputation tier info
  static getReputationTierInfo(userReputation: number): ReputationTier | null {
    return REPUTATION_TIERS.find(t => 
      userReputation >= t.minReputation && userReputation <= t.maxReputation
    ) || null
  }

  // Calculate badge statistics
  static async getBadgeStatistics(): Promise<{
    totalBadges: number
    badgesByCategory: Record<string, number>
    badgesByTier: Record<string, number>
    badgesByRarity: Record<string, number>
  }> {
    const badges = await this.getAllBadges({ isActive: true })
    
    const stats = {
      totalBadges: badges.length,
      badgesByCategory: {} as Record<string, number>,
      badgesByTier: {} as Record<string, number>,
      badgesByRarity: {} as Record<string, number>
    }

    for (const badge of badges) {
      stats.badgesByCategory[badge.category] = (stats.badgesByCategory[badge.category] || 0) + 1
      stats.badgesByTier[badge.tier] = (stats.badgesByTier[badge.tier] || 0) + 1
      stats.badgesByRarity[badge.rarity] = (stats.badgesByRarity[badge.rarity] || 0) + 1
    }

    return stats
  }
}