'use client'
import { useState, useEffect } from 'react'
import { Shield, Activity, Users, TrendingUp, BarChart3, Zap, DollarSign, AlertTriangle, CheckCircle, Clock, RefreshCw, ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SecurityChat } from '@/components/security/security-chat'

interface DashboardMetrics {
  totalScans: number
  threatsBlocked: number
  activeUsers: number
  successRate: number
  dailyScans: number
  weeklyScans: number
  tokenPrice: number
  marketCap: number
  volume24h: number
  totalStakers: number
  activeTasks: number
  recentScans: Array<{
    id: string
    type: string
    severity: string
    target: string
    createdAt: string
    result: {
      isSafe: boolean
    }
  }>
  systemStatus: {
    operational: boolean
    uptime: string
    responseTime: string
  }
}

export function DashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true)
      
      // Fetch platform metrics
      const metricsRes = await fetch('/api/metrics/platform')
      const metricsData = await metricsRes.json()
      
      // Fetch recent scans
      const scansRes = await fetch('/api/security/scans?limit=5', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}`
        }
      })
      const scansData = await scansRes.json()
      
      setMetrics({
        totalScans: metricsData.stats?.totalScans || 0,
        threatsBlocked: parseInt(metricsData.security?.threatsDetected?.replace(/,/g, '') || '0'),
        activeUsers: parseInt(metricsData.userEngagement?.activeUsers?.replace(/,/g, '') || '0'),
        successRate: parseFloat(metricsData.network?.successRate?.replace('%', '') || '100'),
        dailyScans: metricsData.stats?.dailyScans || 0,
        weeklyScans: metricsData.stats?.weeklyScans || 0,
        tokenPrice: parseFloat(metricsData.tokenEconomics?.tokenPrice?.replace('$', '') || '0'),
        marketCap: parseFloat(metricsData.tokenEconomics?.marketCap?.replace(/[$M]/g, '') || '0'),
        volume24h: parseInt(metricsData.tokenEconomics?.volume24h?.replace(/[$K,]/g, '') || '0') * 1000,
        totalStakers: metricsData.stats?.totalStakers || 0,
        activeTasks: metricsData.stats?.activeTasks || 0,
        recentScans: scansData.scans || [],
        systemStatus: {
          operational: metricsData.status?.operational || true,
          uptime: metricsData.network?.uptime || '99.99%',
          responseTime: metricsData.network?.responseTime || '150ms'
        }
      })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500'
      case 'high': return 'text-orange-500'
      case 'medium': return 'text-yellow-500'
      case 'low': return 'text-blue-500'
      case 'safe': return 'text-green-500'
      default: return 'text-muted-foreground'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'url': return '🔗'
      case 'document': return '📄'
      case 'wallet': return '👛'
      case 'smart_contract': return '📝'
      default: return '🛡️'
    }
  }

  if (showChat) {
    return (
      <div className="h-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Security Assistant</h1>
          <Button 
            variant="outline" 
            onClick={() => setShowChat(false)}
            className="border-border/50"
          >
            Back to Dashboard
          </Button>
        </div>
        <SecurityChat initialMessage="" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Real-time platform overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="border-border/50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            onClick={() => setShowChat(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Open Chat
          </Button>
        </div>
      </div>

      {/* System Status */}
      <div className="glass-card p-4 rounded-xl border border-border/50 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {metrics?.systemStatus.operational ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">All Systems Operational</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Partial Outage</span>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              Uptime: {metrics?.systemStatus.uptime} • Response: {metrics?.systemStatus.responseTime}
            </span>
          </div>
          <span className="badge-pink">Live</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Scans</p>
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(metrics?.totalScans || 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Today: {formatNumber(metrics?.dailyScans || 0)}
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Threats Blocked</p>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{formatNumber(metrics?.threatsBlocked || 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Success Rate: {metrics?.successRate || 0}%
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Active Users</p>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(metrics?.activeUsers || 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Stakers: {formatNumber(metrics?.totalStakers || 0)}
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Token Price</p>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">${metrics?.tokenPrice?.toFixed(4) || '0.00'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            MCap: ${metrics?.marketCap || 0}M
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 glass-card p-6 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Security Scans</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/scans'}
              className="hover:bg-primary/10"
            >
              View All
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </div>

          {metrics?.recentScans && metrics.recentScans.length > 0 ? (
            <div className="space-y-3">
              {metrics.recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-3 rounded-lg bg-sidebar/30">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getTypeIcon(scan.type)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {scan.type.replace('_', ' ')}
                        </span>
                        {scan.result?.isSafe ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                        <span className={`text-xs ${getSeverityColor(scan.severity)}`}>
                          {scan.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {scan.target}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(scan.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent scans</p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Platform Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-sm">Weekly Scans</span>
                </div>
                <span className="text-sm font-bold">{formatNumber(metrics?.weeklyScans || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Active Tasks</span>
                </div>
                <span className="text-sm font-bold">{metrics?.activeTasks || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm">24h Volume</span>
                </div>
                <span className="text-sm font-bold">${formatNumber(metrics?.volume24h || 0)}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl border border-primary/30 bg-primary/5">
            <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Button 
                className="w-full justify-start"
                variant="outline"
                onClick={() => window.location.href = '/security'}
              >
                <Shield className="w-4 h-4 mr-2" />
                Security Scanner
              </Button>
              <Button 
                className="w-full justify-start"
                variant="outline"
                onClick={() => window.location.href = '/wallet'}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Check Wallet
              </Button>
              <Button 
                className="w-full justify-start"
                variant="outline"
                onClick={() => window.location.href = '/analytics'}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
