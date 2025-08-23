import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import { ReputationService } from '@/lib/services/reputation-service'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the new reputation service to get comprehensive data
    const reputationSummary = await ReputationService.getReputationSummary(auth.user.walletAddress)
    
    const db = await getDatabase()
    const reputationCollection = db.collection('user_reputation')
    const scansCollection = db.collection('scans')
    const referralCollection = db.collection('referral_relationships_v2')
    const usersCollection = db.collection('users')
    
    // Get user reputation
    const reputation = await reputationCollection.findOne({ 
      walletAddress: auth.walletAddress 
    })
    
    // Get user data for additional checks
    const user = await usersCollection.findOne({ 
      walletAddress: auth.walletAddress 
    })
    
    // Calculate stats
    const [totalScans, threatsDetected, referralsCount] = await Promise.all([
      scansCollection.countDocuments({ 
        userId: user?._id?.toString() 
      }),
      scansCollection.countDocuments({ 
        userId: user?._id?.toString(),
        'result.isSafe': false
      }),
      referralCollection.countDocuments({ 
        referrerWallet: auth.walletAddress 
      })
    ])
    
    // Get scan streak data
    const recentScans = await scansCollection
      .find({ userId: user?._id?.toString() })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    
    // Calculate longest streak
    let longestStreak = 0
    let currentStreak = 0
    let lastScanDate: Date | null = null
    
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
        } else if (dayDiff > 1) {
          longestStreak = Math.max(longestStreak, currentStreak)
          currentStreak = 1
        }
        lastScanDate = scanDate
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak)
    
    const reputationData = {
      reputationScore: reputation?.totalPoints || reputationSummary?.totalPoints || 0,
      tier: reputation?.tier || 'novice',
      stats: {
        totalScans,
        threatsDetected,
        referralsCount,
        longestStreak,
        feedbackProvided: 0, // Would need feedback collection to track
        stakedAmount: 0, // Would need staking system to track
        isPremium: user?.isPremium || false,
        usernameRegistered: !!user?.username,
        xAccountConnected: !!user?.xUsername
      },
      achievements: reputation?.achievements || [],
      badges: reputation?.badges || [],
      events: reputation?.events || reputationSummary?.events || []
    }
    
    return NextResponse.json(reputationData)
    
  } catch (error) {
    console.error('Failed to fetch reputation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reputation data' },
      { status: 500 }
    )
  }
}