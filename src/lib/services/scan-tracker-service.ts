import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export interface ScanStreak {
  userId: string
  walletAddress: string
  currentStreak: number
  longestStreak: number
  lastScanDate: Date
  totalScans: number
  dailyScans: Map<string, number> // date string -> scan count
  streakStartDate: Date
  badges: string[]
  achievements: {
    firstScan?: Date
    tenthScan?: Date
    hundredthScan?: Date
    thousandthScan?: Date
    weekStreak?: Date
    monthStreak?: Date
    yearStreak?: Date
  }
  createdAt: Date
  updatedAt: Date
}

export interface DailyScanRecord {
  userId: string
  walletAddress: string
  date: string // YYYY-MM-DD format
  scanCount: number
  scanTypes: string[]
  threats: number
  safe: number
  createdAt: Date
}

export interface ScanBadge {
  id: string
  name: string
  description: string
  icon: string
  requirement: {
    type: 'streak' | 'total' | 'daily' | 'threat_hunter' | 'safe_scanner'
    value: number
  }
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  points: number
}

export class ScanTrackerService {
  static readonly SCAN_BADGES: ScanBadge[] = [
    // Streak badges
    {
      id: 'streak_starter',
      name: 'Streak Starter',
      description: '3-day scan streak',
      icon: '🔥',
      requirement: { type: 'streak', value: 3 },
      rarity: 'common',
      points: 10
    },
    {
      id: 'week_warrior',
      name: 'Week Warrior',
      description: '7-day scan streak',
      icon: '⚔️',
      requirement: { type: 'streak', value: 7 },
      rarity: 'uncommon',
      points: 25
    },
    {
      id: 'fortnight_fighter',
      name: 'Fortnight Fighter',
      description: '14-day scan streak',
      icon: '🛡️',
      requirement: { type: 'streak', value: 14 },
      rarity: 'rare',
      points: 50
    },
    {
      id: 'monthly_master',
      name: 'Monthly Master',
      description: '30-day scan streak',
      icon: '👑',
      requirement: { type: 'streak', value: 30 },
      rarity: 'epic',
      points: 100
    },
    {
      id: 'quarterly_queen',
      name: 'Quarterly Champion',
      description: '90-day scan streak',
      icon: '💎',
      requirement: { type: 'streak', value: 90 },
      rarity: 'legendary',
      points: 300
    },
    {
      id: 'annual_ace',
      name: 'Annual Ace',
      description: '365-day scan streak',
      icon: '🏆',
      requirement: { type: 'streak', value: 365 },
      rarity: 'legendary',
      points: 1000
    },
    
    // Total scan badges
    {
      id: 'first_scan',
      name: 'First Scan',
      description: 'Complete your first scan',
      icon: '🎯',
      requirement: { type: 'total', value: 1 },
      rarity: 'common',
      points: 5
    },
    {
      id: 'scan_ten',
      name: 'Scanner',
      description: 'Complete 10 scans',
      icon: '🔍',
      requirement: { type: 'total', value: 10 },
      rarity: 'common',
      points: 15
    },
    {
      id: 'scan_fifty',
      name: 'Dedicated Scanner',
      description: 'Complete 50 scans',
      icon: '🎖️',
      requirement: { type: 'total', value: 50 },
      rarity: 'uncommon',
      points: 30
    },
    {
      id: 'scan_hundred',
      name: 'Century Scanner',
      description: 'Complete 100 scans',
      icon: '💯',
      requirement: { type: 'total', value: 100 },
      rarity: 'rare',
      points: 60
    },
    {
      id: 'scan_thousand',
      name: 'Scan Master',
      description: 'Complete 1,000 scans',
      icon: '🌟',
      requirement: { type: 'total', value: 1000 },
      rarity: 'epic',
      points: 200
    },
    {
      id: 'scan_ten_thousand',
      name: 'Scan Legend',
      description: 'Complete 10,000 scans',
      icon: '⭐',
      requirement: { type: 'total', value: 10000 },
      rarity: 'legendary',
      points: 500
    },
    
    // Daily scan badges
    {
      id: 'daily_five',
      name: 'Daily Vigilant',
      description: '5 scans in one day',
      icon: '📅',
      requirement: { type: 'daily', value: 5 },
      rarity: 'common',
      points: 10
    },
    {
      id: 'daily_ten',
      name: 'Daily Guardian',
      description: '10 scans in one day',
      icon: '🛡️',
      requirement: { type: 'daily', value: 10 },
      rarity: 'uncommon',
      points: 20
    },
    {
      id: 'daily_twenty',
      name: 'Daily Defender',
      description: '20 scans in one day',
      icon: '⚡',
      requirement: { type: 'daily', value: 20 },
      rarity: 'rare',
      points: 40
    },
    
    // Threat hunter badges
    {
      id: 'threat_finder',
      name: 'Threat Finder',
      description: 'Find 10 threats',
      icon: '🚨',
      requirement: { type: 'threat_hunter', value: 10 },
      rarity: 'uncommon',
      points: 25
    },
    {
      id: 'threat_hunter',
      name: 'Threat Hunter',
      description: 'Find 50 threats',
      icon: '🎯',
      requirement: { type: 'threat_hunter', value: 50 },
      rarity: 'rare',
      points: 50
    },
    {
      id: 'threat_master',
      name: 'Threat Master',
      description: 'Find 100 threats',
      icon: '💀',
      requirement: { type: 'threat_hunter', value: 100 },
      rarity: 'epic',
      points: 100
    },
    
    // Safe scanner badges
    {
      id: 'safe_scanner',
      name: 'Safe Scanner',
      description: '50 safe scans',
      icon: '✅',
      requirement: { type: 'safe_scanner', value: 50 },
      rarity: 'uncommon',
      points: 20
    },
    {
      id: 'safety_expert',
      name: 'Safety Expert',
      description: '200 safe scans',
      icon: '🛡️',
      requirement: { type: 'safe_scanner', value: 200 },
      rarity: 'rare',
      points: 50
    }
  ]

