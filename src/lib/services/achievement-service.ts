import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { 
  AchievementDefinition,
  UserAchievement, 
  UserActivity,
  UserStats,
  LeaderboardEntry,
  AchievementProgress,
  Challenge,
  UserChallenge,
  ActivityType,
  AchievementCategory,
  AchievementTier,
  AchievementType,
  DEFAULT_LEVEL_CONFIG,
  LevelConfig,
  GlobalAchievementStats
} from '@/lib/models/achievement'
import { NotificationService } from '@/lib/services/notification-service'

export class AchievementService {
  // Collection getters
  private static async getDefinitionsCollection() {
    const db = await getDatabase()
    return db.collection<AchievementDefinition>('achievement_definitions')
  }

  private static async getUserAchievementsCollection() {
    const db = await getDatabase()
    return db.collection<UserAchievement>('user_achievements')
  }

  private static async getUserActivitiesCollection() {
    const db = await getDatabase()
    return db.collection<UserActivity>('user_activities')
  }

  private static async getUserStatsCollection() {
    const db = await getDatabase()
    return db.collection<UserStats>('user_stats')
  }

  private static async getProgressCollection() {
    const db = await getDatabase()
    return db.collection<AchievementProgress>('achievement_progress')
  }

  private static async getChallengesCollection() {
    const db = await getDatabase()
    return db.collection<Challenge>('challenges')
  }

  private static async getUserChallengesCollection() {
    const db = await getDatabase()
    return db.collection<UserChallenge>('user_challenges')
  }

  // Achievement Definition Management
  static async createAchievementDefinition(definition: Omit<AchievementDefinition, '_id' | 'createdAt' | 'updatedAt'>): Promise<AchievementDefinition> {
    const collection = await this.getDefinitionsCollection()
    const now = new Date()

    const newDefinition: AchievementDefinition = {
      ...definition,
      createdAt: now,
      updatedAt: now
    }

    const result = await collection.insertOne(newDefinition)
    return { ...newDefinition, _id: result.insertedId }
  }

  static async getAchievementDefinitions(filters: {
    category?: AchievementCategory
    tier?: AchievementTier
    type?: AchievementType
    isActive?: boolean
  } = {}): Promise<AchievementDefinition[]> {
    const collection = await this.getDefinitionsCollection()
    return await collection.find(filters).toArray()
  }

  static async getAchievementDefinition(key: string): Promise<AchievementDefinition | null> {
    const collection = await this.getDefinitionsCollection()
    return await collection.findOne({ key })
  }

  // Activity Tracking
  static async trackActivity(
    userId: string,
    activityType: ActivityType,
    value: number = 1,
    metadata?: Record<string, any>
  ): Promise<void> {
    const collection = await this.getUserActivitiesCollection()
    
    const activity: UserActivity = {
      userId: new ObjectId(userId),
      activityType,
      value,
      metadata,
      timestamp: new Date(),
      processedForAchievements: false
    }

    await collection.insertOne(activity)
    
    // Process achievements for this activity
    await this.processActivityForAchievements(userId, activity)
  }

  // Process activity for achievements
  private static async processActivityForAchievements(userId: string, activity: UserActivity): Promise<void> {
    try {
      // Get all active achievement definitions that match this activity type
      const definitions = await this.getAchievementDefinitions({
        isActive: true
      })

      const relevantDefinitions = definitions.filter(def => 
        def.requirements.activityType === activity.activityType
      )

      for (const definition of relevantDefinitions) {
        await this.updateAchievementProgress(userId, definition, activity)
      }

      // Update user stats
      await this.updateUserStats(userId, activity)

      // Mark activity as processed
      const activitiesCollection = await this.getUserActivitiesCollection()
      await activitiesCollection.updateOne(
        { _id: activity._id },
        { $set: { processedForAchievements: true } }
      )
    } catch (error) {
      console.error('Error processing activity for achievements:', error)
    }
  }

