'use client'
import { useState, useEffect } from 'react'
import { 
  Flame, 
  TrendingUp, 
  Trophy, 
  Info, 
  ExternalLink, 
  Users, 
  Activity,
  Award,
  Clock,
  Zap,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ShareOnX } from '@/components/share-on-x'
import { getTokenSupply } from '@/lib/solana'

interface BurnRecord {
  id: string
  walletAddress: string
  username?: string
  amount: number
  type: string
  description?: string
  transactionSignature: string
  timestamp: string
  verified: boolean
}

interface LeaderboardEntry {
  rank: number
  walletAddress: string
  username?: string
  totalBurned: number
  burnCount: number
  largestBurn: number
  lastBurnDate: string
  badges?: string[]
}

interface BurnStats {
  totalBurned: number
  totalBurnEvents: number
  uniqueBurners: number
  burnRate: {
    daily: number
    weekly: number
    monthly: number
  }
  topBurners: LeaderboardEntry[]
  recentBurns: BurnRecord[]
  burnsByType: Record<string, number>
}

export default function BurnTrackerPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'recent'>('overview')
  const [stats, setStats] = useState<BurnStats | null>(null)
  const [supplyData, setSupplyData] = useState<{
    total: number
    circulating: number
    burned: number
    burnPercentage: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      setRefreshing(true)
      
      // Fetch burn stats from MongoDB
      const statsResponse = await fetch('/api/burn/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      // Fetch real token supply data
      const supply = await getTokenSupply()
      setSupplyData({
        total: supply.total,
        circulating: supply.circulating,
        burned: supply.burned,
        burnPercentage: supply.burnPercentage || 0
      })
    } catch (error) {
      console.error('Failed to fetch burn data:', error)
      // Set default values
      setSupplyData({
        total: 1000000000,
        circulating: 1000000000,
        burned: 0,
        burnPercentage: 0
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatAmount = (amount: number): string => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
    return amount.toLocaleString()
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)
    
    if (hours < 1) return `${Math.floor(diff / (1000 * 60))} mins ago`
    if (hours < 24) return `${Math.floor(hours)} hours ago`
    if (hours < 168) return `${Math.floor(hours / 24)} days ago`
    return date.toLocaleDateString()
  }

  const openExplorer = (txHash: string) => {
    window.open(`https://solscan.io/tx/${txHash}`, '_blank')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  const totalBurned = stats?.totalBurned || 0
  const totalSupply = supplyData?.total || 1000000000
  const burnPercentage = (totalBurned / totalSupply) * 100

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Burn Tracker
              <span className="badge-pink">Live</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Track LYN burns and compete on the leaderboard
            </p>
          </div>
        </div>
        <Button
          onClick={fetchData}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          {refreshing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
          ) : (
            <Activity className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold">{formatAmount(totalBurned)} LYN</p>
          <p className="text-xs text-muted-foreground">
            {burnPercentage.toFixed(3)}% of supply
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-blue-500" />
            <span className="text-xs text-muted-foreground">Burners</span>
          </div>
          <p className="text-2xl font-bold">{stats?.uniqueBurners || 0}</p>
          <p className="text-xs text-muted-foreground">Unique wallets</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="h-5 w-5 text-green-500" />
            <span className="text-xs text-muted-foreground">Events</span>
          </div>
          <p className="text-2xl font-bold">{stats?.totalBurnEvents || 0}</p>
          <p className="text-xs text-muted-foreground">Total burns</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            <span className="text-xs text-muted-foreground">Rate</span>
          </div>
          <p className="text-2xl font-bold">
            {formatAmount(stats?.burnRate.daily || 0)}
          </p>
          <p className="text-xs text-muted-foreground">Daily average</p>
        </Card>
      </div>

      {/* Burn Visualization */}
      <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10">
        <div className="text-center space-y-4">
          <Flame className="w-16 h-16 mx-auto text-orange-500" />
          <div>
            <p className="text-4xl font-bold">{burnPercentage.toFixed(3)}%</p>
            <p className="text-muted-foreground">of total supply burned</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="w-full bg-background/50 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                style={{ width: `${Math.min(100, burnPercentage)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0%</span>
              <span>{formatAmount(totalBurned)} burned</span>
              <span>100%</span>
            </div>
          </div>
          <ShareOnX
            text={`🔥 ${formatAmount(totalBurned)} $LYN tokens have been burned! That's ${burnPercentage.toFixed(3)}% of total supply! Join the deflationary revolution! 🚀`}
            hashtags={['LYNBurn', 'Deflationary', 'Solana']}
            url="https://app.lynai.xyz/burn"
            variant="outline"
            className="mx-auto"
            successMessage="Flexed the burn stats!"
          />
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'overview' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'leaderboard' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="w-4 h-4 inline mr-2" />
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'recent' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Recent Burns
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Burn Rate Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Burn Rate
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Daily</span>
                  <span className="font-mono">{formatAmount(stats?.burnRate.daily || 0)} LYN</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    style={{ width: '60%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Weekly</span>
                  <span className="font-mono">{formatAmount(stats?.burnRate.weekly || 0)} LYN</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-teal-500 rounded-full"
                    style={{ width: '80%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Monthly</span>
                  <span className="font-mono">{formatAmount(stats?.burnRate.monthly || 0)} LYN</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Burn Types */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Burns by Type
            </h3>
            <div className="space-y-3">
              {Object.entries(stats?.burnsByType || {}).map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {type === 'username_registration' && <User className="w-4 h-4 text-blue-500" />}
                    {type === 'feature_unlock' && <Zap className="w-4 h-4 text-purple-500" />}
                    {type === 'community_event' && <Users className="w-4 h-4 text-green-500" />}
                    {type === 'manual' && <Flame className="w-4 h-4 text-orange-500" />}
                    <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-mono font-bold">{formatAmount(amount)} LYN</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top Burners
          </h3>
          <div className="space-y-2">
            {stats?.topBurners.map((entry) => (
              <div 
                key={entry.walletAddress}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                    entry.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                    entry.rank === 3 ? 'bg-orange-600/20 text-orange-600' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {entry.rank}
                  </div>
                  <div>
                    <div className="font-medium">
                      {entry.username ? `@${entry.username}` : `${entry.walletAddress.slice(0, 8)}...`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {entry.burnCount} burns • Last: {formatDate(entry.lastBurnDate)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{formatAmount(entry.totalBurned)} LYN</div>
                  <div className="flex gap-1 justify-end">
                    {entry.badges?.map((badge, idx) => (
                      <span key={idx} className="text-xs">{badge}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'recent' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Burns
          </h3>
          <div className="space-y-3">
            {stats?.recentBurns.map((burn) => (
              <div 
                key={burn.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => openExplorer(burn.transactionSignature)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {formatAmount(burn.amount)} LYN
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {burn.description}
                    </p>
                    <p className="text-xs text-muted-foreground opacity-70">
                      {burn.username ? `@${burn.username}` : burn.walletAddress.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{formatDate(burn.timestamp)}</p>
                  {burn.verified && (
                    <span className="text-xs text-green-500">✓ Verified</span>
                  )}
                </div>
              </div>
            ))}
            
            {(!stats?.recentBurns || stats.recentBurns.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Flame className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No burns recorded yet</p>
                <p className="text-sm">Burns will appear here as they happen</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Info Box */}
      <Card className="p-4 bg-orange-500/5 border-orange-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">About Token Burns</p>
            <p className="text-xs text-muted-foreground">
              Every burn permanently removes LYN from circulation. Username registrations burn 1,000 LYN, 
              premium features have variable burns, and community events create scheduled burns. 
              All burns are recorded on-chain and tracked here in real-time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}