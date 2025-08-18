'use client'
import { useState, useEffect } from 'react'
import { BarChart3, Users, Globe, Zap, TrendingUp, Server, Shield, Activity, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlatformMetrics {
  network: {
    uptime: string
    responseTime: string
    apiCallsPerDay: string
    successRate: string
  }
  security: {
    threatsDetected: string
    falsePositives: string
    avgScanTime: string
    protectionScore: string
  }
  userEngagement: {
    activeUsers: string
    dailySessions: string
    avgSession: string
    retentionRate: string
  }
  tokenEconomics: {
    marketCap: string
    tokenPrice: string
    holders: string
    volume24h: string
  }
  systemHealth: {
    cpuUsage: number
    memoryUsage: number
    storageUsage: number
    servers: number
    requestsPerSecond: string
    latency: string
    securityGrade: string
  }
  status: {
    operational: boolean
    lastChecked: string
  }
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchMetrics()
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics/platform')
      const data = await response.json()
      setMetrics(data)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch platform metrics:', error)
      setLoading(false)
    }
  }

  const getTrendIcon = (value: string) => {
    // Determine trend based on value changes (simplified)
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (num > 0) return '↑'
    if (num < 0) return '↓'
    return '→'
  }

  const getTrendColor = (value: string) => {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (num > 0) return 'text-green-500'
    if (num < 0) return 'text-red-500'
    return 'text-yellow-500'
  }

  const getLastCheckedTime = () => {
    if (!metrics?.status.lastChecked) return 'Never'
    const diff = Date.now() - new Date(metrics.status.lastChecked).getTime()
    if (diff < 60000) return `${Math.floor(diff / 1000)} seconds ago`
    return `${Math.floor(diff / 60000)} minutes ago`
  }

  const metricsCategories = metrics ? [
    { 
      category: 'Network Performance',
      icon: Globe,
      color: 'text-primary',
      metrics: [
        { label: 'Network Uptime', value: metrics.network.uptime, trend: 'stable' },
        { label: 'Response Time', value: metrics.network.responseTime, trend: 'up' },
        { label: 'API Calls/Day', value: metrics.network.apiCallsPerDay, trend: 'up' },
        { label: 'Success Rate', value: metrics.network.successRate, trend: 'up' },
      ]
    },
    {
      category: 'Security Metrics',
      icon: Shield,
      color: 'text-secondary',
      metrics: [
        { label: 'Threats Detected', value: metrics.security.threatsDetected, trend: 'up' },
        { label: 'False Positives', value: metrics.security.falsePositives, trend: 'down' },
        { label: 'Avg Scan Time', value: metrics.security.avgScanTime, trend: 'down' },
        { label: 'Protection Score', value: metrics.security.protectionScore, trend: 'up' },
      ]
    },
    {
      category: 'User Engagement',
      icon: Users,
      color: 'text-green-500',
      metrics: [
        { label: 'Active Users', value: metrics.userEngagement.activeUsers, trend: 'up' },
        { label: 'Daily Sessions', value: metrics.userEngagement.dailySessions, trend: 'up' },
        { label: 'Avg Session', value: metrics.userEngagement.avgSession, trend: 'up' },
        { label: 'Retention Rate', value: metrics.userEngagement.retentionRate, trend: 'stable' },
      ]
    },
    {
      category: 'Token Economics',
      icon: TrendingUp,
      color: 'text-orange-500',
      metrics: [
        { label: 'Market Cap', value: metrics.tokenEconomics.marketCap, trend: 'up' },
        { label: 'Token Price', value: metrics.tokenEconomics.tokenPrice, trend: 'up' },
        { label: 'Holders', value: metrics.tokenEconomics.holders, trend: 'up' },
        { label: 'Volume 24h', value: metrics.tokenEconomics.volume24h, trend: 'up' },
      ]
    },
  ] : []

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Metrics Dashboard
              {autoRefresh && <span className="badge-pink">Live</span>}
            </h1>
            <p className="text-sm text-muted-foreground">Comprehensive platform performance metrics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={fetchMetrics}
            className="hover:bg-primary/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            className={autoRefresh ? "bg-primary hover:bg-primary/90" : "bg-muted hover:bg-muted/90"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="w-4 h-4 mr-2" />
            {autoRefresh ? 'Live Mode' : 'Manual'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metricsCategories.map((category) => (
              <div key={category.category} className="glass-card p-6 rounded-xl border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center`}>
                    <category.icon className={`w-5 h-5 ${category.color}`} />
                  </div>
                  <h2 className="text-lg font-semibold">{category.category}</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {category.metrics.map((metric) => (
                    <div key={metric.label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold">{metric.value}</p>
                        <span className={`text-sm ${getTrendColor(metric.trend)}`}>
                          {getTrendIcon(metric.trend)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-lg font-semibold mb-4">System Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">CPU Usage</span>
                  <span className="text-sm font-medium">{metrics?.systemHealth.cpuUsage || 0}%</span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${metrics?.systemHealth.cpuUsage || 0}%` }} />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Memory</span>
                  <span className="text-sm font-medium">{metrics?.systemHealth.memoryUsage || 0}%</span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${metrics?.systemHealth.memoryUsage || 0}%` }} />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Storage</span>
                  <span className="text-sm font-medium">{metrics?.systemHealth.storageUsage || 0}%</span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: `${metrics?.systemHealth.storageUsage || 0}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-primary/5">
                <Server className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Servers</p>
                <p className="text-lg font-bold">{metrics?.systemHealth.servers || 0}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/5">
                <Zap className="w-5 h-5 text-secondary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Requests/s</p>
                <p className="text-lg font-bold">{metrics?.systemHealth.requestsPerSecond || '0'}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/5">
                <Activity className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Latency</p>
                <p className="text-lg font-bold">{metrics?.systemHealth.latency || '0ms'}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-500/5">
                <Shield className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Security</p>
                <p className="text-lg font-bold">{metrics?.systemHealth.securityGrade || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {metrics?.status.operational ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-sm font-medium">All Systems Operational</p>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <p className="text-sm font-medium">Partial Outage</p>
                  </>
                )}
                <p className="text-xs text-muted-foreground">Last checked: {getLastCheckedTime()}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="hover:bg-primary/10"
                onClick={() => window.open('https://status.lyn.ai', '_blank')}
              >
                View Status Page
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}