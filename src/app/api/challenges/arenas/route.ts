import { NextRequest, NextResponse } from 'next/server'
import { ChallengeArenaService } from '@/lib/services/challenge-arena-service'
import { gamifiedChallenges, speedRunChallenges, tournamentChallenges } from '@/lib/data/gamified-challenges'

export async function GET(request: NextRequest) {
  try {
    const arenaService = ChallengeArenaService.getInstance()
    const activeArenas = await arenaService.getActiveArenas()
    
    // Create demo arenas if none exist
    if (activeArenas.length === 0) {
      const now = new Date()
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)
      
      const endOfWeek = new Date(now)
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
      endOfWeek.setHours(23, 59, 59, 999)
      
      // Daily Challenge
      const dailyChallenge = gamifiedChallenges[Math.floor(Math.random() * gamifiedChallenges.length)]
      await arenaService.createArena({
        type: 'daily',
        name: 'Daily Security Sprint',
        description: `Today's challenge: ${dailyChallenge.title}. Complete it fast for bonus points!`,
        startTime: now,
        endTime: endOfDay,
        status: 'active',
        rules: {
          maxAttempts: 3,
          timeLimit: 10,
          scoringSystem: 'combined',
          penaltyForHints: 25,
          bonusForSpeed: 10,
          bonusForNoHints: 100
        },
        prizes: [
          { rank: 1, reward: { xp: 1000, tokens: 100, badge: 'Daily Champion' } },
          { rank: 2, reward: { xp: 500, tokens: 50 } },
          { rank: 3, reward: { xp: 250, tokens: 25 } },
          { rank: 10, reward: { xp: 100, tokens: 10 } }
        ],
        participants: [],
        challenges: [dailyChallenge.id as any],
        metadata: {
          totalParticipants: 0,
          averageScore: 0,
          topScore: 0,
          totalPrizePool: 185
        }
      })
      
      // Weekly Tournament
      const weeklyChallenge = tournamentChallenges[0]
      await arenaService.createArena({
        type: 'weekly',
        name: 'Weekly Security Championship',
        description: 'Compete in the ultimate security challenge tournament. Top 10 players win rewards!',
        startTime: now,
        endTime: endOfWeek,
        status: 'active',
        rules: {
          maxAttempts: 5,
          timeLimit: 30,
          scoringSystem: 'combined',
          penaltyForHints: 50,
          bonusForSpeed: 20,
          bonusForNoHints: 200
        },
        prizes: [
          { rank: 1, reward: { xp: 5000, tokens: 500, badge: 'Weekly Champion', title: 'Security Master' } },
          { rank: 2, reward: { xp: 3000, tokens: 300, badge: 'Weekly Runner-up' } },
          { rank: 3, reward: { xp: 2000, tokens: 200, badge: 'Weekly Bronze' } },
          { rank: 5, reward: { xp: 1000, tokens: 100 } },
          { rank: 10, reward: { xp: 500, tokens: 50 } }
        ],
        participants: [],
        challenges: [weeklyChallenge.id as any],
        metadata: {
          totalParticipants: 0,
          averageScore: 0,
          topScore: 0,
          totalPrizePool: 1150
        }
      })
      
      // Speed Run Challenge
      const speedRun = speedRunChallenges[0]
      await arenaService.createArena({
        type: 'daily',
        name: 'Speed Security Check',
        description: '60-second rapid-fire security assessment. How fast can you identify threats?',
        startTime: now,
        endTime: endOfDay,
        status: 'active',
        rules: {
          maxAttempts: 10,
          timeLimit: 1,
          scoringSystem: 'speed',
          penaltyForHints: 0,
          bonusForSpeed: 50,
          bonusForNoHints: 0
        },
        prizes: [
          { rank: 1, reward: { xp: 300, badge: 'Speed Demon' } },
          { rank: 3, reward: { xp: 150 } },
          { rank: 5, reward: { xp: 75 } }
        ],
        participants: [],
        challenges: [speedRun.id as any],
        metadata: {
          totalParticipants: 0,
          averageScore: 0,
          topScore: 0,
          totalPrizePool: 0
        }
      })
    }
    
    // Format response
    const formattedArenas = activeArenas.map(arena => ({
      id: arena._id?.toString(),
      name: arena.name,
      type: arena.type,
      status: arena.status,
      startTime: arena.startTime,
      endTime: arena.endTime,
      participants: arena.participants.length,
      prizePool: arena.metadata.totalPrizePool,
      difficulty: 'intermediate', // Would be determined by challenge difficulty
      category: 'security', // Would be determined by challenge category
      timeLimit: arena.rules.timeLimit,
      maxAttempts: arena.rules.maxAttempts,
      topScore: arena.metadata.topScore,
      averageScore: arena.metadata.averageScore,
      description: arena.description,
      rules: arena.rules
    }))
    
    return NextResponse.json({
      success: true,
      arenas: formattedArenas
    })
  } catch (error) {
    console.error('Failed to fetch arenas:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch arenas'
    }, { status: 500 })
  }
}