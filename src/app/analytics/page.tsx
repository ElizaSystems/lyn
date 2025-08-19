'use client'
import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, Shield, Activity, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d')
  const [metrics, setMetrics] = useState<{
    totalScans: number
    threatsBlocked: number
    activeUsers: number
    successRate: number
    totalScansChange?: string
    threatsChange?: string
    usersChange?: string
    successRateChange?: string
    dailyData?: Array<{ day: string; scans: number; threats: number }>
    threatCategories?: {
      phishing: number
      malware: number
      suspiciousWallets: number
      smartContractExploits: number
    }
    recentEvents?: Array<{
      time: string
      event: string
      severity: string
      details: string
    }>
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analytics/metrics?range=${timeRange}`)
        const data = await response.json()
        setMetrics(data)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
        setLoading(false)
      }
    }
    fetchData()
  }, [timeRange])


  const stats = metrics ? [
    { label: 'Total Scans', value: metrics.totalScans.toLocaleString(), change: metrics.totalScansChange || '+0%', icon: Shield },
    { label: 'Threats Blocked', value: metrics.threatsBlocked.toLocaleString(), change: metrics.threatsChange || '+0%', icon: Activity },
    { label: 'Active Users', value: metrics.activeUsers.toLocaleString(), change: metrics.usersChange || '+0%', icon: Users },
    { label: 'Success Rate', value: `${metrics.successRate}%`, change: metrics.successRateChange || '+0%', icon: TrendingUp },
  ] : []

  const chartData = metrics?.dailyData?.slice(-7).map((d, i: number) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] || d.day,
    scans: d.scans,
    threats: d.threats
  })) || []

  const maxScans = Math.max(...chartData.map(d => d.scans))
  const maxThreats = Math.max(...chartData.map(d => d.threats))

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground">Security performance metrics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/50 p-1">
            {['24h', '7d', '30d', '90d'].map((range) => (
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
          <Button variant="outline" className="border-border/50 hover:bg-primary/10">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-4 rounded-xl border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className={`text-xs mt-1 ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
              {stat.change} from last period
            </p>
          </div>
        ))}
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl border border-border/50">
          <h2 className="text-lg font-semibold mb-4">Daily Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Scans</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-muted-foreground">Threats</span>
              </div>
            </div>
            
            <div className="space-y-3">
              {chartData.map((data) => (
                <div key={data.day} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-10">{data.day}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-6 bg-card rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/80"
                        style={{ width: `${(data.scans / maxScans) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{data.scans}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-6 bg-card rounded-md overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-secondary to-secondary/80"
                        style={{ width: `${(data.threats / maxThreats) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{data.threats}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-border/50">
          <h2 className="text-lg font-semibold mb-4">Threat Categories</h2>
          <div className="space-y-4">
            {(metrics?.threatCategories ? [
              { category: 'Phishing Links', count: metrics.threatCategories.phishing, percentage: Math.round((metrics.threatCategories.phishing / (metrics.threatsBlocked || 1)) * 100) },
              { category: 'Malware Documents', count: metrics.threatCategories.malware, percentage: Math.round((metrics.threatCategories.malware / (metrics.threatsBlocked || 1)) * 100) },
              { category: 'Suspicious Wallets', count: metrics.threatCategories.suspiciousWallets, percentage: Math.round((metrics.threatCategories.suspiciousWallets / (metrics.threatsBlocked || 1)) * 100) },
              { category: 'Smart Contract Exploits', count: metrics.threatCategories.smartContractExploits, percentage: Math.round((metrics.threatCategories.smartContractExploits / (metrics.threatsBlocked || 1)) * 100) },
            ] : [
              { category: 'Phishing Links', count: 0, percentage: 0 },
              { category: 'Malware Documents', count: 0, percentage: 0 },
              { category: 'Suspicious Wallets', count: 0, percentage: 0 },
              { category: 'Smart Contract Exploits', count: 0, percentage: 0 },
            ]).map((item) => (
              <div key={item.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.category}</span>
                  <span className="text-sm text-muted-foreground">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">Detection Accuracy</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">99.7%</p>
                <p className="text-xs text-muted-foreground">False positive rate: 0.3%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-500">+2.1%</p>
                <p className="text-xs text-muted-foreground">vs last month</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Security Events</h2>
          <Button variant="ghost" size="sm" className="hover:bg-primary/10">
            View All
          </Button>
        </div>
        <div className="space-y-3">
          {(metrics?.recentEvents || [
            { time: '2 min ago', event: 'Blocked phishing attempt', severity: 'high', details: 'fake-metamask.com' },
            { time: '15 min ago', event: 'Malicious contract detected', severity: 'critical', details: '0x742d...293f' },
            { time: '1 hour ago', event: 'Suspicious wallet flagged', severity: 'medium', details: '0x8f3a...1b2c' },
            { time: '3 hours ago', event: 'Document scan completed', severity: 'low', details: 'invoice.pdf - Clean' },
          ]).map((event, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-card/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  event.severity === 'critical' ? 'bg-red-500' :
                  event.severity === 'high' ? 'bg-orange-500' :
                  event.severity === 'medium' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`} />
                <div>
                  <p className="text-sm font-medium">{event.event}</p>
                  <p className="text-xs text-muted-foreground">{event.details}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{event.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}