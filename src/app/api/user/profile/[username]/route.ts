import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ScanService } from '@/lib/services/scan-service'
import { BadgeService } from '@/lib/services/badge-service'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await context.params
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const db = await getDatabase()
    const usersCollection = db.collection('users')
    const reputationCollection = db.collection('user_reputation')
    const referralRelationshipsCollection = db.collection('referral_relationships')

    // Get user data
    const user = await usersCollection.findOne({ username })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get reputation data
    const reputation = await reputationCollection.findOne({ username })
    
    // Get referrer data if exists
    let referrerInfo = null
    const referralRelationship = await referralRelationshipsCollection.findOne({ 
      referredId: user._id 
    })
    
    if (referralRelationship) {
      const referrer = await usersCollection.findOne({ _id: referralRelationship.referrerId })
      if (referrer) {
        referrerInfo = {
          walletAddress: referrer.walletAddress,
          username: referrer.username,
          referralCode: referralRelationship.referralCode
        }
      }
    }

    // Get user's scan statistics
    const userStats = await ScanService.getUserStatistics(user._id.toString())

    // Get recent scans (public ones only)
    const recentScans = await ScanService.getUserRecentScans(user._id.toString(), 10)
    const publicScans = recentScans.filter(scan => scan.status === 'completed').map(scan => ({
      id: scan._id?.toString(),
      hash: scan.hash,
      type: scan.type,
      target: scan.target,
      severity: scan.severity,
      status: scan.status,
      result: scan.result,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt
    }))

    // Calculate additional metrics
    const accountAge = user.createdAt ? 
      Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0

    // Get referral count for the user
    const referralCount = await referralRelationshipsCollection.countDocuments({ 
      referrerId: user._id 
    })

    // Get burn and stake amounts (if available)
    const burnCollection = db.collection('burns')
    const stakingCollection = db.collection('stakes')
    
    const burnStats = await burnCollection.aggregate([
      { $match: { walletAddress: user.walletAddress } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray()
    
    const stakeStats = await stakingCollection.aggregate([
      { $match: { walletAddress: user.walletAddress } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray()
    
    // Get reports submitted count
    const reportsCollection = db.collection('security_reports')
    const reportsCount = await reportsCollection.countDocuments({ 
      reporterAddress: user.walletAddress 
    })

    // Prepare comprehensive metrics
    const comprehensiveMetrics = {
      totalScans: userStats?.totalScans || 0,
      safeScans: userStats?.safeScans || 0,
      threatsDetected: userStats?.threatsDetected || 0,
      accountAge,
      verifiedScans: publicScans.length,
      referralCount,
      stakingAmount: stakeStats[0]?.total || 0,
      burnAmount: burnStats[0]?.total || 0,
      reportsSubmitted: reportsCount,
      accurateReports: reputation?.metrics?.accurateReports || 0,
      communityContributions: reputation?.metrics?.communityContributions || 0
    }

    // Calculate badges dynamically
    const earnedBadges = await BadgeService.calculateUserBadges(
      user._id.toString(),
      comprehensiveMetrics
    )

    // Calculate reputation score with badge bonuses
    const reputationScore = BadgeService.calculateReputationScore(
      comprehensiveMetrics,
      earnedBadges
    )

    // Update reputation in database
    await reputationCollection.updateOne(
      { username },
      {
        $set: {
          metrics: comprehensiveMetrics,
          reputationScore,
          badges: earnedBadges,
          updatedAt: new Date()
        },
        $setOnInsert: {
          username,
          createdAt: new Date()
        }
      },
      { upsert: true }
    )

    // Get next achievable badges
    const nextBadges = BadgeService.getNextAchievableBadges(
      earnedBadges,
      comprehensiveMetrics
    )

    return NextResponse.json({
      profile: {
        username,
        walletAddress: user.walletAddress,
        registeredAt: user.usernameRegisteredAt,
        accountCreated: user.createdAt,
        referrer: referrerInfo
      },
      reputation: {
        score: reputationScore,
        metrics: comprehensiveMetrics,
        badges: earnedBadges,
        badgeStats: BadgeService.getBadgeStats(earnedBadges),
        nextBadges
      },
      statistics: userStats || {
        totalScans: 0,
        safeScans: 0,
        threatsDetected: 0,
        scansByType: {},
        scansBySeverity: {}
      },
      recentScans: publicScans,
      accountAge
    })

  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}
