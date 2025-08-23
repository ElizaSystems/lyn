import { NextRequest, NextResponse } from 'next/server'
import { MultiChainWalletSecurityIntegration } from '@/lib/services/multi-chain-wallet-security-integration'
import { requireAuth } from '@/lib/auth'
import { ObjectId } from 'mongodb'
import { BlockchainType } from '@/lib/models/multi-chain'

/**
 * Enhanced wallet analysis with multi-chain support
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication (handles anonymous users with sessionId)
    const authResult = await requireAuth(request)
    const userId = authResult.user?.id ? new ObjectId(authResult.user.id) : undefined
    
    const body = await request.json()
    const { 
      walletAddress, 
      enableMultiChain = true,
      chainsToAnalyze,
      includeBridgeAnalysis = true,
      includePortfolioAnalysis = true
    } = body
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }

    console.log(`[Enhanced Wallet Analysis] Analyzing wallet: ${walletAddress}`)

    // Perform enhanced wallet security analysis
    const securityResult = await MultiChainWalletSecurityIntegration.analyzeWalletComprehensive(
      walletAddress,
      userId,
      {
        enableMultiChain,
        chainsToAnalyze: chainsToAnalyze as BlockchainType[] | undefined,
        includeBridgeAnalysis,
        includePortfolioAnalysis
      }
    )

    // Get enhanced reputation
    const reputation = await MultiChainWalletSecurityIntegration.getEnhancedWalletReputation(
      walletAddress,
      enableMultiChain
    )

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
        solana: {
          score: reputation.solanaReputation.score,
          communityReports: reputation.solanaReputation.reports.length,
          verifiedReports: reputation.solanaReputation.reports.filter(r => r.status === 'verified').length,
          trustLevel: reputation.solanaReputation.score > 700 ? 'high' : reputation.solanaReputation.score > 400 ? 'medium' : 'low'
        },
        multiChain: reputation.multiChainData ? {
          trackedChains: reputation.multiChainData.trackedChains,
          crossChainRiskScore: reputation.multiChainData.crossChainRiskScore,
          bridgeActivity: reputation.multiChainData.totalBridgeActivity,
          portfolioValue: reputation.multiChainData.portfolioValue,
          riskLevel: MultiChainWalletSecurityIntegration['getRiskLevel'](reputation.multiChainData.crossChainRiskScore)
        } : null
      },
      threats: securityResult.threats,
      flags: securityResult.flags,
      details: securityResult.analysis,
      recommendations: securityResult.recommendations,
      multiChainAnalysis: securityResult.multiChainAnalysis,
      timestamp: new Date().toISOString(),
      enhanced: true
    }

    console.log(`[Enhanced Wallet Analysis] Analysis complete for ${walletAddress}. Risk level: ${securityResult.riskLevel}`)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Enhanced Wallet Analysis] Error:', error)
    
    return NextResponse.json({
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      walletAddress: request.url,
      enhanced: false,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Analyze multiple connected wallets
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    const userId = authResult.user?.id ? new ObjectId(authResult.user.id) : undefined
    
    const body = await request.json()
    const { addresses } = body
    
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: 'Addresses array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate address format
    for (const addressData of addresses) {
      if (!addressData.address || !addressData.chain) {
        return NextResponse.json(
          { error: 'Each address must have address and chain properties' },
          { status: 400 }
        )
      }
    }

    console.log(`[Connected Wallets Analysis] Analyzing ${addresses.length} connected wallets`)

    // Perform connected wallet analysis
    const result = await MultiChainWalletSecurityIntegration.analyzeConnectedWallets(
      addresses,
      userId
    )

    console.log(`[Connected Wallets Analysis] Analysis complete. Overall risk: ${result.consolidatedRisk.overallRiskLevel}`)

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Connected Wallets Analysis] Error:', error)
    
    return NextResponse.json({
      error: 'Connected wallets analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}