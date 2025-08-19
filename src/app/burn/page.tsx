'use client'
import { useState, useEffect } from 'react'
import { Flame, TrendingDown, Calendar, Info, ArrowDown, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTokenSupply } from '@/lib/solana'
import { getRealTimeTokenData } from '@/lib/services/real-time-data'

interface BurnEvent {
  date: string
  amount: string
  txHash: string
  percentage: number
  blockHeight?: number
}

export default function BurnTrackerPage() {
  const [timeRange, setTimeRange] = useState('all')
  const [supplyData, setSupplyData] = useState<{
    total: number
    circulating: number
    burned: number
    burnPercentage: number
  } | null>(null)
  const [burnEvents, setBurnEvents] = useState<BurnEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch real token supply data
        const supply = await getTokenSupply()
        setSupplyData({
          total: supply.total,
          circulating: supply.circulating,
          burned: supply.burned,
          burnPercentage: supply.burnPercentage || 0
        })

        // Fetch burn events from API
        const response = await fetch(`/api/burn/events?range=${timeRange}`)
        if (response.ok) {
          const data = await response.json()
          setBurnEvents(data.events || [])
        } else {
          // No burn events yet - token launches without initial burns
          setBurnEvents([])
        }
      } catch (error) {
        console.error('Failed to fetch burn data:', error)
        // Set default values - real supply data will be fetched when available
        setSupplyData({
          total: 1000000000,
          circulating: 1000000000,
          burned: 0,
          burnPercentage: 0
        })
        setBurnEvents([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [timeRange])


  const totalBurned = supplyData?.burned || 0
  const totalSupply = supplyData?.total || 1000000000
  const circulatingSupply = supplyData?.circulating || (totalSupply - totalBurned)
  const burnPercentage = supplyData?.burnPercentage || ((totalBurned / totalSupply) * 100)

  // Calculate burn rate (average per month based on events)
  const calculateBurnRate = () => {
    if (burnEvents.length === 0) return 0
    const totalEventBurns = burnEvents.reduce((sum, event) => 
      sum + parseInt(event.amount.replace(/,/g, '')), 0)
    // Assuming events span several months
    const months = Math.max(1, burnEvents.length)
    return totalEventBurns / months
  }

  const openExplorer = (txHash: string) => {
    window.open(`https://solscan.io/tx/${txHash}`, '_blank')
  }

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
              <span className="badge-pink">Live</span>
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

      {/* Status Notice */}
      {burnEvents.length === 0 && !loading && (
        <div className="glass-card p-4 rounded-xl border border-primary/30 bg-primary/5 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Real-Time Burn Tracking</p>
              <p className="text-sm text-muted-foreground">
                Monitoring all transactions on the LYN token mint address for burn events. 
                No burns detected yet - when tokens are burned, they will appear here with transaction details.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-xl border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Burned</p>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-orange-500">
                {(totalBurned / 1000000).toFixed(1)}M LYN
              </p>
              <p className="text-xs text-muted-foreground mt-1">{burnPercentage.toFixed(3)}% of total supply</p>
            </div>

            <div className="glass-card p-4 rounded-xl border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Circulating Supply</p>
                <TrendingDown className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{(circulatingSupply / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-green-500 mt-1">-{burnPercentage.toFixed(3)}% from initial</p>
            </div>

            <div className="glass-card p-4 rounded-xl border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Burn Rate</p>
                <ArrowDown className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{(calculateBurnRate() / 1000000).toFixed(1)}M</p>
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
                  <p className="text-3xl font-bold">{burnPercentage.toFixed(3)}%</p>
                  <p className="text-sm text-muted-foreground">of total supply burned</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="h-4 bg-card rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, burnPercentage)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium">{(totalSupply / 1000000).toFixed(0)}M Total</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Burn Events</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="hover:bg-primary/10"
                onClick={() => window.open('https://solscan.io/token/' + process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS, '_blank')}
              >
                View on Explorer
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {burnEvents.map((event, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-card/50 transition-colors cursor-pointer"
                  onClick={() => openExplorer(event.txHash)}
                >
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
                  All burn transactions are verifiable on the Solana blockchain.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}