  // Update achievement progress
  private static async updateAchievementProgress(
    userId: string,
    definition: AchievementDefinition,
    activity: UserActivity
  ): Promise<void> {
    const progressCollection = await this.getProgressCollection()
    const userObjectId = new ObjectId(userId)

    // Check if user already has this achievement
    const existingAchievement = await this.getUserAchievement(userId, definition.key)
    if (existingAchievement?.isCompleted) {
      return // Already completed
    }

    // Get or create progress record
    let progress = await progressCollection.findOne({
      userId: userObjectId,
      achievementKey: definition.key
    })

    if (!progress) {
      progress = {
        userId: userObjectId,
        achievementKey: definition.key,
        currentValue: 0,
        targetValue: definition.requirements.threshold,
        startedAt: new Date(),
        lastUpdated: new Date(),
        isCompleted: false
      }
      await progressCollection.insertOne(progress)
    }

    // Calculate new progress value
    let newValue = progress.currentValue

    if (definition.type === 'cumulative') {
      newValue += activity.value
    } else if (definition.type === 'milestone') {
      newValue = Math.max(newValue, activity.value)
    } else if (definition.type === 'streak') {
      // Handle streak logic
      newValue = await this.calculateStreakValue(userId, definition, activity)
    }

    // Update progress
    await progressCollection.updateOne(
      { _id: progress._id },
      {
        $set: {
          currentValue: newValue,
          lastUpdated: new Date()
        }
      }
    )

    // Check if achievement should be awarded
    if (newValue >= definition.requirements.threshold && !progress.isCompleted) {
      await this.awardAchievement(userId, definition, newValue)
    }
  }

  // Award achievement to user
  private static async awardAchievement(
    userId: string,
    definition: AchievementDefinition,
    finalValue: number
  ): Promise<void> {
    const userAchievementsCollection = await this.getUserAchievementsCollection()
    const progressCollection = await this.getProgressCollection()
    const userObjectId = new ObjectId(userId)
    const now = new Date()

    // Create user achievement record
    const userAchievement: UserAchievement = {
      userId: userObjectId,
      achievementKey: definition.key,
      achievementName: definition.name,
      category: definition.category,
      tier: definition.tier,
      progress: {
        current: finalValue,
        target: definition.requirements.threshold,
        percentage: 100
      },
      isCompleted: true,
      completedAt: now,
      metadata: {
        context: { earnedValue: finalValue }
      },
      createdAt: now,
      updatedAt: now
    }

    await userAchievementsCollection.insertOne(userAchievement)

    // Mark progress as completed
    await progressCollection.updateOne(
      { userId: userObjectId, achievementKey: definition.key },
      {
        $set: {
          isCompleted: true,
          completedAt: now
        }
      }
    )

    // Award XP and reputation
    await this.awardXPAndReputation(userId, definition.rewards.xp, definition.rewards.reputation)

    // Send achievement notification
    await this.sendAchievementNotification(userId, definition)

    console.log(`Achievement awarded: ${definition.name} to user ${userId}`)
  }

