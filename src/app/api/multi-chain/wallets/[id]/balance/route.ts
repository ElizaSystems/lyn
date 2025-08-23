import { NextRequest, NextResponse } from 'next/server'
import { MultiChainBalanceAggregator } from '@/lib/services/multi-chain-balance-aggregator'
import { ObjectId } from 'mongodb'

/**
 * GET /api/multi-chain/wallets/[id]/balance - Get wallet balance across all chains
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)
    const url = new URL(request.url)
    const includePortfolio = url.searchParams.get('portfolio') === 'true'

    // Get aggregated balance
    const balance = await MultiChainBalanceAggregator.getAggregatedBalance(walletId)

    let portfolio = null
    if (includePortfolio) {
      portfolio = await MultiChainBalanceAggregator.getPortfolioDistribution(walletId)
    }

    return NextResponse.json({
      success: true,
      data: {
        balance,
        portfolio
      }
    })
  } catch (error) {
    console.error('[Multi-chain Balance] GET error:', error)
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
 * POST /api/multi-chain/wallets/[id]/balance - Update wallet balance
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)
    const body = await request.json()
    const { chains, addresses } = body

    if (chains && addresses) {
      // Update balance for specific chains
      const updatedBalance = await MultiChainBalanceAggregator.updateAllBalances(
        walletId,
        addresses
      )

      return NextResponse.json({
        success: true,
        data: updatedBalance,
        message: 'Balance updated successfully'
      })
    } else {
      // Get wallet and update all balances
      const { CrossChainActivityTracker } = await import('@/lib/services/cross-chain-activity-tracker')
      const wallets = await CrossChainActivityTracker.getAllWallets(1, 1000)
      const wallet = wallets.wallets.find(w => w._id?.toString() === params.id)
      
      if (!wallet) {
        return NextResponse.json(
          { success: false, error: 'Wallet not found' },
          { status: 404 }
        )
      }

      const updatedBalance = await MultiChainBalanceAggregator.updateAllBalances(
        walletId,
        wallet.addresses
      )

      return NextResponse.json({
        success: true,
        data: updatedBalance,
        message: 'All balances updated successfully'
      })
    }
  } catch (error) {
    console.error('[Multi-chain Balance Update] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}