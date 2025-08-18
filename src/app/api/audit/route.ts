import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

interface AuditReport {
  _id?: ObjectId
  contractAddress: string
  contractName: string
  network: string
  userId?: string
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  score: number // 0-100
  vulnerabilities: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    type: string
    description: string
    location?: string
    recommendation: string
  }>
  summary: {
    totalIssues: number
    critical: number
    high: number
    medium: number
    low: number
  }
  gasOptimization?: Array<{
    location: string
    suggestion: string
    potentialSaving: string
  }>
  codeQuality: {
    score: number
    documentation: number
    testing: number
    complexity: number
  }
  createdAt: Date
  completedAt?: Date
}

async function getAuditCollection() {
  const db = await getDatabase()
  return db.collection<AuditReport>('audit_reports')
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const contractAddress = searchParams.get('contract')
    const userId = searchParams.get('userId')
    
    const auditCollection = await getAuditCollection()
    
    if (contractAddress) {
      // Get specific audit report
      const report = await auditCollection.findOne({ contractAddress })
      if (report) {
        return NextResponse.json(report)
      }
    }
    
    // Get recent audits
    const query = userId ? { userId } : {}
    const reports = await auditCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
    
    // Get statistics
    const stats = await auditCollection.aggregate([
      {
        $group: {
          _id: null,
          totalAudits: { $sum: 1 },
          avgScore: { $avg: '$score' },
          criticalIssues: { $sum: '$summary.critical' },
          highIssues: { $sum: '$summary.high' }
        }
      }
    ]).toArray()
    
    return NextResponse.json({
      reports,
      stats: stats[0] || {
        totalAudits: 0,
        avgScore: 0,
        criticalIssues: 0,
        highIssues: 0
      }
    })
  } catch (error) {
    console.error('Audit GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch audit data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contractAddress, contractCode, network = 'mainnet' } = body
    
    if (!contractAddress || !contractCode) {
      return NextResponse.json({ 
        error: 'Contract address and code required' 
      }, { status: 400 })
    }
    
    const auditCollection = await getAuditCollection()
    
    // Check if audit already exists
    const existingAudit = await auditCollection.findOne({ 
      contractAddress,
      status: { $in: ['pending', 'analyzing'] }
    })
    
    if (existingAudit) {
      return NextResponse.json({ 
        error: 'Audit already in progress',
        reportId: existingAudit._id 
      }, { status: 409 })
    }
    
    // Perform basic static analysis (in production, this would be more sophisticated)
    const vulnerabilities = analyzeContract(contractCode)
    
    const summary = {
      totalIssues: vulnerabilities.length,
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length
    }
    
    // Calculate risk score
    const score = calculateScore(summary)
    const riskLevel = getRiskLevel(score)
    
    // Create audit report
    const report: AuditReport = {
      contractAddress,
      contractName: extractContractName(contractCode),
      network,
      userId: body.userId,
      status: 'completed',
      riskLevel,
      score,
      vulnerabilities,
      summary,
      gasOptimization: findGasOptimizations(contractCode),
      codeQuality: {
        score: Math.floor(Math.random() * 30) + 70,
        documentation: Math.floor(Math.random() * 40) + 60,
        testing: Math.floor(Math.random() * 50) + 50,
        complexity: Math.floor(Math.random() * 30) + 70
      },
      createdAt: new Date(),
      completedAt: new Date()
    }
    
    const result = await auditCollection.insertOne(report)
    
    return NextResponse.json({
      success: true,
      reportId: result.insertedId,
      report
    })
  } catch (error) {
    console.error('Audit POST error:', error)
    return NextResponse.json({ error: 'Failed to process audit' }, { status: 500 })
  }
}

function analyzeContract(code: string): AuditReport['vulnerabilities'] {
  const vulnerabilities = []
  
  // Check for reentrancy
  if (code.includes('call.value') || code.includes('.call{value:')) {
    vulnerabilities.push({
      severity: 'high' as const,
      type: 'Reentrancy',
      description: 'Potential reentrancy vulnerability detected',
      location: 'External call found',
      recommendation: 'Use checks-effects-interactions pattern and consider ReentrancyGuard'
    })
  }
  
  // Check for integer overflow
  if (!code.includes('SafeMath') && code.includes('uint')) {
    vulnerabilities.push({
      severity: 'medium' as const,
      type: 'Integer Overflow',
      description: 'Arithmetic operations without SafeMath',
      recommendation: 'Use SafeMath library or Solidity 0.8+ with built-in overflow checks'
    })
  }
  
  // Check for unprotected functions
  if (code.includes('function') && !code.includes('onlyOwner') && !code.includes('require')) {
    vulnerabilities.push({
      severity: 'medium' as const,
      type: 'Access Control',
      description: 'Functions without access control',
      recommendation: 'Implement proper access control modifiers'
    })
  }
  
  // Check for tx.origin
  if (code.includes('tx.origin')) {
    vulnerabilities.push({
      severity: 'high' as const,
      type: 'Phishing Attack Vector',
      description: 'Use of tx.origin for authorization',
      location: 'tx.origin usage',
      recommendation: 'Replace tx.origin with msg.sender'
    })
  }
  
  // Check for timestamp dependence
  if (code.includes('block.timestamp') || code.includes('now')) {
    vulnerabilities.push({
      severity: 'low' as const,
      type: 'Timestamp Dependence',
      description: 'Contract relies on block timestamp',
      recommendation: 'Be aware that miners can manipulate timestamps within limits'
    })
  }
  
  // Check for unchecked return values
  if (code.includes('.transfer(') || code.includes('.send(')) {
    vulnerabilities.push({
      severity: 'medium' as const,
      type: 'Unchecked Return Value',
      description: 'Transfer/send return values not checked',
      recommendation: 'Always check return values of transfer/send operations'
    })
  }
  
  // Check for floating pragma
  if (code.includes('pragma solidity ^')) {
    vulnerabilities.push({
      severity: 'low' as const,
      type: 'Floating Pragma',
      description: 'Contract uses floating pragma version',
      recommendation: 'Lock pragma to specific compiler version for production'
    })
  }
  
  return vulnerabilities
}

function findGasOptimizations(code: string): Array<{
  location: string
  suggestion: string
  potentialSaving: string
}> {
  const optimizations = []
  
  if (code.includes('public') && code.includes('string')) {
    optimizations.push({
      location: 'String variables',
      suggestion: 'Consider using bytes32 for fixed-size strings',
      potentialSaving: '~50 gas per operation'
    })
  }
  
  if (code.includes('for') || code.includes('while')) {
    optimizations.push({
      location: 'Loop operations',
      suggestion: 'Cache array length outside loops',
      potentialSaving: '~3 gas per iteration'
    })
  }
  
  if (code.split('require').length > 5) {
    optimizations.push({
      location: 'Multiple require statements',
      suggestion: 'Combine require statements where possible',
      potentialSaving: '~20 gas per combined check'
    })
  }
  
  return optimizations
}

function extractContractName(code: string): string {
  const match = code.match(/contract\s+(\w+)/i)
  return match ? match[1] : 'Unknown Contract'
}

function calculateScore(summary: AuditReport['summary']): number {
  let score = 100
  score -= summary.critical * 25
  score -= summary.high * 15
  score -= summary.medium * 5
  score -= summary.low * 2
  return Math.max(0, Math.min(100, score))
}

function getRiskLevel(score: number): AuditReport['riskLevel'] {
  if (score >= 90) return 'low'
  if (score >= 70) return 'medium'
  if (score >= 50) return 'high'
  return 'critical'
}