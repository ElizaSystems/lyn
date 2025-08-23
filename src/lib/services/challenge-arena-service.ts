import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export interface ChallengeArena {
  _id?: ObjectId
  type: 'daily' | 'weekly' | 'tournament' | 'season'
  name: string
  description: string
  startTime: Date
  endTime: Date
  status: 'upcoming' | 'active' | 'completed'
  rules: {
    maxAttempts: number
    timeLimit: number // in minutes
    scoringSystem: 'speed' | 'accuracy' | 'combined'
    penaltyForHints: number // points deducted
    bonusForSpeed: number // points per minute saved
    bonusForNoHints: number // bonus if completed without hints
  }
  prizes: {
    rank: number
    reward: {
      xp: number
      tokens?: number
      badge?: string
      title?: string
    }
  }[]
  participants: {
    walletAddress: string
    username: string
    score: number
    timeSpent: number
    hintsUsed: number
    completedAt?: Date
    rank?: number
  }[]
  challenges: ObjectId[] // References to challenge IDs
  metadata: {
    totalParticipants: number
    averageScore: number
    topScore: number
    totalPrizePool: number
  }
}

export interface LiveChallenge {
  _id?: ObjectId
  arenaId: ObjectId
  challengeId: ObjectId
  participantId: string
  startedAt: Date
  status: 'in_progress' | 'completed' | 'abandoned'
  currentQuestion: number
  answers: any[]
  hintsUsed: string[]
  score: number
  timeRemaining: number
  streakMultiplier: number // Bonus for consecutive correct answers
}

export interface SeasonRanking {
  _id?: ObjectId
  season: number
  year: number
  leaderboard: {
    walletAddress: string
    username: string
    totalPoints: number
    challengesCompleted: number
    averageScore: number
    bestTime: number
    currentStreak: number
    rank: number
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master'
    badges: string[]
  }[]
  startDate: Date
  endDate: Date
  rewards: {
    distributed: boolean
    totalPool: number
    distribution: {
      rank: number
      walletAddress: string
      amount: number
      type: 'XP' | 'TOKENS' | 'NFT'
    }[]
  }
}

export class ChallengeArenaService {
  private static instance: ChallengeArenaService

  static getInstance(): ChallengeArenaService {
    if (!this.instance) {
      this.instance = new ChallengeArenaService()
    }
    return this.instance
  }

  // Create a new arena/competition
  async createArena(arena: Omit<ChallengeArena, '_id'>): Promise<ChallengeArena> {
    const db = await getDatabase()
    const arenasCollection = db.collection<ChallengeArena>('challenge_arenas')
    
    const result = await arenasCollection.insertOne({
      ...arena,
      participants: [],
      metadata: {
        totalParticipants: 0,
        averageScore: 0,
        topScore: 0,
        totalPrizePool: arena.prizes.reduce((sum, p) => sum + (p.reward.tokens || 0), 0)
      }
    } as ChallengeArena)
    
    return { ...arena, _id: result.insertedId }
  }

  // Get active arenas
  async getActiveArenas(): Promise<ChallengeArena[]> {
    const db = await getDatabase()
    const arenasCollection = db.collection<ChallengeArena>('challenge_arenas')
    
    const now = new Date()
    return await arenasCollection.find({
      status: 'active',
      startTime: { $lte: now },
      endTime: { $gte: now }
    }).toArray()
  }

  // Join an arena
  async joinArena(
    arenaId: string,
    walletAddress: string,
    username: string
  ): Promise<{ success: boolean; message: string; challengeId?: string }> {
    const db = await getDatabase()
    const arenasCollection = db.collection<ChallengeArena>('challenge_arenas')
    const liveCollection = db.collection<LiveChallenge>('live_challenges')
    
    const arena = await arenasCollection.findOne({ _id: new ObjectId(arenaId) })
    if (!arena) {
      return { success: false, message: 'Arena not found' }
    }
    
    // Check if already participating
    const existing = arena.participants.find(p => p.walletAddress === walletAddress)
    if (existing && existing.completedAt) {
      return { success: false, message: 'Already completed this challenge' }
    }
    
    // Check max attempts
    const attempts = await liveCollection.countDocuments({
      arenaId: new ObjectId(arenaId),
      participantId: walletAddress
    })
    
    if (attempts >= arena.rules.maxAttempts) {
      return { success: false, message: 'Max attempts reached' }
    }
    
    // Create live challenge session
    const liveChallenge: LiveChallenge = {
      arenaId: new ObjectId(arenaId),
      challengeId: arena.challenges[0], // Start with first challenge
      participantId: walletAddress,
      startedAt: new Date(),
      status: 'in_progress',
      currentQuestion: 0,
      answers: [],
      hintsUsed: [],
      score: 0,
      timeRemaining: arena.rules.timeLimit * 60, // Convert to seconds
      streakMultiplier: 1
    }
    
    const result = await liveCollection.insertOne(liveChallenge)
    
    // Add participant if not exists
    if (!existing) {
      await arenasCollection.updateOne(
        { _id: new ObjectId(arenaId) },
        {
          $push: {
            participants: {
              walletAddress,
              username,
              score: 0,
              timeSpent: 0,
              hintsUsed: 0
            }
          },
          $inc: { 'metadata.totalParticipants': 1 }
        }
      )
    }
    
    return { 
      success: true, 
      message: 'Joined arena successfully',
      challengeId: result.insertedId.toString()
    }
  }

