'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Trophy, Timer, Zap, Users, TrendingUp, Award, AlertCircle, 
  Play, Pause, ChevronRight, Target, Flame, Star, Lock,
  Shield, Brain, Swords, Crown, Medal, Sparkles
} from 'lucide-react'
import { useWallet } from '@/components/solana/solana-provider'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface ArenaChallenge {
  id: string
  name: string
  type: 'daily' | 'weekly' | 'tournament' | 'season'
  status: 'upcoming' | 'active' | 'completed'
  startTime: Date
  endTime: Date
  participants: number
  prizePool: number
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  category: string
  timeLimit: number
  maxAttempts: number
  topScore: number
  averageScore: number
  description: string
  rules: {
    scoringSystem: string
    bonusForSpeed: number
    penaltyForHints: number
  }
}

interface LiveChallengeState {
  challengeId: string
  currentQuestion: number
  totalQuestions: number
  score: number
  timeRemaining: number
  streakMultiplier: number
  hintsUsed: number
  answers: any[]
  status: 'ready' | 'in_progress' | 'completed' | 'reviewing'
}

interface LeaderboardEntry {
  rank: number
  username: string
  walletAddress: string
  score: number
  timeSpent: number
  completedAt: Date
  percentile: number
  tier: string
  badges: string[]
}

