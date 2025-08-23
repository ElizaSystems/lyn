import { NextRequest, NextResponse } from 'next/server'
import { BADGE_DEFINITIONS, TOTAL_BADGES } from '@/lib/services/badge-definitions'
import { BadgeServiceV2 } from '@/lib/services/badge-service-v2'
import { verifyAuth } from '@/lib/auth-helper'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models/user'

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req)
    
    // Return all badge definitions
    const badges = BADGE_DEFINITIONS.map(badge => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      rarity: badge.rarity,
      reputationReward: badge.reputationReward,
      xpReward: badge.xpReward,
      requirements: badge.requirements
    }))
    
    let userProgress = null
    let earnedBadges = []
    let stats = null
    
    if (authResult) {
      // Get user's earned badges and progress
      await connectToDatabase()
      const user = await User.findOne({ wallet: authResult.userId })
      
      if (user) {
        earnedBadges = user.badges || []
        
        // Calculate metrics for progress
        const metrics = {
          totalScans: user.scanCount || 0,
          safeScans: user.safeScans || 0,
          threatsDetected: user.threatsDetected || 0,
          accountAge: user.createdAt ? 
            Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          referralCount: user.referralCount || 0,
          stakingAmount: user.stakingAmount || 0,
          burnAmount: user.burnAmount || 0,
          reportsSubmitted: user.reportsSubmitted || 0,
          quizScore: user.quizHighScore || 0,
          challengesCompleted: user.challengesCompleted || 0,
          streak: user.currentStreak || 0,
          tipsViewed: user.metadata?.tipsViewed?.length || 0,
          votes: user.communityVotes || 0,
          walletConnections: user.connectedWallets?.length || 0,
          dailyLogins: user.consecutiveLogins || 0,
          phishingReports: user.phishingReportsVerified || 0,
          accuracyRate: user.scanAccuracy || 0,
          multiChain: user.chainsScanned?.length || 0
        }
        
        // Get next achievable badges
        const nextBadges = BadgeServiceV2.getNextAchievableBadges(earnedBadges, metrics)
        
        // Get stats
        stats = BadgeServiceV2.getBadgeStats(earnedBadges)
        
        userProgress = {
          earned: earnedBadges.map((b: any) => b.id),
          nextAchievable: nextBadges,
          metrics,
          stats
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      totalBadges: TOTAL_BADGES,
      badges,
      userProgress,
      earnedBadges,
      stats,
      categories: {
        security: badges.filter(b => b.category === 'security').length,
        community: badges.filter(b => b.category === 'community').length,
        achievement: badges.filter(b => b.category === 'achievement').length,
        special: badges.filter(b => b.category === 'special').length,
        quiz: badges.filter(b => b.category === 'quiz').length,
        challenge: badges.filter(b => b.category === 'challenge').length,
        phishing: badges.filter(b => b.category === 'phishing').length
      },
      rarities: {
        common: badges.filter(b => b.rarity === 'common').length,
        rare: badges.filter(b => b.rarity === 'rare').length,
        epic: badges.filter(b => b.rarity === 'epic').length,
        legendary: badges.filter(b => b.rarity === 'legendary').length,
        mythic: badges.filter(b => b.rarity === 'mythic').length
      }
    })
  } catch (error) {
    console.error('Error getting badges:', error)
    return NextResponse.json(
      { error: 'Failed to get badges' },
      { status: 500 }
    )
  }
}