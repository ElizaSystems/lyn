'use client'
import { BarChart3, Users, Globe, Zap, TrendingUp, Server, Shield, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MetricsPage() {
  const metrics = [
    { 
      category: 'Network Performance',
      icon: Globe,
      color: 'text-primary',
      metrics: [
        { label: 'Network Uptime', value: '99.99%', trend: 'stable' },
        { label: 'Response Time', value: '142ms', trend: 'up' },
        { label: 'API Calls/Day', value: '2.4M', trend: 'up' },
        { label: 'Success Rate', value: '99.7%', trend: 'up' },
      ]
    },
    {
      category: 'Security Metrics',
      icon: Shield,
      color: 'text-secondary',
      metrics: [
        { label: 'Threats Detected', value: '8,924', trend: 'up' },
        { label: 'False Positives', value: '0.3%', trend: 'down' },
        { label: 'Avg Scan Time', value: '1.2s', trend: 'down' },
        { label: 'Protection Score', value: '98/100', trend: 'up' },
      ]
    },
    {
      category: 'User Engagement',
      icon: Users,
      color: 'text-green-500',
      metrics: [
        { label: 'Active Users', value: '3,421', trend: 'up' },
        { label: 'Daily Sessions', value: '12.8K', trend: 'up' },
        { label: 'Avg Session', value: '8m 42s', trend: 'up' },
        { label: 'Retention Rate', value: '87%', trend: 'stable' },
      ]
    },
    {
      category: 'Token Economics',
      icon: TrendingUp,
      color: 'text-orange-500',
      metrics: [
        { label: 'Market Cap', value: '$4.2M', trend: 'up' },
        { label: 'Token Price', value: '$0.042', trend: 'up' },
        { label: 'Holders', value: '8,241', trend: 'up' },
        { label: 'Volume 24h', value: '$892K', trend: 'up' },
      ]
    },
  ]

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '↑'
    if (trend === 'down') return '↓'
    return '→'
  }

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return 'text-green-500'
    if (trend === 'down') return 'text-red-500'
    return 'text-yellow-500'
  }

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Metrics Dashboard</h1>
            <p className="text-sm text-muted-foreground">Comprehensive platform performance metrics</p>
          </div>
        </div>
        
        <Button className="bg-primary hover:bg-primary/90">
          <Activity className="w-4 h-4 mr-2" />
          Live Mode
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((category) => (
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
              <span className="text-sm font-medium">42%</span>
            </div>
            <div className="h-2 bg-card rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: '42%' }} />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Memory</span>
              <span className="text-sm font-medium">68%</span>
            </div>
            <div className="h-2 bg-card rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-secondary to-primary" style={{ width: '68%' }} />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Storage</span>
              <span className="text-sm font-medium">31%</span>
            </div>
            <div className="h-2 bg-card rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: '31%' }} />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-primary/5">
            <Server className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Servers</p>
            <p className="text-lg font-bold">12</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/5">
            <Zap className="w-5 h-5 text-secondary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Requests/s</p>
            <p className="text-lg font-bold">2.8K</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/5">
            <Activity className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Latency</p>
            <p className="text-lg font-bold">42ms</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-orange-500/5">
            <Shield className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Security</p>
            <p className="text-lg font-bold">A+</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-sm font-medium">All Systems Operational</p>
            <p className="text-xs text-muted-foreground">Last checked: 30 seconds ago</p>
          </div>
          <Button variant="ghost" size="sm" className="hover:bg-primary/10">
            View Status Page
          </Button>
        </div>
      </div>
    </div>
  )
}