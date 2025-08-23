import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import { ReputationService } from '@/lib/services/reputation-service'

/**
 * POST /api/user/reputation/recalculate
 * Recalculate reputation for existing users who were active before the reputation system
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDatabase()
    const usersCollection = db.collection('users')
    const scansCollection = db.collection('scans')
    const referralCollection = db.collection('referral_relationships_v2')
    const reputationCollection = db.collection('user_reputation')
    
    // Get user data
    const user = await usersCollection.findOne({ 
      walletAddress: auth.walletAddress 
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Check if reputation already exists and has been properly calculated
    let reputation = await reputationCollection.findOne({ 
      walletAddress: auth.walletAddress 
    })
    
    // Initialize reputation if it doesn't exist
    if (!reputation) {
      reputation = await ReputationService.getOrCreateReputation(auth.walletAddress)
    }
    
    // Retroactively calculate points for existing achievements
    const pointsToAward: { action: string; points: number; description: string }[] = []
    
    // 1. Check for username registration
    if (user.username && !reputation.stats?.usernameRegistered) {
      pointsToAward.push({
        action: 'USERNAME_REGISTRATION',
        points: ReputationService.POINTS.USERNAME_REGISTRATION,
        description: 'Registered username'
      })
      
      // Update the flag
      await reputationCollection.updateOne(
        { walletAddress: auth.walletAddress },
        { $set: { 'stats.usernameRegistered': true } }
      )
    }
    
    // 2. Check for X account connection
    if (user.xUsername && !reputation.stats?.xAccountConnected) {
      pointsToAward.push({
        action: 'X_ACCOUNT_CONNECTED',
        points: ReputationService.POINTS.X_ACCOUNT_CONNECTED,
        description: 'Connected X account'
      })
      
      // Update the flag
      await reputationCollection.updateOne(
        { walletAddress: auth.walletAddress },
        { $set: { 'stats.xAccountConnected': true } }
      )
    }
    
    // 3. Check for first scan
    const firstScan = await scansCollection.findOne(
      { userId: user._id?.toString() },
      { sort: { createdAt: 1 } }
    )
    
    if (firstScan && reputation.stats?.scansCompleted === 0) {
      pointsToAward.push({
        action: 'FIRST_SCAN',
        points: ReputationService.POINTS.FIRST_SCAN,
        description: 'Completed first scan'
      })
    }
    
    // 4. Count total scans completed (retroactive)
    const totalScans = await scansCollection.countDocuments({ 
      userId: user._id?.toString() 
    })
    
    // Award points for scans not yet counted
    const unaccountedScans = totalScans - (reputation.stats?.scansCompleted || 0)
    if (unaccountedScans > 0) {
      // Award points for each uncounted scan
      const scanPoints = unaccountedScans * ReputationService.POINTS.SCAN_COMPLETED
      pointsToAward.push({
        action: 'SCAN_COMPLETED',
        points: scanPoints,
        description: `Completed ${unaccountedScans} scans`
      })
      
      // Update scan count
      await reputationCollection.updateOne(
        { walletAddress: auth.walletAddress },
        { $set: { 'stats.scansCompleted': totalScans } }
      )
    }
    
    // 5. Count threats detected
    const threatsDetected = await scansCollection.countDocuments({ 
      userId: user._id?.toString(),
      'result.isSafe': false
    })
    
    const unaccountedThreats = threatsDetected - (reputation.stats?.threatsDetected || 0)
    if (unaccountedThreats > 0) {
      const threatPoints = unaccountedThreats * ReputationService.POINTS.THREAT_DETECTED
      pointsToAward.push({
        action: 'THREAT_DETECTED',
        points: threatPoints,
        description: `Detected ${unaccountedThreats} threats`
      })
      
      // Update threat count
      await reputationCollection.updateOne(
        { walletAddress: auth.walletAddress },
        { $set: { 'stats.threatsDetected': threatsDetected } }
      )
    }
    
    // 6. Count successful referrals
    const referrals = await referralCollection.countDocuments({ 
      referrerWallet: auth.walletAddress 
    })
    
    const unaccountedReferrals = referrals - (reputation.stats?.referralsSuccessful || 0)
    if (unaccountedReferrals > 0) {
      const referralPoints = unaccountedReferrals * ReputationService.POINTS.REFERRAL_SUCCESSFUL
      pointsToAward.push({
        action: 'REFERRAL_SUCCESSFUL',
        points: referralPoints,
        description: `${unaccountedReferrals} successful referrals`
      })
      
      // Update referral count
      await reputationCollection.updateOne(
        { walletAddress: auth.walletAddress },
        { $set: { 'stats.referralsSuccessful': referrals } }
      )
    }
    
    // 7. Calculate streak bonuses (retroactive)
    const recentScans = await scansCollection
      .find({ userId: user._id?.toString() })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    
    let longestStreak = 0
    let currentStreak = 0
    let lastScanDate: Date | null = null
    let hasWeekStreak = false
    let hasMonthStreak = false
    
    for (const scan of recentScans) {
      const scanDate = new Date(scan.createdAt)
      scanDate.setHours(0, 0, 0, 0)
      
      if (!lastScanDate) {
        currentStreak = 1
        lastScanDate = scanDate
      } else {
        const dayDiff = Math.floor((lastScanDate.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (dayDiff === 1) {
          currentStreak++
          
          // Check for streak milestones
          if (currentStreak >= 7 && !hasWeekStreak) {
            hasWeekStreak = true
          }
          if (currentStreak >= 30 && !hasMonthStreak) {
            hasMonthStreak = true
          }
        } else if (dayDiff > 1) {
          longestStreak = Math.max(longestStreak, currentStreak)
          currentStreak = 1
        }
        lastScanDate = scanDate
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak)
    
    // Award streak bonuses if not already given
    const achievements = reputation.achievements || []
    
    if (longestStreak >= 7 && !achievements.includes('WEEKLY_STREAK')) {
      pointsToAward.push({
        action: 'WEEKLY_SCAN_STREAK',
        points: ReputationService.POINTS.WEEKLY_SCAN_STREAK,
        description: 'Achieved 7-day scan streak'
      })
      
      await reputationCollection.updateOne(
        { walletAddress: auth.walletAddress },
        { $push: { achievements: 'WEEKLY_STREAK' } }
      )
    }
    
    if (longestStreak >= 30 && !achievements.includes('MONTHLY_STREAK')) {
      pointsToAward.push({
        action: 'MONTHLY_SCAN_STREAK',
        points: ReputationService.POINTS.MONTHLY_SCAN_STREAK,
        description: 'Achieved 30-day scan streak'
      })
      
      await reputationCollection.updateOne(
        { walletAddress: auth.walletAddress },
        { $push: { achievements: 'MONTHLY_STREAK' } }
      )
    }
    
    // Award all calculated points
    let totalPointsAwarded = 0
    for (const award of pointsToAward) {
      await ReputationService.awardPoints(
        auth.walletAddress,
        award.action,
        award.points,
        award.description
      )
      totalPointsAwarded += award.points
    }
    
    // Get updated reputation
    const updatedReputation = await reputationCollection.findOne({ 
      walletAddress: auth.walletAddress 
    })
    
    // Calculate current level based on total points
    const level = ReputationService.calculateLevel(updatedReputation?.totalPoints || 0)
    
    // Update level
    await reputationCollection.updateOne(
      { walletAddress: auth.walletAddress },
      { $set: { level } }
    )
    
    return NextResponse.json({
      success: true,
      message: 'Reputation recalculated successfully',
      pointsAwarded: totalPointsAwarded,
      totalPoints: updatedReputation?.totalPoints || 0,
      level,
      details: pointsToAward
    })
    
  } catch (error) {
    console.error('Failed to recalculate reputation:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate reputation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/user/reputation/recalculate
 * Check if user needs reputation recalculation
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDatabase()
    const reputationCollection = db.collection('user_reputation')
    const usersCollection = db.collection('users')
    
    const [reputation, user] = await Promise.all([
      reputationCollection.findOne({ walletAddress: auth.walletAddress }),
      usersCollection.findOne({ walletAddress: auth.walletAddress })
    ])
    
    // Check if recalculation is needed
    const needsRecalculation = !reputation || 
      (user?.username && !reputation.stats?.usernameRegistered) ||
      (user?.xUsername && !reputation.stats?.xAccountConnected) ||
      !reputation.stats?.scansCompleted
    
    return NextResponse.json({
      needsRecalculation,
      hasReputation: !!reputation,
      currentPoints: reputation?.totalPoints || 0
    })
    
  } catch (error) {
    console.error('Failed to check reputation status:', error)
    return NextResponse.json(
      { error: 'Failed to check reputation status' },
      { status: 500 }
    )
  }
}