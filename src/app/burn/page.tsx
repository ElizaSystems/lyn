'use client'
import { useState } from 'react'
import { Flame, TrendingDown, Calendar, Info, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BurnTrackerPage() {
  const [timeRange, setTimeRange] = useState('all')

  const burnEvents = [
    { date: '2024-12-15', amount: '1,000,000', txHash: '0xabc...123', percentage: 0.1 },
    { date: '2024-12-01', amount: '2,500,000', txHash: '0xdef...456', percentage: 0.25 },
    { date: '2024-11-15', amount: '1,750,000', txHash: '0xghi...789', percentage: 0.175 },
    { date: '2024-11-01', amount: '3,000,000', txHash: '0xjkl...012', percentage: 0.3 },
    { date: '2024-10-15', amount: '2,000,000', txHash: '0xmno...345', percentage: 0.2 },
  ]

  const totalBurned = burnEvents.reduce((sum, event) => sum + parseInt(event.amount.replace(/,/g, '')), 0)
  const totalSupply = 1000000000 // 1 billion
  const circulatingSupply = totalSupply - totalBurned
  const burnPercentage = ((totalBurned / totalSupply) * 100).toFixed(3)

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Burn Tracker
              <span className="badge-pink">New</span>
            </h1>
            <p className="text-sm text-muted-foreground">Track LYN token burns and deflationary metrics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/50 p-1">
            {['24h', '7d', '30d', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  timeRange === range 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Burned</p>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-500">
            {(totalBurned / 1000000).toFixed(1)}M LYN
          </p>
          <p className="text-xs text-muted-foreground mt-1">{burnPercentage}% of total supply</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Circulating Supply</p>
            <TrendingDown className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{(circulatingSupply / 1000000).toFixed(1)}M</p>
          <p className="text-xs text-green-500 mt-1">-{burnPercentage}% from initial</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Burn Rate</p>
            <ArrowDown className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold">2.5M</p>
          <p className="text-xs text-muted-foreground mt-1">per month average</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Next Burn</p>
            <Calendar className="w-4 h-4 text-secondary" />
          </div>
          <p className="text-2xl font-bold">15 days</p>
          <p className="text-xs text-muted-foreground mt-1">Scheduled burn event</p>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl border border-border/50">
        <h2 className="text-lg font-semibold mb-4">Burn Visualization</h2>
        <div className="space-y-4">
          <div className="h-32 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Flame className="w-12 h-12 text-orange-500 mx-auto mb-2 animate-pulse" />
              <p className="text-3xl font-bold">{burnPercentage}%</p>
              <p className="text-sm text-muted-foreground">of total supply burned</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="h-4 bg-card rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                  style={{ width: `${burnPercentage}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-medium">{totalSupply / 1000000}M Total</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Burn Events</h2>
          <Button variant="ghost" size="sm" className="hover:bg-primary/10">
            View All
          </Button>
        </div>
        
        <div className="space-y-3">
          {burnEvents.map((event, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-card/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-medium">{event.amount} LYN</p>
                  <p className="text-xs text-muted-foreground">Transaction: {event.txHash}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{event.date}</p>
                <p className="text-xs text-orange-500">{event.percentage}% of supply</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl border border-orange-500/30 bg-orange-500/5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-orange-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">About Token Burns</p>
            <p className="text-xs text-muted-foreground">
              Token burns permanently remove LYN from circulation, creating deflationary pressure. 
              Burns occur monthly through automated smart contracts and special events. 
              This mechanism helps increase scarcity and potentially supports token value over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}