/**
 * Compliance and KYC/AML Agent
 * Ensures regulatory compliance and detects money laundering
 */

import { runAgentLoop } from './agent-framework'
import { getDatabase } from './mongodb'
import { Connection, PublicKey } from '@solana/web3.js'
import { config } from './config'

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || config.solana.rpcUrl
)

export interface ComplianceCheck {
  passed: boolean
  score: number // 0-100
  issues: ComplianceIssue[]
  recommendations: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface ComplianceIssue {
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  regulation?: string // e.g., "MiCA", "AML5"
}

export interface KYCData {
  userId: string
  walletAddress: string
  country?: string
  verificationLevel: 'none' | 'basic' | 'enhanced'
  documents?: string[]
  verifiedAt?: Date
}

/**
 * Perform KYC verification
 */
export async function verifyKYC(userData: KYCData): Promise<ComplianceCheck> {
  console.log(`[ComplianceAgent] Starting KYC for user: ${userData.userId}`)
  
  const db = await getDatabase()
  
  try {
    // Get user's transaction history
    const user = await db.collection('users').findOne({ 
      walletAddress: userData.walletAddress 
    })
    
    // Get on-chain data
    const pubkey = new PublicKey(userData.walletAddress)
    const balance = await connection.getBalance(pubkey)
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 100 })
    
    // Analyze transaction patterns
    const txPatterns = await analyzeTransactionPatterns(signatures, userData.walletAddress)
    
    // Run compliance agent
    const outcome = await runAgentLoop(
      'Verify user KYC/AML compliance',
      {
        userData,
        userProfile: user,
        balance: balance / 1e9,
        transactionCount: signatures.length,
        txPatterns,
        verificationLevel: userData.verificationLevel
      },
      'compliance'
    )
    
    // Parse compliance results
    const complianceCheck = parseComplianceOutcome(outcome, userData)
    
    // Update user compliance status
    if (complianceCheck.passed) {
      await db.collection('users').updateOne(
        { walletAddress: userData.walletAddress },
        {
          $set: {
            kycVerified: true,
            kycLevel: userData.verificationLevel,
            kycScore: complianceCheck.score,
            kycVerifiedAt: new Date(),
            complianceRisk: complianceCheck.riskLevel
          }
        }
      )
    } else {
      // Log compliance failure
      await db.collection('compliance_failures').insertOne({
        userId: userData.userId,
        walletAddress: userData.walletAddress,
        issues: complianceCheck.issues,
        timestamp: new Date()
      })
    }
    
    return complianceCheck
    
  } catch (error) {
    console.error(`[ComplianceAgent] KYC verification failed:`, error)
    
    return {
      passed: false,
      score: 0,
      issues: [{
        type: 'verification_error',
        severity: 'high',
        description: 'KYC verification could not be completed'
      }],
      recommendations: ['Please try again or contact support'],
      riskLevel: 'high'
    }
  }
}

/**
 * Detect money laundering patterns
 */
