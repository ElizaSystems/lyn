import { ObjectId } from 'mongodb'

// Achievement Categories
export type AchievementCategory = 
  | 'security_scanner'      // URL, wallet, contract, document scanning
  | 'cross_chain_explorer'  // Multi-chain activity tracking
  | 'threat_hunter'         // Threat detection and reporting
  | 'community_guardian'    // Feedback, voting, whitelist/blacklist contributions
  | 'burn_master'          // Token burning verification
  | 'achievement_hunter'    // Collecting other badges
  | 'task_automation'      // Creating and running automated tasks
  | 'notification_expert'   // Webhook setup, alert management
  | 'payment_pioneer'      // Crypto subscriptions
  | 'referral_network'     // Successful referrals and network growth
  | 'realtime_defender'    // Threat feed monitoring
  | 'ai_assistant'         // Chat interactions
  | 'streak_master'        // Daily/weekly/monthly activity
  | 'veteran'              // Account age and longevity
  | 'special_event'        // Platform milestones, seasonal events

// Achievement Tiers
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'platinum'

// Achievement Types
export type AchievementType = 'cumulative' | 'milestone' | 'streak' | 'one_time' | 'secret'

// Achievement Rarity
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

// Activity Types for tracking
export type ActivityType =
  | 'scan_completed'
  | 'threat_detected'
  | 'wallet_analyzed'
  | 'document_scanned'
  | 'url_checked'
  | 'contract_analyzed'
  | 'cross_chain_activity'
  | 'multi_chain_scan'
  | 'tokens_burned'
  | 'burn_verified'
  | 'referral_completed'
  | 'referral_network_growth'
  | 'community_vote'
  | 'feedback_submitted'
  | 'whitelist_contribution'
  | 'blacklist_contribution'
  | 'task_created'
  | 'task_automated'
  | 'webhook_configured'
  | 'notification_setup'
  | 'subscription_purchased'
  | 'crypto_payment_made'
  | 'threat_feed_monitored'
  | 'ai_chat_interaction'
  | 'daily_login'
  | 'weekly_activity'
  | 'monthly_activity'
  | 'profile_updated'
  | 'streak_maintained'
  | 'badge_collected'
  | 'achievement_unlocked'

