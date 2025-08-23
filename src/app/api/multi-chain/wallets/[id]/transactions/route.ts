import { NextRequest, NextResponse } from 'next/server'
import { CrossChainTransactionTracker } from '@/lib/services/cross-chain-transaction-tracker'
import { BlockchainType } from '@/lib/models/multi-chain'
import { ObjectId } from 'mongodb'

/**
 * GET /api/multi-chain/wallets/[id]/transactions - Get wallet transaction history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)
    const url = new URL(request.url)
    
    // Parse query parameters
    const chain = url.searchParams.get('chain') as BlockchainType | null
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const minRiskScore = url.searchParams.get('minRiskScore') ? 
      parseInt(url.searchParams.get('minRiskScore')!) : undefined
    const bridgeOnly = url.searchParams.get('bridgeOnly') === 'true'
    const status = url.searchParams.get('status') as 'success' | 'failed' | 'pending' | null
    const includeStats = url.searchParams.get('stats') === 'true'
    
    // Date filters
    const startDate = url.searchParams.get('startDate') ? 
      new Date(url.searchParams.get('startDate')!) : undefined
    const endDate = url.searchParams.get('endDate') ? 
      new Date(url.searchParams.get('endDate')!) : undefined

    // Get transaction history
    const result = await CrossChainTransactionTracker.getTransactionHistory(walletId, {
      chain: chain || undefined,
      limit,
      offset,
      startDate,
      endDate,
      minRiskScore,
      bridgeOnly,
      status: status || undefined
    })

    let stats = null
    if (includeStats) {
      stats = await CrossChainTransactionTracker.getTransactionStats(walletId)
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.hasMore
        },
        stats
      }
    })
  } catch (error) {
    console.error('[Multi-chain Transactions] GET error:', error)
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
 * POST /api/multi-chain/wallets/[id]/transactions - Sync transaction history
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)
    const body = await request.json()
    const { limit = 100 } = body

    // Sync transactions
    const result = await CrossChainTransactionTracker.syncWalletTransactions(walletId, limit)

    return NextResponse.json({
      success: true,
      data: result,
      message: `Synced ${result.synced} new transactions`
    })
  } catch (error) {
    console.error('[Multi-chain Transaction Sync] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}