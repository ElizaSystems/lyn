export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  category: 'security' | 'community' | 'achievement' | 'special' | 'quiz' | 'challenge' | 'phishing'
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
  requirements: BadgeRequirement[]
  reputationReward: number
  xpReward: number
}

export interface BadgeRequirement {
  type: 'scans' | 'threats_detected' | 'safe_scans' | 'account_age' | 'referrals' | 'stake' | 'burn' | 
        'reports' | 'quiz_score' | 'challenges_completed' | 'streak' | 'tips_viewed' | 'votes' | 
        'wallet_connections' | 'daily_logins' | 'phishing_reports' | 'accuracy_rate' | 'multi_chain'
  value: number
  comparison: 'gte' | 'lte' | 'eq'
}

export const BADGE_DEFINITIONS: Badge[] = [
  // SECURITY BADGES (12)
  {
    id: 'first_scan',
    name: 'First Scan',
    description: 'Completed your first security scan',
    icon: '🔍',
    category: 'security',
    rarity: 'common',
    requirements: [{ type: 'scans', value: 1, comparison: 'gte' }],
    reputationReward: 10,
    xpReward: 50
  },
  {
    id: 'scanner_novice',
    name: 'Scanner Novice',
    description: 'Completed 10 security scans',
    icon: '🛡️',
    category: 'security',
    rarity: 'common',
    requirements: [{ type: 'scans', value: 10, comparison: 'gte' }],
    reputationReward: 25,
    xpReward: 100
  },
  {
    id: 'scanner_expert',
    name: 'Scanner Expert',
    description: 'Completed 50 security scans',
    icon: '⚔️',
    category: 'security',
    rarity: 'rare',
    requirements: [{ type: 'scans', value: 50, comparison: 'gte' }],
    reputationReward: 50,
    xpReward: 250
  },
  {
    id: 'scanner_master',
    name: 'Scanner Master',
    description: 'Completed 100 security scans',
    icon: '🏆',
    category: 'security',
    rarity: 'epic',
    requirements: [{ type: 'scans', value: 100, comparison: 'gte' }],
    reputationReward: 100,
    xpReward: 500
  },
  {
    id: 'scanner_legend',
    name: 'Scanner Legend',
    description: 'Completed 500 security scans',
    icon: '👑',
    category: 'security',
    rarity: 'legendary',
    requirements: [{ type: 'scans', value: 500, comparison: 'gte' }],
    reputationReward: 250,
    xpReward: 1500
  },
  {
    id: 'threat_hunter',
    name: 'Threat Hunter',
    description: 'Detected 10 threats',
    icon: '🎯',
    category: 'security',
    rarity: 'rare',
    requirements: [{ type: 'threats_detected', value: 10, comparison: 'gte' }],
    reputationReward: 75,
    xpReward: 300
  },
  {
    id: 'threat_eliminator',
    name: 'Threat Eliminator',
    description: 'Detected 50 threats',
    icon: '💀',
    category: 'security',
    rarity: 'epic',
    requirements: [{ type: 'threats_detected', value: 50, comparison: 'gte' }],
    reputationReward: 150,
    xpReward: 750
  },
  {
    id: 'threat_terminator',
    name: 'Threat Terminator',
    description: 'Detected 100 threats',
    icon: '🔥',
    category: 'security',
    rarity: 'legendary',
    requirements: [{ type: 'threats_detected', value: 100, comparison: 'gte' }],
    reputationReward: 300,
    xpReward: 2000
  },
  {
    id: 'safe_guardian',
    name: 'Safe Guardian',
    description: 'Verified 25 safe resources',
    icon: '✅',
    category: 'security',
    rarity: 'common',
    requirements: [{ type: 'safe_scans', value: 25, comparison: 'gte' }],
    reputationReward: 20,
    xpReward: 75
  },
  {
    id: 'accuracy_ace',
    name: 'Accuracy Ace',
    description: 'Maintain 90% scan accuracy',
    icon: '🎯',
    category: 'security',
    rarity: 'epic',
    requirements: [{ type: 'accuracy_rate', value: 90, comparison: 'gte' }],
    reputationReward: 125,
    xpReward: 600
  },
  {
    id: 'multi_chain_scanner',
    name: 'Multi-Chain Scanner',
    description: 'Scanned across 5 different blockchains',
    icon: '🔗',
    category: 'security',
    rarity: 'rare',
    requirements: [{ type: 'multi_chain', value: 5, comparison: 'gte' }],
    reputationReward: 60,
    xpReward: 350
  },
  {
    id: 'wallet_guardian',
    name: 'Wallet Guardian',
    description: 'Protected 10 wallets from threats',
    icon: '🔐',
    category: 'security',
    rarity: 'rare',
    requirements: [{ type: 'wallet_connections', value: 10, comparison: 'gte' }],
    reputationReward: 80,
    xpReward: 400
  },

  // COMMUNITY BADGES (10)
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined within the first month',
    icon: '🌟',
    category: 'community',
    rarity: 'rare',
    requirements: [{ type: 'account_age', value: 30, comparison: 'lte' }],
    reputationReward: 100,
    xpReward: 500
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Account over 90 days old',
    icon: '🎖️',
    category: 'community',
    rarity: 'rare',
    requirements: [{ type: 'account_age', value: 90, comparison: 'gte' }],
    reputationReward: 75,
    xpReward: 400
  },
  {
    id: 'elder',
    name: 'Elder',
    description: 'Account over 365 days old',
    icon: '🧙',
    category: 'community',
    rarity: 'legendary',
    requirements: [{ type: 'account_age', value: 365, comparison: 'gte' }],
    reputationReward: 200,
    xpReward: 1000
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Referred 3 users',
    icon: '🦋',
    category: 'community',
    rarity: 'common',
    requirements: [{ type: 'referrals', value: 3, comparison: 'gte' }],
    reputationReward: 30,
    xpReward: 150
  },
  {
    id: 'influencer',
    name: 'Influencer',
    description: 'Referred 10 users',
    icon: '📢',
    category: 'community',
    rarity: 'rare',
    requirements: [{ type: 'referrals', value: 10, comparison: 'gte' }],
    reputationReward: 90,
    xpReward: 500
  },
  {
    id: 'ambassador',
    name: 'Ambassador',
    description: 'Referred 25 users',
    icon: '🌐',
    category: 'community',
    rarity: 'epic',
    requirements: [{ type: 'referrals', value: 25, comparison: 'gte' }],
    reputationReward: 175,
    xpReward: 1000
  },
  {
    id: 'network_builder',
    name: 'Network Builder',
    description: 'Referred 50 users',
    icon: '🏗️',
    category: 'community',
    rarity: 'legendary',
    requirements: [{ type: 'referrals', value: 50, comparison: 'gte' }],
    reputationReward: 350,
    xpReward: 2500
  },
  {
    id: 'daily_visitor',
    name: 'Daily Visitor',
    description: 'Logged in 7 days in a row',
    icon: '📅',
    category: 'community',
    rarity: 'common',
    requirements: [{ type: 'daily_logins', value: 7, comparison: 'gte' }],
    reputationReward: 25,
    xpReward: 100
  },
  {
    id: 'dedicated_user',
    name: 'Dedicated User',
    description: 'Logged in 30 days in a row',
    icon: '💪',
    category: 'community',
    rarity: 'rare',
    requirements: [{ type: 'daily_logins', value: 30, comparison: 'gte' }],
    reputationReward: 100,
    xpReward: 600
  },
  {
    id: 'community_voter',
    name: 'Community Voter',
    description: 'Voted on 20 phishing reports',
    icon: '🗳️',
    category: 'community',
    rarity: 'common',
    requirements: [{ type: 'votes', value: 20, comparison: 'gte' }],
    reputationReward: 40,
    xpReward: 200
  },

  // ACHIEVEMENT BADGES (10)
  {
    id: 'staker',
    name: 'Staker',
    description: 'Staked LYN tokens',
    icon: '💎',
    category: 'achievement',
    rarity: 'common',
    requirements: [{ type: 'stake', value: 100, comparison: 'gte' }],
    reputationReward: 50,
    xpReward: 250
  },
  {
    id: 'diamond_hands',
    name: 'Diamond Hands',
    description: 'Staked over 5,000 LYN',
    icon: '💎',
    category: 'achievement',
    rarity: 'epic',
    requirements: [{ type: 'stake', value: 5000, comparison: 'gte' }],
    reputationReward: 150,
    xpReward: 1000
  },
  {
    id: 'whale_staker',
    name: 'Whale Staker',
    description: 'Staked over 10,000 LYN',
    icon: '🐋',
    category: 'achievement',
    rarity: 'legendary',
    requirements: [{ type: 'stake', value: 10000, comparison: 'gte' }],
    reputationReward: 300,
    xpReward: 2000
  },
  {
    id: 'burner',
    name: 'Token Burner',
    description: 'Burned 100 LYN tokens',
    icon: '🔥',
    category: 'achievement',
    rarity: 'rare',
    requirements: [{ type: 'burn', value: 100, comparison: 'gte' }],
    reputationReward: 75,
    xpReward: 400
  },
  {
    id: 'inferno',
    name: 'Inferno',
    description: 'Burned 1,000 LYN tokens',
    icon: '🌋',
    category: 'achievement',
    rarity: 'epic',
    requirements: [{ type: 'burn', value: 1000, comparison: 'gte' }],
    reputationReward: 200,
    xpReward: 1250
  },
  {
    id: 'reporter',
    name: 'Security Reporter',
    description: 'Submitted 5 security reports',
    icon: '📝',
    category: 'achievement',
    rarity: 'common',
    requirements: [{ type: 'reports', value: 5, comparison: 'gte' }],
    reputationReward: 35,
    xpReward: 175
  },
  {
    id: 'vigilant',
    name: 'Vigilant Guardian',
    description: 'Submitted 25 security reports',
    icon: '👁️',
    category: 'achievement',
    rarity: 'epic',
    requirements: [{ type: 'reports', value: 25, comparison: 'gte' }],
    reputationReward: 125,
    xpReward: 750
  },
  {
    id: 'watchdog',
    name: 'Watchdog',
    description: 'Submitted 50 security reports',
    icon: '🐕',
    category: 'achievement',
    rarity: 'legendary',
    requirements: [{ type: 'reports', value: 50, comparison: 'gte' }],
    reputationReward: 275,
    xpReward: 1750
  },
  {
    id: 'streak_starter',
    name: 'Streak Starter',
    description: 'Maintain a 7-day activity streak',
    icon: '⚡',
    category: 'achievement',
    rarity: 'common',
    requirements: [{ type: 'streak', value: 7, comparison: 'gte' }],
    reputationReward: 30,
    xpReward: 150
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Maintain a 30-day activity streak',
    icon: '🔥',
    category: 'achievement',
    rarity: 'epic',
    requirements: [{ type: 'streak', value: 30, comparison: 'gte' }],
    reputationReward: 150,
    xpReward: 900
  },

  // QUIZ BADGES (5)
  {
    id: 'quiz_starter',
    name: 'Quiz Starter',
    description: 'Complete your first quiz',
    icon: '🧠',
    category: 'quiz',
    rarity: 'common',
    requirements: [{ type: 'quiz_score', value: 1, comparison: 'gte' }],
    reputationReward: 20,
    xpReward: 100
  },
  {
    id: 'quiz_enthusiast',
    name: 'Quiz Enthusiast',
    description: 'Score 80% or higher on 10 quizzes',
    icon: '📚',
    category: 'quiz',
    rarity: 'rare',
    requirements: [{ type: 'quiz_score', value: 10, comparison: 'gte' }],
    reputationReward: 70,
    xpReward: 400
  },
  {
    id: 'quiz_genius',
    name: 'Quiz Genius',
    description: 'Perfect score on 5 quizzes',
    icon: '🎓',
    category: 'quiz',
    rarity: 'epic',
    requirements: [{ type: 'quiz_score', value: 5, comparison: 'gte' }],
    reputationReward: 140,
    xpReward: 800
  },
  {
    id: 'knowledge_keeper',
    name: 'Knowledge Keeper',
    description: 'Complete 50 quizzes',
    icon: '📖',
    category: 'quiz',
    rarity: 'legendary',
    requirements: [{ type: 'quiz_score', value: 50, comparison: 'gte' }],
    reputationReward: 250,
    xpReward: 1500
  },
  {
    id: 'speed_learner',
    name: 'Speed Learner',
    description: 'Complete a quiz in under 2 minutes with 100% accuracy',
    icon: '⚡',
    category: 'quiz',
    rarity: 'rare',
    requirements: [{ type: 'quiz_score', value: 1, comparison: 'gte' }],
    reputationReward: 60,
    xpReward: 300
  },

  // CHALLENGE BADGES (5)
  {
    id: 'challenger',
    name: 'Challenger',
    description: 'Complete your first security challenge',
    icon: '🎯',
    category: 'challenge',
    rarity: 'common',
    requirements: [{ type: 'challenges_completed', value: 1, comparison: 'gte' }],
    reputationReward: 25,
    xpReward: 125
  },
  {
    id: 'challenge_seeker',
    name: 'Challenge Seeker',
    description: 'Complete 10 security challenges',
    icon: '🏃',
    category: 'challenge',
    rarity: 'rare',
    requirements: [{ type: 'challenges_completed', value: 10, comparison: 'gte' }],
    reputationReward: 85,
    xpReward: 500
  },
  {
    id: 'challenge_master',
    name: 'Challenge Master',
    description: 'Complete 25 security challenges',
    icon: '🥷',
    category: 'challenge',
    rarity: 'epic',
    requirements: [{ type: 'challenges_completed', value: 25, comparison: 'gte' }],
    reputationReward: 160,
    xpReward: 1000
  },
  {
    id: 'challenge_legend',
    name: 'Challenge Legend',
    description: 'Complete 50 security challenges',
    icon: '🏅',
    category: 'challenge',
    rarity: 'legendary',
    requirements: [{ type: 'challenges_completed', value: 50, comparison: 'gte' }],
    reputationReward: 300,
    xpReward: 2000
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete 10 challenges with perfect scores',
    icon: '💯',
    category: 'challenge',
    rarity: 'epic',
    requirements: [{ type: 'challenges_completed', value: 10, comparison: 'gte' }],
    reputationReward: 175,
    xpReward: 1100
  },

  // PHISHING BADGES (3)
  {
    id: 'phishing_detector',
    name: 'Phishing Detector',
    description: 'Report 5 verified phishing attempts',
    icon: '🎣',
    category: 'phishing',
    rarity: 'rare',
    requirements: [{ type: 'phishing_reports', value: 5, comparison: 'gte' }],
    reputationReward: 65,
    xpReward: 350
  },
  {
    id: 'phishing_expert',
    name: 'Phishing Expert',
    description: 'Report 20 verified phishing attempts',
    icon: '🦈',
    category: 'phishing',
    rarity: 'epic',
    requirements: [{ type: 'phishing_reports', value: 20, comparison: 'gte' }],
    reputationReward: 145,
    xpReward: 850
  },
  {
    id: 'phishing_hunter',
    name: 'Phishing Hunter',
    description: 'Report 50 verified phishing attempts',
    icon: '🏹',
    category: 'phishing',
    rarity: 'legendary',
    requirements: [{ type: 'phishing_reports', value: 50, comparison: 'gte' }],
    reputationReward: 285,
    xpReward: 1800
  },

  // SPECIAL BADGES (5)
  {
    id: 'perfect_scanner',
    name: 'Perfect Scanner',
    description: '100 scans with 100% accuracy',
    icon: '💯',
    category: 'special',
    rarity: 'legendary',
    requirements: [
      { type: 'scans', value: 100, comparison: 'gte' },
      { type: 'accuracy_rate', value: 100, comparison: 'eq' }
    ],
    reputationReward: 400,
    xpReward: 2500
  },
  {
    id: 'security_legend',
    name: 'Security Legend',
    description: 'Over 1000 scans completed',
    icon: '🏅',
    category: 'special',
    rarity: 'mythic',
    requirements: [{ type: 'scans', value: 1000, comparison: 'gte' }],
    reputationReward: 500,
    xpReward: 5000
  },
  {
    id: 'tip_collector',
    name: 'Tip Collector',
    description: 'View 100 security tips',
    icon: '💡',
    category: 'special',
    rarity: 'rare',
    requirements: [{ type: 'tips_viewed', value: 100, comparison: 'gte' }],
    reputationReward: 55,
    xpReward: 300
  },
  {
    id: 'all_rounder',
    name: 'All-Rounder',
    description: 'Earn badges from all categories',
    icon: '🌟',
    category: 'special',
    rarity: 'mythic',
    requirements: [
      { type: 'scans', value: 50, comparison: 'gte' },
      { type: 'quiz_score', value: 10, comparison: 'gte' },
      { type: 'challenges_completed', value: 5, comparison: 'gte' },
      { type: 'phishing_reports', value: 3, comparison: 'gte' }
    ],
    reputationReward: 600,
    xpReward: 3500
  },
  {
    id: 'founding_member',
    name: 'Founding Member',
    description: 'One of the first 100 users',
    icon: '🎖️',
    category: 'special',
    rarity: 'mythic',
    requirements: [{ type: 'account_age', value: 1, comparison: 'gte' }],
    reputationReward: 1000,
    xpReward: 5000
  }
]

// Export helper function to get badge by ID
export function getBadgeById(id: string): Badge | undefined {
  return BADGE_DEFINITIONS.find(badge => badge.id === id)
}

// Export helper function to get badges by category
export function getBadgesByCategory(category: string): Badge[] {
  return BADGE_DEFINITIONS.filter(badge => badge.category === category)
}

// Export helper function to get badges by rarity
export function getBadgesByRarity(rarity: string): Badge[] {
  return BADGE_DEFINITIONS.filter(badge => badge.rarity === rarity)
}

// Export badge count
export const TOTAL_BADGES = BADGE_DEFINITIONS.length // Should be 50