import { NextRequest, NextResponse } from 'next/server'
import { runAgentLoop } from '@/lib/agent-framework'
import { getDatabase } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Optional auth check - remove if webhook-based
    const authResult = await requireAuth(request)
    const isWebhook = request.headers.get('x-webhook-signature')
    
    if (!isWebhook && 'error' in authResult && !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { txData, walletAddress, urgency = 'medium' } = await request.json()
    
    if (!txData && !walletAddress) {
      return NextResponse.json(
        { error: 'Transaction data or wallet address required' },
        { status: 400 }
      )
    }
    
    // Run fraud detection agent
    const outcome = await runAgentLoop(
      'Detect fraud and anomalies in crypto transaction',
      {
        txData,
        walletAddress,
        urgency,
        timestamp: new Date().toISOString()
      },
      'fraud_detection'
    )
    
    // If threat detected, take immediate action
    if (outcome.threat) {
      const db = await getDatabase()
      
      // Create alert
      await db.collection('alerts').insertOne({
        type: 'fraud_detected',
        severity: outcome.decision.confidence > 0.8 ? 'critical' : 'high',
        walletAddress,
        decision: outcome.decision,
        createdAt: new Date(),
        status: 'active'
      })
      
      // Notify affected users
      if (walletAddress) {
        const user = await db.collection('users').findOne({ walletAddress })
        if (user) {
          await db.collection('notifications').insertOne({
            userId: user._id,
            type: 'security_alert',
            title: 'Potential Fraud Detected',
            message: outcome.decision.reasoning,
            priority: 'high',
            read: false,
            createdAt: new Date()
          })
        }
      }
      
      // Log for compliance
      await db.collection('fraud_logs').insertOne({
        walletAddress,
        txData,
        detection: outcome,
        timestamp: new Date()
      })
    }
    
    return NextResponse.json({
      success: true,
      threatDetected: outcome.threat,
      confidence: outcome.decision.confidence,
      actions: outcome.executedActions,
      metrics: outcome.metrics
    })
    
  } catch (error) {
    console.error('Fraud detection error:', error)
    return NextResponse.json(
      { error: 'Fraud detection failed' },
      { status: 500 }
    )
  }
}

// GET endpoint for checking fraud detection status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('wallet')
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      )
    }
    
    const db = await getDatabase()
    
    // Get recent fraud alerts for wallet
    const alerts = await db.collection('alerts')
      .find({ 
        walletAddress,
        type: 'fraud_detected',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
    
    // Check if wallet is blocked
    const isBlocked = await db.collection('blocked_wallets')
      .findOne({ walletAddress })
    
    return NextResponse.json({
      walletAddress,
      isBlocked: !!isBlocked,
      recentAlerts: alerts.map(a => ({
        id: a._id,
        severity: a.severity,
        reasoning: a.decision?.reasoning,
        confidence: a.decision?.confidence,
        date: a.createdAt
      })),
      riskScore: calculateRiskScore(alerts)
    })
    
  } catch (error) {
    console.error('Fraud status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check fraud status' },
      { status: 500 }
    )
  }
}

function calculateRiskScore(alerts: any[]): number {
  if (alerts.length === 0) return 0
  
  // Weight recent alerts more heavily
  const now = Date.now()
  let weightedScore = 0
  let totalWeight = 0
  
  alerts.forEach(alert => {
    const age = now - new Date(alert.createdAt).getTime()
    const ageDays = age / (24 * 60 * 60 * 1000)
    const weight = Math.max(0, 1 - (ageDays / 30)) // Linear decay over 30 days
    
    const severity = alert.severity === 'critical' ? 1 : alert.severity === 'high' ? 0.7 : 0.4
    weightedScore += severity * (alert.decision?.confidence || 0.5) * weight
    totalWeight += weight
  })
  
  return totalWeight > 0 ? Math.min(1, weightedScore / totalWeight) : 0
}