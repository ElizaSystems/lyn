'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trophy, Star, Target, TrendingUp, Filter, Eye, Calendar } from 'lucide-react'

import { ReputationDisplay, CompactReputationDisplay, TierProgressBar, ReputationHistory } from '@/components/reputation/reputation-display'
import { BadgeGrid, CategoryBadges, BadgeShowcase, SingleBadgeDisplay } from '@/components/badges/badge-display'

// Mock data interfaces (in real app, these would come from your services)
interface AchievementDashboardProps {
  userId: string
  userData: {
    stats: {
      totalXP: number
      totalReputation: number
      level: number
      achievementsUnlocked: number
      achievementsByCategory: Record<string, number>
      achievementsByTier: Record<string, number>
    }
    reputationTier: {
      tier: string
      minReputation: number
      maxReputation: number
      title: string
      description: string
      color: string
      benefits: string[]
      multiplier: number
    }
    earnedBadges: Array<{
      key: string
      name: string
      description: string
      category: string
      tier: string
      rarity: string
      emoji: string
      earnedAt: Date
      visual: {
        color: string
        borderColor?: string
        glowEffect?: boolean
        animationType?: string
      }
    }>
    badgeProgress: Array<{
      key: string
      name: string
      description: string
      category: string
      tier: string
      rarity: string
      emoji: string
      progress: {
        current: number
        target: number
        percentage: number
      }
      visual: {
        color: string
        borderColor?: string
        glowEffect?: boolean
        animationType?: string
      }
    }>
    nextBadges: Array<{
      key: string
      name: string
      description: string
      category: string
      tier: string
      rarity: string
      emoji: string
      progress: {
        current: number
        target: number
        percentage: number
      }
    }>
    decayStatus?: {
      isActive: boolean
      daysSinceLastActivity: number
      projectedDecay: number
      nextDecayCheck?: Date
    }
  }
  allTiers: Array<{
    tier: string
    minReputation: number
    maxReputation: number
    title: string
    description: string
    color: string
    benefits: string[]
    multiplier: number
  }>
  reputationHistory?: Array<{
    date: Date
    change: number
    reason: string
    newTotal: number
  }>
}

const ACHIEVEMENT_CATEGORIES = {
  security_scanner: { name: 'Security Scanner', emoji: '🛡️', description: 'URL, wallet, contract, and document scanning' },
  cross_chain_explorer: { name: 'Cross-Chain Explorer', emoji: '⛓️', description: 'Multi-chain activity tracking' },
  threat_hunter: { name: 'Threat Hunter', emoji: '🎯', description: 'Threat detection and reporting' },
  community_guardian: { name: 'Community Guardian', emoji: '🛡️', description: 'Community feedback and moderation' },
  burn_master: { name: 'Burn Master', emoji: '🔥', description: 'Token burning verification' },
  achievement_hunter: { name: 'Achievement Hunter', emoji: '🏆', description: 'Meta-achievements' },
  task_automation: { name: 'Task Automation', emoji: '⚙️', description: 'Automated security tasks' },
  notification_expert: { name: 'Notification Expert', emoji: '🔔', description: 'Alert management' },
  payment_pioneer: { name: 'Payment Pioneer', emoji: '💳', description: 'Crypto subscriptions' },
  referral_network: { name: 'Referral Network', emoji: '🌐', description: 'Referral networks' },
  realtime_defender: { name: 'Real-time Defender', emoji: '📡', description: 'Threat monitoring' },
  ai_assistant: { name: 'AI Assistant', emoji: '🤖', description: 'AI interactions' },
  streak_master: { name: 'Streak Master', emoji: '📅', description: 'Activity consistency' },
  veteran: { name: 'Veteran', emoji: '⭐', description: 'Account longevity' },
  special_event: { name: 'Special Events', emoji: '🎉', description: 'Limited-time events' }
}