  // Award XP and reputation
  private static async awardXPAndReputation(userId: string, xp: number, reputation: number): Promise<void> {
    const statsCollection = await this.getUserStatsCollection()
    const userObjectId = new ObjectId(userId)

    const currentStats = await this.getUserStats(userId)
    const newXP = currentStats.totalXP + xp
    const newReputation = currentStats.totalReputation + reputation

    // Calculate new level
    const newLevel = this.calculateLevel(newXP)
    const levelUp = newLevel > currentStats.level

    await statsCollection.updateOne(
      { userId: userObjectId },
      {
        $inc: {
          totalXP: xp,
          totalReputation: reputation,
          achievementsUnlocked: 1
        },
        $set: {
          level: newLevel,
          levelProgress: this.calculateLevelProgress(newXP),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )

    // Send level up notification if applicable
    if (levelUp) {
      await this.sendLevelUpNotification(userId, currentStats.level, newLevel, xp)
    }
  }

  // Calculate user level from XP
  private static calculateLevel(totalXP: number): number {
    for (let i = DEFAULT_LEVEL_CONFIG.length - 1; i >= 0; i--) {
      if (totalXP >= DEFAULT_LEVEL_CONFIG[i].xpTotal) {
        return DEFAULT_LEVEL_CONFIG[i].level
      }
    }
    return 1
  }

  // Calculate progress to next level
  private static calculateLevelProgress(totalXP: number): number {
    const currentLevel = this.calculateLevel(totalXP)
    const nextLevelConfig = DEFAULT_LEVEL_CONFIG.find(config => config.level === currentLevel + 1)
    
    if (!nextLevelConfig) return 100 // Max level

    const currentLevelConfig = DEFAULT_LEVEL_CONFIG.find(config => config.level === currentLevel)
    if (!currentLevelConfig) return 0

    const xpInCurrentLevel = totalXP - currentLevelConfig.xpTotal
    const xpNeededForNext = nextLevelConfig.xpRequired

    return Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNext) * 100))
  }

  // Calculate streak value
  private static async calculateStreakValue(
    userId: string,
    definition: AchievementDefinition,
    activity: UserActivity
  ): Promise<number> {
    const activitiesCollection = await this.getUserActivitiesCollection()
    const userObjectId = new ObjectId(userId)

    // For daily streak, check if user has activity in consecutive days
    if (definition.requirements.activityType === 'daily_login') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      let streakDays = 1
      let checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - 1)

      while (streakDays <= 365) { // Max reasonable streak
        const dayStart = new Date(checkDate)
        const dayEnd = new Date(checkDate)
        dayEnd.setDate(dayEnd.getDate() + 1)

        const dayActivity = await activitiesCollection.findOne({
          userId: userObjectId,
          activityType: 'daily_login',
          timestamp: { $gte: dayStart, $lt: dayEnd }
        })

        if (!dayActivity) break

        streakDays++
        checkDate.setDate(checkDate.getDate() - 1)
      }

      return streakDays
    }

    return activity.value
  }

  // User Stats Management
  static async getUserStats(userId: string): Promise<UserStats> {
    const collection = await this.getUserStatsCollection()
    const userObjectId = new ObjectId(userId)

    let stats = await collection.findOne({ userId: userObjectId })
    
    if (!stats) {
      // Create initial stats
      stats = {
        userId: userObjectId,
        totalXP: 0,
        totalReputation: 0,
        level: 1,
        levelProgress: 0,
        achievementsUnlocked: 0,
        achievementsByCategory: {
          security_scanner: 0,
          threat_hunter: 0,
          community_guardian: 0,
          token_burner: 0,
          referral_master: 0,
          streak: 0,
          veteran: 0,
          rare: 0,
          special: 0
        },
        achievementsByTier: {
          bronze: 0,
          silver: 0,
          gold: 0,
          diamond: 0
        },
        stats: {
          totalScans: 0,
          threatsDetected: 0,
          tokensBurned: 0,
          referralsMade: 0,
          communityContributions: 0,
          currentStreakDays: 0,
          longestStreakDays: 0,
          accountAgeDays: 0
        },
        recentAchievements: [],
        updatedAt: new Date()
      }

      await collection.insertOne(stats)
    }

    return stats
  }

  // Update user stats based on activity
  private static async updateUserStats(userId: string, activity: UserActivity): Promise<void> {
    const collection = await this.getUserStatsCollection()
    const userObjectId = new ObjectId(userId)

    const updateData: Record<string, any> = {
      updatedAt: new Date()
    }

    // Update specific stats based on activity type
    switch (activity.activityType) {
      case 'scan_completed':
        updateData['$inc'] = { 'stats.totalScans': activity.value }
        break
      case 'threat_detected':
        updateData['$inc'] = { 'stats.threatsDetected': activity.value }
        break
      case 'tokens_burned':
        updateData['$inc'] = { 'stats.tokensBurned': activity.value }
        break
      case 'referral_completed':
        updateData['$inc'] = { 'stats.referralsMade': activity.value }
        break
      case 'community_vote':
      case 'feedback_submitted':
        updateData['$inc'] = { 'stats.communityContributions': activity.value }
        break
    }

    if (updateData['$inc']) {
      await collection.updateOne(
        { userId: userObjectId },
        updateData,
        { upsert: true }
      )
    }
  }

  // Get user achievements
  static async getUserAchievements(
    userId: string,
    filters: {
      category?: AchievementCategory
      tier?: AchievementTier
      isCompleted?: boolean
    } = {}
  ): Promise<UserAchievement[]> {
    const collection = await this.getUserAchievementsCollection()
    const query = { userId: new ObjectId(userId), ...filters }
    
    return await collection.find(query).sort({ completedAt: -1 }).toArray()
  }

  // Get single user achievement
  static async getUserAchievement(userId: string, achievementKey: string): Promise<UserAchievement | null> {
    const collection = await this.getUserAchievementsCollection()
    return await collection.findOne({
      userId: new ObjectId(userId),
      achievementKey
    })
  }

  // Get achievement progress
  static async getAchievementProgress(userId: string): Promise<AchievementProgress[]> {
    const collection = await this.getProgressCollection()
    return await collection.find({ userId: new ObjectId(userId) }).toArray()
  }

  // Leaderboard Management
  static async getLeaderboard(
    type: 'xp' | 'reputation' | 'achievements' | 'activity',
    category?: AchievementCategory,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    const statsCollection = await this.getUserStatsCollection()

    let sortField: string
    switch (type) {
      case 'xp':
        sortField = 'totalXP'
        break
      case 'reputation':
        sortField = 'totalReputation'
        break
      case 'achievements':
        sortField = 'achievementsUnlocked'
        break
      default:
        sortField = 'totalXP'
    }

    const pipeline: any[] = [
      { $sort: { [sortField]: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $addFields: {
          rank: { $add: [{ $indexOfArray: ['$$ROOT', '$$ROOT'] }, 1] }
        }
      }
    ]

    const results = await statsCollection.aggregate(pipeline).toArray()

    return results.map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      username: result.user[0]?.profile?.username,
      walletAddress: result.user[0]?.walletAddress,
      score: result[sortField],
      achievements: result.achievementsUnlocked,
      updatedAt: result.updatedAt
    }))
  }

  // Challenge Management
  static async createChallenge(challenge: Omit<Challenge, '_id' | 'createdAt' | 'participantCount' | 'completionCount'>): Promise<Challenge> {
    const collection = await this.getChallengesCollection()
    
    const newChallenge: Challenge = {
      ...challenge,
      participantCount: 0,
      completionCount: 0,
      createdAt: new Date()
    }

    const result = await collection.insertOne(newChallenge)
    return { ...newChallenge, _id: result.insertedId }
  }

  static async getActiveChallenges(): Promise<Challenge[]> {
    const collection = await this.getChallengesCollection()
    const now = new Date()
    
    return await collection.find({
      isActive: true,
      'duration.startDate': { $lte: now },
      'duration.endDate': { $gte: now }
    }).toArray()
  }

  // Notification methods
  private static async sendAchievementNotification(
    userId: string,
    definition: AchievementDefinition
  ): Promise<void> {
    try {
      await NotificationService.sendNotification(
        userId,
        'account-activity',
        {
          title: 'Achievement Unlocked!',
          message: `Congratulations! You've earned the "${definition.name}" achievement.`,
          achievementName: definition.name,
          achievementDescription: definition.description,
          xpEarned: definition.rewards.xp,
          reputationEarned: definition.rewards.reputation,
          tier: definition.tier,
          category: definition.category
        },
        {
          priority: 'medium',
          channels: ['in-app']
        }
      )
    } catch (error) {
      console.error('Failed to send achievement notification:', error)
    }
  }

  private static async sendLevelUpNotification(
    userId: string,
    oldLevel: number,
    newLevel: number,
    xpEarned: number
  ): Promise<void> {
    try {
      const levelConfig = DEFAULT_LEVEL_CONFIG.find(config => config.level === newLevel)
      
      await NotificationService.sendNotification(
        userId,
        'account-activity',
        {
          title: 'Level Up!',
          message: `Congratulations! You've reached level ${newLevel}${levelConfig?.title ? ` - ${levelConfig.title}` : ''}!`,
          oldLevel,
          newLevel,
          xpEarned,
          title: levelConfig?.title
        },
        {
          priority: 'high',
          channels: ['in-app']
        }
      )
    } catch (error) {
      console.error('Failed to send level up notification:', error)
    }
  }

  // Analytics and Statistics
  static async getGlobalStats(): Promise<GlobalAchievementStats> {
    const [achievementsCollection, statsCollection] = await Promise.all([
      this.getUserAchievementsCollection(),
      this.getUserStatsCollection()
    ])

    const totalEarned = await achievementsCollection.countDocuments({ isCompleted: true })
    const totalXP = await statsCollection.aggregate([
      { $group: { _id: null, total: { $sum: '$totalXP' } } }
    ]).toArray()

    const avgLevel = await statsCollection.aggregate([
      { $group: { _id: null, avg: { $avg: '$level' } } }
    ]).toArray()

    return {
      totalAchievementsEarned: totalEarned,
      mostEarnedAchievements: [],
      rareAchievements: [],
      averageUserLevel: avgLevel[0]?.avg || 1,
      totalXPAwarded: totalXP[0]?.total || 0,
      achievementsByCategory: {
        security_scanner: 0,
        threat_hunter: 0,
        community_guardian: 0,
        token_burner: 0,
        referral_master: 0,
        streak: 0,
        veteran: 0,
        rare: 0,
        special: 0
      },
      achievementsByTier: {
        bronze: 0,
        silver: 0,
        gold: 0,
        diamond: 0
      },
      updatedAt: new Date()
    }
  }

  // Initialize default achievements
  static async initializeDefaultAchievements(): Promise<void> {
    const definitions = await this.getAchievementDefinitions()
    
    if (definitions.length > 0) {
      console.log('Achievement definitions already exist, skipping initialization')
      return
    }

    console.log('Initializing default achievement definitions...')

    const defaultDefinitions: Array<Omit<AchievementDefinition, '_id' | 'createdAt' | 'updatedAt'>> = [
      // Security Scanner Achievements
      {
        key: 'security_scanner_bronze_10',
        name: 'Security Rookie',
        description: 'Complete your first 10 security scans',
        category: 'security_scanner',
        tier: 'bronze',
        type: 'cumulative',
        rarity: 'common',
        requirements: {
          activityType: 'scan_completed',
          threshold: 10
        },
        rewards: {
          xp: 50,
          reputation: 10,
          badge: 'scanner_bronze'
        },
        metadata: {
          icon: 'shield-check',
          color: '#CD7F32',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1
        },
        isActive: true
      },
      {
        key: 'security_scanner_silver_100',
        name: 'Security Guardian',
        description: 'Complete 100 security scans',
        category: 'security_scanner',
        tier: 'silver',
        type: 'cumulative',
        rarity: 'uncommon',
        requirements: {
          activityType: 'scan_completed',
          threshold: 100
        },
        rewards: {
          xp: 200,
          reputation: 50,
          badge: 'scanner_silver'
        },
        metadata: {
          icon: 'shield-check',
          color: '#C0C0C0',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1,
          prerequisites: ['security_scanner_bronze_10']
        },
        isActive: true
      },
      {
        key: 'security_scanner_gold_500',
        name: 'Security Expert',
        description: 'Complete 500 security scans',
        category: 'security_scanner',
        tier: 'gold',
        type: 'cumulative',
        rarity: 'rare',
        requirements: {
          activityType: 'scan_completed',
          threshold: 500
        },
        rewards: {
          xp: 500,
          reputation: 150,
          badge: 'scanner_gold',
          title: 'Security Expert'
        },
        metadata: {
          icon: 'shield-check',
          color: '#FFD700',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1,
          prerequisites: ['security_scanner_silver_100']
        },
        isActive: true
      },
      {
        key: 'security_scanner_diamond_1000',
        name: 'Security Master',
        description: 'Complete 1000 security scans',
        category: 'security_scanner',
        tier: 'diamond',
        type: 'cumulative',
        rarity: 'legendary',
        requirements: {
          activityType: 'scan_completed',
          threshold: 1000
        },
        rewards: {
          xp: 1000,
          reputation: 300,
          badge: 'scanner_diamond',
          title: 'Security Master'
        },
        metadata: {
          icon: 'shield-check',
          color: '#B9F2FF',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1,
          prerequisites: ['security_scanner_gold_500']
        },
        isActive: true
      },

      // Threat Hunter Achievements
      {
        key: 'threat_hunter_bronze_5',
        name: 'Threat Spotter',
        description: 'Detect your first 5 security threats',
        category: 'threat_hunter',
        tier: 'bronze',
        type: 'cumulative',
        rarity: 'common',
        requirements: {
          activityType: 'threat_detected',
          threshold: 5
        },
        rewards: {
          xp: 75,
          reputation: 15,
          badge: 'hunter_bronze'
        },
        metadata: {
          icon: 'bug',
          color: '#CD7F32',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1
        },
        isActive: true
      },
      {
        key: 'threat_hunter_silver_25',
        name: 'Threat Tracker',
        description: 'Detect 25 security threats',
        category: 'threat_hunter',
        tier: 'silver',
        type: 'cumulative',
        rarity: 'uncommon',
        requirements: {
          activityType: 'threat_detected',
          threshold: 25
        },
        rewards: {
          xp: 250,
          reputation: 75,
          badge: 'hunter_silver'
        },
        metadata: {
          icon: 'bug',
          color: '#C0C0C0',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1,
          prerequisites: ['threat_hunter_bronze_5']
        },
        isActive: true
      },
      {
        key: 'threat_hunter_gold_100',
        name: 'Threat Eliminator',
        description: 'Detect 100 security threats',
        category: 'threat_hunter',
        tier: 'gold',
        type: 'cumulative',
        rarity: 'rare',
        requirements: {
          activityType: 'threat_detected',
          threshold: 100
        },
        rewards: {
          xp: 600,
          reputation: 200,
          badge: 'hunter_gold',
          title: 'Threat Hunter'
        },
        metadata: {
          icon: 'bug',
          color: '#FFD700',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1,
          prerequisites: ['threat_hunter_silver_25']
        },
        isActive: true
      },

      // Token Burner Achievements
      {
        key: 'token_burner_bronze_100',
        name: 'Fire Starter',
        description: 'Burn your first 100 LYN tokens',
        category: 'token_burner',
        tier: 'bronze',
        type: 'cumulative',
        rarity: 'common',
        requirements: {
          activityType: 'tokens_burned',
          threshold: 100
        },
        rewards: {
          xp: 100,
          reputation: 25,
          badge: 'burner_bronze'
        },
        metadata: {
          icon: 'fire',
          color: '#CD7F32',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1
        },
        isActive: true
      },
      {
        key: 'token_burner_silver_1000',
        name: 'Flame Keeper',
        description: 'Burn 1,000 LYN tokens',
        category: 'token_burner',
        tier: 'silver',
        type: 'cumulative',
        rarity: 'uncommon',
        requirements: {
          activityType: 'tokens_burned',
          threshold: 1000
        },
        rewards: {
          xp: 300,
          reputation: 100,
          badge: 'burner_silver'
        },
        metadata: {
          icon: 'fire',
          color: '#C0C0C0',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1,
          prerequisites: ['token_burner_bronze_100']
        },
        isActive: true
      },

      // Referral Achievements
      {
        key: 'referral_master_bronze_5',
        name: 'Inviter',
        description: 'Successfully refer 5 new users',
        category: 'referral_master',
        tier: 'bronze',
        type: 'cumulative',
        rarity: 'common',
        requirements: {
          activityType: 'referral_completed',
          threshold: 5
        },
        rewards: {
          xp: 100,
          reputation: 50,
          badge: 'referral_bronze'
        },
        metadata: {
          icon: 'user-plus',
          color: '#CD7F32',
          isSecret: false,
          isRetired: false,
          maxEarnings: 1
        },
        isActive: true
      },

      // Streak Achievements
      {
        key: 'streak_bronze_7',
        name: 'Consistent',
        description: 'Maintain a 7-day activity streak',
        category: 'streak',
        tier: 'bronze',
        type: 'streak',
        rarity: 'common',
        requirements: {
          activityType: 'daily_login',
          threshold: 7,
          timeframe: 7
        },
        rewards: {
          xp: 150,
          reputation: 30,
          badge: 'streak_bronze'
        },
        metadata: {
          icon: 'calendar',
          color: '#CD7F32',
          isSecret: false,
          isRetired: false,
          maxEarnings: -1
        },
        isActive: true
      },
      {
        key: 'streak_silver_30',
        name: 'Dedicated',
        description: 'Maintain a 30-day activity streak',
        category: 'streak',
        tier: 'silver',
        type: 'streak',
        rarity: 'uncommon',
        requirements: {
          activityType: 'daily_login',
          threshold: 30,
          timeframe: 30
        },
        rewards: {
          xp: 500,
          reputation: 100,
          badge: 'streak_silver'
        },
        metadata: {
          icon: 'calendar',
          color: '#C0C0C0',
          isSecret: false,
          isRetired: false,
          maxEarnings: -1
        },
        isActive: true
      }
    ]

    // Insert all default definitions
    for (const definition of defaultDefinitions) {
      await this.createAchievementDefinition(definition)
    }

    console.log(`Initialized ${defaultDefinitions.length} default achievement definitions`)
  }
}

export default AchievementService