'use client'

import { useState } from 'react'
import {
  Shield,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe,
  Link,
  Activity,
  TrendingUp,
  AlertCircle,
  Loader2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ChainAnalysis {
  chain: string
  address: string
  balance: string
  nativeBalance: string
  transactionCount: number
  riskScore: number
  threats: string[]
  isActive: boolean
  lastActivity?: string
  tokens?: Array<{
    symbol: string
    balance: string
    value?: number
  }>
}

interface MultiChainAnalysis {
  primaryAddress: string
  overallRiskScore: number
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  totalValueUSD: number
  chainAnalyses: ChainAnalysis[]
  crossChainActivity: {
    bridgeTransactions: number
    suspiciousBridges: string[]
    commonInteractions: string[]
  }
  threats: {
    critical: string[]
    high: string[]
    medium: string[]
    low: string[]
  }
  recommendations: string[]
  timestamp: string
}

const CHAIN_ICONS: Record<string, string> = {
  solana: '◎',
  ethereum: 'Ξ',
  bsc: '🔶',
  polygon: '⬜',
  arbitrum: '🔷',
  base: '🔵'
}

const CHAIN_COLORS: Record<string, string> = {
  solana: 'bg-purple-500',
  ethereum: 'bg-blue-500',
  bsc: 'bg-yellow-500',
  polygon: 'bg-purple-600',
  arbitrum: 'bg-blue-600',
  base: 'bg-blue-400'
}

export default function MultiChainScanner() {
  const [address, setAddress] = useState('')
  const [selectedChains, setSelectedChains] = useState(['solana', 'ethereum', 'bsc', 'polygon'])
  const [analysis, setAnalysis] = useState<MultiChainAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedChain, setExpandedChain] = useState<string | null>(null)
  const [scanMode, setScanMode] = useState<'quick' | 'deep'>('quick')

  const availableChains = [
    { id: 'solana', name: 'Solana', icon: '◎' },
    { id: 'ethereum', name: 'Ethereum', icon: 'Ξ' },
    { id: 'bsc', name: 'BNB Chain', icon: '🔶' },
    { id: 'polygon', name: 'Polygon', icon: '⬜' },
    { id: 'arbitrum', name: 'Arbitrum', icon: '🔷' },
    { id: 'base', name: 'Base', icon: '🔵' }
  ]

  const toggleChain = (chainId: string) => {
    setSelectedChains(prev =>
      prev.includes(chainId)
        ? prev.filter(c => c !== chainId)
        : [...prev, chainId]
    )
  }

  const scanWallet = async () => {
    if (!address.trim()) {
      setError('Please enter a wallet address')
      return
    }

    if (selectedChains.length === 0) {
      setError('Please select at least one blockchain')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const response = await fetch('/api/security/analyze-multi-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          chains: selectedChains
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze wallet')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze wallet')
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-600 bg-red-100'
      case 'HIGH': return 'text-orange-600 bg-orange-100'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100'
      case 'LOW': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL': return <XCircle className="h-5 w-5 text-red-600" />
      case 'HIGH': return <AlertTriangle className="h-5 w-5 text-orange-600" />
      case 'MEDIUM': return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'LOW': return <CheckCircle className="h-5 w-5 text-green-600" />
      default: return <Shield className="h-5 w-5 text-gray-600" />
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Globe className="h-6 w-6 text-primary" />
                Multi-Chain Security Scanner
              </CardTitle>
              <CardDescription>
                Analyze wallets across 6 major blockchains for comprehensive threat detection
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chain Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Blockchains to Scan:</label>
            <div className="flex flex-wrap gap-2">
              {availableChains.map(chain => (
                <Button
                  key={chain.id}
                  variant={selectedChains.includes(chain.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleChain(chain.id)}
                  className="transition-all"
                >
                  <span className="mr-1">{chain.icon}</span>
                  {chain.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter wallet address or ENS/SNS domain..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && scanWallet()}
              className="flex-1"
            />
            <Button 
              onClick={scanWallet} 
              disabled={loading || selectedChains.length === 0}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Scan Wallet
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Overview Card */}
          <Card className={`border-2 ${
            analysis.overallRiskLevel === 'CRITICAL' ? 'border-red-500' :
            analysis.overallRiskLevel === 'HIGH' ? 'border-orange-500' :
            analysis.overallRiskLevel === 'MEDIUM' ? 'border-yellow-500' :
            'border-green-500'
          }`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {getRiskIcon(analysis.overallRiskLevel)}
                  Overall Risk Assessment
                </CardTitle>
                <Badge className={getRiskColor(analysis.overallRiskLevel)}>
                  {analysis.overallRiskLevel} RISK
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <div className="flex items-center gap-2">
                    <Progress value={analysis.overallRiskScore} className="flex-1" />
                    <span className="font-bold">{analysis.overallRiskScore}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-xl font-bold">${analysis.totalValueUSD.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Chains</p>
                  <p className="text-xl font-bold">
                    {analysis.chainAnalyses.filter(c => c.isActive).length} / {analysis.chainAnalyses.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Threats Summary */}
          {(analysis.threats.critical.length > 0 || 
            analysis.threats.high.length > 0 || 
            analysis.threats.medium.length > 0) && (
            <Alert variant={analysis.threats.critical.length > 0 ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Threats Detected</AlertTitle>
              <AlertDescription className="mt-2 space-y-1">
                {analysis.threats.critical.map((threat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">CRITICAL</Badge>
                    <span>{threat}</span>
                  </div>
                ))}
                {analysis.threats.high.map((threat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge className="bg-orange-500 text-xs">HIGH</Badge>
                    <span>{threat}</span>
                  </div>
                ))}
                {analysis.threats.medium.map((threat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge className="bg-yellow-500 text-xs">MEDIUM</Badge>
                    <span>{threat}</span>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Chain-by-Chain Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Chain-by-Chain Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.chainAnalyses.map((chainAnalysis) => (
                  <div
                    key={chainAnalysis.chain}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedChain(
                      expandedChain === chainAnalysis.chain ? null : chainAnalysis.chain
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${CHAIN_COLORS[chainAnalysis.chain]} flex items-center justify-center text-white font-bold`}>
                          {CHAIN_ICONS[chainAnalysis.chain]}
                        </div>
                        <div>
                          <p className="font-medium capitalize">{chainAnalysis.chain}</p>
                          <p className="text-sm text-muted-foreground">
                            {chainAnalysis.nativeBalance} • {chainAnalysis.transactionCount} txns
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {chainAnalysis.isActive && (
                          <Badge variant="outline" className="text-xs">
                            <Activity className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        <Badge className={`text-xs ${
                          chainAnalysis.riskScore > 75 ? 'bg-red-500' :
                          chainAnalysis.riskScore > 50 ? 'bg-orange-500' :
                          chainAnalysis.riskScore > 25 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}>
                          Risk: {chainAnalysis.riskScore}%
                        </Badge>
                        {expandedChain === chainAnalysis.chain ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                        }
                      </div>
                    </div>

                    {expandedChain === chainAnalysis.chain && (
                      <div className="mt-4 space-y-2 border-t pt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Address:</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs">{chainAnalysis.address.slice(0, 6)}...{chainAnalysis.address.slice(-4)}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(chainAnalysis.address)
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {chainAnalysis.lastActivity && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Last Activity:</span>
                            <span>{new Date(chainAnalysis.lastActivity).toLocaleDateString()}</span>
                          </div>
                        )}
                        {chainAnalysis.threats.length > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Threats:</span>
                            <ul className="mt-1 space-y-1">
                              {chainAnalysis.threats.map((threat, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                                  <span>{threat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cross-Chain Activity */}
          {analysis.crossChainActivity.commonInteractions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  Cross-Chain Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Bridge Transactions</p>
                    <p className="text-2xl font-bold">{analysis.crossChainActivity.bridgeTransactions}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active on Chains</p>
                    <div className="flex gap-1 mt-1">
                      {analysis.crossChainActivity.commonInteractions.map(chain => (
                        <Badge key={chain} variant="outline" className="text-xs">
                          {chain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {analysis.crossChainActivity.suspiciousBridges.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Suspicious Activity</p>
                      <Badge variant="destructive" className="text-xs mt-1">
                        {analysis.crossChainActivity.suspiciousBridges[0]}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Security Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}