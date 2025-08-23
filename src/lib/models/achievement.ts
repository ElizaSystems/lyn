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
  | 'tokens_burned'
  | 'referral_completed'
  | 'community_vote'
  | 'feedback_submitted'
  | 'daily_login'
  | 'profile_updated'
  | 'subscription_purchased'
  | 'streak_maintained'

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
  { level: 2, xpRequired: 100, xpTotal: 100, title: 'Explorer', badge: 'explorer' },
  { level: 3, xpRequired: 200, xpTotal: 300, title: 'Guardian', badge: 'guardian' },
  { level: 4, xpRequired: 400, xpTotal: 700, title: 'Protector', badge: 'protector' },
  { level: 5, xpRequired: 600, xpTotal: 1300, title: 'Sentinel', badge: 'sentinel' },
  { level: 6, xpRequired: 800, xpTotal: 2100, title: 'Defender', badge: 'defender' },
  { level: 7, xpRequired: 1000, xpTotal: 3100, title: 'Champion', badge: 'champion' },
  { level: 8, xpRequired: 1500, xpTotal: 4600, title: 'Elite', badge: 'elite' },
  { level: 9, xpRequired: 2000, xpTotal: 6600, title: 'Master', badge: 'master' },
  { level: 10, xpRequired: 3000, xpTotal: 9600, title: 'Legend', badge: 'legend' }
]

// Achievement Categories Configuration
export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, {
  name: string
  description: string
  color: string
  icon: string
}> = {
  security_scanner: {
    name: 'Security Scanner',
    description: 'Achievements for performing security scans',
    color: '#3B82F6',
    icon: 'shield-check'
  },
  threat_hunter: {
    name: 'Threat Hunter',
    description: 'Achievements for detecting threats and vulnerabilities',
    color: '#EF4444',
    icon: 'bug'
  },
  community_guardian: {
    name: 'Community Guardian',
    description: 'Achievements for community contributions and engagement',
    color: '#10B981',
    icon: 'users'
  },
  token_burner: {
    name: 'Token Burner',
    description: 'Achievements for burning LYN tokens',
    color: '#F59E0B',
    icon: 'fire'
  },
  referral_master: {
    name: 'Referral Master',
    description: 'Achievements for successful referrals',
    color: '#8B5CF6',
    icon: 'user-plus'
  },
  streak: {
    name: 'Consistency',
    description: 'Achievements for maintaining activity streaks',
    color: '#06B6D4',
    icon: 'calendar'
  },
  veteran: {
    name: 'Veteran',
    description: 'Achievements for account longevity and dedication',
    color: '#6B7280',
    icon: 'star'
  },
  rare: {
    name: 'Rare Achievements',
    description: 'Rare and secret achievements',
    color: '#EC4899',
    icon: 'sparkles'
  },
  special: {
    name: 'Special Events',
    description: 'Limited-time event achievements',
    color: '#F97316',
    icon: 'trophy'
  }
}