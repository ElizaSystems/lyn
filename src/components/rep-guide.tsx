'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Circle, Trophy, User, Twitter, MessageSquare, Shield, Target, Flame, Users, Star, Lock } from 'lucide-react'

interface Achievement {
  id: string
  name: string
  description: string
  points: number
  icon: React.ReactNode
  category: 'account' | 'activity' | 'social' | 'advanced'
  completed?: boolean
}

interface RepGuideProps {
  walletAddress?: string | null
}

export function RepGuide({ walletAddress }: RepGuideProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [currentTier, setCurrentTier] = useState<{
    name: string
    minPoints: number
    maxPoints: number
    color: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const allAchievements: Achievement[] = [
    // Account Setup
    {
      id: 'register_username',
      name: 'Register Username',
      description: 'Burn 1,000 LYN to register your unique username',
      points: 100,
      icon: <User className="w-5 h-5" />,
      category: 'account'
    },
    {
      id: 'connect_x',
      name: 'Connect X Account',
      description: 'Link your X (Twitter) account for 5 free monthly scans',
      points: 50,
      icon: <Twitter className="w-5 h-5" />,
      category: 'account'
    },
    // Activity Based
    {
      id: 'first_scan',
      name: 'First Scan',
      description: 'Complete your first security scan',
      points: 10,
      icon: <Shield className="w-5 h-5" />,
      category: 'activity'
    },
    {
      id: 'scan_streak_3',
      name: '3-Day Streak',
      description: 'Scan for 3 consecutive days',
      points: 25,
      icon: <Flame className="w-5 h-5" />,
      category: 'activity'
    },
    {
      id: 'scan_streak_7',
      name: 'Week Warrior',
      description: 'Maintain a 7-day scan streak',
      points: 50,
      icon: <Flame className="w-5 h-5" />,
      category: 'activity'
    },
    {
      id: 'scan_streak_30',
      name: 'Monthly Master',
      description: 'Achieve a 30-day scan streak',
      points: 200,
      icon: <Flame className="w-5 h-5" />,
      category: 'activity'
    },
    {
      id: 'threat_hunter',
      name: 'Threat Hunter',
      description: 'Detect 10 threats through your scans',
      points: 100,
      icon: <Target className="w-5 h-5" />,
      category: 'activity'
    },
    {
      id: 'scan_100',
      name: 'Century Scanner',
      description: 'Complete 100 total scans',
      points: 150,
      icon: <Shield className="w-5 h-5" />,
      category: 'activity'
    },
    // Social & Community
    {
      id: 'provide_feedback',
      name: 'Feedback Provider',
      description: 'Submit feedback on scan results',
      points: 20,
      icon: <MessageSquare className="w-5 h-5" />,
      category: 'social'
    },
    {
      id: 'referral_1',
      name: 'First Referral',
      description: 'Refer your first user to the platform',
      points: 50,
      icon: <Users className="w-5 h-5" />,
      category: 'social'
    },
    {
      id: 'referral_5',
      name: 'Referral Champion',
      description: 'Successfully refer 5 users',
      points: 200,
      icon: <Users className="w-5 h-5" />,
      category: 'social'
    },
    // Advanced Achievements
    {
      id: 'premium_subscriber',
      name: 'Premium Member',
      description: 'Subscribe to premium features',
      points: 100,
      icon: <Star className="w-5 h-5" />,
      category: 'advanced'
    },
    {
      id: 'stake_tokens',
      name: 'Token Staker',
      description: 'Stake LYN tokens for additional benefits',
      points: 150,
      icon: <Lock className="w-5 h-5" />,
      category: 'advanced'
    }
  ]

  const tiers = [
    { name: 'Novice', minPoints: 0, maxPoints: 99, color: 'text-gray-400' },
    { name: 'Bronze', minPoints: 100, maxPoints: 299, color: 'text-amber-600' },
    { name: 'Silver', minPoints: 300, maxPoints: 599, color: 'text-gray-300' },
    { name: 'Gold', minPoints: 600, maxPoints: 999, color: 'text-yellow-400' },
    { name: 'Platinum', minPoints: 1000, maxPoints: 1999, color: 'text-cyan-300' },
    { name: 'Diamond', minPoints: 2000, maxPoints: 9999, color: 'text-purple-400' },
    { name: 'Master', minPoints: 10000, maxPoints: Infinity, color: 'text-red-500' }
  ]

  useEffect(() => {
    if (walletAddress) {
      fetchUserAchievements()
    } else {
      setAchievements(allAchievements)
      setLoading(false)
    }
  }, [walletAddress])

  const fetchUserAchievements = async () => {
    try {
      // Check if user needs reputation recalculation (for pre-existing accounts)
      const recalcCheckRes = await fetch('/api/user/reputation/recalculate', {
        credentials: 'include'
      })
      
      if (recalcCheckRes.ok) {
        const recalcStatus = await recalcCheckRes.json()
        
        // If recalculation is needed, trigger it
        if (recalcStatus.needsRecalculation) {
          const recalcRes = await fetch('/api/user/reputation/recalculate', {
            method: 'POST',
            credentials: 'include'
          })
          
          if (recalcRes.ok) {
            const recalcResult = await recalcRes.json()
            console.log('Reputation recalculated:', recalcResult)
          }
        }
      }
      
      // Fetch user profile and achievements
      const [profileRes, reputationRes] = await Promise.all([
        fetch('/api/user/profile', {
          credentials: 'include'
        }),
        fetch('/api/user/reputation', {
          credentials: 'include'
        })
      ])

      if (profileRes.ok && reputationRes.ok) {
        const profile = await profileRes.json()
        const reputation = await reputationRes.json()
        
        // Mark completed achievements based on user data
        const updatedAchievements = allAchievements.map(achievement => {
          let completed = false
          
          switch (achievement.id) {
            case 'register_username':
              completed = !!profile.username
              break
            case 'connect_x':
              completed = !!profile.xUsername
              break
            case 'first_scan':
              completed = reputation.stats?.totalScans > 0
              break
            case 'scan_streak_3':
              completed = reputation.stats?.longestStreak >= 3
              break
            case 'scan_streak_7':
              completed = reputation.stats?.longestStreak >= 7
              break
            case 'scan_streak_30':
              completed = reputation.stats?.longestStreak >= 30
              break
            case 'threat_hunter':
              completed = reputation.stats?.threatsDetected >= 10
              break
            case 'scan_100':
              completed = reputation.stats?.totalScans >= 100
              break
            case 'provide_feedback':
              completed = reputation.stats?.feedbackProvided > 0
              break
            case 'referral_1':
              completed = reputation.stats?.referralsCount >= 1
              break
            case 'referral_5':
              completed = reputation.stats?.referralsCount >= 5
              break
            case 'premium_subscriber':
              completed = profile.isPremium === true
              break
            case 'stake_tokens':
              completed = reputation.stats?.stakedAmount > 0
              break
          }
          
          return { ...achievement, completed }
        })
        
        setAchievements(updatedAchievements)
        setTotalPoints(reputation.reputationScore || 0)
        
        // Determine current tier
        const tier = tiers.find(t => 
          reputation.reputationScore >= t.minPoints && 
          reputation.reputationScore <= t.maxPoints
        )
        setCurrentTier(tier || tiers[0])
      } else {
        setAchievements(allAchievements)
      }
    } catch (error) {
      console.error('Failed to fetch achievements:', error)
      setAchievements(allAchievements)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'account': return 'Account Setup'
      case 'activity': return 'Activity & Engagement'
      case 'social': return 'Social & Community'
      case 'advanced': return 'Advanced Achievements'
      default: return category
    }
  }

  const getNextTier = () => {
    if (!currentTier) return tiers[0]
    const currentIndex = tiers.findIndex(t => t.name === currentTier.name)
    return tiers[currentIndex + 1] || null
  }

  const nextTier = getNextTier()
  const progressToNextTier = currentTier && nextTier
    ? ((totalPoints - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100
    : 100

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with current tier and progress */}
      <div className="bg-sidebar/30 rounded-lg p-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Reputation Guide</h2>
            <p className="text-muted-foreground">Earn reputation points by completing achievements</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{totalPoints}</span>
              <span className="text-muted-foreground">points</span>
            </div>
            {currentTier && (
              <div className={`font-semibold ${currentTier.color}`}>
                {currentTier.name} Tier
              </div>
            )}
          </div>
        </div>
        
        {/* Progress to next tier */}
        {nextTier && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress to {nextTier.name}</span>
              <span className="text-muted-foreground">
                {nextTier.minPoints - totalPoints} points needed
              </span>
            </div>
            <div className="h-2 bg-sidebar/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                style={{ width: `${Math.min(progressToNextTier, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tier System Overview */}
      <div className="bg-sidebar/30 rounded-lg p-6 border border-border/50">
        <h3 className="text-lg font-semibold mb-4">Reputation Tiers</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {tiers.map(tier => (
            <div 
              key={tier.name}
              className={`text-center p-3 rounded-lg ${
                currentTier?.name === tier.name 
                  ? 'bg-primary/20 border border-primary/40' 
                  : 'bg-sidebar/30 border border-border/30'
              }`}
            >
              <Trophy className={`w-6 h-6 mx-auto mb-2 ${tier.color}`} />
              <div className={`font-semibold ${tier.color}`}>{tier.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {tier.minPoints}+ pts
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements by Category */}
      {['account', 'activity', 'social', 'advanced'].map(category => {
        const categoryAchievements = achievements.filter(a => a.category === category)
        const completedCount = categoryAchievements.filter(a => a.completed).length
        
        return (
          <div key={category} className="bg-sidebar/30 rounded-lg p-6 border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{getCategoryName(category)}</h3>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{categoryAchievements.length} completed
              </span>
            </div>
            
            <div className="space-y-3">
              {categoryAchievements.map(achievement => (
                <div 
                  key={achievement.id}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                    achievement.completed 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-sidebar/20 border border-border/30'
                  }`}
                >
                  <div className="mt-1">
                    {achievement.completed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {achievement.icon}
                      <span className={`font-medium ${
                        achievement.completed ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {achievement.name}
                      </span>
                      <span className={`text-sm px-2 py-0.5 rounded-full ${
                        achievement.completed 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-sidebar/50 text-muted-foreground'
                      }`}>
                        +{achievement.points} pts
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Tips Section */}
      <div className="bg-sidebar/30 rounded-lg p-6 border border-border/50">
        <h3 className="text-lg font-semibold mb-4">Pro Tips</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Complete account setup achievements first for a quick reputation boost</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Daily scanning builds streaks and earns consistent points</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Referring friends multiplies your earning potential through tier rewards</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Higher reputation tiers unlock exclusive features and benefits</span>
          </div>
        </div>
      </div>
    </div>
  )
}