export async function detectMoneyLaundering(
  walletAddress: string,
  timeframe: number = 30 // days
): Promise<{ 
  detected: boolean; 
  confidence: number; 
  patterns: string[];
  recommendation: string 
}> {
  console.log(`[ComplianceAgent] Checking AML for wallet: ${walletAddress}`)
  
  try {
    const pubkey = new PublicKey(walletAddress)
    const endTime = Date.now()
    const startTime = endTime - (timeframe * 24 * 60 * 60 * 1000)
    
    // Get transaction history
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit: 1000
    })
    
    // Filter by timeframe
    const relevantSigs = signatures.filter(sig => {
      const timestamp = (sig.blockTime || 0) * 1000
      return timestamp >= startTime && timestamp <= endTime
    })
    
    // Analyze for ML patterns
    const patterns = await identifyMLPatterns(relevantSigs, walletAddress)
    
    // Run AML detection agent
    const outcome = await runAgentLoop(
      'Detect money laundering activity',
      {
        walletAddress,
        transactionCount: relevantSigs.length,
        patterns,
        timeframe
      },
      'fraud_detection'
    )
    
    const detected = outcome.threat || patterns.suspiciousPatterns.length > 2
    const confidence = detected ? outcome.decision.confidence : 0
    
    // Generate recommendation
    let recommendation = 'No action required'
    if (detected) {
      if (confidence > 0.8) {
        recommendation = 'Immediate account freeze recommended'
      } else if (confidence > 0.5) {
        recommendation = 'Enhanced monitoring required'
      } else {
        recommendation = 'Manual review recommended'
      }
    }
    
    // Log AML check
    const db = await getDatabase()
    await db.collection('aml_checks').insertOne({
      walletAddress,
      detected,
      confidence,
      patterns: patterns.suspiciousPatterns,
      recommendation,
      timestamp: new Date()
    })
    
    return {
      detected,
      confidence,
      patterns: patterns.suspiciousPatterns,
      recommendation
    }
    
  } catch (error) {
    console.error(`[ComplianceAgent] AML detection failed:`, error)
    
    return {
      detected: false,
      confidence: 0,
      patterns: [],
      recommendation: 'Unable to complete AML check'
    }
  }
}

/**
 * Check sanctions list
 */
export async function checkSanctions(
  walletAddress: string
): Promise<{ sanctioned: boolean; lists: string[] }> {
  const db = await getDatabase()
  
  try {
    // Check internal sanctions database
    const sanctioned = await db.collection('sanctioned_addresses')
      .findOne({ address: walletAddress })
    
    if (sanctioned) {
      return {
        sanctioned: true,
        lists: sanctioned.lists || ['internal']
      }
    }
    
    // Check known bad actor patterns
    const badActorPatterns = [
      /^hack/i,
      /^scam/i,
      /^exploit/i
    ]
    
    const user = await db.collection('users').findOne({ walletAddress })
    const username = user?.username || ''
    
    const matchesPattern = badActorPatterns.some(pattern => 
      pattern.test(username) || pattern.test(walletAddress)
    )
    
    if (matchesPattern) {
      // Add to watchlist
      await db.collection('watchlist').insertOne({
        walletAddress,
        reason: 'pattern_match',
        addedAt: new Date()
      })
      
      return {
        sanctioned: false, // Not sanctioned but watched
        lists: ['watchlist']
      }
    }
    
    return {
      sanctioned: false,
      lists: []
    }
    
  } catch (error) {
    console.error(`[ComplianceAgent] Sanctions check failed:`, error)
    
    return {
      sanctioned: false,
      lists: []
    }
  }
}

/**
 * Auto-report suspicious activity
 */
