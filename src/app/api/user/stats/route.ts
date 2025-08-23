import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }

    const db = await getDatabase()
    
    // Get user reputation
    const reputation = await db.collection('user_reputation').findOne({ walletAddress })
    
    // Get user achievements/badges
    const achievements = await db.collection('user_achievements').findOne({ walletAddress })
    
    // Get scan count
    const scanCount = await db.collection('security_scans').countDocuments({ 
      walletAddress,
      status: 'completed' 
    })
    
    // Calculate reputation tier based on score
    let tier = 'Novice'
    let tierColor = 'text-gray-400'
    const score = reputation?.reputationScore || 0
    
    if (score >= 1000) {
      tier = 'Guardian'
      tierColor = 'text-purple-500'
    } else if (score >= 750) {
      tier = 'Expert'
      tierColor = 'text-blue-500'
    } else if (score >= 500) {
      tier = 'Trusted'
      tierColor = 'text-green-500'
    } else if (score >= 250) {
      tier = 'Contributor'
      tierColor = 'text-yellow-500'
    } else if (score >= 100) {
      tier = 'Member'
      tierColor = 'text-orange-500'
    }
    
    // Count actual badges earned
    const badgeCount = achievements?.badges?.length || 0
    
    return NextResponse.json({
      reputationScore: score,
      reputationTier: tier,
      reputationTierColor: tierColor,
      totalScans: scanCount,
      badgesEarned: badgeCount,
      badges: achievements?.badges || [],
      metrics: reputation?.metrics || {
        totalScans: scanCount,
        accurateReports: 0,
        communityContributions: 0,
        stakingAmount: 0,
        accountAge: 0,
        verifiedScans: 0
      }
    })

  } catch (error) {
    console.error('User stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    )
  }
}
