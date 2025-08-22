'use client'
import { useState, useEffect } from 'react'
import { 
  Shield, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  Flag,
  TrendingUp,
  Users,
  Clock,
  Activity,
  Zap,
  Copy,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface WalletAnalysis {
  walletAddress: string
  analysis: {
    riskLevel: string
    riskScore: number
    isBlacklisted: boolean
    overallSafety: boolean
  }
  reputation: {
    score: number
    communityReports: number
    verifiedReports: number
    trustLevel: string
  }
  threats: string[]
  flags: Array<{
    type: string
    severity: string
    description: string
    confidence: number
  }>
  details: {
    accountAge: number
    transactionCount: number
    averageTransactionValue: number
    uniqueInteractions: number
  }
  recommendations: string[]
  timestamp: string
}

interface WalletReport {
  reportType: 'scam' | 'phishing' | 'rugpull' | 'impersonation' | 'bot' | 'other'
  description: string
  evidence?: {
    transactionHashes?: string[]
    screenshots?: string[]
    additionalInfo?: string
  }
}

export default function WalletSecurityPage() {
  const [searchAddress, setSearchAddress] = useState('')
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportData, setReportData] = useState<WalletReport>({
    reportType: 'scam',
    description: '',
    evidence: { transactionHashes: [], additionalInfo: '' }
  })

  const analyzeWallet = async (address: string) => {
    if (!address.trim()) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/security/analyze-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address.trim() })
      })
      
      if (response.ok) {
        const data = await response.json()
        setAnalysis(data)
      } else {
        const error = await response.json()
        alert(`Analysis failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Wallet analysis error:', error)
      alert('Failed to analyze wallet')
    } finally {
      setLoading(false)
    }
  }

  const submitReport = async () => {
    if (!analysis || !reportData.description.trim()) return
    
    try {
      const response = await fetch('/api/security/report-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: analysis.walletAddress,
          ...reportData
        })
      })
      
      if (response.ok) {
        alert('Report submitted successfully!')
        setShowReportModal(false)
        setReportData({
          reportType: 'scam',
          description: '',
          evidence: { transactionHashes: [], additionalInfo: '' }
        })
      } else {
        const error = await response.json()
        alert(`Report failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Report submission error:', error)
      alert('Failed to submit report')
    }
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'very-low': return 'text-green-500 bg-green-500/10 border-green-500/20'
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20'
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20'
      default: return 'text-muted-foreground bg-muted/10 border-border/20'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-orange-500'
      case 'critical': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
          <Shield className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Wallet Security Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Analyze Solana wallets for scams, suspicious activity, and security risks
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="glass-card p-6 rounded-xl border border-border/50">
        <h2 className="text-lg font-semibold mb-4">Analyze Wallet Address</h2>
        <div className="flex gap-3">
          <Input
            placeholder="Enter Solana wallet address..."
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && analyzeWallet(searchAddress)}
          />
          <Button 
            onClick={() => analyzeWallet(searchAddress)}
            disabled={loading || !searchAddress.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Analyze
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Enter any Solana wallet address to check for security risks, scammer reports, and reputation
        </p>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Risk Overview */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Security Analysis</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">Address:</span>
                  <code className="text-sm bg-muted/50 px-2 py-1 rounded">
                    {analysis.walletAddress.slice(0, 8)}...{analysis.walletAddress.slice(-8)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(analysis.walletAddress)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportModal(true)}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://solscan.io/account/${analysis.walletAddress}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Explorer
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Risk Level */}
              <div className="text-center">
                <div className={`inline-flex items-center px-4 py-2 rounded-full border ${getRiskColor(analysis.analysis.riskLevel)}`}>
                  {analysis.analysis.isBlacklisted ? (
                    <XCircle className="w-4 h-4 mr-2" />
                  ) : analysis.analysis.overallSafety ? (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 mr-2" />
                  )}
                  <span className="font-medium capitalize">{analysis.analysis.riskLevel.replace('-', ' ')}</span>
                </div>
                <div className="text-2xl font-bold mt-2">{analysis.analysis.riskScore}/100</div>
                <div className="text-sm text-muted-foreground">Risk Score</div>
              </div>

              {/* Reputation */}
              <div className="text-center">
                <div className="text-2xl font-bold">{analysis.reputation.score}</div>
                <div className="text-sm text-muted-foreground">Reputation Score</div>
                <div className={`text-xs mt-1 ${
                  analysis.reputation.trustLevel === 'high' ? 'text-green-500' :
                  analysis.reputation.trustLevel === 'medium' ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  {analysis.reputation.trustLevel.toUpperCase()} TRUST
                </div>
              </div>

              {/* Community Reports */}
              <div className="text-center">
                <div className="text-2xl font-bold">{analysis.reputation.communityReports}</div>
                <div className="text-sm text-muted-foreground">Community Reports</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analysis.reputation.verifiedReports} verified
                </div>
              </div>
            </div>
          </div>

          {/* Threats & Flags */}
          {(analysis.threats.length > 0 || analysis.flags.length > 0) && (
            <div className="glass-card p-6 rounded-xl border border-red-500/20 bg-red-500/5">
              <h3 className="text-lg font-semibold text-red-500 mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Security Alerts
              </h3>
              
              {analysis.threats.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Identified Threats:</h4>
                  <ul className="space-y-1">
                    {analysis.threats.map((threat, index) => (
                      <li key={index} className="text-sm text-red-400 flex items-start">
                        <span className="w-1 h-1 bg-red-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {threat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.flags.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Security Flags:</h4>
                  <div className="space-y-2">
                    {analysis.flags.map((flag, index) => (
                      <div key={index} className="flex items-start justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div>
                          <div className={`font-medium ${getSeverityColor(flag.severity)}`}>
                            {flag.description}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Type: {flag.type.replace('_', ' ')} • Confidence: {flag.confidence}%
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs ${getSeverityColor(flag.severity)}`}>
                          {flag.severity.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wallet Details */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Wallet Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <div className="text-xl font-bold">{analysis.details.accountAge}</div>
                <div className="text-sm text-muted-foreground">Days Old</div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Activity className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <div className="text-xl font-bold">{analysis.details.transactionCount}</div>
                <div className="text-sm text-muted-foreground">Transactions</div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <div className="text-xl font-bold">{analysis.details.averageTransactionValue.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Avg SOL/Tx</div>
              </div>
              
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <Users className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <div className="text-xl font-bold">{analysis.details.uniqueInteractions}</div>
                <div className="text-sm text-muted-foreground">Unique Contacts</div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="text-lg font-semibold mb-4">Security Recommendations</h3>
            <div className="space-y-2">
              {analysis.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                  <span className="text-sm">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && analysis && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Report Wallet</h3>
            <div className="space-y-4">
              <div>
                <Label>Report Type</Label>
                <select
                  value={reportData.reportType}
                  onChange={(e) => setReportData({
                    ...reportData,
                    reportType: e.target.value as WalletReport['reportType']
                  })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border/50 rounded-lg"
                >
                  <option value="scam">Scam</option>
                  <option value="phishing">Phishing</option>
                  <option value="rugpull">Rug Pull</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="bot">Bot Activity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label>Description</Label>
                <textarea
                  value={reportData.description}
                  onChange={(e) => setReportData({
                    ...reportData,
                    description: e.target.value
                  })}
                  placeholder="Describe the suspicious activity..."
                  className="w-full mt-1 px-3 py-2 bg-background border border-border/50 rounded-lg resize-none"
                  rows={3}
                />
              </div>

              <div>
                <Label>Transaction Hashes (Evidence)</Label>
                <Input
                  value={reportData.evidence?.transactionHashes?.join(', ') || ''}
                  onChange={(e) => setReportData({
                    ...reportData,
                    evidence: {
                      ...reportData.evidence,
                      transactionHashes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    }
                  })}
                  placeholder="Enter transaction hashes as evidence..."
                  className="mt-1"
                />
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={submitReport}
                  disabled={!reportData.description.trim()}
                  className="flex-1"
                >
                  Submit Report
                </Button>
                <Button
                  onClick={() => setShowReportModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Wallets Analyzed</span>
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">12,847</div>
          <div className="text-xs text-muted-foreground">This month</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Scammers Found</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-500">247</div>
          <div className="text-xs text-muted-foreground">Blacklisted</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Community Reports</span>
            <Flag className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold">1,892</div>
          <div className="text-xs text-muted-foreground">Total reports</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Detection Rate</span>
            <Zap className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-500">98.7%</div>
          <div className="text-xs text-muted-foreground">Accuracy</div>
        </div>
      </div>

      {/* How It Works */}
      <div className="glass-card p-6 rounded-xl border border-border/50">
        <h3 className="text-lg font-semibold mb-4">How Wallet Security Analysis Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">🔍 Analysis Methods</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Transaction pattern analysis</li>
              <li>• Community reputation scoring</li>
              <li>• Blacklist database checking</li>
              <li>• Suspicious activity detection</li>
              <li>• Account age and history review</li>
              <li>• Known scammer pattern matching</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">🛡️ Protection Features</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Real-time threat intelligence</li>
              <li>• Community-driven reporting</li>
              <li>• Automated risk scoring</li>
              <li>• Comprehensive recommendations</li>
              <li>• Historical analysis tracking</li>
              <li>• Multi-source verification</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
