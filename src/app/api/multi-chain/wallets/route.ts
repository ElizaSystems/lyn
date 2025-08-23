import { NextRequest, NextResponse } from 'next/server'
import { CrossChainActivityTracker } from '@/lib/services/cross-chain-activity-tracker'
import { MultiChainBalanceAggregator } from '@/lib/services/multi-chain-balance-aggregator'
import { CrossChainRiskAnalyzer } from '@/lib/services/cross-chain-risk-analyzer'
import { BlockchainType } from '@/lib/models/multi-chain'
import { ObjectId } from 'mongodb'

/**
 * GET /api/multi-chain/wallets - Get all tracked wallets
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const result = await CrossChainActivityTracker.getAllWallets(page, limit)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[Multi-chain Wallets] GET error:', error)
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
 * POST /api/multi-chain/wallets - Track a new wallet across chains
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { primaryAddress, chains, label } = body

    if (!primaryAddress) {
      return NextResponse.json(
        { success: false, error: 'Primary address is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(chains) || chains.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one blockchain must be specified' },
        { status: 400 }
      )
    }

    // Validate chain types
    const validChains = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base']
    const invalidChains = chains.filter((chain: string) => !validChains.includes(chain))
    
    if (invalidChains.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid chains: ${invalidChains.join(', ')}. Valid chains: ${validChains.join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Track the wallet
    const wallet = await CrossChainActivityTracker.trackWallet(
      primaryAddress,
      chains as BlockchainType[],
      label
    )

    // Perform initial balance update
    if (wallet._id) {
      try {
        await MultiChainBalanceAggregator.updateAllBalances(wallet._id, wallet.addresses)
      } catch (balanceError) {
        console.warn('Failed to update initial balances:', balanceError)
      }

      // Perform initial risk assessment
      try {
        await CrossChainRiskAnalyzer.assessWalletRisk(wallet._id)
      } catch (riskError) {
        console.warn('Failed to perform initial risk assessment:', riskError)
      }
    }

    return NextResponse.json({
      success: true,
      data: wallet
    })
  } catch (error) {
    console.error('[Multi-chain Wallets] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}