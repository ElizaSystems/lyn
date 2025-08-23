import { NextRequest, NextResponse } from 'next/server'
import { CrossChainRiskAnalyzer } from '@/lib/services/cross-chain-risk-analyzer'

/**
 * GET /api/multi-chain/risk/high-risk - Get high-risk wallets
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const minRiskScore = parseInt(url.searchParams.get('minRiskScore') || '70')
    const limit = parseInt(url.searchParams.get('limit') || '100')

    if (minRiskScore < 0 || minRiskScore > 100) {
      return NextResponse.json(
        { success: false, error: 'minRiskScore must be between 0 and 100' },
        { status: 400 }
      )
    }

    const highRiskWallets = await CrossChainRiskAnalyzer.getHighRiskWallets(minRiskScore, limit)

    // Calculate statistics
    const stats = {
      total: highRiskWallets.length,
      critical: highRiskWallets.filter(w => w.overallRiskLevel === 'critical').length,
      high: highRiskWallets.filter(w => w.overallRiskLevel === 'high').length,
      averageRiskScore: highRiskWallets.length > 0 
        ? Math.round(highRiskWallets.reduce((sum, w) => sum + w.overallRiskScore, 0) / highRiskWallets.length)
        : 0,
      chainDistribution: {}
    }

    // Calculate chain distribution
    const chainCounts: Record<string, number> = {}
    highRiskWallets.forEach(wallet => {
      Object.keys(wallet.chainRisks).forEach(chain => {
        chainCounts[chain] = (chainCounts[chain] || 0) + 1
      })
    })
    stats.chainDistribution = chainCounts

    return NextResponse.json({
      success: true,
      data: {
        wallets: highRiskWallets,
        stats
      }
    })
  } catch (error) {
    console.error('[High Risk Wallets] GET error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}