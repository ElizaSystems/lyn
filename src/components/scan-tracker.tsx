'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, Flame, Calendar, TrendingUp, Award, Star, Shield } from 'lucide-react'

interface ScanBadge {
  id: string
  name: string
  description: string
  icon: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  points: number
}

interface ScanStats {
  currentStreak: number
  longestStreak: number
  totalScans: number
  todayScans: number
  badges: ScanBadge[]
  weeklyScans: { date: string; count: number; day: string }[]
  monthlyScans: { date: string; count: number }[]
  lastScanDate?: string
  streakStartDate?: string
}

interface ScanTrackerProps {
  walletAddress?: string
}

export function ScanTracker({ walletAddress }: ScanTrackerProps) {
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [leaderboardType, setLeaderboardType] = useState<'streak' | 'total' | 'badges'>('streak')
  const [showBadges, setShowBadges] = useState(false)

  useEffect(() => {
    if (walletAddress) {
      fetchStats()
      fetchLeaderboard()
    }
  }, [walletAddress])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/scans/tracker')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch scan stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`/api/scans/leaderboard?type=${leaderboardType}`)
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data.leaderboard || [])
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [leaderboardType])

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-400 bg-gray-400/10'
      case 'uncommon': return 'text-green-400 bg-green-400/10'
      case 'rare': return 'text-blue-400 bg-blue-400/10'
      case 'epic': return 'text-purple-400 bg-purple-400/10'
      case 'legendary': return 'text-yellow-400 bg-yellow-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  const getStreakEmoji = (streak: number) => {
    if (streak >= 365) return '🏆'
    if (streak >= 90) return '💎'
    if (streak >= 30) return '👑'
    if (streak >= 14) return '🛡️'
    if (streak >= 7) return '⚔️'
    if (streak >= 3) return '🔥'
    return '✨'
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-sidebar/30 rounded-xl"></div>
        <div className="h-48 bg-sidebar/30 rounded-xl"></div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const maxWeeklyScans = Math.max(...stats.weeklyScans.map(d => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Streak Card */}
      <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{getStreakEmoji(stats.currentStreak)}</div>
            <div>
              <h3 className="text-2xl font-bold text-orange-400">
                {stats.currentStreak} Day Streak
              </h3>
              <p className="text-sm text-muted-foreground">
                Longest: {stats.longestStreak} days
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{stats.todayScans}</p>
            <p className="text-sm text-muted-foreground">Scans Today</p>
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div className="mt-6">
          <p className="text-sm font-medium mb-3">Weekly Activity</p>
          <div className="flex items-end justify-between gap-1 h-20">
            {stats.weeklyScans.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-sidebar/30 rounded relative flex items-end justify-center">
                  <div
                    className={`w-full bg-gradient-to-t from-orange-500 to-yellow-500 rounded transition-all ${
                      day.count > 0 ? 'opacity-100' : 'opacity-20'
                    }`}
                    style={{
                      height: `${(day.count / maxWeeklyScans) * 60}px`,
                      minHeight: day.count > 0 ? '4px' : '0'
                    }}
                  />
                  {day.count > 0 && (
                    <span className="absolute -top-5 text-xs font-medium">
                      {day.count}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{day.day}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold">{stats.totalScans}</p>
          <p className="text-xs text-muted-foreground">Total Scans</p>
        </Card>
        <Card className="p-4 text-center">
          <Award className="w-8 h-8 mx-auto mb-2 text-purple-500" />
          <p className="text-2xl font-bold">{stats.badges.length}</p>
          <p className="text-xs text-muted-foreground">Badges Earned</p>
        </Card>
        <Card className="p-4 text-center">
          <Star className="w-8 h-8 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">
            {stats.badges.reduce((sum, b) => sum + b.points, 0)}
          </p>
          <p className="text-xs text-muted-foreground">Total Points</p>
        </Card>
      </div>

      {/* Badges Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Scan Badges
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBadges(!showBadges)}
          >
            {showBadges ? 'Hide' : 'Show All'}
          </Button>
        </div>

        {showBadges ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats.badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-3 rounded-lg border ${getRarityColor(badge.rarity)}`}
              >
                <div className="text-2xl mb-1">{badge.icon}</div>
                <p className="text-sm font-medium">{badge.name}</p>
                <p className="text-xs opacity-70">{badge.description}</p>
                <p className="text-xs mt-1">+{badge.points} pts</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {stats.badges.slice(0, 8).map((badge) => (
              <div
                key={badge.id}
                className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${getRarityColor(
                  badge.rarity
                )}`}
                title={`${badge.name}: ${badge.description}`}
              >
                {badge.icon}
              </div>
            ))}
            {stats.badges.length > 8 && (
              <div className="w-12 h-12 rounded-lg bg-sidebar/30 flex items-center justify-center text-sm">
                +{stats.badges.length - 8}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Leaderboard */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Leaderboard
          </h3>
          <div className="flex gap-2">
            <Button
              variant={leaderboardType === 'streak' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLeaderboardType('streak')}
            >
              Streaks
            </Button>
            <Button
              variant={leaderboardType === 'total' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLeaderboardType('total')}
            >
              Total
            </Button>
            <Button
              variant={leaderboardType === 'badges' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLeaderboardType('badges')}
            >
              Badges
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {leaderboard.map((user, index) => (
            <div
              key={user.walletAddress}
              className="flex items-center justify-between p-3 rounded-lg bg-sidebar/30"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-400 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  'bg-sidebar text-muted-foreground'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{user.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {leaderboardType === 'streak' && `${user.currentStreak} day streak`}
                    {leaderboardType === 'total' && `${user.totalScans} total scans`}
                    {leaderboardType === 'badges' && `${user.badges} badges`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {leaderboardType === 'streak' && (
                  <span className="text-2xl">{getStreakEmoji(user.currentStreak)}</span>
                )}
                {leaderboardType === 'total' && (
                  <span className="font-bold">{user.totalScans}</span>
                )}
                {leaderboardType === 'badges' && (
                  <div className="flex gap-1">
                    {user.badgeList?.slice(0, 3).map((badge: ScanBadge) => (
                      <span key={badge.id} className="text-lg" title={badge.name}>
                        {badge.icon}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}