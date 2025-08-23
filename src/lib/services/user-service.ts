import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { User, UserTask, UserWallet, UserSession } from '@/lib/models/user'
import { AchievementService } from './achievement-service'
import { ActivityTracker } from './activity-tracker'
import { EnhancedBadgeService } from './enhanced-badge-service'
import { ReputationDecayService } from './reputation-decay-service'
import jwt from 'jsonwebtoken'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret'

export class UserService {
  private static async getUsersCollection() {
    const db = await getDatabase()
    return db.collection<User>('users')
  }

  private static async getTasksCollection() {
    const db = await getDatabase()
    return db.collection<UserTask>('tasks')
  }

  private static async getWalletsCollection() {
    const db = await getDatabase()
    return db.collection<UserWallet>('wallets')
  }

  private static async getSessionsCollection() {
    const db = await getDatabase()
    return db.collection<UserSession>('sessions')
  }

  // User Authentication Methods
  static async authenticateWithWallet(walletAddress: string, signature: string, nonce: string): Promise<{ user: User; token: string } | null> {
    try {
      // Verify the signature
      const message = `Sign this message to authenticate: ${nonce}`
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = bs58.decode(signature)
      const publicKeyBytes = new PublicKey(walletAddress).toBytes()

      const isValidSignature = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      )

      if (!isValidSignature) {
        return null
      }

      const users = await this.getUsersCollection()
      
      // Find or create user
      let user = await users.findOne({ walletAddress })
      
      if (!user) {
        user = await this.createUser(walletAddress) as User & { _id: ObjectId }
      }

      // Create session
      const sessions = await this.getSessionsCollection()
      const session: UserSession = {
        userId: user._id!,
        walletAddress,
        signature,
        nonce,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date()
      }
      
      await sessions.insertOne(session)

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, walletAddress },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return { user, token }
    } catch (error) {
      console.error('Authentication error:', error)
      return null
    }
  }

  static async createUser(walletAddress: string): Promise<User> {
    const users = await this.getUsersCollection()
    
    const user: User = {
      walletAddress,
      publicKey: walletAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'system',
        notifications: true,
        autoRefresh: true
      }
    }

    const result = await users.insertOne(user)
    return { ...user, _id: result.insertedId }
  }

  static async getUserById(userId: string): Promise<User | null> {
    const users = await this.getUsersCollection()
    return await users.findOne({ _id: new ObjectId(userId) })
  }

  static async getUserByWallet(walletAddress: string): Promise<User | null> {
    const users = await this.getUsersCollection()
    return await users.findOne({ walletAddress })
  }

  static async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const users = await this.getUsersCollection()
    
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    return result || null
  }

  // Task Management Methods
  static async getUserTasks(userId: string): Promise<UserTask[]> {
    const tasks = await this.getTasksCollection()
    return await tasks.find({ userId: new ObjectId(userId) }).toArray()
  }

  static async createTask(userId: string, taskData: Omit<UserTask, '_id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<UserTask> {
    const tasks = await this.getTasksCollection()
    
    const task: UserTask = {
      ...taskData,
      userId: new ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await tasks.insertOne(task)
    return { ...task, _id: result.insertedId }
  }

  static async updateTask(userId: string, taskId: string, updates: Partial<UserTask>): Promise<UserTask | null> {
    const tasks = await this.getTasksCollection()
    
    const result = await tasks.findOneAndUpdate(
      { _id: new ObjectId(taskId), userId: new ObjectId(userId) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    return result || null
  }

  static async deleteTask(userId: string, taskId: string): Promise<boolean> {
    const tasks = await this.getTasksCollection()
    
    const result = await tasks.deleteOne({
      _id: new ObjectId(taskId),
      userId: new ObjectId(userId)
    })

    return result.deletedCount > 0
  }

  // Wallet Management Methods
  static async getUserWallets(userId: string): Promise<UserWallet[]> {
    const wallets = await this.getWalletsCollection()
    return await wallets.find({ userId: new ObjectId(userId) }).toArray()
  }

  static async addWallet(userId: string, address: string, name?: string): Promise<UserWallet> {
    const wallets = await this.getWalletsCollection()
    
    // Check if this is the first wallet (make it default)
    const existingWallets = await this.getUserWallets(userId)
    const isDefault = existingWallets.length === 0

    const wallet: UserWallet = {
      userId: new ObjectId(userId),
      address,
      name,
      isDefault,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await wallets.insertOne(wallet)
    return { ...wallet, _id: result.insertedId }
  }

  // Session Management
  static async validateToken(token: string): Promise<{ userId: string; walletAddress: string } | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; walletAddress: string }
      
      // Check if session exists and is valid
      const sessions = await this.getSessionsCollection()
      const session = await sessions.findOne({
        userId: new ObjectId(decoded.userId),
        expiresAt: { $gt: new Date() }
      })

      if (!session) {
        return null
      }

      return {
        userId: decoded.userId,
        walletAddress: decoded.walletAddress
      }
    } catch {
      return null
    }
  }

  static async logout(userId: string): Promise<void> {
    const sessions = await this.getSessionsCollection()
    await sessions.deleteMany({ userId: new ObjectId(userId) })
  }

  // Achievement Integration Methods
  static async updateUserWithAchievementData(userId: string): Promise<User | null> {
    try {
      const users = await this.getUsersCollection()
      const userStats = await AchievementService.getUserStats(userId)
      const userAchievements = await AchievementService.getUserAchievements(userId, { isCompleted: true })

      // Extract earned badges and titles
      const badges = userAchievements
        .map(achievement => achievement.metadata?.badge)
        .filter(Boolean) as string[]
      
      const titles = userAchievements
        .map(achievement => achievement.metadata?.title)
        .filter(Boolean) as string[]

      const achievementData = {
        totalXP: userStats.totalXP,
        totalReputation: userStats.totalReputation,
        level: userStats.level,
        achievementsUnlocked: userStats.achievementsUnlocked,
        badges,
        titles,
        currentTitle: titles.length > 0 ? titles[titles.length - 1] : undefined
      }

      const result = await users.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            achievements: achievementData,
            'profile.level': userStats.level,
            'profile.reputation': userStats.totalReputation,
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      )

      return result || null
    } catch (error) {
      console.error('Error updating user with achievement data:', error)
      return null
    }
  }

  static async getUserWithAchievements(userId: string): Promise<User & {
    achievementStats?: any
    recentAchievements?: any[]
    leaderboardRanks?: any
  } | null> {
    try {
      const user = await this.getUserById(userId)
      if (!user) return null

      // Get achievement data
      const [userStats, recentAchievements] = await Promise.all([
        AchievementService.getUserStats(userId),
        AchievementService.getUserAchievements(userId, { isCompleted: true })
      ])

      // Update user profile with latest achievement data
      await this.updateUserWithAchievementData(userId)

      return {
        ...user,
        achievementStats: userStats,
        recentAchievements: recentAchievements.slice(0, 5) // Last 5 achievements
      }
    } catch (error) {
      console.error('Error getting user with achievements:', error)
      return null
    }
  }

  static async updateUserProfile(
    userId: string, 
    updates: {
      username?: string
      avatar?: string
      bio?: string
      currentTitle?: string
    }
  ): Promise<User | null> {
    try {
      const users = await this.getUsersCollection()
      
      // Track profile update activity
      if (updates.username) {
        await ActivityTracker.trackProfileUpdate(userId, 'username', { newUsername: updates.username })
      }
      if (updates.avatar) {
        await ActivityTracker.trackProfileUpdate(userId, 'avatar')
      }
      if (updates.bio) {
        await ActivityTracker.trackProfileUpdate(userId, 'bio')
      }

      // Validate title if provided (user can only use titles they've earned)
      if (updates.currentTitle) {
        const userAchievements = await AchievementService.getUserAchievements(userId, { isCompleted: true })
        const earnedTitles = userAchievements
          .map(achievement => achievement.metadata?.title)
          .filter(Boolean) as string[]
        
        if (!earnedTitles.includes(updates.currentTitle)) {
          throw new Error('User has not earned the specified title')
        }
      }

      const profileUpdates: any = {}
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'currentTitle') {
            profileUpdates['achievements.currentTitle'] = value
          } else {
            profileUpdates[`profile.${key}`] = value
          }
        }
      })

      const result = await users.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            ...profileUpdates,
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      )

      return result || null
    } catch (error) {
      console.error('Error updating user profile:', error)
      throw error
    }
  }

  // Enhanced authentication with activity tracking
  static async authenticateWithWalletTracked(walletAddress: string, signature: string, nonce: string): Promise<{ user: User; token: string } | null> {
    const result = await this.authenticateWithWallet(walletAddress, signature, nonce)
    
    if (result?.user?._id) {
      const userId = result.user._id.toString()
      
      // Track daily login activity using enhanced system
      await AchievementService.trackActivityEnhanced(userId, 'daily_login', 1)
      
      // Update reputation decay tracking
      await ReputationDecayService.updateLastActivity(userId)
      
      // Initialize decay tracking if not exists
      await ReputationDecayService.initializeDecayTracking(userId)
      
      // Update user with latest achievement data
      await this.updateUserWithAchievementData(userId)
    }
    
    return result
  }

  // Get user with comprehensive achievement and badge data
  static async getUserWithComprehensiveData(userId: string): Promise<User & {
    achievementStats?: any
    recentAchievements?: any[]
    earnedBadges?: any[]
    badgeProgress?: any[]
    nextBadges?: any[]
    reputationTier?: any
    decayStatus?: any
    leaderboardRanks?: any
  } | null> {
    try {
      const user = await this.getUserById(userId)
      if (!user) return null

      // Get comprehensive achievement and badge data
      const [completeSummary, decayStatus] = await Promise.all([
        AchievementService.getUserCompleteSummary(userId),
        ReputationDecayService.getUserDecayStatus(userId)
      ])

      // Update user profile with latest achievement data
      await this.updateUserWithAchievementData(userId)

      return {
        ...user,
        achievementStats: completeSummary.stats,
        recentAchievements: completeSummary.achievements.slice(0, 5),
        earnedBadges: completeSummary.earnedBadges,
        badgeProgress: completeSummary.badgeProgress,
        nextBadges: completeSummary.nextBadges,
        reputationTier: completeSummary.reputationTier,
        decayStatus
      }
    } catch (error) {
      console.error('Error getting user with comprehensive data:', error)
      return null
    }
  }

  // Create user with enhanced system initialization
  static async createUserEnhanced(walletAddress: string): Promise<User> {
    const user = await this.createUser(walletAddress)
    
    if (user._id) {
      const userId = user._id.toString()
      
      // Initialize reputation decay tracking
      await ReputationDecayService.initializeDecayTracking(userId)
      
      // Initialize user stats with new reputation system (starting at 0)
      await AchievementService.getUserStats(userId) // This creates initial stats with 0 reputation
      
      console.log(`Enhanced user created: ${walletAddress} with ID ${userId}`)
    }
    
    return user
  }

  // Track user activity with comprehensive system
  static async trackUserActivity(
    userId: string, 
    activityType: string, 
    value: number = 1, 
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Update last activity for decay tracking
      await ReputationDecayService.updateLastActivity(userId)
      
      // Track activity in enhanced system
      await AchievementService.trackActivityEnhanced(userId, activityType as any, value, metadata)
      
      // Update user profile with latest data
      await this.updateUserWithAchievementData(userId)
      
    } catch (error) {
      console.error('Error tracking user activity:', error)
    }
  }

  // Get user's reputation tier benefits
  static async getUserReputationBenefits(userId: string): Promise<{
    tier: any
    multiplier: number
    benefits: string[]
    nextTier?: any
    progressToNext?: number
  } | null> {
    try {
      const userStats = await AchievementService.getUserStats(userId)
      const currentTier = EnhancedBadgeService.getReputationTierInfo(userStats.totalReputation)
      
      if (!currentTier) return null
      
      // Find next tier
      const allTiers = [
        { tier: 'novice', minReputation: 0, maxReputation: 99, title: 'Novice' },
        { tier: 'contributor', minReputation: 100, maxReputation: 299, title: 'Contributor' },
        { tier: 'guardian', minReputation: 300, maxReputation: 599, title: 'Guardian' },
        { tier: 'expert', minReputation: 600, maxReputation: 999, title: 'Expert' },
        { tier: 'elite', minReputation: 1000, maxReputation: 1499, title: 'Elite' },
        { tier: 'legend', minReputation: 1500, maxReputation: Infinity, title: 'Legend' }
      ]
      
      const currentTierIndex = allTiers.findIndex(t => t.tier === currentTier.tier)
      const nextTier = currentTierIndex < allTiers.length - 1 ? allTiers[currentTierIndex + 1] : null
      
      let progressToNext = 0
      if (nextTier) {
        const reputationInCurrentTier = userStats.totalReputation - currentTier.minReputation
        const reputationNeededForNext = nextTier.minReputation - currentTier.minReputation
        progressToNext = Math.min(100, (reputationInCurrentTier / reputationNeededForNext) * 100)
      }
      
      return {
        tier: currentTier,
        multiplier: EnhancedBadgeService.getReputationMultiplier(userStats.totalReputation),
        benefits: currentTier.benefits,
        nextTier,
        progressToNext
      }
    } catch (error) {
      console.error('Error getting user reputation benefits:', error)
      return null
    }
  }

  // Admin function to manually adjust user reputation
  static async adjustUserReputation(
    userId: string, 
    reputationChange: number, 
    reason: string,
    adminId: string
  ): Promise<{ success: boolean; newReputation: number; error?: string }> {
    try {
      const userStats = await AchievementService.getUserStats(userId)
      const newReputation = Math.max(0, userStats.totalReputation + reputationChange)
      
      // Update reputation directly
      const statsCollection = await getDatabase().then(db => db.collection('user_stats'))
      await statsCollection.updateOne(
        { userId: new ObjectId(userId) },
        {
          $set: {
            totalReputation: newReputation,
            updatedAt: new Date()
          }
        }
      )
      
      // Log the adjustment
      const auditCollection = await getDatabase().then(db => db.collection('audit_logs'))
      await auditCollection.insertOne({
        userId: new ObjectId(adminId),
        action: 'reputation_adjustment',
        resource: `user:${userId}`,
        details: {
          targetUserId: userId,
          reputationChange,
          oldReputation: userStats.totalReputation,
          newReputation,
          reason
        },
        timestamp: new Date()
      })
      
      console.log(`Reputation adjusted for user ${userId}: ${userStats.totalReputation} -> ${newReputation} (${reputationChange > 0 ? '+' : ''}${reputationChange}) by admin ${adminId}`)
      
      return { success: true, newReputation }
    } catch (error) {
      console.error('Error adjusting user reputation:', error)
      return { success: false, newReputation: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}