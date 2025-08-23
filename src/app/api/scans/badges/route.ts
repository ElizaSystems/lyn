import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ScanTrackerService } from '@/lib/services/scan-tracker-service'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth) {
      // Return all badges without earned status for non-authenticated users
      return NextResponse.json({
        badges: ScanTrackerService.SCAN_BADGES.map(badge => ({
          ...badge,
          earned: false
        }))
      })
    }

    const db = await getDatabase()
    const streaksCollection = db.collection('scan_streaks')
    const scansCollection = db.collection('scans')
    const usersCollection = db.collection('users')
    
    // Get user data
    const user = await usersCollection.findOne({ walletAddress: auth.walletAddress })
    const userId = user?._id?.toString()
    
    // Get user's streak data
    const streakData = await streaksCollection.findOne({ 
      walletAddress: auth.walletAddress 
    })
    
    // Get scan statistics
    const [totalScans, threatsDetected, safeScans] = await Promise.all([
      scansCollection.countDocuments({ userId }),
      scansCollection.countDocuments({ 
        userId,
        'result.isSafe': false 
      }),
      scansCollection.countDocuments({ 
        userId,
        'result.isSafe': true 
      })
    ])
    
    // Get daily scan max
    const dailyRecords = await db.collection('daily_scan_records')
      .find({ userId })
      .sort({ scanCount: -1 })
      .limit(1)
      .toArray()
    const maxDailyScans = dailyRecords[0]?.scanCount || 0
    
    // Check which badges are earned
    const allBadges = ScanTrackerService.SCAN_BADGES.map(badge => {
      let earned = false
      let earnedAt = null
      
      switch (badge.requirement.type) {
        case 'streak':
          earned = (streakData?.currentStreak || 0) >= badge.requirement.value ||
                  (streakData?.longestStreak || 0) >= badge.requirement.value
          break
        case 'total':
          earned = totalScans >= badge.requirement.value
          break
        case 'daily':
          earned = maxDailyScans >= badge.requirement.value
          break
        case 'threat_hunter':
          earned = threatsDetected >= badge.requirement.value
          break
        case 'safe_scanner':
          earned = safeScans >= badge.requirement.value
          break
      }
      
      // Get earned date from streak data if available
      if (earned && streakData?.badges?.includes(badge.id)) {
        earnedAt = streakData.achievements?.[`${badge.id}Date`] || null
      }
      
      return {
        ...badge,
        earned,
        earnedAt,
        progress: {
          current: badge.requirement.type === 'streak' ? (streakData?.currentStreak || 0) :
                  badge.requirement.type === 'total' ? totalScans :
                  badge.requirement.type === 'daily' ? maxDailyScans :
                  badge.requirement.type === 'threat_hunter' ? threatsDetected :
                  badge.requirement.type === 'safe_scanner' ? safeScans : 0,
          required: badge.requirement.value
        }
      }
    })
    
    return NextResponse.json({
      badges: allBadges,
      stats: {
        totalBadges: allBadges.length,
        earnedBadges: allBadges.filter(b => b.earned).length,
        totalPoints: allBadges.filter(b => b.earned).reduce((sum, b) => sum + b.points, 0)
      }
    })
    
  } catch (error) {
    console.error('Failed to fetch badges:', error)
    return NextResponse.json(
      { error: 'Failed to fetch badges' },
      { status: 500 }
    )
  }
}