  /**
   * Track a new scan and update streaks
   */
  static async trackScan(
    walletAddress: string,
    scanType: string,
    isThreat: boolean
  ): Promise<{ newBadges: ScanBadge[], streakUpdate: any }> {
    const db = await getDatabase()
    const streaksCollection = db.collection('scan_streaks')
    const dailyCollection = db.collection('daily_scans')
    const usersCollection = db.collection('users')
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    
    // Get user
    const user = await usersCollection.findOne({ walletAddress })
    if (!user) {
      throw new Error('User not found')
    }
    
    const userId = user._id.toString()
    
    // Update daily scan record
    await dailyCollection.updateOne(
      { userId, date: todayStr },
      {
        $inc: { 
          scanCount: 1,
          threats: isThreat ? 1 : 0,
          safe: isThreat ? 0 : 1
        },
        $addToSet: { scanTypes: scanType },
        $set: { walletAddress, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    )
    
    // Get or create streak record
    let streak = await streaksCollection.findOne({ userId })
    
    if (!streak) {
      streak = {
        userId,
        walletAddress,
        currentStreak: 1,
        longestStreak: 1,
        lastScanDate: today,
        totalScans: 1,
        dailyScans: { [todayStr]: 1 },
        streakStartDate: today,
        badges: [],
        achievements: { firstScan: today },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } else {
      // Update streak
      const lastScan = new Date(streak.lastScanDate)
      lastScan.setHours(0, 0, 0, 0)
      
      const daysSinceLastScan = Math.floor((today.getTime() - lastScan.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysSinceLastScan === 0) {
        // Same day, just increment count
        streak.totalScans++
        streak.dailyScans[todayStr] = (streak.dailyScans[todayStr] || 0) + 1
      } else if (daysSinceLastScan === 1) {
        // Consecutive day, continue streak
        streak.currentStreak++
        streak.totalScans++
        streak.dailyScans[todayStr] = 1
        if (streak.currentStreak > streak.longestStreak) {
          streak.longestStreak = streak.currentStreak
        }
      } else {
        // Streak broken, start new
        streak.currentStreak = 1
        streak.streakStartDate = today
        streak.totalScans++
        streak.dailyScans[todayStr] = 1
      }
      
      streak.lastScanDate = today
      streak.updatedAt = new Date()
      
      // Update achievements
      if (streak.totalScans === 10 && !streak.achievements.tenthScan) {
        streak.achievements.tenthScan = today
      }
      if (streak.totalScans === 100 && !streak.achievements.hundredthScan) {
        streak.achievements.hundredthScan = today
      }
      if (streak.totalScans === 1000 && !streak.achievements.thousandthScan) {
        streak.achievements.thousandthScan = today
      }
      if (streak.currentStreak === 7 && !streak.achievements.weekStreak) {
        streak.achievements.weekStreak = today
      }
      if (streak.currentStreak === 30 && !streak.achievements.monthStreak) {
        streak.achievements.monthStreak = today
      }
      if (streak.currentStreak === 365 && !streak.achievements.yearStreak) {
        streak.achievements.yearStreak = today
      }
    }
    
    // Check for new badges
    const newBadges: ScanBadge[] = []
    const currentBadges = new Set(streak.badges || [])
    
    // Get daily scan count
    const dailyCount = await dailyCollection.findOne({ userId, date: todayStr })
    const todayScans = dailyCount?.scanCount || 1
    
    // Get threat counts
    const threatCount = await dailyCollection.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalThreats: { $sum: '$threats' } } }
    ]).toArray()
    const totalThreats = threatCount[0]?.totalThreats || 0
    
    const safeCount = await dailyCollection.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalSafe: { $sum: '$safe' } } }
    ]).toArray()
    const totalSafe = safeCount[0]?.totalSafe || 0
    
    for (const badge of this.SCAN_BADGES) {
      if (currentBadges.has(badge.id)) continue
      
      let earned = false
      
      switch (badge.requirement.type) {
        case 'streak':
          earned = streak.currentStreak >= badge.requirement.value
          break
        case 'total':
          earned = streak.totalScans >= badge.requirement.value
          break
        case 'daily':
          earned = todayScans >= badge.requirement.value
          break
        case 'threat_hunter':
          earned = totalThreats >= badge.requirement.value
          break
        case 'safe_scanner':
          earned = totalSafe >= badge.requirement.value
          break
      }
      
      if (earned) {
        newBadges.push(badge)
        streak.badges.push(badge.id)
      }
    }
    
    // Save streak
    await streaksCollection.replaceOne(
      { userId },
      streak,
      { upsert: true }
    )
    
    return {
      newBadges,
      streakUpdate: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        totalScans: streak.totalScans,
        todayScans
      }
    }
  }
  
  /**
   * Get user's scan statistics and badges
   */
  static async getUserScanStats(walletAddress: string) {
    const db = await getDatabase()
    const streaksCollection = db.collection('scan_streaks')
    const dailyCollection = db.collection('daily_scans')
    const usersCollection = db.collection('users')
    
    const user = await usersCollection.findOne({ walletAddress })
    if (!user) {
      return null
    }
    
    const userId = user._id.toString()
    const streak = await streaksCollection.findOne({ userId })
    
    if (!streak) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalScans: 0,
        todayScans: 0,
        badges: [],
        achievements: {},
        weeklyScans: [],
        monthlyScans: []
      }
    }
    
    // Get today's scans
    const today = new Date().toISOString().split('T')[0]
    const todayRecord = await dailyCollection.findOne({ userId, date: today })
    
    // Get last 7 days
    const weeklyScans = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const record = await dailyCollection.findOne({ userId, date: dateStr })
      weeklyScans.push({
        date: dateStr,
        count: record?.scanCount || 0,
        day: date.toLocaleDateString('en', { weekday: 'short' })
      })
    }
    
    // Get last 30 days for monthly chart
    const monthlyScans = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const record = await dailyCollection.findOne({ userId, date: dateStr })
      monthlyScans.push({
        date: dateStr,
        count: record?.scanCount || 0
      })
    }
    
    // Get badge details
    const badges = this.SCAN_BADGES.filter(b => streak.badges?.includes(b.id))
    
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalScans: streak.totalScans,
      todayScans: todayRecord?.scanCount || 0,
      badges,
      achievements: streak.achievements,
      weeklyScans,
      monthlyScans,
      lastScanDate: streak.lastScanDate,
      streakStartDate: streak.streakStartDate
    }
  }
  
  /**
   * Get leaderboard
   */
  static async getLeaderboard(type: 'streak' | 'total' | 'badges' = 'streak', limit = 10) {
    const db = await getDatabase()
    const streaksCollection = db.collection('scan_streaks')
    const usersCollection = db.collection('users')
    
    let sortField = 'currentStreak'
    if (type === 'total') sortField = 'totalScans'
    if (type === 'badges') sortField = 'badges'
    
    const topUsers = await streaksCollection
      .find({})
      .sort({ [sortField]: -1 })
      .limit(limit)
      .toArray()
    
    const leaderboard = []
    for (const streak of topUsers) {
      const user = await usersCollection.findOne({ _id: new ObjectId(streak.userId) })
      if (user) {
        leaderboard.push({
          username: user.username || `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`,
          walletAddress: user.walletAddress,
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          totalScans: streak.totalScans,
          badges: streak.badges?.length || 0,
          badgeList: this.SCAN_BADGES.filter(b => streak.badges?.includes(b.id))
        })
      }
    }
    
    return leaderboard
  }
}