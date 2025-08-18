'use client'
import { useState, useEffect } from 'react'
import { Shield, Lock, Unlock, TrendingUp, Coins, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function StakingPage() {
  const [stakingAmount, setStakingAmount] = useState('')
  const [selectedPool, setSelectedPool] = useState('gold')
  const [stakingData, setStakingData] = useState<{
    pools?: Array<{
      id: string
      name: string
      apy: string | number
      lockPeriod: string | number
      minStake: string | number
      totalStaked: string | number
      yourStake: string
      available: boolean
    }>
    balance?: { lyn?: number }
    totalValueLocked?: number
    averageApy?: number
    totalRewards?: number
    totalStakers?: number
  } | null>(null)
  const [_loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStakingData()
  }, [])

  const fetchStakingData = async () => {
    try {
      const response = await fetch('/api/staking')
      const data = await response.json()
      setStakingData(data)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch staking data:', error)
      setLoading(false)
    }
  }

  const stakingPools = stakingData?.pools || [
    {
      id: 'flexible',
      name: 'Flexible Staking',
      apy: '12%',
      lockPeriod: 'None',
      minStake: '100 LYN',
      totalStaked: '12.5M LYN',
      yourStake: '0 LYN',
      available: true,
    },
    {
      id: '30days',
      name: '30 Days Locked',
      apy: '18%',
      lockPeriod: '30 days',
      minStake: '500 LYN',
      totalStaked: '25.8M LYN',
      yourStake: '0 LYN',
      available: true,
    },
    {
      id: '90days',
      name: '90 Days Locked',
      apy: '25%',
      lockPeriod: '90 days',
      minStake: '1,000 LYN',
      totalStaked: '42.3M LYN',
      yourStake: '0 LYN',
      available: true,
    },
    {
      id: '180days',
      name: '180 Days Locked',
      apy: '35%',
      lockPeriod: '180 days',
      minStake: '5,000 LYN',
      totalStaked: '18.7M LYN',
      yourStake: '0 LYN',
      available: true,
    },
  ]

  const calculateRewards = (amount: string, apy: string) => {
    const principal = parseFloat(amount) || 0
    const rate = parseFloat(apy) / 100
    const daily = (principal * rate) / 365
    const monthly = (principal * rate) / 12
    const yearly = principal * rate
    
    return {
      daily: daily.toFixed(2),
      monthly: monthly.toFixed(2),
      yearly: yearly.toFixed(2),
    }
  }

  const selectedPoolData = stakingPools.find(pool => pool.id === selectedPool)
  const rewards = calculateRewards(stakingAmount, String(selectedPoolData?.apy || '0'))

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Staking</h1>
            <p className="text-sm text-muted-foreground">Earn rewards by staking your LYN tokens</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Your Balance</p>
          <p className="text-2xl font-bold">{stakingData?.balance?.lyn?.toLocaleString() || '0'} LYN</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Staked</p>
            <Coins className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold">{((stakingData?.totalValueLocked || 99300000) / 1000000).toFixed(1)}M LYN</p>
          <p className="text-xs text-muted-foreground mt-1">Across all pools</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Average APY</p>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-500">{stakingData?.averageApy?.toFixed(1) || '0.75'}%</p>
          <p className="text-xs text-muted-foreground mt-1">Weighted average</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Your Rewards</p>
            <Coins className="w-4 h-4 text-secondary" />
          </div>
          <p className="text-2xl font-bold">{stakingData?.totalRewards?.toLocaleString() || '0'} LYN</p>
          <p className="text-xs text-muted-foreground mt-1">Claimable now</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Stakers</p>
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold">{stakingData?.totalStakers?.toLocaleString() || '2,847'}</p>
          <p className="text-xs text-green-500 mt-1">+124 this week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Staking Pools</h2>
          <div className="space-y-3">
            {stakingPools.map((pool) => (
              <div
                key={pool.id}
                onClick={() => setSelectedPool(pool.id)}
                className={`glass-card p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedPool === pool.id 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-border/50 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      pool.lockPeriod === 'None' 
                        ? 'bg-green-500/20' 
                        : 'bg-primary/20'
                    }`}>
                      {pool.lockPeriod === 'None' ? (
                        <Unlock className="w-5 h-5 text-green-500" />
                      ) : (
                        <Lock className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{pool.name}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Lock: {pool.lockPeriod}</span>
                        <span>•</span>
                        <span>Min: {pool.minStake}</span>
                        <span>•</span>
                        <span>Staked: {pool.totalStaked}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-500">{pool.apy}</p>
                    <p className="text-xs text-muted-foreground">APY</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Stake Calculator</h2>
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Amount to Stake</label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    value={stakingAmount}
                    onChange={(e) => setStakingAmount(e.target.value)}
                    placeholder="0"
                    className="w-full p-3 bg-input border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30"
                  />
                  <span className="absolute right-3 top-3 text-muted-foreground">LYN</span>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-card/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Selected Pool</span>
                  <span className="font-medium">{selectedPoolData?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">APY</span>
                  <span className="font-medium text-green-500">{selectedPoolData?.apy}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Lock Period</span>
                  <span className="font-medium">{selectedPoolData?.lockPeriod}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Estimated Rewards</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Daily</span>
                    <span className="font-medium">{rewards.daily} LYN</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Monthly</span>
                    <span className="font-medium">{rewards.monthly} LYN</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Yearly</span>
                    <span className="font-medium text-green-500">{rewards.yearly} LYN</span>
                  </div>
                </div>
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90">
                Connect Wallet to Stake
              </Button>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Staking Benefits</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Earn passive income on your LYN</li>
                  <li>• Compound rewards automatically</li>
                  <li>• Participate in governance votes</li>
                  <li>• Early access to new features</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}