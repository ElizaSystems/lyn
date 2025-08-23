import { NextRequest, NextResponse } from 'next/server'
import { WalletSecurityService } from '@/lib/services/wallet-security'
import { requireAuth } from '@/lib/auth'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    // Check authentication (handles anonymous users with sessionId)
    const authResult = await requireAuth(request)
    const userId = authResult.user?.id ? new ObjectId(authResult.user.id) : undefined
    
    const { walletAddress, includeTransactionAnalysis = true } = await request.json()
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
    }

    console.log(`[Wallet Analysis] Analyzing wallet: ${walletAddress}`)

    // Perform comprehensive wallet security analysis
    const securityResult = await WalletSecurityService.analyzeWallet(walletAddress, userId)

    // Get wallet reputation
    const reputation = await WalletSecurityService.getWalletReputation(walletAddress)

    // Create response with detailed analysis
    const response = {
      walletAddress,
      analysis: {
        riskLevel: securityResult.riskLevel,
        riskScore: securityResult.riskScore,
        isBlacklisted: securityResult.isBlacklisted,
        isWhitelisted: securityResult.isWhitelisted,
        overallSafety: securityResult.riskLevel === 'very-low' || securityResult.riskLevel === 'low'
      },
      listStatus: securityResult.listStatus,
      reputation: {
        score: reputation.score,
        communityReports: reputation.reports.length,
        verifiedReports: reputation.reports.filter(r => r.status === 'verified').length,
        trustLevel: reputation.score > 700 ? 'high' : reputation.score > 400 ? 'medium' : 'low'
      },
      threats: securityResult.threats,
      flags: securityResult.flags,
      details: securityResult.analysis,
      recommendations: securityResult.recommendations,
      scanId: `wallet-${Date.now()}`,
      timestamp: new Date().toISOString()
    }

    // Log the analysis for audit purposes
    console.log(`[Wallet Analysis] Completed for ${walletAddress}: Risk ${securityResult.riskLevel} (${securityResult.riskScore}/100)`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('Wallet analysis error:', error)
    return NextResponse.json({
      error: 'Failed to analyze wallet',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('address')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address parameter required' }, { status: 400 })
    }

    // Check for cached result first
    const cached = await WalletSecurityService.getCachedResult(walletAddress)
    
    if (cached) {
      return NextResponse.json({
        walletAddress,
        cached: true,
        analysis: {
          riskLevel: cached.riskLevel,
          riskScore: cached.riskScore,
          isBlacklisted: cached.isBlacklisted,
          overallSafety: cached.riskLevel === 'very-low' || cached.riskLevel === 'low'
        },
        reputation: cached.reputation,
        threats: cached.threats,
        flags: cached.flags,
        recommendations: cached.recommendations,
        lastChecked: cached.lastChecked
      })
    }

    return NextResponse.json({
      walletAddress,
      cached: false,
      message: 'No cached analysis available. Use POST method for full analysis.'
    })

  } catch (error) {
    console.error('Wallet analysis GET error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve wallet analysis'
    }, { status: 500 })
  }
}