  // Submit answer for live challenge
  async submitAnswer(
    liveChallengeId: string,
    answer: any,
    timeSpent: number
  ): Promise<{
    correct: boolean
    score: number
    feedback: string
    nextQuestion?: any
    completed?: boolean
    finalRank?: number
  }> {
    const db = await getDatabase()
    const liveCollection = db.collection<LiveChallenge>('live_challenges')
    const arenasCollection = db.collection<ChallengeArena>('challenge_arenas')
    
    const liveChallenge = await liveCollection.findOne({ 
      _id: new ObjectId(liveChallengeId) 
    })
    
    if (!liveChallenge || liveChallenge.status !== 'in_progress') {
      return { 
        correct: false, 
        score: 0, 
        feedback: 'Challenge not found or already completed' 
      }
    }
    
    const arena = await arenasCollection.findOne({ 
      _id: liveChallenge.arenaId 
    })
    
    if (!arena) {
      return { correct: false, score: 0, feedback: 'Arena not found' }
    }
    
    // Calculate score based on accuracy and speed
    let scoreGained = 0
    const isCorrect = await this.validateAnswer(liveChallenge.challengeId, answer)
    
    if (isCorrect) {
      scoreGained = 100 // Base score
      
      // Apply streak multiplier
      scoreGained *= liveChallenge.streakMultiplier
      
      // Speed bonus
      const timeBonus = Math.max(0, (arena.rules.timeLimit * 60 - timeSpent) / 60) * arena.rules.bonusForSpeed
      scoreGained += timeBonus
      
      // Deduct for hints
      scoreGained -= liveChallenge.hintsUsed.length * arena.rules.penaltyForHints
      
      // Update streak
      await liveCollection.updateOne(
        { _id: new ObjectId(liveChallengeId) },
        {
          $inc: { 
            score: scoreGained,
            streakMultiplier: 0.1 // Increase by 10% for each correct answer
          },
          $push: { answers: answer },
          $set: { timeRemaining: arena.rules.timeLimit * 60 - timeSpent }
        }
      )
    } else {
      // Reset streak on wrong answer
      await liveCollection.updateOne(
        { _id: new ObjectId(liveChallengeId) },
        {
          $set: { streakMultiplier: 1 },
          $push: { answers: answer }
        }
      )
    }
    
    // Check if more questions or completed
    const hasMoreQuestions = liveChallenge.currentQuestion < arena.challenges.length - 1
    
    if (hasMoreQuestions) {
      await liveCollection.updateOne(
        { _id: new ObjectId(liveChallengeId) },
        { $inc: { currentQuestion: 1 } }
      )
      
      return {
        correct: isCorrect,
        score: scoreGained,
        feedback: isCorrect ? 'Correct! Keep going!' : 'Incorrect, but keep trying!',
        nextQuestion: arena.challenges[liveChallenge.currentQuestion + 1]
      }
    } else {
      // Challenge completed
      const finalScore = liveChallenge.score + scoreGained
      
      // No hints bonus
      const noHintsBonus = liveChallenge.hintsUsed.length === 0 ? arena.rules.bonusForNoHints : 0
      const totalScore = finalScore + noHintsBonus
      
      // Update participant score
      await arenasCollection.updateOne(
        { 
          _id: arena._id,
          'participants.walletAddress': liveChallenge.participantId
        },
        {
          $set: {
            'participants.$.score': totalScore,
            'participants.$.timeSpent': timeSpent,
            'participants.$.hintsUsed': liveChallenge.hintsUsed.length,
            'participants.$.completedAt': new Date()
          }
        }
      )
      
      // Mark live challenge as completed
      await liveCollection.updateOne(
        { _id: new ObjectId(liveChallengeId) },
        { $set: { status: 'completed' } }
      )
      
      // Calculate rank
      const updatedArena = await arenasCollection.findOne({ _id: arena._id })
      const sortedParticipants = updatedArena!.participants
        .filter(p => p.completedAt)
        .sort((a, b) => b.score - a.score)
      
      const rank = sortedParticipants.findIndex(p => p.walletAddress === liveChallenge.participantId) + 1
      
      return {
        correct: isCorrect,
        score: totalScore,
        feedback: `Challenge completed! Final score: ${totalScore}`,
        completed: true,
        finalRank: rank
      }
    }
  }