// Achievement Definition (template/definition stored in database)
export interface AchievementDefinition {
  _id?: ObjectId
  key: string                    // Unique identifier (e.g., 'security_scanner_bronze_100')
  name: string                   // Display name
  description: string            // Achievement description
  category: AchievementCategory
  tier: AchievementTier
  type: AchievementType
  rarity: AchievementRarity
  requirements: {
    activityType: ActivityType
    threshold: number            // Required count/amount
    timeframe?: number          // Days (for streak/time-based achievements)
    conditions?: Record<string, any> // Additional conditions
  }
  rewards: {
    xp: number                  // XP/Points awarded
    reputation: number          // Reputation points
    title?: string             // Special title unlock
    badge?: string             // Badge icon/image
    unlocks?: string[]         // Features/content unlocked
  }
  metadata: {
    icon: string               // Icon identifier
    color: string              // Theme color
    isSecret: boolean          // Hidden until earned
    isRetired: boolean         // No longer earnable
    maxEarnings?: number       // Max times this can be earned (-1 for unlimited)
    prerequisites?: string[]   // Required achievement keys
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// User Achievement (earned achievement record)
export interface UserAchievement {
  _id?: ObjectId
  userId: ObjectId
  achievementKey: string         // Reference to AchievementDefinition.key
  achievementName: string        // Cached for performance
  category: AchievementCategory
  tier: AchievementTier
  progress: {
    current: number             // Current progress
    target: number              // Target requirement
    percentage: number          // Progress percentage (0-100)
  }
  isCompleted: boolean
  completedAt?: Date
  metadata?: {
    context?: Record<string, any>  // Context when earned
    streak?: number               // For streak achievements
    rank?: number                 // Ranking when earned
  }
  createdAt: Date
  updatedAt: Date
}

// User Activity Log (for tracking progress)
export interface UserActivity {
  _id?: ObjectId
  userId: ObjectId
  activityType: ActivityType
  value: number                  // Amount/count
  metadata?: {
    scanId?: ObjectId
    severity?: string
    burnAmount?: number
    referralId?: ObjectId
    streakCount?: number
    context?: Record<string, any>
  }
  timestamp: Date
  processedForAchievements?: boolean  // To track if this activity was processed
}

// User Stats and Progress
export interface UserStats {
  _id?: ObjectId
  userId: ObjectId
  totalXP: number
  totalReputation: number
  level: number                  // Calculated from XP
  levelProgress: number          // Progress to next level (0-100)
  achievementsUnlocked: number
  achievementsByCategory: Record<AchievementCategory, number>
  achievementsByTier: Record<AchievementTier, number>
  
  // Activity statistics
  stats: {
    totalScans: number
    threatsDetected: number
    tokensBurned: number
    referralsMade: number
    communityContributions: number
    currentStreakDays: number
    longestStreakDays: number
    accountAgeDays: number
  }
  
  // Recent achievements
  recentAchievements: Array<{
    achievementKey: string
    achievementName: string
    earnedAt: Date
    xpEarned: number
  }>
  
  updatedAt: Date
}

// Leaderboard Entry
export interface LeaderboardEntry {
  rank: number
  userId: ObjectId
  username?: string
  walletAddress: string
  score: number                  // XP, reputation, or activity-specific score
  achievements: number
  metadata?: {
    tier?: AchievementTier
    category?: AchievementCategory
    streak?: number
    context?: Record<string, any>
  }
  updatedAt: Date
}

// Achievement Progress Tracking
export interface AchievementProgress {
  _id?: ObjectId
  userId: ObjectId
  achievementKey: string
  currentValue: number
  targetValue: number
  startedAt: Date
  lastUpdated: Date
  isCompleted: boolean
  completedAt?: Date
}

// Daily/Weekly Challenges (special time-limited achievements)
export interface Challenge {
  _id?: ObjectId
  name: string
  description: string
  requirements: {
    activityType: ActivityType
    threshold: number
    conditions?: Record<string, any>
  }
  rewards: {
    xp: number
    reputation: number
    badge?: string
    specialReward?: string
  }
  duration: {
    startDate: Date
    endDate: Date
    type: 'daily' | 'weekly' | 'monthly' | 'special'
  }
  isActive: boolean
  participantCount: number
  completionCount: number
  createdAt: Date
}

// User Challenge Participation
export interface UserChallenge {
  _id?: ObjectId
  userId: ObjectId
  challengeId: ObjectId
  progress: number
  target: number
  isCompleted: boolean
  completedAt?: Date
  rewardClaimed: boolean
  createdAt: Date
}

// Achievement Notification Event
export interface AchievementNotification {
  _id?: ObjectId
  userId: ObjectId
  type: 'achievement_earned' | 'level_up' | 'streak_milestone' | 'leaderboard_rank'
  title: string
  message: string
  metadata: {
    achievementKey?: string
    oldLevel?: number
    newLevel?: number
    xpEarned?: number
    rank?: number
    streak?: number
  }
  isRead: boolean
  createdAt: Date
}

// Global Achievement Statistics
export interface GlobalAchievementStats {
  totalAchievementsEarned: number
  mostEarnedAchievements: Array<{
    achievementKey: string
    achievementName: string
    earnedCount: number
    percentage: number
  }>
  rareAchievements: Array<{
    achievementKey: string
    achievementName: string
    earnedCount: number
    rarity: AchievementRarity
  }>
  averageUserLevel: number
  totalXPAwarded: number
  achievementsByCategory: Record<AchievementCategory, number>
  achievementsByTier: Record<AchievementTier, number>
  updatedAt: Date
}

// Level System Configuration
export interface LevelConfig {
  level: number
  xpRequired: number
  xpTotal: number
  title?: string
  benefits?: string[]
  badge?: string
}

export const DEFAULT_LEVEL_CONFIG: LevelConfig[] = [
  { level: 1, xpRequired: 0, xpTotal: 0, title: 'Novice', badge: 'novice' },
  { level: 2, xpRequired: 50, xpTotal: 50, title: 'Apprentice', badge: 'apprentice' },
  { level: 3, xpRequired: 100, xpTotal: 150, title: 'Explorer', badge: 'explorer' },
  { level: 4, xpRequired: 200, xpTotal: 350, title: 'Contributor', badge: 'contributor' },
  { level: 5, xpRequired: 300, xpTotal: 650, title: 'Guardian', badge: 'guardian' },
  { level: 6, xpRequired: 400, xpTotal: 1050, title: 'Expert', badge: 'expert' },
  { level: 7, xpRequired: 500, xpTotal: 1550, title: 'Elite', badge: 'elite' },
  { level: 8, xpRequired: 750, xpTotal: 2300, title: 'Master', badge: 'master' },
  { level: 9, xpRequired: 1000, xpTotal: 3300, title: 'Legend', badge: 'legend' },
  { level: 10, xpRequired: 1500, xpTotal: 4800, title: 'Mythic', badge: 'mythic' }
]

// Reputation Tier Configuration
export interface ReputationTier {
  tier: string
  minReputation: number
  maxReputation: number
  title: string
  description: string
  color: string
  benefits: string[]
  multiplier: number // Reputation earning multiplier
}

export const REPUTATION_TIERS: ReputationTier[] = [
  {
    tier: 'novice',
    minReputation: 0,
    maxReputation: 99,
    title: 'Novice',
    description: 'Just getting started on your security journey',
    color: '#9CA3AF',
    benefits: ['Basic platform access', 'Community participation'],
    multiplier: 1.0
  },
  {
    tier: 'contributor',
    minReputation: 100,
    maxReputation: 299,
    title: 'Contributor',
    description: 'Actively contributing to platform security',
    color: '#10B981',
    benefits: ['Enhanced scanning features', 'Priority support', '10% reputation bonus'],
    multiplier: 1.1
  },
  {
    tier: 'guardian',
    minReputation: 300,
    maxReputation: 599,
    title: 'Guardian',
    description: 'Trusted community member and security guardian',
    color: '#3B82F6',
    benefits: ['Advanced threat detection', 'Moderation privileges', '25% reputation bonus'],
    multiplier: 1.25
  },
  {
    tier: 'expert',
    minReputation: 600,
    maxReputation: 999,
    title: 'Expert',
    description: 'Security expert with proven track record',
    color: '#8B5CF6',
    benefits: ['Expert-level features', 'Beta access', '50% reputation bonus'],
    multiplier: 1.5
  },
  {
    tier: 'elite',
    minReputation: 1000,
    maxReputation: 1499,
    title: 'Elite',
    description: 'Elite security professional',
    color: '#F59E0B',
    benefits: ['Exclusive features', 'Direct developer access', '75% reputation bonus'],
    multiplier: 1.75
  },
  {
    tier: 'legend',
    minReputation: 1500,
    maxReputation: Infinity,
    title: 'Legend',
    description: 'Legendary status - the highest tier of security mastery',
    color: '#EF4444',
    benefits: ['All features unlocked', 'Legendary badge', '100% reputation bonus'],
    multiplier: 2.0
  }
]

// Achievement Categories Configuration
export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, {
  name: string
  description: string
  color: string
  icon: string
  emoji: string
}> = {
  security_scanner: {
    name: 'Security Scanner',
    description: 'URL, wallet, contract, and document scanning achievements',
    color: '#3B82F6',
    icon: 'shield-check',
    emoji: '🛡️'
  },
  cross_chain_explorer: {
    name: 'Cross-Chain Explorer',
    description: 'Multi-chain activity tracking and analysis achievements',
    color: '#7C3AED',
    icon: 'link',
    emoji: '⛓️'
  },
  threat_hunter: {
    name: 'Threat Hunter',
    description: 'Threat detection and security reporting achievements',
    color: '#EF4444',
    icon: 'bug',
    emoji: '🎯'
  },
  community_guardian: {
    name: 'Community Guardian',
    description: 'Community feedback, voting, and moderation achievements',
    color: '#10B981',
    icon: 'users',
    emoji: '🛡️'
  },
  burn_master: {
    name: 'Burn Master',
    description: 'Token burning verification and commitment achievements',
    color: '#F59E0B',
    icon: 'fire',
    emoji: '🔥'
  },
  achievement_hunter: {
    name: 'Achievement Hunter',
    description: 'Meta-achievements for collecting badges and milestones',
    color: '#EC4899',
    icon: 'trophy',
    emoji: '🏆'
  },
  task_automation: {
    name: 'Task Automation',
    description: 'Creating and managing automated security tasks',
    color: '#06B6D4',
    icon: 'cog',
    emoji: '⚙️'
  },
  notification_expert: {
    name: 'Notification Expert',
    description: 'Webhook setup and alert management mastery',
    color: '#8B5CF6',
    icon: 'bell',
    emoji: '🔔'
  },
  payment_pioneer: {
    name: 'Payment Pioneer',
    description: 'Cryptocurrency subscription and payment achievements',
    color: '#F97316',
    icon: 'credit-card',
    emoji: '💳'
  },
  referral_network: {
    name: 'Referral Network',
    description: 'Building and growing your referral network',
    color: '#84CC16',
    icon: 'network',
    emoji: '🌐'
  },
  realtime_defender: {
    name: 'Real-time Defender',
    description: 'Threat feed monitoring and real-time security',
    color: '#DC2626',
    icon: 'radar',
    emoji: '📡'
  },
  ai_assistant: {
    name: 'AI Assistant',
    description: 'AI chat interactions and assistance achievements',
    color: '#6366F1',
    icon: 'bot',
    emoji: '🤖'
  },
  streak_master: {
    name: 'Streak Master',
    description: 'Daily, weekly, and monthly activity consistency',
    color: '#059669',
    icon: 'calendar-days',
    emoji: '📅'
  },
  veteran: {
    name: 'Veteran',
    description: 'Account longevity and platform dedication',
    color: '#6B7280',
    icon: 'star',
    emoji: '⭐'
  },
  special_event: {
    name: 'Special Events',
    description: 'Limited-time events and platform milestone celebrations',
    color: '#DB2777',
    icon: 'party-popper',
    emoji: '🎉'
  }
}