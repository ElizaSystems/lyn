'use client'
import { useState, useEffect } from 'react'
import { useWallet } from '@/components/solana/solana-provider'
import { 
  Trophy, Shield, Star, Zap, Brain, Target, Flag, 
  Lock, CheckCircle, Circle, TrendingUp, Award,
  Flame, Diamond, Crown, Sparkles, Info, Search
} from 'lucide-react'
import { toast } from 'sonner'

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  category: string
  rarity: string
  reputationReward: number
  xpReward: number
  requirements: any[]
}

interface UserProgress {
  earned: string[]
  nextAchievable: Array<{
    badge: Badge
    progress: number
    missingRequirements: string[]
  }>
  metrics: any
  stats: any
}

export default function BadgesPage() {
  const { connected, publicKey } = useWallet()
  const [badges, setBadges] = useState<Badge[]>([])
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedRarity, setSelectedRarity] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showOnlyEarned, setShowOnlyEarned] = useState(false)

  useEffect(() => {
    loadBadges()
  }, [connected, publicKey])

  const loadBadges = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/badges/all')
      const data = await response.json()
      
      if (data.success) {
        setBadges(data.badges)
        if (data.userProgress) {
          setUserProgress(data.userProgress)
        }
      }
    } catch (error) {
      console.error('Error loading badges:', error)
      toast.error('Failed to load badges')
    } finally {
      setLoading(false)
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'border-gray-500 bg-gray-500/10 text-gray-300'
      case 'rare':
        return 'border-blue-500 bg-blue-500/10 text-blue-300'
      case 'epic':
        return 'border-purple-500 bg-purple-500/10 text-purple-300'
      case 'legendary':
        return 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
      case 'mythic':
        return 'border-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-yellow-500/10 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400'
      default:
        return 'border-gray-500 bg-gray-500/10'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security':
        return <Shield className="w-4 h-4" />
      case 'community':
        return <Star className="w-4 h-4" />
      case 'achievement':
        return <Trophy className="w-4 h-4" />
      case 'quiz':
        return <Brain className="w-4 h-4" />
      case 'challenge':
        return <Target className="w-4 h-4" />
      case 'phishing':
        return <Flag className="w-4 h-4" />
      case 'special':
        return <Sparkles className="w-4 h-4" />
      default:
        return <Award className="w-4 h-4" />
    }
  }

  const filteredBadges = badges.filter(badge => {
    if (selectedCategory !== 'all' && badge.category !== selectedCategory) return false
    if (selectedRarity !== 'all' && badge.rarity !== selectedRarity) return false
    if (showOnlyEarned && !userProgress?.earned.includes(badge.id)) return false
    if (searchQuery && !badge.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !badge.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const categories = ['all', 'security', 'community', 'achievement', 'quiz', 'challenge', 'phishing', 'special']
  const rarities = ['all', 'common', 'rare', 'epic', 'legendary', 'mythic']

  const categoryCount = (cat: string) => {
    if (cat === 'all') return badges.length
    return badges.filter(b => b.category === cat).length
  }

  const rarityCount = (rar: string) => {
    if (rar === 'all') return badges.length
    return badges.filter(b => b.rarity === rar).length
  }

  const earnedCount = userProgress?.earned.length || 0
  const totalBadges = badges.length
  const completionPercentage = totalBadges > 0 ? Math.round((earnedCount / totalBadges) * 100) : 0

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Badge Collection</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {earnedCount} of {totalBadges} badges earned ({completionPercentage}%)
                </p>
              </div>
            </div>
            
            {connected && userProgress && (
              <div className="hidden sm:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold">{userProgress.stats?.totalReputation || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Reputation</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{userProgress.stats?.totalXp || 0}</div>
                  <div className="text-xs text-muted-foreground">Total XP</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {connected && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Collection Progress</span>
              <span className="text-sm text-muted-foreground">{earnedCount}/{totalBadges}</span>
            </div>
            <div className="w-full bg-background/50 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            
            {/* Rarity breakdown */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span>Common: {userProgress?.stats?.byRarity?.common || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Rare: {userProgress?.stats?.byRarity?.rare || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span>Epic: {userProgress?.stats?.byRarity?.epic || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Legendary: {userProgress?.stats?.byRarity?.legendary || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                <span>Mythic: {userProgress?.stats?.byRarity?.mythic || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Search and toggle */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search badges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          
          {connected && (
            <button
              onClick={() => setShowOnlyEarned(!showOnlyEarned)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                showOnlyEarned 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              }`}
            >
              {showOnlyEarned ? 'Showing Earned' : 'Show All'}
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg border whitespace-nowrap text-sm transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {cat !== 'all' && getCategoryIcon(cat)}
                {cat.charAt(0).toUpperCase() + cat.slice(1)} ({categoryCount(cat)})
              </span>
            </button>
          ))}
        </div>

        {/* Rarity filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {rarities.map(rar => (
            <button
              key={rar}
              onClick={() => setSelectedRarity(rar)}
              className={`px-3 py-1.5 rounded-lg border whitespace-nowrap text-sm transition-colors ${
                selectedRarity === rar
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              }`}
            >
              {rar.charAt(0).toUpperCase() + rar.slice(1)} ({rarityCount(rar)})
            </button>
          ))}
        </div>
      </div>

      {/* Badges Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-muted/30 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-muted mb-3" />
                <div className="h-4 w-3/4 bg-muted mb-2" />
                <div className="h-3 w-full bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBadges.map(badge => {
              const isEarned = userProgress?.earned.includes(badge.id)
              const nextBadge = userProgress?.nextAchievable?.find(n => n.badge.id === badge.id)
              
              return (
                <div
                  key={badge.id}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    isEarned 
                      ? `${getRarityColor(badge.rarity)} border-opacity-100`
                      : 'border-border/50 bg-muted/20 opacity-75 hover:opacity-100'
                  }`}
                >
                  {/* Earned indicator */}
                  {isEarned && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                  
                  {/* Badge Icon */}
                  <div className="text-4xl mb-3">{badge.icon}</div>
                  
                  {/* Badge Info */}
                  <h3 className="font-semibold text-sm mb-1">{badge.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {badge.description}
                  </p>
                  
                  {/* Rewards */}
                  <div className="flex items-center gap-3 text-xs mb-2">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-500" />
                      {badge.reputationReward} Rep
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      {badge.xpReward} XP
                    </span>
                  </div>
                  
                  {/* Progress bar for next achievable */}
                  {!isEarned && nextBadge && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Progress</span>
                        <span className="text-xs font-medium">{Math.round(nextBadge.progress)}%</span>
                      </div>
                      <div className="w-full bg-background/50 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${nextBadge.progress}%` }}
                        />
                      </div>
                      {nextBadge.missingRequirements[0] && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {nextBadge.missingRequirements[0]}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Locked indicator */}
                  {!isEarned && !nextBadge && (
                    <div className="absolute inset-0 bg-background/50 rounded-xl flex items-center justify-center">
                      <Lock className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        {filteredBadges.length === 0 && !loading && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No badges found</h3>
            <p className="text-muted-foreground">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {connected && userProgress && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-border">
          <h2 className="text-lg font-semibold mb-4">Your Badge Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold">{earnedCount}</div>
              <div className="text-sm text-muted-foreground">Total Earned</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold">{completionPercentage}%</div>
              <div className="text-sm text-muted-foreground">Completion</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold">{userProgress.stats?.totalReputation || 0}</div>
              <div className="text-sm text-muted-foreground">Rep Earned</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold">{userProgress.stats?.totalXp || 0}</div>
              <div className="text-sm text-muted-foreground">XP Earned</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}