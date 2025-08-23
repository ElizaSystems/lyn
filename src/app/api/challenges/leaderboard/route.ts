import { NextRequest, NextResponse } from 'next/server'
import { ChallengeArenaService } from '@/lib/services/challenge-arena-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const arenaId = searchParams.get('arenaId')
    const type = searchParams.get('type') || 'current'
    
    const arenaService = ChallengeArenaService.getInstance()
    
    if (type === 'season') {
      // Get season rankings
      const seasonRanking = await arenaService.getSeasonRankings()
      
      return NextResponse.json({
        success: true,
        type: 'season',
        season: seasonRanking.season,
        year: seasonRanking.year,
        leaderboard: seasonRanking.leaderboard.map((entry, index) => ({
          rank: entry.rank || index + 1,
          username: entry.username,
          walletAddress: entry.walletAddress,
          score: entry.totalPoints,
          timeSpent: entry.bestTime,
          completedAt: new Date(),
          percentile: Math.round(((seasonRanking.leaderboard.length - index) / seasonRanking.leaderboard.length) * 100),
          tier: entry.tier,
          badges: entry.badges
        }))
      })
    } else if (arenaId) {
      // Get arena-specific leaderboard
      const leaderboard = await arenaService.getLeaderboard(arenaId, 100)
      
      return NextResponse.json({
        success: true,
        type: 'arena',
        arenaId,
        leaderboard
      })
    } else {
      // Get overall leaderboard
      const seasonRanking = await arenaService.getSeasonRankings()
      
      return NextResponse.json({
        success: true,
        type: 'overall',
        leaderboard: seasonRanking.leaderboard.slice(0, 100).map((entry, index) => ({
          rank: entry.rank || index + 1,
          username: entry.username,
          walletAddress: entry.walletAddress,
          score: entry.totalPoints,
          challengesCompleted: entry.challengesCompleted,
          averageScore: entry.averageScore,
          tier: entry.tier,
          badges: entry.badges
        }))
      })
    }
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch leaderboard'
    }, { status: 500 })
  }
}