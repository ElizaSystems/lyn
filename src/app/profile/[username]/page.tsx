'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { 
  Shield, 
  Star, 
  Trophy, 
  Calendar, 
  Activity, 
  TrendingUp, 
  Users, 
  Award,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Link,
  FileText,
  Wallet,
  Code
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UserProfile {
  username: string
  walletAddress: string
  registeredAt: string
  accountCreated: string
}

interface ReputationData {
  score: number
  metrics: {
    totalScans: number
    accurateReports: number
    communityContributions: number
    stakingAmount: number
    accountAge: number
    verifiedScans: number
  }
  badges: Array<{
    id: string
    name: string
    description: string
    icon: string
    earnedAt: string
  }>
}

interface Scan {
  id: string
  hash: string
  type: 'url' | 'document' | 'wallet' | 'smart_contract' | 'transaction'
  target: string
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  status: string
  result: {
    isSafe: boolean
    threatsCount: number
    confidence: number
  }
  createdAt: string
  completedAt?: string
}

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reputation, setReputation] = useState<ReputationData | null>(null)
  const [statistics, setStatistics] = useState<{
    totalScans: number
    safeScans: number
    threatsDetected: number
  } | null>(null)
  const [recentScans, setRecentScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [username])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/user/profile/${username}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('User not found')
        } else {
          setError('Failed to load profile')
        }
        return
      }

      const data = await response.json()
      setProfile(data.profile)
      setReputation(data.reputation)
      setStatistics(data.statistics)
      setRecentScans(data.recentScans || [])
    } catch (err) {
      setError('Failed to load profile')
      console.error('Profile fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyProfileUrl = () => {
    const url = `${window.location.origin}/profile/${username}`
    navigator.clipboard.writeText(url)
  }

  const getReputationColor = (score: number) => {
    if (score >= 800) return 'text-purple-500'
    if (score >= 600) return 'text-blue-500'
    if (score >= 400) return 'text-green-500'
    if (score >= 200) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getReputationLabel = (score: number) => {
    if (score >= 800) return 'Elite Guardian'
    if (score >= 600) return 'Expert Analyst'
    if (score >= 400) return 'Security Specialist'
    if (score >= 200) return 'Active Contributor'
    return 'New Member'
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
      case 'url': return <Link className="w-4 h-4" />
      case 'document': return <FileText className="w-4 h-4" />
      case 'wallet': return <Wallet className="w-4 h-4" />
      case 'smart_contract': return <Code className="w-4 h-4" />
      default: return <Shield className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">{error}</h1>
          <p className="text-muted-foreground">The requested profile could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{profile?.username}</h1>
                <p className="text-muted-foreground">
                  {profile?.walletAddress.substring(0, 8)}...{profile?.walletAddress.slice(-8)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Joined {profile?.registeredAt ? new Date(profile.registeredAt).toLocaleDateString() : 'Recently'}
                </p>
              </div>
            </div>
            <Button onClick={copyProfileUrl} variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Share Profile
            </Button>
          </div>

          {/* Reputation Score */}
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getReputationColor(reputation?.score || 0)}`}>
                {reputation?.score || 0}
              </div>
              <div className="text-sm text-muted-foreground">Reputation</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${getReputationColor(reputation?.score || 0)}`}>
                {getReputationLabel(reputation?.score || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Rank</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Stats & Badges */}
          <div className="space-y-6">
            {/* Statistics */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Statistics
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Scans</span>
                  <span className="font-semibold">{statistics?.totalScans || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Safe Scans</span>
                  <span className="font-semibold text-green-500">{statistics?.safeScans || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Threats Found</span>
                  <span className="font-semibold text-red-500">{statistics?.threatsDetected || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Age</span>
                  <span className="font-semibold">{reputation?.metrics.accountAge || 0} days</span>
                </div>
              </div>
            </div>

            {/* Badges Section */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2" />
                Badges
              </h2>
              {reputation?.badges && reputation.badges.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {reputation.badges.map((badge) => (
                    <div key={badge.id} className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-2xl mb-1">{badge.icon}</div>
                      <div className="text-sm font-semibold">{badge.name}</div>
                      <div className="text-xs text-muted-foreground">{badge.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No badges earned yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete scans and contribute to earn badges!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Recent Scans */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Recent Security Scans
              </h2>
              
              {recentScans.length > 0 ? (
                <div className="space-y-3">
                  {recentScans.map((scan) => (
                    <div key={scan.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="mt-1">
                            {getTypeIcon(scan.type)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium truncate max-w-md">
                              {scan.target}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`text-sm ${getSeverityColor(scan.severity)}`}>
                                {scan.severity.toUpperCase()}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">
                                {scan.result.isSafe ? (
                                  <span className="flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Safe
                                  </span>
                                ) : (
                                  <span className="flex items-center">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {scan.result.threatsCount} threat{scan.result.threatsCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">
                                {scan.result.confidence}% confidence
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(scan.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No scans yet</h3>
                  <p className="text-muted-foreground">
                    This user hasn&apos;t performed any security scans yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
