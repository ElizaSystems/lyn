'use client'
import { useState, useEffect } from 'react'
import { 
  Users, 
  Flame, 
  TrendingUp, 
  Copy, 
  CheckCircle, 
  ExternalLink,
  Coins,
  Trophy,
  Gift,
  Share2,
  Activity,
  DollarSign,
  UserPlus,
  Link2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWallet } from '@/components/solana/solana-provider'

interface ReferralDashboard {
  referralCode: string
  referralLink: string
  stats: {
    totalReferrals: number
    activeReferrals: number
    totalBurned: number
    totalRewards: number
    pendingRewards: number
    paidRewards: number
    conversionRate: number
  }
  recentReferrals: Array<{
    username?: string
    walletAddress: string
    joinedAt: string
    burned: number
    rewardsGenerated: number
  }>
  recentRewards: Array<{
    burnAmount: number
    rewardAmount: number
    status: string
    createdAt: string
  }>
}

export default function ReferralPage() {
  const { publicKey, connected } = useWallet()
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!connected || !publicKey) {
        setLoading(false)
        return
      }

      try {
        // First get or create user
        const authResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
          }
        })
        
        let userIdToUse = publicKey.toString()
        if (authResponse.ok) {
          const userData = await authResponse.json()
          userIdToUse = userData.id || userData._id || publicKey.toString()
          setUserId(userIdToUse)
        }

        // Get or create referral code
        const codeResponse = await fetch(`/api/referral/code?userId=${userIdToUse}&walletAddress=${publicKey.toString()}`)
        
        if (!codeResponse.ok) {
          console.error('Failed to get referral code')
          setLoading(false)
          return
        }

        const codeData = await codeResponse.json()
        
        // Get dashboard data
        const dashboardResponse = await fetch(`/api/referral/dashboard?userId=${userIdToUse}`)
        
        if (dashboardResponse.ok) {
          const dashboardData = await dashboardResponse.json()
          setDashboard(dashboardData)
        } else {
          // Create minimal dashboard from code data
          setDashboard({
            referralCode: codeData.code,
            referralLink: codeData.link,
            stats: {
              totalReferrals: codeData.stats?.totalReferrals || 0,
              activeReferrals: 0,
              totalBurned: codeData.stats?.totalBurned || 0,
              totalRewards: codeData.stats?.totalRewards || 0,
              pendingRewards: 0,
              paidRewards: 0,
              conversionRate: 0
            },
            recentReferrals: [],
            recentRewards: []
          })
        }
      } catch (error) {
        console.error('Failed to fetch referral dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [connected, publicKey])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareOnTwitter = () => {
    const text = `Join @LynAI using my referral code ${dashboard?.referralCode} and we both earn rewards! 🔥\n\nEvery burn = 20% rewards for referrers\n\n${dashboard?.referralLink}`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  if (!connected) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center py-20">
          <Gift className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold mb-2">Referral Program</h1>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to access your referral dashboard
          </p>
          <Button size="lg">Connect Wallet</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Referral Program</h1>
            <p className="text-sm text-muted-foreground">
              Earn 20% of all LYN burned by your referrals
            </p>
          </div>
        </div>
      </div>

      {/* Referral Link Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Your Referral Link</h2>
            <p className="text-sm text-muted-foreground">
              Share this link to earn rewards from referrals
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(dashboard?.referralLink || '')}
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button
              size="sm"
              onClick={shareOnTwitter}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share on X
            </Button>
          </div>
        </div>
        
        <div className="bg-background/50 rounded-lg p-3 font-mono text-sm break-all">
          {dashboard?.referralLink}
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Referral Code:</span>
            <span className="font-bold text-primary">{dashboard?.referralCode}</span>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold">{dashboard?.stats.totalReferrals || 0}</p>
          <p className="text-xs text-muted-foreground">Referrals</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="h-5 w-5 text-green-500" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <p className="text-2xl font-bold">{dashboard?.stats.activeReferrals || 0}</p>
          <p className="text-xs text-muted-foreground">
            {dashboard?.stats.conversionRate?.toFixed(1)}% conversion
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-xs text-muted-foreground">Burned</span>
          </div>
          <p className="text-2xl font-bold">
            {(dashboard?.stats.totalBurned || 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">LYN burned</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Earned</span>
          </div>
          <p className="text-2xl font-bold">
            {(dashboard?.stats.totalRewards || 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">LYN rewards (20%)</p>
        </Card>
      </div>

      {/* Rewards Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Rewards Breakdown
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">Pending Rewards</span>
              <span className="font-bold text-yellow-500">
                {(dashboard?.stats.pendingRewards || 0).toLocaleString()} LYN
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">Paid Rewards</span>
              <span className="font-bold text-green-500">
                {(dashboard?.stats.paidRewards || 0).toLocaleString()} LYN
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">Total Earned</span>
              <span className="font-bold text-primary">
                {(dashboard?.stats.totalRewards || 0).toLocaleString()} LYN
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            How It Works
          </h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">1</span>
              </div>
              <div>
                <p className="font-medium">Share Your Link</p>
                <p className="text-sm text-muted-foreground">
                  Send your referral link to friends
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">2</span>
              </div>
              <div>
                <p className="font-medium">They Register & Burn</p>
                <p className="text-sm text-muted-foreground">
                  Referrals burn LYN for usernames & features
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">3</span>
              </div>
              <div>
                <p className="font-medium">Earn 20% Rewards</p>
                <p className="text-sm text-muted-foreground">
                  Get 20% of all LYN they burn forever
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Referrals */}
      {dashboard?.recentReferrals && dashboard.recentReferrals.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recent Referrals
          </h3>
          <div className="space-y-2">
            {dashboard.recentReferrals.map((referral, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {referral.username ? `@${referral.username}` : referral.walletAddress.slice(0, 8) + '...'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(referral.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{referral.burned.toLocaleString()} LYN</p>
                  <p className="text-xs text-green-500">
                    +{referral.rewardsGenerated.toLocaleString()} earned
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info Box */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Maximize Your Earnings</p>
            <p className="text-sm text-muted-foreground">
              Share your referral link on social media, in Discord servers, and with friends. 
              Every burn from your referrals earns you 20% rewards forever. The more active 
              users you refer, the more you earn!
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Add missing import
import { User, Info } from 'lucide-react'