export function ChallengeArena() {
  const { connected, publicKey } = useWallet()
  const [activeTab, setActiveTab] = useState<'arena' | 'leaderboard' | 'rewards'>('arena')
  const [selectedArena, setSelectedArena] = useState<ArenaChallenge | null>(null)
  const [liveChallenge, setLiveChallenge] = useState<LiveChallengeState | null>(null)
  const [arenas, setArenas] = useState<ArenaChallenge[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [playerStats, setPlayerStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Fetch active arenas
  useEffect(() => {
    fetchArenas()
    if (connected && publicKey) {
      fetchPlayerStats()
    }
  }, [connected, publicKey])

  // Countdown timer for live challenge
  useEffect(() => {
    if (liveChallenge?.status === 'in_progress' && liveChallenge.timeRemaining > 0) {
      const timer = setInterval(() => {
        setLiveChallenge(prev => {
          if (!prev || prev.timeRemaining <= 0) return prev
          return { ...prev, timeRemaining: prev.timeRemaining - 1 }
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [liveChallenge?.status])

  const fetchArenas = async () => {
    try {
      const response = await fetch('/api/challenges/arenas')
      if (response.ok) {
        const data = await response.json()
        setArenas(data.arenas || [])
      }
    } catch (error) {
      console.error('Failed to fetch arenas:', error)
    }
  }

  const fetchPlayerStats = async () => {
    try {
      const response = await fetch('/api/challenges/player-stats')
      if (response.ok) {
        const data = await response.json()
        setPlayerStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch player stats:', error)
    }
  }

  const fetchLeaderboard = async (arenaId: string) => {
    try {
      const response = await fetch(`/api/challenges/leaderboard?arenaId=${arenaId}`)
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data.leaderboard || [])
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    }
  }

  const joinArena = async (arena: ArenaChallenge) => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet first')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/challenges/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arenaId: arena.id,
          walletAddress: publicKey.toBase58()
        })
      })

      const data = await response.json()
      if (data.success) {
        setSelectedArena(arena)
        setLiveChallenge({
          challengeId: data.challengeId,
          currentQuestion: 0,
          totalQuestions: data.totalQuestions || 5,
          score: 0,
          timeRemaining: arena.timeLimit * 60,
          streakMultiplier: 1,
          hintsUsed: 0,
          answers: [],
          status: 'ready'
        })
        
        // Start countdown
        setCountdown(3)
        setTimeout(() => setCountdown(2), 1000)
        setTimeout(() => setCountdown(1), 2000)
        setTimeout(() => {
          setCountdown(null)
          startChallenge()
        }, 3000)
      } else {
        alert(data.message || 'Failed to join arena')
      }
    } catch (error) {
      console.error('Failed to join arena:', error)
      alert('Failed to join arena')
    } finally {
      setLoading(false)
    }
  }

  const startChallenge = () => {
    setLiveChallenge(prev => prev ? { ...prev, status: 'in_progress' } : null)
  }

  const submitAnswer = async (answer: any) => {
    if (!liveChallenge) return

    setLoading(true)
    try {
      const response = await fetch('/api/challenges/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: liveChallenge.challengeId,
          answer,
          timeSpent: (selectedArena!.timeLimit * 60) - liveChallenge.timeRemaining
        })
      })

      const data = await response.json()
      
      if (data.correct) {
        // Celebrate correct answer
        confetti({
          particleCount: 50,
          angle: 90,
          spread: 45,
          origin: { x: 0.5, y: 0.5 }
        })
        
        setLiveChallenge(prev => prev ? {
          ...prev,
          score: prev.score + data.score,
          streakMultiplier: prev.streakMultiplier + 0.1,
          answers: [...prev.answers, answer]
        } : null)
      } else {
        // Reset streak on wrong answer
        setLiveChallenge(prev => prev ? {
          ...prev,
          streakMultiplier: 1,
          answers: [...prev.answers, answer]
        } : null)
      }

      if (data.completed) {
        // Challenge completed
        setLiveChallenge(prev => prev ? { ...prev, status: 'completed' } : null)
        
        // Big celebration
        confetti({
          particleCount: 200,
          spread: 70,
          origin: { y: 0.6 }
        })
        
        // Fetch updated leaderboard
        if (selectedArena) {
          fetchLeaderboard(selectedArena.id)
        }
      } else if (data.nextQuestion) {
        // Move to next question
        setLiveChallenge(prev => prev ? {
          ...prev,
          currentQuestion: prev.currentQuestion + 1
        } : null)
      }
    } catch (error) {
      console.error('Failed to submit answer:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'master': return 'text-purple-400 bg-purple-400/10'
      case 'diamond': return 'text-cyan-400 bg-cyan-400/10'
      case 'platinum': return 'text-slate-300 bg-slate-300/10'
      case 'gold': return 'text-yellow-400 bg-yellow-400/10'
      case 'silver': return 'text-gray-400 bg-gray-400/10'
      default: return 'text-orange-400 bg-orange-400/10'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'expert': return 'text-red-400 border-red-400/30'
      case 'advanced': return 'text-orange-400 border-orange-400/30'
      case 'intermediate': return 'text-yellow-400 border-yellow-400/30'
      default: return 'text-green-400 border-green-400/30'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      {playerStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Score</p>
                <p className="text-2xl font-bold">{playerStats.totalScore}</p>
              </div>
              <Trophy className="w-8 h-8 text-purple-400" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Rank</p>
                <p className="text-2xl font-bold">#{playerStats.rank || '-'}</p>
              </div>
              <Medal className="w-8 h-8 text-blue-400" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win Streak</p>
                <p className="text-2xl font-bold">{playerStats.currentStreak}</p>
              </div>
              <Flame className="w-8 h-8 text-orange-400" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tier</p>
                <p className="text-2xl font-bold capitalize">{playerStats.tier || 'Bronze'}</p>
              </div>
              <Crown className="w-8 h-8 text-green-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="arena">
            <Swords className="w-4 h-4 mr-2" />
            Battle Arena
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Trophy className="w-4 h-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <Sparkles className="w-4 h-4 mr-2" />
            Rewards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="arena" className="space-y-4">
          {/* Live Challenge View */}
          {liveChallenge && selectedArena && (
            <Card className="p-6 border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="space-y-4">
                {/* Challenge Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{selectedArena.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Question {liveChallenge.currentQuestion + 1} of {liveChallenge.totalQuestions}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-2xl font-mono font-bold">
                      <Timer className="w-6 h-6" />
                      <span className={liveChallenge.timeRemaining < 60 ? 'text-red-400' : ''}>
                        {formatTime(liveChallenge.timeRemaining)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Time Remaining</p>
                  </div>
                </div>

                {/* Score and Streak */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">{liveChallenge.score}</p>
                    <p className="text-sm text-muted-foreground">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-400">
                      {liveChallenge.streakMultiplier.toFixed(1)}x
                    </p>
                    <p className="text-sm text-muted-foreground">Streak Bonus</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-400">{liveChallenge.hintsUsed}</p>
                    <p className="text-sm text-muted-foreground">Hints Used</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <Progress 
                  value={(liveChallenge.currentQuestion / liveChallenge.totalQuestions) * 100} 
                  className="h-2"
                />

                {/* Countdown Overlay */}
                <AnimatePresence>
                  {countdown !== null && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute inset-0 bg-background/90 flex items-center justify-center z-50"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-9xl font-bold text-primary"
                      >
                        {countdown}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Challenge Content */}
                {liveChallenge.status === 'in_progress' && (
                  <div className="space-y-4">
                    {/* Question would be loaded here */}
                    <Card className="p-4 bg-muted/50">
                      <p className="text-lg">Challenge question will appear here...</p>
                    </Card>
                    
                    {/* Answer Options */}
                    <div className="grid grid-cols-2 gap-3">
                      {['Option A', 'Option B', 'Option C', 'Option D'].map((option, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="h-auto p-4 text-left"
                          onClick={() => submitAnswer(option)}
                          disabled={loading}
                        >
                          <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completion Screen */}
                {liveChallenge.status === 'completed' && (
                  <div className="text-center space-y-4">
                    <Trophy className="w-24 h-24 mx-auto text-yellow-400" />
                    <h3 className="text-3xl font-bold">Challenge Complete!</h3>
                    <p className="text-xl">Final Score: {liveChallenge.score}</p>
                    <Button onClick={() => setLiveChallenge(null)}>
                      Back to Arenas
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Arena List */}
          {!liveChallenge && (
            <div className="grid gap-4">
              {arenas.map((arena) => (
                <Card key={arena.id} className="p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold">{arena.name}</h3>
                        <Badge className={getDifficultyColor(arena.difficulty)}>
                          {arena.difficulty}
                        </Badge>
                        <Badge variant="outline">
                          {arena.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{arena.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {arena.participants} players
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="w-4 h-4" />
                          {arena.timeLimit} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          {arena.prizePool} tokens
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Top Score: {arena.topScore}</span>
                        <span>Avg Score: {arena.averageScore}</span>
                        <span>Max Attempts: {arena.maxAttempts}</span>
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      {arena.status === 'active' ? (
                        <Button 
                          onClick={() => joinArena(arena)}
                          disabled={!connected || loading}
                          className="min-w-[120px]"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Enter Arena
                        </Button>
                      ) : arena.status === 'upcoming' ? (
                        <Button variant="outline" disabled>
                          <Lock className="w-4 h-4 mr-2" />
                          Coming Soon
                        </Button>
                      ) : (
                        <Badge variant="secondary">Completed</Badge>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        Ends {new Date(arena.endTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Season Leaderboard</h3>
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.walletAddress}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      entry.rank === 1 ? 'bg-yellow-500 text-black' :
                      entry.rank === 2 ? 'bg-gray-400 text-black' :
                      entry.rank === 3 ? 'bg-orange-600 text-white' :
                      'bg-muted-foreground/20'
                    }`}>
                      {entry.rank}
                    </div>
                    <div>
                      <p className="font-medium">{entry.username}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={getTierColor(entry.tier)} variant="outline">
                          {entry.tier}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Top {entry.percentile}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{entry.score}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(entry.timeSpent)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Season Rewards</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
                  <Crown className="w-12 h-12 text-yellow-400 mb-2" />
                  <h4 className="font-bold">1st Place</h4>
                  <p className="text-2xl font-bold">10,000 LYN</p>
                  <p className="text-sm text-muted-foreground">+ Exclusive NFT</p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-gray-400/10 to-slate-500/10">
                  <Medal className="w-12 h-12 text-gray-400 mb-2" />
                  <h4 className="font-bold">2nd Place</h4>
                  <p className="text-2xl font-bold">5,000 LYN</p>
                  <p className="text-sm text-muted-foreground">+ Rare NFT</p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-orange-600/10 to-amber-600/10">
                  <Award className="w-12 h-12 text-orange-600 mb-2" />
                  <h4 className="font-bold">3rd Place</h4>
                  <p className="text-2xl font-bold">2,500 LYN</p>
                  <p className="text-sm text-muted-foreground">+ Uncommon NFT</p>
                </Card>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Tier Rewards</h4>
                {['Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'].map((tier, i) => (
                  <div key={tier} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge className={getTierColor(tier.toLowerCase())} variant="outline">
                        {tier}
                      </Badge>
                      <span className="text-sm">Top {[1, 5, 15, 30, 50, 100][i]}%</span>
                    </div>
                    <span className="font-bold">{[1000, 500, 250, 100, 50, 25][i]} LYN</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}