export function AchievementDashboard({ 
  userId, 
  userData, 
  allTiers, 
  reputationHistory = [] 
}: AchievementDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTier, setSelectedTier] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'progress' | 'tier' | 'name'>('progress')
  const [showEarnedOnly, setShowEarnedOnly] = useState(false)

  // Combine earned badges and progress badges for display
  const allBadges = [
    ...userData.earnedBadges.map(badge => ({
      ...badge,
      isEarned: true,
      progress: undefined
    })),
    ...userData.badgeProgress.map(badge => ({
      ...badge,
      isEarned: false
    }))
  ]

  // Filter badges
  const filteredBadges = allBadges.filter(badge => {
    if (showEarnedOnly && !badge.isEarned) return false
    if (selectedCategory !== 'all' && badge.category !== selectedCategory) return false
    if (selectedTier !== 'all' && badge.tier !== selectedTier) return false
    return true
  })

  const nextTier = allTiers.find(t => t.minReputation > userData.stats.totalReputation)
  const progressToNext = nextTier 
    ? ((userData.stats.totalReputation - userData.reputationTier.minReputation) / 
       (nextTier.minReputation - userData.reputationTier.minReputation)) * 100
    : 0

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with key stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Trophy className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{userData.stats.totalXP.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Experience Points</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CompactReputationDisplay
              currentReputation={userData.stats.totalReputation}
              tier={userData.reputationTier}
              multiplier={userData.reputationTier.multiplier}
              size="md"
              showTooltip={false}
            />
            <div>
              <div className="text-sm text-muted-foreground">Reputation</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-100">
              <Star className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{userData.stats.achievementsUnlocked}</div>
              <div className="text-sm text-muted-foreground">Badges Earned</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100">
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{userData.stats.level}</div>
              <div className="text-sm text-muted-foreground">Level</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="reputation">Reputation</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reputation display */}
            <ReputationDisplay
              currentReputation={userData.stats.totalReputation}
              tier={userData.reputationTier}
              nextTier={nextTier}
              progressToNext={progressToNext}
              multiplier={userData.reputationTier.multiplier}
              decayInfo={userData.decayStatus}
              showDetailed={false}
            />

            {/* Recent achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Recent Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {userData.earnedBadges.slice(0, 8).map((badge) => (
                    <div key={badge.key} className="flex flex-col items-center">
                      <SingleBadgeDisplay 
                        badge={{
                          ...badge,
                          isEarned: true
                        }} 
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
                {userData.earnedBadges.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No badges earned yet. Start by completing security scans!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Next achievable badges */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Next Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {userData.nextBadges.slice(0, 3).map((badge) => (
                  <div key={badge.key} className="flex items-center gap-3 p-3 rounded-md border">
                    <SingleBadgeDisplay 
                      badge={{
                        ...badge,
                        isEarned: false
                      }} 
                      size="sm"
                      showProgress={true}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{badge.name}</div>
                      <div className="text-xs text-muted-foreground mb-1">{badge.description}</div>
                      <div className="text-xs font-medium">
                        {badge.progress.current} / {badge.progress.target}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, category]) => (
                      <SelectItem key={key} value={key}>
                        {category.emoji} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="tier">Tier</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant={showEarnedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowEarnedOnly(!showEarnedOnly)}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {showEarnedOnly ? 'Show All' : 'Earned Only'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Badge grid */}
          <BadgeGrid
            badges={filteredBadges}
            showProgress={true}
            sortBy={sortBy}
          />
        </TabsContent>

        {/* Reputation Tab */}
        <TabsContent value="reputation" className="space-y-6">
          <ReputationDisplay
            currentReputation={userData.stats.totalReputation}
            tier={userData.reputationTier}
            nextTier={nextTier}
            progressToNext={progressToNext}
            multiplier={userData.reputationTier.multiplier}
            decayInfo={userData.decayStatus}
            totalEarned={userData.stats.totalReputation} // In real app, track separately
            showDetailed={true}
          />

          <TierProgressBar
            tiers={allTiers}
            currentReputation={userData.stats.totalReputation}
            currentTier={userData.reputationTier}
          />
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-6">
          {/* Categories overview */}
          <div className="space-y-4">
            {Object.entries(ACHIEVEMENT_CATEGORIES).map(([categoryKey, category]) => {
              const categoryBadges = allBadges.filter(badge => badge.category === categoryKey)
              if (categoryBadges.length === 0) return null

              return (
                <CategoryBadges
                  key={categoryKey}
                  categoryName={category.name}
                  categoryEmoji={category.emoji}
                  categoryDescription={category.description}
                  badges={categoryBadges}
                  showAll={false}
                />
              )
            })}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReputationHistory history={reputationHistory} />
            
            {/* Achievement timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Achievement Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {userData.earnedBadges.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No achievements earned yet.
                    </p>
                  ) : (
                    userData.earnedBadges
                      .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
                      .slice(0, 10)
                      .map((badge, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
                          <SingleBadgeDisplay 
                            badge={{ ...badge, isEarned: true }} 
                            size="sm" 
                            interactive={false}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{badge.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {badge.earnedAt.toLocaleDateString()}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">
                            {badge.tier}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}