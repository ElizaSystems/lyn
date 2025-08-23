import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'

export interface ReputationEvent {
  action: string
  points: number
  description: string
  timestamp: Date
}

export interface UserReputation {
  walletAddress: string
  totalPoints: number
  level: number
  events: ReputationEvent[]
  achievements: string[]
  stats: {
    scansCompleted: number
    threatsDetected: number
    referralsSuccessful: number
    usernameRegistered: boolean
    xAccountConnected: boolean
  }
  createdAt: Date
  updatedAt: Date
}

export class ReputationService {
  // Point values for different actions
  static readonly POINTS = {
    USERNAME_REGISTRATION: 25,
    FIRST_SCAN: 10,
    SCAN_COMPLETED: 5,
    THREAT_DETECTED: 15,
    X_ACCOUNT_CONNECTED: 20,
    REFERRAL_SUCCESSFUL: 50,
    DAILY_SCAN_STREAK: 10,
    WEEKLY_SCAN_STREAK: 25,
    MONTHLY_SCAN_STREAK: 100,
  }

  /**
   * Initialize or get user reputation
   */
  static async getOrCreateReputation(walletAddress: string): Promise<UserReputation> {
    const db = await getDatabase()
    const collection = db.collection<UserReputation>('user_reputation')
    
    let reputation = await collection.findOne({ walletAddress })
    
    if (!reputation) {
      reputation = {
        walletAddress,
        totalPoints: 0,
        level: 0,
        events: [],
        achievements: [],
        stats: {
          scansCompleted: 0,
          threatsDetected: 0,
          referralsSuccessful: 0,
          usernameRegistered: false,
          xAccountConnected: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await collection.insertOne(reputation)
    }
    
    return reputation
  }

  /**
   * Award points for an action
   */
  static async awardPoints(
    walletAddress: string,
    action: string,
    points: number,
    description?: string
  ): Promise<void> {
    const db = await getDatabase()
    const collection = db.collection<UserReputation>('user_reputation')
    
    const event: ReputationEvent = {
      action,
      points,
      description: description || action,
      timestamp: new Date()
    }
    
    // Update or create reputation
    await collection.updateOne(
      { walletAddress },
      {
        $inc: { totalPoints: points },
        $push: { events: event },
        $set: { 
          updatedAt: new Date(),
          level: 0 // Will be calculated based on totalPoints
        }
      },
      { upsert: true }
    )
    
    // Update level based on total points
    const reputation = await collection.findOne({ walletAddress })
    if (reputation) {
      const level = this.calculateLevel(reputation.totalPoints)
      await collection.updateOne(
        { walletAddress },
        { $set: { level } }
      )
    }
  }

  /**
   * Check and award username registration points
   */
  static async checkUsernameRegistration(walletAddress: string): Promise<boolean> {
    const db = await getDatabase()
    const usersCollection = db.collection('users')
    const reputationCollection = db.collection<UserReputation>('user_reputation')
    
    // Check if user has registered username
    const user = await usersCollection.findOne({ 
      walletAddress,
      username: { $exists: true, $ne: null }
    })
    
    if (!user || !user.username) {
      return false
    }
    
    // Check if already awarded
    const reputation = await this.getOrCreateReputation(walletAddress)
    if (reputation.stats.usernameRegistered) {
      return true // Already awarded
    }
    
    // Award points
    await this.awardPoints(
      walletAddress,
      'USERNAME_REGISTRATION',
      this.POINTS.USERNAME_REGISTRATION,
      'Registered username on LYN'
    )
    
    // Update stats
    await reputationCollection.updateOne(
      { walletAddress },
      { $set: { 'stats.usernameRegistered': true } }
    )
    
    console.log(`[Reputation] Awarded ${this.POINTS.USERNAME_REGISTRATION} points to ${walletAddress} for username registration`)
    return true
  }

  /**
   * Award points for completing a scan
   */
  static async awardScanPoints(
    walletAddress: string,
    scanType: string,
    threatDetected: boolean
  ): Promise<void> {
    const db = await getDatabase()
    const reputationCollection = db.collection<UserReputation>('user_reputation')
    
    const reputation = await this.getOrCreateReputation(walletAddress)
    
    // Check if this is the first scan
    if (reputation.stats.scansCompleted === 0) {
      await this.awardPoints(
        walletAddress,
        'FIRST_SCAN',
        this.POINTS.FIRST_SCAN,
        'Completed first security scan'
      )
    }
    
    // Award regular scan points
    await this.awardPoints(
      walletAddress,
      'SCAN_COMPLETED',
      this.POINTS.SCAN_COMPLETED,
      `Completed ${scanType} scan`
    )
    
    // Award bonus for threat detection
    if (threatDetected) {
      await this.awardPoints(
        walletAddress,
        'THREAT_DETECTED',
        this.POINTS.THREAT_DETECTED,
        'Detected security threat'
      )
      
      await reputationCollection.updateOne(
        { walletAddress },
        { $inc: { 'stats.threatsDetected': 1 } }
      )
    }
    
    // Update scan count
    await reputationCollection.updateOne(
      { walletAddress },
      { $inc: { 'stats.scansCompleted': 1 } }
    )
    
    console.log(`[Reputation] Awarded scan points to ${walletAddress}: ${threatDetected ? 'with threat' : 'safe'}`)
  }

  /**
   * Check and award X account connection points
   */
  static async checkXAccountConnection(walletAddress: string): Promise<boolean> {
    const db = await getDatabase()
    const reputationCollection = db.collection<UserReputation>('user_reputation')
    const xAccountsCollection = db.collection('x_accounts')
    
    // Check if user has connected X account
    const xAccount = await xAccountsCollection.findOne({ walletAddress })
    
    if (!xAccount) {
      return false
    }
    
    // Check if already awarded
    const reputation = await this.getOrCreateReputation(walletAddress)
    if (reputation.stats.xAccountConnected) {
      return true // Already awarded
    }
    
    // Award points
    await this.awardPoints(
      walletAddress,
      'X_ACCOUNT_CONNECTED',
      this.POINTS.X_ACCOUNT_CONNECTED,
      'Connected X (Twitter) account'
    )
    
    // Update stats
    await reputationCollection.updateOne(
      { walletAddress },
      { $set: { 'stats.xAccountConnected': true } }
    )
    
    console.log(`[Reputation] Awarded ${this.POINTS.X_ACCOUNT_CONNECTED} points to ${walletAddress} for X account connection`)
    return true
  }

  /**
   * Calculate user level based on total points
   */
  static calculateLevel(totalPoints: number): number {
    // Level thresholds
    const thresholds = [
      0,     // Level 0
      50,    // Level 1
      150,   // Level 2
      300,   // Level 3
      500,   // Level 4
      750,   // Level 5
      1100,  // Level 6
      1500,  // Level 7
      2000,  // Level 8
      2600,  // Level 9
      3300,  // Level 10
    ]
    
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (totalPoints >= thresholds[i]) {
        return i
      }
    }
    
    return 0
  }

  /**
   * Get user reputation summary
   */
  static async getReputationSummary(walletAddress: string) {
    const reputation = await this.getOrCreateReputation(walletAddress)
    
    // Check for any missing achievements
    await this.checkUsernameRegistration(walletAddress)
    await this.checkXAccountConnection(walletAddress)
    
    // Refresh reputation after checks
    const updated = await this.getOrCreateReputation(walletAddress)
    
    return {
      totalPoints: updated.totalPoints,
      level: updated.level,
      nextLevelPoints: this.getPointsToNextLevel(updated.totalPoints),
      stats: updated.stats,
      recentEvents: updated.events.slice(-10).reverse(), // Last 10 events
      achievements: updated.achievements
    }
  }

  /**
   * Get points needed for next level
   */
  static getPointsToNextLevel(currentPoints: number): number {
    const thresholds = [50, 150, 300, 500, 750, 1100, 1500, 2000, 2600, 3300]
    
    for (const threshold of thresholds) {
      if (currentPoints < threshold) {
        return threshold - currentPoints
      }
    }
    
    return 0 // Max level
  }
}