import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ScanService } from '@/lib/services/scan-service'

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

    // Get user data
    const user = await usersCollection.findOne({ username })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get reputation data
    const reputation = await reputationCollection.findOne({ username })

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

    // Update reputation metrics if needed
    if (reputation) {
      const updatedMetrics = {
        ...reputation.metrics,
        totalScans: userStats?.totalScans || 0,
        accountAge,
        verifiedScans: publicScans.length
      }

      // Calculate reputation score
      const reputationScore = calculateReputationScore(updatedMetrics)

      await reputationCollection.updateOne(
        { username },
        {
          $set: {
            metrics: updatedMetrics,
            reputationScore,
            updatedAt: new Date()
          }
        }
      )
    }

    return NextResponse.json({
      profile: {
        username,
        walletAddress: user.walletAddress,
        registeredAt: user.usernameRegisteredAt,
        accountCreated: user.createdAt
      },
      reputation: {
        score: reputation?.reputationScore || 100,
        metrics: reputation?.metrics || {},
        badges: reputation?.badges || []
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

function calculateReputationScore(metrics: {
  totalScans?: number
  accountAge?: number
  accurateReports?: number
  communityContributions?: number
  stakingAmount?: number
  verifiedScans?: number
}): number {
  let score = 100 // Base score

  // Scan activity bonus (up to +50 points)
  const scanBonus = Math.min(50, (metrics.totalScans || 0) * 2)
  score += scanBonus

  // Account age bonus (up to +30 points)
  const ageBonus = Math.min(30, (metrics.accountAge || 0) / 10)
  score += ageBonus

  // Accuracy bonus (up to +40 points)
  const accuracyBonus = Math.min(40, (metrics.accurateReports || 0) * 5)
  score += accuracyBonus

  // Community contributions bonus (up to +30 points)
  const communityBonus = Math.min(30, (metrics.communityContributions || 0) * 10)
  score += communityBonus

  // Staking bonus (up to +50 points)
  const stakingBonus = Math.min(50, (metrics.stakingAmount || 0) / 1000)
  score += stakingBonus

  // Verified scans bonus (up to +20 points)
  const verifiedBonus = Math.min(20, (metrics.verifiedScans || 0))
  score += verifiedBonus

  return Math.min(1000, Math.max(0, Math.round(score)))
}