  // Get real-time leaderboard
  async getLeaderboard(
    arenaId: string,
    limit: number = 100
  ): Promise<{
    walletAddress: string
    username: string
    score: number
    timeSpent: number
    rank: number
    percentile: number
  }[]> {
    const db = await getDatabase()
    const arenasCollection = db.collection<ChallengeArena>('challenge_arenas')
    
    const arena = await arenasCollection.findOne({ _id: new ObjectId(arenaId) })
    if (!arena) return []
    
    const sorted = arena.participants
      .filter(p => p.completedAt)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
    
    const total = arena.participants.filter(p => p.completedAt).length
    
    return sorted.map((p, index) => ({
      walletAddress: p.walletAddress,
      username: p.username,
      score: p.score,
      timeSpent: p.timeSpent,
      rank: index + 1,
      percentile: Math.round(((total - index) / total) * 100)
    }))
  }

  // Get season rankings with flexonomics
  async getSeasonRankings(season?: number): Promise<SeasonRanking> {
    const db = await getDatabase()
    const rankingsCollection = db.collection<SeasonRanking>('season_rankings')
    
    const currentSeason = season || this.getCurrentSeason()
    const currentYear = new Date().getFullYear()
    
    let ranking = await rankingsCollection.findOne({ 
      season: currentSeason,
      year: currentYear
    })
    
    if (!ranking) {
      // Create new season ranking
      ranking = {
        season: currentSeason,
        year: currentYear,
        leaderboard: [],
        startDate: this.getSeasonStartDate(currentSeason),
        endDate: this.getSeasonEndDate(currentSeason),
        rewards: {
          distributed: false,
          totalPool: 100000, // Base pool in tokens
          distribution: []
        }
      }
      
      await rankingsCollection.insertOne(ranking)
    }
    
    return ranking
  }

  // Update player stats with flexonomics multipliers
  async updatePlayerStats(
    walletAddress: string,
    username: string,
    challengeScore: number,
    timeSpent: number
  ): Promise<void> {
    const db = await getDatabase()
    const statsCollection = db.collection('player_challenge_stats')
    
    const stats = await statsCollection.findOne({ walletAddress })
    
    // Calculate flex multiplier based on performance
    const flexMultiplier = this.calculateFlexMultiplier(challengeScore, timeSpent, stats)
    const adjustedScore = Math.round(challengeScore * flexMultiplier)
    
    if (stats) {
      await statsCollection.updateOne(
        { walletAddress },
        {
          $inc: {
            totalPoints: adjustedScore,
            challengesCompleted: 1,
            currentStreak: 1
          },
          $set: {
            lastActive: new Date(),
            averageScore: Math.round((stats.totalPoints + adjustedScore) / (stats.challengesCompleted + 1))
          },
          $max: {
            bestScore: adjustedScore,
            longestStreak: stats.currentStreak + 1
          },
          $min: {
            bestTime: timeSpent
          }
        }
      )
    } else {
      await statsCollection.insertOne({
        walletAddress,
        username,
        totalPoints: adjustedScore,
        challengesCompleted: 1,
        averageScore: adjustedScore,
        bestScore: adjustedScore,
        bestTime: timeSpent,
        currentStreak: 1,
        longestStreak: 1,
        tier: 'bronze',
        badges: [],
        lastActive: new Date(),
        createdAt: new Date()
      })
    }
    
    // Update season rankings
    await this.updateSeasonRanking(walletAddress, username, adjustedScore)
  }

