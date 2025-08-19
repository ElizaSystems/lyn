'use client'
import { useState, useEffect } from 'react'
import { Shield, MessageCircle, Zap, AlertTriangle, CheckCircle, RefreshCw, FileText, Link, Wallet } from 'lucide-react'
import { SecurityChat } from '@/components/security/security-chat'

interface Scan {
  id: string
  hash: string
  type: 'url' | 'document' | 'wallet' | 'smart_contract' | 'transaction'
  target: string
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'completed' | 'failed'
  result: {
    isSafe: boolean
    threats: string[]
    confidence: number
    details: string
  }
  createdAt: string
}

export default function SecurityPage() {
  const [recentScans, setRecentScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    totalScans: number
    safeScans: number
    threatsDetected: number
  } | null>(null)

  const features = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: "AI-Powered Analysis",
      description: "Advanced threat detection using machine learning algorithms"
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: "Interactive Chat",
      description: "Ask questions and get instant security insights"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Real-time Scanning",
      description: "Continuous monitoring of links, documents, and contracts"
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: "Threat Intelligence",
      description: "Stay informed about the latest security threats and vulnerabilities"
    }
  ]

  // Fetch recent scans
  const fetchRecentScans = async () => {
    try {
      // Get session ID from localStorage (same as security chat uses)
      const sessionId = localStorage.getItem('security-session-id') || 
                       `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      const response = await fetch('/api/security/scans?limit=5', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}`,
          'X-Session-Id': sessionId
        }
      })

      if (response.ok) {
        const data = await response.json()
        setRecentScans(data.scans || [])
        setStats(data.statistics)
      }
    } catch (error) {
      console.error('Failed to fetch recent scans:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentScans()
    // Refresh every 30 seconds
    const interval = setInterval(fetchRecentScans, 30000)
    return () => clearInterval(interval)
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500'
      case 'high':
        return 'text-orange-500'
      case 'medium':
        return 'text-yellow-500'
      case 'low':
        return 'text-blue-500'
      case 'safe':
        return 'text-green-500'
      default:
        return 'text-muted-foreground'
    }
  }

  const getSeverityBadge = (severity: string) => {
    const color = getSeverityColor(severity)
    return (
      <span className={`text-xs font-medium ${color} uppercase`}>
        {severity}
      </span>
    )
  }

  const getResultIcon = (scan: Scan) => {
    if (scan.status === 'pending') {
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
    }
    return scan.result?.isSafe 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <AlertTriangle className="w-4 h-4 text-red-500" />
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Link className="w-3 h-3" />
      case 'document':
        return <FileText className="w-3 h-3" />
      case 'wallet':
      case 'smart_contract':
      case 'transaction':
        return <Wallet className="w-3 h-3" />
      default:
        return <Shield className="w-3 h-3" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
    return date.toLocaleDateString()
  }

  const truncateTarget = (target: string, maxLength: number = 25) => {
    if (target.length <= maxLength) return target
    const start = target.substring(0, 10)
    const end = target.substring(target.length - 10)
    return `${start}...${end}`
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Security Assistant</h1>
            <p className="text-muted-foreground">AI-powered security analysis and threat detection</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chat Interface */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="flex items-center gap-2 mb-6">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Chat with Security AI</h2>
            </div>
            <SecurityChat onScanComplete={fetchRecentScans} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Features */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Key Features</h3>
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Scans */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Scans</h3>
              <button 
                onClick={fetchRecentScans}
                className="p-1 hover:bg-sidebar/30 rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {loading && recentScans.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-14 bg-sidebar/30 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : recentScans.length > 0 ? (
              <div className="space-y-3">
                {recentScans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between p-3 rounded-lg bg-sidebar/30 hover:bg-sidebar/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {getResultIcon(scan)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {getTypeIcon(scan.type)}
                            <span className="text-xs font-medium capitalize">{scan.type.replace('_', ' ')}</span>
                          </div>
                          {getSeverityBadge(scan.severity)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate" title={scan.target}>
                          {truncateTarget(scan.target)}
                        </p>
                        {scan.hash && (
                          <p className="text-xs text-muted-foreground/60">
                            #{scan.hash.substring(0, 8)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatTimeAgo(scan.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Shield className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No scans yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start by analyzing a URL or document
                </p>
              </div>
            )}

            {stats && stats.totalScans > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Scans:</span>
                    <span className="ml-1 font-medium">{stats.totalScans}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Safe:</span>
                    <span className="ml-1 font-medium text-green-500">{stats.safeScans}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Threats:</span>
                    <span className="ml-1 font-medium text-red-500">{stats.threatsDetected}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success Rate:</span>
                    <span className="ml-1 font-medium">
                      {((stats.safeScans / stats.totalScans) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left p-3 rounded-lg bg-sidebar/30 hover:bg-sidebar/50 transition-colors">
                <div className="text-sm font-medium">Scan URL</div>
                <div className="text-xs text-muted-foreground">Check if a link is safe</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg bg-sidebar/30 hover:bg-sidebar/50 transition-colors">
                <div className="text-sm font-medium">Analyze Document</div>
                <div className="text-xs text-muted-foreground">Upload and scan files</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg bg-sidebar/30 hover:bg-sidebar/50 transition-colors">
                <div className="text-sm font-medium">Check Wallet</div>
                <div className="text-xs text-muted-foreground">Verify wallet safety</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}