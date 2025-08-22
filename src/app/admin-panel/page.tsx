'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/components/solana/solana-provider'
import { 
  Shield, 
  Users, 
  Activity, 
  Flame, 
  TrendingUp, 
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AdminStats {
  totalUsers: number
  totalUsersWithUsernames: number
  totalBurns: number
  totalBurnAmount: number
  totalScans: number
  totalReferrals: number
  usernameRegistrationRate: number
  recentActivity: {
    users: number
    burns: number
    scans: number
  }
}

interface AdminUser {
  id: string
  walletAddress: string
  username?: string
  tokenBalance: number
  hasTokenAccess: boolean
  createdAt: string
  lastLoginAt: string
  usernameRegisteredAt?: string
  stats: {
    burnCount: number
    burnTotal: number
    scanCount: number
  }
}

interface AdminBurn {
  id: string
  walletAddress: string
  username?: string
  amount: number
  type: string
  description?: string
  transactionSignature: string
  timestamp: string
  verified: boolean
  metadata?: Record<string, unknown>
}

interface AdminScan {
  id: string
  userId: string
  user?: {
    username?: string
    walletAddress?: string
  }
  scanType: string
  target: string
  status: string
  results?: {
    riskLevel: string
    threats: string[]
    score: number
  }
  createdAt: string
  ipAddress?: string
}

export default function AdminPanel() {
  const { connected, publicKey } = useWallet()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'burns' | 'scans'>('overview')
  
  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [burns, setBurns] = useState<AdminBurn[]>([])
  const [scans, setScans] = useState<AdminScan[]>([])
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Check admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (connected && publicKey) {
        try {
          const response = await fetch('/api/admin/simple-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: publicKey.toString() })
          })
          
          if (response.ok) {
            const data = await response.json()
            setIsAdmin(data.isAdmin)
            console.log('[Admin Panel] Admin check result:', data)
          } else {
            setIsAdmin(false)
          }
        } catch (error) {
          console.error('Failed to check admin access:', error)
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
      setLoading(false)
    }
    
    checkAdminAccess()
  }, [connected, publicKey])

  // Fetch admin stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error)
    }
  }

  // Fetch users
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const response = await fetch(`/api/admin/users?search=${searchTerm}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  // Fetch burns
  const fetchBurns = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const response = await fetch('/api/admin/burns?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setBurns(data.burns)
      }
    } catch (error) {
      console.error('Failed to fetch burns:', error)
    }
  }

  // Fetch scans
  const fetchScans = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const response = await fetch('/api/admin/scans?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setScans(data.scans)
      }
    } catch (error) {
      console.error('Failed to fetch scans:', error)
    }
  }

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true)
    await Promise.all([
      fetchStats(),
      activeTab === 'users' ? fetchUsers() : Promise.resolve(),
      activeTab === 'burns' ? fetchBurns() : Promise.resolve(),
      activeTab === 'scans' ? fetchScans() : Promise.resolve()
    ])
    setRefreshing(false)
  }

  // Load initial data
  useEffect(() => {
    if (isAdmin) {
      fetchStats()
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'users') fetchUsers()
      else if (activeTab === 'burns') fetchBurns()
      else if (activeTab === 'scans') fetchScans()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab, searchTerm])

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatWallet = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10'
      case 'high': return 'text-orange-500 bg-orange-500/10'
      case 'medium': return 'text-yellow-500 bg-yellow-500/10'
      case 'low': return 'text-green-500 bg-green-500/10'
      default: return 'text-gray-500 bg-gray-500/10'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground mb-4">Please connect your wallet to access the admin panel.</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            Your wallet ({formatWallet(publicKey?.toString() || '')}) does not have admin privileges.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-muted-foreground">System administration and monitoring</p>
            </div>
          </div>
          <Button onClick={refreshData} disabled={refreshing} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-border">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'burns', label: 'Burns', icon: Flame },
            { id: 'scans', label: 'Scans', icon: Activity }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as 'overview' | 'users' | 'burns' | 'scans')}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-6 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Total Users</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {stats.totalUsersWithUsernames} with usernames ({stats.usernameRegistrationRate.toFixed(1)}%)
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Total Burns</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalBurns.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {stats.totalBurnAmount.toLocaleString()} LYN burned
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Total Scans</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalScans.toLocaleString()}</div>
              </div>

              <div className="glass-card p-6 rounded-xl border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Referrals</span>
                </div>
                <div className="text-2xl font-bold">{stats.totalReferrals.toLocaleString()}</div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-6 rounded-xl border border-border/50">
              <h3 className="text-lg font-semibold mb-4">Recent Activity (24h)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">{stats.recentActivity.users}</div>
                  <div className="text-sm text-muted-foreground">New Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">{stats.recentActivity.burns}</div>
                  <div className="text-sm text-muted-foreground">Burns</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{stats.recentActivity.scans}</div>
                  <div className="text-sm text-muted-foreground">Scans</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by username or wallet..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-sidebar/30">
                    <tr>
                      <th className="text-left p-4 font-medium">User</th>
                      <th className="text-left p-4 font-medium">Balance</th>
                      <th className="text-left p-4 font-medium">Activity</th>
                      <th className="text-left p-4 font-medium">Joined</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-border/50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">
                              {user.username ? `@${user.username}` : 'Anonymous'}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              {formatWallet(user.walletAddress)}
                              <button
                                onClick={() => copyToClipboard(user.walletAddress)}
                                className="text-primary hover:text-primary/80"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <div>{user.tokenBalance.toLocaleString()} LYN</div>
                            <div className={`text-xs ${user.hasTokenAccess ? 'text-green-500' : 'text-red-500'}`}>
                              {user.hasTokenAccess ? 'Access Granted' : 'No Access'}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm space-y-1">
                            <div>{user.stats.burnCount} burns ({user.stats.burnTotal.toLocaleString()} LYN)</div>
                            <div>{user.stats.scanCount} scans</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <div>{formatDate(user.createdAt)}</div>
                            {user.usernameRegisteredAt && (
                              <div className="text-xs text-green-500">
                                Username: {formatDate(user.usernameRegisteredAt)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Button size="sm" variant="outline">
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Burns Tab */}
        {activeTab === 'burns' && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-sidebar/30">
                    <tr>
                      <th className="text-left p-4 font-medium">User</th>
                      <th className="text-left p-4 font-medium">Amount</th>
                      <th className="text-left p-4 font-medium">Type</th>
                      <th className="text-left p-4 font-medium">Transaction</th>
                      <th className="text-left p-4 font-medium">Date</th>
                      <th className="text-left p-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {burns.map((burn) => (
                      <tr key={burn.id} className="border-t border-border/50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">
                              {burn.username ? `@${burn.username}` : 'Anonymous'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatWallet(burn.walletAddress)}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-orange-500">
                            {burn.amount.toLocaleString()} LYN
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <div className="capitalize">{burn.type.replace('_', ' ')}</div>
                            {burn.description && (
                              <div className="text-xs text-muted-foreground">{burn.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-mono flex items-center gap-2">
                            {formatWallet(burn.transactionSignature)}
                            <button
                              onClick={() => copyToClipboard(burn.transactionSignature)}
                              className="text-primary hover:text-primary/80"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">{formatDate(burn.timestamp)}</div>
                        </td>
                        <td className="p-4">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                            burn.verified ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {burn.verified ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {burn.verified ? 'Verified' : 'Pending'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Scans Tab */}
        {activeTab === 'scans' && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-sidebar/30">
                    <tr>
                      <th className="text-left p-4 font-medium">User</th>
                      <th className="text-left p-4 font-medium">Type</th>
                      <th className="text-left p-4 font-medium">Target</th>
                      <th className="text-left p-4 font-medium">Risk Level</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => (
                      <tr key={scan.id} className="border-t border-border/50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">
                              {scan.user?.username ? `@${scan.user.username}` : 'Anonymous'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {scan.user?.walletAddress ? formatWallet(scan.user.walletAddress) : 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="capitalize text-sm">{scan.scanType.replace('_', ' ')}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-mono max-w-xs truncate" title={scan.target}>
                            {scan.target}
                          </div>
                        </td>
                        <td className="p-4">
                          {scan.results && (
                            <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                              getSeverityColor(scan.results.riskLevel)
                            }`}>
                              {scan.results.riskLevel.toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                            scan.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                            scan.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                            'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {scan.status.toUpperCase()}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">{formatDate(scan.createdAt)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}