  // Flexonomics: Dynamic reward calculation
  private calculateFlexMultiplier(
    score: number,
    timeSpent: number,
    playerStats: any
  ): number {
    let multiplier = 1.0
    
    // Speed bonus (faster = higher multiplier)
    if (timeSpent < 60) multiplier += 0.5 // Under 1 minute
    else if (timeSpent < 180) multiplier += 0.3 // Under 3 minutes
    else if (timeSpent < 300) multiplier += 0.1 // Under 5 minutes
    
    // Perfect score bonus
    if (score >= 1000) multiplier += 0.5
    else if (score >= 750) multiplier += 0.3
    else if (score >= 500) multiplier += 0.1
    
    // Streak bonus
    if (playerStats) {
      if (playerStats.currentStreak >= 10) multiplier += 0.5
      else if (playerStats.currentStreak >= 5) multiplier += 0.3
      else if (playerStats.currentStreak >= 3) multiplier += 0.1
      
      // Consistency bonus (regular player)
      const daysSinceLastActive = playerStats.lastActive 
        ? (Date.now() - new Date(playerStats.lastActive).getTime()) / (1000 * 60 * 60 * 24)
        : 999
      
      if (daysSinceLastActive <= 1) multiplier += 0.2 // Daily player
      else if (daysSinceLastActive <= 3) multiplier += 0.1 // Regular player
    }
    
    // New player bonus (first 10 challenges)
    if (!playerStats || playerStats.challengesCompleted < 10) {
      multiplier += 0.2
    }
    
    return Math.min(multiplier, 3.0) // Cap at 3x
  }

  // Helper methods
  private async validateAnswer(challengeId: ObjectId, answer: any): Promise<boolean> {
    // Implement answer validation logic
    // This would check against the correct answer in the database
    return Math.random() > 0.3 // Placeholder - 70% chance of correct
  }

  private getCurrentSeason(): number {
    const month = new Date().getMonth() + 1
    return Math.ceil(month / 3) // 4 seasons per year
  }

  private getSeasonStartDate(season: number): Date {
    const year = new Date().getFullYear()
    const month = (season - 1) * 3
    return new Date(year, month, 1)
  }

  private getSeasonEndDate(season: number): Date {
    const year = new Date().getFullYear()
    const month = season * 3
    return new Date(year, month, 0, 23, 59, 59)
  }

  private async updateSeasonRanking(
    walletAddress: string,
    username: string,
    points: number
  ): Promise<void> {
    const db = await getDatabase()
    const rankingsCollection = db.collection<SeasonRanking>('season_rankings')
    
    const currentSeason = this.getCurrentSeason()
    const currentYear = new Date().getFullYear()
    
    await rankingsCollection.updateOne(
      { 
        season: currentSeason,
        year: currentYear,
        'leaderboard.walletAddress': walletAddress
      },
      {
        $inc: {
          'leaderboard.$.totalPoints': points,
          'leaderboard.$.challengesCompleted': 1
        }
      }
    )
    
    // If player not in leaderboard, add them
    const updated = await rankingsCollection.findOne({
      season: currentSeason,
      year: currentYear,
      'leaderboard.walletAddress': walletAddress
    })
    
    if (!updated) {
      await rankingsCollection.updateOne(
        { 
          season: currentSeason,
          year: currentYear
        },
        {
          $push: {
            leaderboard: {
              walletAddress,
              username,
              totalPoints: points,
              challengesCompleted: 1,
              averageScore: points,
              bestTime: 0,
              currentStreak: 1,
              rank: 0,
              tier: 'bronze',
              badges: []
            }
          }
        }
      )
    }
    
    // Recalculate ranks
    await this.recalculateRanks(currentSeason, currentYear)
  }

  private async recalculateRanks(season: number, year: number): Promise<void> {
    const db = await getDatabase()
    const rankingsCollection = db.collection<SeasonRanking>('season_rankings')
    
    const ranking = await rankingsCollection.findOne({ season, year })
    if (!ranking) return
    
    // Sort by total points and assign ranks and tiers
    const sorted = ranking.leaderboard.sort((a, b) => b.totalPoints - a.totalPoints)
    const total = sorted.length
    
    sorted.forEach((player, index) => {
      player.rank = index + 1
      
      // Assign tiers based on percentile
      const percentile = ((total - index) / total) * 100
      if (percentile >= 99) player.tier = 'master'
      else if (percentile >= 95) player.tier = 'diamond'
      else if (percentile >= 85) player.tier = 'platinum'
      else if (percentile >= 70) player.tier = 'gold'
      else if (percentile >= 50) player.tier = 'silver'
      else player.tier = 'bronze'
    })
    
    await rankingsCollection.updateOne(
      { season, year },
      { $set: { leaderboard: sorted } }
    )
  }
}