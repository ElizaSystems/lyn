'use client'
import { useState, useEffect } from 'react'
import { Shield, Lock, FileSearch, AlertTriangle, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Vulnerability {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  description: string
  location?: string
  recommendation: string
}

interface GasOptimization {
  location: string
  suggestion: string
  potentialSaving: string
}

interface AuditResult {
  contractName: string
  contractAddress: string
  score: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  summary: {
    totalIssues: number
    critical: number
    high: number
    medium: number
    low: number
  }
  codeQuality: {
    score: number
    documentation: number
    testing: number
    complexity: number
  }
  vulnerabilities: Vulnerability[]
  gasOptimization?: GasOptimization[]
}

interface AuditStats {
  totalAudits: number
  avgScore: number
  criticalIssues: number
  highIssues: number
}

export default function AuditPage() {
  const [contractCode, setContractCode] = useState('')
  const [contractAddress, setContractAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [recentAudits, setRecentAudits] = useState<AuditResult[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)

  useEffect(() => {
    fetchRecentAudits()
  }, [])

  const fetchRecentAudits = async () => {
    try {
      const response = await fetch('/api/audit')
      const data = await response.json()
      setRecentAudits(data.reports || [])
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to fetch audits:', error)
    }
  }

  const handleAudit = async () => {
    if (!contractCode || !contractAddress) {
      alert('Please provide both contract address and code')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress, contractCode })
      })
      
      const data = await response.json()
      if (data.report) {
        setAuditResult(data.report)
      }
    } catch (error) {
      console.error('Audit failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-orange-500'
      case 'critical': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />
      case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'low': return <CheckCircle className="w-4 h-4 text-blue-500" />
      default: return <CheckCircle className="w-4 h-4 text-gray-500" />
    }
  }

  if (auditResult) {
    return (
      <div className="h-full p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Audit Report</h1>
              <p className="text-sm text-muted-foreground">{auditResult.contractName}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setAuditResult(null)}
            className="border-border/50 hover:bg-primary/10"
          >
            New Audit
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">Security Score</p>
            <p className="text-3xl font-bold">{auditResult.score}/100</p>
            <p className={`text-sm mt-1 ${getRiskColor(auditResult.riskLevel)}`}>
              {auditResult.riskLevel.toUpperCase()} RISK
            </p>
          </div>

          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">Total Issues</p>
            <p className="text-3xl font-bold">{auditResult.summary.totalIssues}</p>
            <div className="flex gap-2 text-xs mt-1">
              <span className="text-red-500">{auditResult.summary.critical} Critical</span>
              <span className="text-orange-500">{auditResult.summary.high} High</span>
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">Code Quality</p>
            <p className="text-3xl font-bold">{auditResult.codeQuality.score}%</p>
            <p className="text-xs text-muted-foreground mt-1">Documentation: {auditResult.codeQuality.documentation}%</p>
          </div>

          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">Complexity</p>
            <p className="text-3xl font-bold">{auditResult.codeQuality.complexity}%</p>
            <p className="text-xs text-muted-foreground mt-1">Testing: {auditResult.codeQuality.testing}%</p>
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-border/50">
          <h2 className="text-lg font-semibold mb-4">Vulnerabilities Found</h2>
          <div className="space-y-3">
            {auditResult.vulnerabilities.map((vuln, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-card/50">
                {getSeverityIcon(vuln.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{vuln.type}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      vuln.severity === 'critical' ? 'bg-red-500/20 text-red-500' :
                      vuln.severity === 'high' ? 'bg-orange-500/20 text-orange-500' :
                      vuln.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      {vuln.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{vuln.description}</p>
                  {vuln.location && (
                    <p className="text-xs text-muted-foreground mt-1">Location: {vuln.location}</p>
                  )}
                  <p className="text-sm text-primary mt-2">→ {vuln.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {auditResult.gasOptimization && auditResult.gasOptimization.length > 0 && (
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h2 className="text-lg font-semibold mb-4">Gas Optimization Suggestions</h2>
            <div className="space-y-3">
              {auditResult.gasOptimization.map((opt, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-card/50">
                  <TrendingUp className="w-4 h-4 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{opt.location}</p>
                    <p className="text-sm text-muted-foreground">{opt.suggestion}</p>
                    <p className="text-xs text-green-500 mt-1">Potential saving: {opt.potentialSaving}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Security Audit</h1>
            <p className="text-sm text-muted-foreground">AI-powered smart contract analysis</p>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground">Total Audits</p>
            <p className="text-2xl font-bold">{stats.totalAudits}</p>
          </div>
          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground">Avg Score</p>
            <p className="text-2xl font-bold">{Math.round(stats.avgScore)}/100</p>
          </div>
          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground">Critical Issues</p>
            <p className="text-2xl font-bold text-red-500">{stats.criticalIssues}</p>
          </div>
          <div className="glass-card p-4 rounded-xl border border-border/50">
            <p className="text-sm text-muted-foreground">High Issues</p>
            <p className="text-2xl font-bold text-orange-500">{stats.highIssues}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl border border-border/50">
          <h2 className="text-lg font-semibold mb-4">New Audit</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Contract Address</label>
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full mt-1 p-3 bg-input border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30"
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Contract Code</label>
              <textarea
                value={contractCode}
                onChange={(e) => setContractCode(e.target.value)}
                placeholder="pragma solidity ^0.8.0;&#10;&#10;contract MyContract {&#10;  // Paste your contract code here&#10;}"
                className="w-full mt-1 p-3 bg-input border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30 font-mono text-sm"
                rows={10}
              />
            </div>

            <Button 
              onClick={handleAudit} 
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FileSearch className="w-4 h-4 mr-2" />
                  Start Audit
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card p-6 rounded-xl border border-border/50">
            <h3 className="font-semibold mb-3">What We Check</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-sm">Reentrancy Attacks</p>
                  <p className="text-xs text-muted-foreground">External call vulnerabilities</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="font-medium text-sm">Integer Overflow/Underflow</p>
                  <p className="text-xs text-muted-foreground">Arithmetic operation safety</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Access Control</p>
                  <p className="text-xs text-muted-foreground">Function permission checks</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-sm">Gas Optimization</p>
                  <p className="text-xs text-muted-foreground">Cost reduction suggestions</p>
                </div>
              </div>
            </div>
          </div>

          {recentAudits.length > 0 && (
            <div className="glass-card p-6 rounded-xl border border-border/50">
              <h3 className="font-semibold mb-3">Recent Audits</h3>
              <div className="space-y-2">
                {recentAudits.slice(0, 5).map((audit, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-card/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Shield className={`w-4 h-4 ${getRiskColor(audit.riskLevel)}`} />
                      <div>
                        <p className="text-sm font-medium">{audit.contractName}</p>
                        <p className="text-xs text-muted-foreground">
                          {audit.contractAddress.slice(0, 10)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{audit.score}/100</p>
                      <p className={`text-xs ${getRiskColor(audit.riskLevel)}`}>
                        {audit.riskLevel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}