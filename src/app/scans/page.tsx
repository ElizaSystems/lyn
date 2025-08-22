'use client'
import { useState, useEffect } from 'react'
import { Shield, Search, RefreshCw, AlertTriangle, CheckCircle, Link, FileText, Wallet, Code, TrendingUp, Users, Activity, Globe, Lock, Copy, Star, Trophy, User, ExternalLink, Flame, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWallet } from '@/components/solana/solana-provider'
import { burnTokensWithWallet, isPhantomAvailable } from '@/lib/burn-tokens'

interface Scan {
  id: string
  hash: string
  type: 'url' | 'document' | 'wallet' | 'smart_contract' | 'transaction'
  target: string
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'completed' | 'failed'
  result: {
    isSafe: boolean
    threatsCount: number
    confidence: number
  }
  user?: {
    address: string
    username: string
  }
  metadata?: Record<string, unknown>
  createdAt: string
  completedAt?: string
}

interface ScanStats {
  totalScans: number
  safeScans: number
  threatsDetected: number
  uniqueUsers: number
  last24h: number
}

export default function ScansPage() {
  const { publicKey, connected } = useWallet()
  const [activeTab, setActiveTab] = useState<'profile' | 'personal' | 'public'>('profile') // Default to profile
  const [personalScans, setPersonalScans] = useState<Scan[]>([])
  const [publicScans, setPublicScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [personalStats, setPersonalStats] = useState<{
    totalScans: number
    safeScans: number
    threatsDetected: number
    lastScanDate: Date
    scansByType: Record<string, number>
    scansBySeverity: Record<string, number>
  } | null>(null)
  // const [selectedScan, setSelectedScan] = useState<Scan | null>(null) // For future modal implementation
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  
  // Profile/Username related state
  const [userProfile, setUserProfile] = useState<{
    username?: string
    walletAddress?: string
    id?: string
  } | null>(null)
  const [showUsernameRegistration, setShowUsernameRegistration] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [registering, setRegistering] = useState(false)
  const [registerStep, setRegisterStep] = useState<'idle' | 'burning' | 'registering'>('idle')
  const [tokenBalance, setTokenBalance] = useState<number>(0)

  // Fetch token balance when wallet connects
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connected || !publicKey) {
        setTokenBalance(0)
        return
      }

      try {
        console.log(`[Profile] Fetching balance for connected wallet: ${publicKey.toString()}`)
        const response = await fetch('/api/wallet/balance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ walletAddress: publicKey.toString() })
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('[Profile] Balance data received:', data)
          setTokenBalance(data.token || data.balance || 0)
        } else {
          console.error('[Profile] Balance fetch failed:', response.status)
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error)
      }
    }

    fetchBalance()
  }, [connected, publicKey])

  // Fetch personal scans
  const fetchPersonalScans = async () => {
    try {
      // Get session ID (same as security chat uses)
      const sessionId = localStorage.getItem('security-session-id') || 
                       `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // Save it if not already saved
      if (!localStorage.getItem('security-session-id')) {
        localStorage.setItem('security-session-id', sessionId)
      }
      
      const token = localStorage.getItem('auth-token')

      const response = await fetch('/api/security/scans?limit=20', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Session-Id': sessionId
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPersonalScans(data.scans || [])
        setPersonalStats(data.statistics)
      }
    } catch (error) {
      console.error('Failed to fetch personal scans:', error)
    }
  }

  // Fetch public scans
  const fetchPublicScans = async (resetPage = false) => {
    try {
      setRefreshing(true)
      const currentPage = resetPage ? 1 : page
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        filter: filterType,
        search: searchQuery
      })

      const response = await fetch(`/api/scans/public?${params}`)

      if (response.ok) {
        const data = await response.json()
        setPublicScans(data.scans || [])
        setStats(data.stats)
        setTotalPages(data.pagination?.totalPages || 1)
        if (resetPage) setPage(1)
      }
    } catch (error) {
      console.error('Failed to fetch public scans:', error)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  // Fetch user profile and token balance
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      // Check if user has a username
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUserProfile(userData)
        
        // Fetch token balance
        const balanceResponse = await fetch(`/api/wallet/balance?address=${userData.walletAddress}`)
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json()
          setTokenBalance(balanceData.balance || 0)
        }
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
    }
  }

  // Check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null)
      return
    }

    try {
      const response = await fetch(`/api/user/register-username?username=${encodeURIComponent(username)}`)
      const data = await response.json()
      setUsernameAvailable(data.available)
    } catch (error) {
      console.error('Failed to check username:', error)
      setUsernameAvailable(null)
    }
  }

  // Register username
  const registerUsername = async () => {
    if (!usernameInput || !usernameAvailable) return

    // Check if Phantom wallet is available
    if (!isPhantomAvailable()) {
      alert('Please install Phantom wallet to burn tokens and register your username.')
      return
    }

    setRegistering(true)
    setRegisterStep('burning')
    try {
      // Step 1: Burn tokens
      const burnAmount = 10000 // 10,000 LYN tokens to burn
      const confirmBurn = window.confirm(
        `This will burn ${burnAmount.toLocaleString()} LYN tokens from your wallet.\n\n` +
        `This action is irreversible. The tokens will be permanently destroyed.\n\n` +
        `Do you want to continue?`
      )

      if (!confirmBurn) {
        setRegistering(false)
        setRegisterStep('idle')
        return
      }

      console.log(`[Registration] Starting burn of ${burnAmount} LYN tokens...`)
      let burnSignature: string
      
      try {
        burnSignature = await burnTokensWithWallet(burnAmount)
        console.log(`[Registration] Burn successful! Signature: ${burnSignature}`)
      } catch (burnError) {
        console.error('[Registration] Burn failed:', burnError)
        alert(`Failed to burn tokens: ${(burnError as Error).message}`)
        setRegistering(false)
        setRegisterStep('idle')
        return
      }

      // Step 2: Register username with burn proof
      setRegisterStep('registering')
      const token = localStorage.getItem('auth-token')
      const walletAddress = publicKey?.toString() || userProfile?.walletAddress || ''
      
      console.log(`[Registration] Registering username with burn proof...`)
      const response = await fetch('/api/user/register-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: usernameInput,
          walletAddress,
          signature: burnSignature,
          transaction: burnSignature // Using signature as transaction ID
        })
      })

      if (response.ok) {
        const data = await response.json()
        setUserProfile({ ...userProfile, username: usernameInput })
        setShowUsernameRegistration(false)
        setUsernameInput('')
        alert(
          `✅ Username registered successfully!\n\n` +
          `Username: @${usernameInput}\n` +
          `${burnAmount.toLocaleString()} LYN tokens burned\n` +
          `Transaction: ${burnSignature.slice(0, 8)}...${burnSignature.slice(-8)}\n\n` +
          `Your profile: ${data.profileUrl}`
        )
      } else {
        const error = await response.json()
        alert(`Registration failed: ${error.error}\n\nYour tokens were burned but registration failed. Please contact support with transaction: ${burnSignature}`)
      }
    } catch (error) {
      console.error('Registration error:', error)
      alert('Registration failed. Please try again.')
    } finally {
      setRegistering(false)
      setRegisterStep('idle')
    }
  }

  useEffect(() => {
    fetchPersonalScans()
    fetchPublicScans()
    fetchUserProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'public') {
      fetchPublicScans(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, searchQuery])

  useEffect(() => {
    if (activeTab === 'public') {
      fetchPublicScans()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20'
      case 'high':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
      case 'low':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
      case 'safe':
        return 'text-green-500 bg-green-500/10 border-green-500/20'
      default:
        return 'text-muted-foreground bg-sidebar/30 border-border/50'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Link className="w-4 h-4" />
      case 'document':
        return <FileText className="w-4 h-4" />
      case 'wallet':
        return <Wallet className="w-4 h-4" />
      case 'smart_contract':
        return <Code className="w-4 h-4" />
      case 'transaction':
        return <Activity className="w-4 h-4" />
      default:
        return <Shield className="w-4 h-4" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const truncateTarget = (target: string, maxLength: number = 40) => {
    if (target.length <= maxLength) return target
    return `${target.substring(0, maxLength - 3)}...`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const filteredPersonalScans = personalScans.filter(scan => {
    if (filterType !== 'all' && scan.type !== filterType) return false
    if (filterSeverity !== 'all' && scan.severity !== filterSeverity) return false
    if (searchQuery && !scan.target.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !scan.hash.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">SecScan Dashboard</h1>
            <p className="text-muted-foreground">Real-time security scan monitoring and analysis</p>
          </div>
        </div>

        {/* Global Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="glass-card p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Scans</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalScans.toLocaleString()}</div>
            </div>
            <div className="glass-card p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Safe</span>
              </div>
              <div className="text-2xl font-bold text-green-500">{stats.safeScans.toLocaleString()}</div>
            </div>
            <div className="glass-card p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Threats</span>
              </div>
              <div className="text-2xl font-bold text-red-500">{stats.threatsDetected.toLocaleString()}</div>
            </div>
            <div className="glass-card p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Active Users</span>
              </div>
              <div className="text-2xl font-bold">{stats.uniqueUsers.toLocaleString()}</div>
            </div>
            <div className="glass-card p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Last 24h</span>
              </div>
              <div className="text-2xl font-bold">{stats.last24h.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'profile' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-sidebar/30 hover:bg-sidebar/50 text-muted-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            My Profile
          </div>
        </button>
        <button
          onClick={() => setActiveTab('public')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'public' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-sidebar/30 hover:bg-sidebar/50 text-muted-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Public Feed
          </div>
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'personal' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-sidebar/30 hover:bg-sidebar/50 text-muted-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            My Scans
          </div>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by hash or target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-sidebar/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-sidebar/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Types</option>
            <option value="url">URLs</option>
            <option value="document">Documents</option>
            <option value="wallet">Wallets</option>
            <option value="smart_contract">Smart Contracts</option>
            <option value="transaction">Transactions</option>
          </select>
          {activeTab === 'personal' && (
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-4 py-2 bg-sidebar/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Severities</option>
              <option value="safe">Safe</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          )}
          <button
            onClick={() => activeTab === 'public' ? fetchPublicScans() : fetchPersonalScans()}
            className="px-4 py-2 bg-sidebar/30 border border-border/50 rounded-lg hover:bg-sidebar/50 transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Profile Tab Content */}
      {activeTab === 'profile' && (
        <div className="space-y-6 mb-8">
          {/* Profile Header */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {userProfile?.username || 'Anonymous User'}
                  </h2>
                  <p className="text-muted-foreground">
                    {userProfile?.walletAddress ? 
                      `${userProfile.walletAddress.substring(0, 8)}...${userProfile.walletAddress.slice(-8)}` : 
                      'Not connected'
                    }
                  </p>
                  <div className="flex items-center mt-2 space-x-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">LYN Balance:</span>
                      <span className="ml-1 font-semibold">{tokenBalance.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {!userProfile?.username && (
                <Button
                  onClick={() => setShowUsernameRegistration(true)}
                  disabled={tokenBalance < 100000}
                  className="bg-primary hover:bg-primary/80"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Register Username
                </Button>
              )}
              
              {userProfile?.username && (
                <Button
                  onClick={() => {
                    const profileUrl = `${window.location.origin}/profile/${userProfile.username}`
                    navigator.clipboard.writeText(profileUrl)
                  }}
                  variant="outline"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Share Profile
                </Button>
              )}
            </div>

            {/* Reputation Score */}
            {userProfile?.username && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border/50 pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-500 mb-1">750</div>
                  <div className="text-sm text-muted-foreground">Reputation Score</div>
                  <div className="text-xs text-blue-400">Security Expert</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500 mb-1">{personalStats?.totalScans || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Scans</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-500 mb-1">3</div>
                  <div className="text-sm text-muted-foreground">Badges Earned</div>
                </div>
              </div>
            )}
          </div>

          {/* Username Registration Requirements */}
          {!userProfile?.username && (
            <div className="glass-card p-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-start space-x-3">
                <Trophy className="w-6 h-6 text-yellow-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-500 mb-2">Register Your Username</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Secure your unique username and create a shareable profile. Requirements:
                  </p>
                  <ul className="text-sm space-y-1 mb-4">
                    <li className={`flex items-center space-x-2 ${tokenBalance >= 100000 ? 'text-green-400' : 'text-red-400'}`}>
                      <span>{tokenBalance >= 100000 ? '✓' : '✗'}</span>
                      <span>Hold 100,000+ LYN tokens (Current: {tokenBalance.toLocaleString()})</span>
                    </li>
                    <li className="flex items-center space-x-2 text-muted-foreground">
                      <span>•</span>
                      <span>Pay 10,000 LYN registration fee</span>
                    </li>
                    <li className="flex items-center space-x-2 text-muted-foreground">
                      <span>•</span>
                      <span>Get shareable profile URL</span>
                    </li>
                  </ul>
                  {tokenBalance < 100000 && (
                    <p className="text-sm text-red-400">
                      You need {(100000 - tokenBalance).toLocaleString()} more LYN tokens to register.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Badge Preview Section */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Trophy className="w-5 h-5 mr-2" />
              Achievement Badges
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="text-2xl mb-2">🛡️</div>
                <div className="text-sm font-medium">First Scan</div>
                <div className="text-xs text-muted-foreground">Complete your first security scan</div>
              </div>
              <div className="text-center p-4 bg-gray-800/30 rounded-lg border border-gray-600 opacity-50">
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm font-medium">Threat Hunter</div>
                <div className="text-xs text-muted-foreground">Find 10 security threats</div>
              </div>
              <div className="text-center p-4 bg-gray-800/30 rounded-lg border border-gray-600 opacity-50">
                <div className="text-2xl mb-2">⭐</div>
                <div className="text-sm font-medium">Community Hero</div>
                <div className="text-xs text-muted-foreground">Help 100 community members</div>
              </div>
              <div className="text-center p-4 bg-gray-800/30 rounded-lg border border-gray-600 opacity-50">
                <div className="text-2xl mb-2">👑</div>
                <div className="text-sm font-medium">Elite Guardian</div>
                <div className="text-xs text-muted-foreground">Reach 1000 reputation score</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Username Registration Modal */}
      {showUsernameRegistration && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Register Username</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value)
                    checkUsernameAvailability(e.target.value)
                  }}
                  placeholder="Enter your username"
                  className="mt-1"
                />
                {usernameInput.length >= 3 && (
                  <p className={`text-sm mt-1 ${usernameAvailable === true ? 'text-green-400' : usernameAvailable === false ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {usernameAvailable === true ? '✓ Username available' : 
                     usernameAvailable === false ? '✗ Username taken' : 'Checking...'}
                  </p>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>• 3-20 characters</p>
                <p>• Letters, numbers, underscores, hyphens only</p>
                <p>• Fee: 10,000 LYN tokens (burned permanently)</p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={registerUsername}
                  disabled={!usernameAvailable || registering}
                  className="flex-1"
                >
                  {registering ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {registerStep === 'burning' ? 'Burning Tokens...' : 'Registering...'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Flame className="h-4 w-4" />
                      Register (Burn 10,000 LYN)
                    </span>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowUsernameRegistration(false)
                    setUsernameInput('')
                    setUsernameAvailable(null)
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scans Grid */}
      {activeTab !== 'profile' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-4 rounded-xl border border-border/50 animate-pulse">
              <div className="h-20 bg-sidebar/30 rounded-lg mb-3"></div>
              <div className="h-4 bg-sidebar/30 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-sidebar/30 rounded w-1/2"></div>
            </div>
          ))
        ) : (
          (activeTab === 'public' ? publicScans : filteredPersonalScans).map((scan) => (
            <div
              key={scan.id}
              className="glass-card p-4 rounded-xl border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
              // onClick={() => setSelectedScan(scan)} // For future modal implementation
            >
              {/* Scan Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${scan.result?.isSafe ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {scan.result?.isSafe ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(scan.type)}
                      <span className="text-sm font-medium capitalize">
                        {scan.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(scan.severity)}`}>
                      {scan.severity.toUpperCase()}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(scan.createdAt)}
                </span>
              </div>

              {/* Scan Target */}
              <div className="mb-3">
                <p className="text-sm text-muted-foreground mb-1">Target</p>
                <p className="text-sm font-mono bg-sidebar/30 px-2 py-1 rounded truncate" title={scan.target}>
                  {truncateTarget(scan.target)}
                </p>
              </div>

              {/* Scan Results */}
              {scan.result && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-sidebar/30 px-2 py-1 rounded">
                    <p className="text-xs text-muted-foreground">Threats</p>
                    <p className="text-sm font-medium">{scan.result.threatsCount || 0}</p>
                  </div>
                  <div className="bg-sidebar/30 px-2 py-1 rounded">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-sm font-medium">{scan.result.confidence}%</p>
                  </div>
                </div>
              )}

              {/* Scan Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    #{scan.hash.substring(0, 8)}
                  </div>
                  {scan.user && activeTab === 'public' && (
                    <div className="text-xs text-muted-foreground">
                      by {scan.user.username}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copyToClipboard(scan.hash)
                  }}
                  className="p-1 hover:bg-sidebar/30 rounded transition-colors"
                  title="Copy hash"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
        </div>

        {/* Pagination */}
        {activeTab === 'public' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-sidebar/30 border border-border/50 rounded-lg hover:bg-sidebar/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-sidebar/30 border border-border/50 rounded-lg hover:bg-sidebar/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Personal Stats */}
        {activeTab === 'personal' && personalStats && (
          <div className="mt-8 glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Your Security Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Scans</p>
              <p className="text-2xl font-bold">{personalStats.totalScans}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Safe Results</p>
              <p className="text-2xl font-bold text-green-500">{personalStats.safeScans}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Threats Detected</p>
              <p className="text-2xl font-bold text-red-500">{personalStats.threatsDetected}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
              <p className="text-2xl font-bold">
                {personalStats.totalScans > 0 
                  ? ((personalStats.safeScans / personalStats.totalScans) * 100).toFixed(0)
                  : 0}%
              </p>
            </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && (activeTab === 'public' ? publicScans : filteredPersonalScans).length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No scans found</h3>
            <p className="text-muted-foreground">
              {activeTab === 'public' 
                ? 'No public scans available yet'
                : 'You haven\'t performed any scans yet'}
            </p>
          </div>
        )}
        </>
      )}
    </div>
  )
}