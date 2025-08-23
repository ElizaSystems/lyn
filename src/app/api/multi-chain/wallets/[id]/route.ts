import { NextRequest, NextResponse } from 'next/server'
import { CrossChainActivityTracker } from '@/lib/services/cross-chain-activity-tracker'
import { MultiChainBalanceAggregator } from '@/lib/services/multi-chain-balance-aggregator'
import { CrossChainRiskAnalyzer } from '@/lib/services/cross-chain-risk-analyzer'
import { CrossChainTransactionTracker } from '@/lib/services/cross-chain-transaction-tracker'
import { ObjectId } from 'mongodb'

/**
 * GET /api/multi-chain/wallets/[id] - Get wallet details, balance, and activity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)

    // Get wallet data
    const wallets = await CrossChainActivityTracker.getAllWallets(1, 1000)
    const wallet = wallets.wallets.find(w => w._id?.toString() === params.id)
    
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      )
    }

    // Get aggregated balance
    let balanceData
    try {
      balanceData = await MultiChainBalanceAggregator.getAggregatedBalance(walletId)
    } catch (error) {
      console.warn('Failed to get balance data:', error)
      balanceData = null
    }

    // Get activity summary
    let activitySummary
    try {
      activitySummary = await CrossChainActivityTracker.getWalletActivitySummary(walletId)
    } catch (error) {
      console.warn('Failed to get activity summary:', error)
      activitySummary = []
    }

    // Get risk assessment
    let riskAssessment
    try {
      riskAssessment = await CrossChainRiskAnalyzer.getRiskAssessment(walletId)
    } catch (error) {
      console.warn('Failed to get risk assessment:', error)
      riskAssessment = null
    }

    return NextResponse.json({
      success: true,
      data: {
        wallet,
        balance: balanceData,
        activity: activitySummary,
        risk: riskAssessment
      }
    })
  } catch (error) {
    console.error('[Multi-chain Wallet Detail] GET error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/multi-chain/wallets/[id] - Delete wallet tracking
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)

    await CrossChainActivityTracker.deleteWallet(walletId)

    return NextResponse.json({
      success: true,
      message: 'Wallet tracking deleted successfully'
    })
  } catch (error) {
    console.error('[Multi-chain Wallet Delete] DELETE error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}