export async function reportSuspiciousActivity(
  walletAddress: string,
  activityType: string,
  details: any
): Promise<{ reported: boolean; caseId: string }> {
  const db = await getDatabase()
  
  try {
    // Generate case ID
    const caseId = `SAR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Create suspicious activity report
    const sar = {
      caseId,
      walletAddress,
      activityType,
      details,
      reportedAt: new Date(),
      status: 'pending_review',
      autoGenerated: true
    }
    
    await db.collection('suspicious_activity_reports').insertOne(sar)
    
    // Run compliance check
    const compliance = await verifyKYC({
      userId: walletAddress,
      walletAddress,
      verificationLevel: 'none'
    })
    
    // If high risk, escalate
    if (compliance.riskLevel === 'critical' || compliance.riskLevel === 'high') {
      await db.collection('escalated_cases').insertOne({
        caseId,
        priority: 'high',
        escalatedAt: new Date()
      })
    }
    
    console.log(`[ComplianceAgent] SAR filed: ${caseId}`)
    
    return {
      reported: true,
      caseId
    }
    
  } catch (error) {
    console.error(`[ComplianceAgent] SAR filing failed:`, error)
    
    return {
      reported: false,
      caseId: ''
    }
  }
}

/**
 * Helper: Analyze transaction patterns
 */
async function analyzeTransactionPatterns(
  signatures: any[],
  walletAddress: string
): Promise<any> {
  const patterns: any = {
    totalTransactions: signatures.length,
    avgTransactionsPerDay: 0,
    largeTransactions: 0,
    rapidTransactions: 0,
    uniqueCounterparties: new Set()
  }
  
  if (signatures.length === 0) return patterns
  
  // Calculate time span
  const firstTx = signatures[signatures.length - 1]
  const lastTx = signatures[0]
  const timeSpanDays = ((lastTx.blockTime || 0) - (firstTx.blockTime || 0)) / (24 * 60 * 60)
  
  patterns.avgTransactionsPerDay = timeSpanDays > 0 
    ? signatures.length / timeSpanDays 
    : signatures.length
  
  // Check for rapid transactions (potential layering)
  let rapidCount = 0
  for (let i = 1; i < signatures.length; i++) {
    const timeDiff = (signatures[i-1].blockTime || 0) - (signatures[i].blockTime || 0)
    if (timeDiff < 60) rapidCount++ // Less than 1 minute apart
  }
  patterns.rapidTransactions = rapidCount
  
  return patterns
}

/**
 * Helper: Identify ML patterns
 */
async function identifyMLPatterns(
  signatures: any[],
  walletAddress: string
): Promise<any> {
  const suspiciousPatterns: string[] = []
  
  // Structuring: Large deposits followed by many small withdrawals
  if (signatures.length > 50) {
    suspiciousPatterns.push('high_transaction_volume')
  }
  
  // Layering: Rapid successive transactions
  const rapidTxs = signatures.filter((sig, i) => {
    if (i === 0) return false
    const timeDiff = (signatures[i-1].blockTime || 0) - (sig.blockTime || 0)
    return timeDiff < 60
  })
  
  if (rapidTxs.length > 10) {
    suspiciousPatterns.push('layering_pattern')
  }
  
  // Round amounts (potential automated activity)
  // Note: Would need to fetch full transaction details for amount analysis
  
  return {
    suspiciousPatterns,
    riskScore: suspiciousPatterns.length * 0.3
  }
}

/**
 * Helper: Parse compliance outcome
 */
function parseComplianceOutcome(
  outcome: any,
  userData: KYCData
): ComplianceCheck {
  const issues: ComplianceIssue[] = []
  const recommendations: string[] = []
  
  // Check verification level
  if (userData.verificationLevel === 'none') {
    issues.push({
      type: 'no_verification',
      severity: 'high',
      description: 'User has not completed KYC verification'
    })
    recommendations.push('Complete identity verification')
  }
  
  // Parse agent reasoning for issues
  const reasoning = outcome.decision.reasoning || ''
  
  if (reasoning.includes('suspicious')) {
    issues.push({
      type: 'suspicious_activity',
      severity: 'medium',
      description: 'Transaction patterns indicate potential risk'
    })
  }
  
  if (reasoning.includes('sanction')) {
    issues.push({
      type: 'sanctions_risk',
      severity: 'high',
      description: 'Wallet may be associated with sanctioned entity',
      regulation: 'OFAC'
    })
  }
  
  // Calculate score
  let score = 100
  issues.forEach(issue => {
    score -= issue.severity === 'high' ? 30 : issue.severity === 'medium' ? 15 : 5
  })
  score = Math.max(0, score)
  
  // Determine risk level
  let riskLevel: ComplianceCheck['riskLevel'] = 'low'
  if (score < 30) riskLevel = 'critical'
  else if (score < 50) riskLevel = 'high'
  else if (score < 70) riskLevel = 'medium'
  
  return {
    passed: score >= 50 && issues.filter(i => i.severity === 'high').length === 0,
    score,
    issues,
    recommendations,
    riskLevel
  }
}