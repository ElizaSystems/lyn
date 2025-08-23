import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { verifyAuth } from '@/lib/auth-helper'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required'
      }, { status: 401 })
    }
    
    const db = await getDatabase()
    const statsCollection = db.collection('player_challenge_stats')
    const rankingsCollection = db.collection('season_rankings')
    
    // Get player stats
    const stats = await statsCollection.findOne({ walletAddress: user.walletAddress })
    
    if (!stats) {
      // Return default stats for new player
      return NextResponse.json({
        totalScore: 0,
        rank: null,
        currentStreak: 0,
        tier: 'bronze',
        challengesCompleted: 0,
        averageScore: 0,
        bestTime: null,
        badges: [],
        xp: 0
      })
    }
    
    // Get current season rank
    const currentSeason = Math.ceil((new Date().getMonth() + 1) / 3)
    const currentYear = new Date().getFullYear()
    const seasonRanking = await rankingsCollection.findOne({
      season: currentSeason,
      year: currentYear
    })
    
    let rank = null
    if (seasonRanking) {
      const playerEntry = seasonRanking.leaderboard.find(
        (e: any) => e.walletAddress === user.walletAddress
      )
      rank = playerEntry?.rank || null
    }
    
    return NextResponse.json({
      totalScore: stats.totalPoints || 0,
      rank,
      currentStreak: stats.currentStreak || 0,
      tier: stats.tier || 'bronze',
      challengesCompleted: stats.challengesCompleted || 0,
      averageScore: stats.averageScore || 0,
      bestTime: stats.bestTime,
      badges: stats.badges || [],
      xp: stats.totalPoints || 0
    })
  } catch (error) {
    console.error('Failed to fetch player stats:', error)
    return NextResponse.json({
      totalScore: 0,
      rank: null,
      currentStreak: 0,
      tier: 'bronze',
      challengesCompleted: 0,
      averageScore: 0,
      bestTime: null,
      badges: [],
      xp: 0
    })
  }
}