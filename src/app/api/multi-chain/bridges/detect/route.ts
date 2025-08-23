import { NextRequest, NextResponse } from 'next/server'
import { BridgeMonitorService } from '@/lib/services/bridge-monitor'
import { BlockchainType } from '@/lib/models/multi-chain'

/**
 * POST /api/multi-chain/bridges/detect - Detect if a transaction is a bridge transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { txHash, chain } = body

    if (!txHash || !chain) {
      return NextResponse.json(
        { success: false, error: 'Transaction hash and chain are required' },
        { status: 400 }
      )
    }

    // Validate chain type
    const validChains = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base']
    if (!validChains.includes(chain)) {
      return NextResponse.json(
        { success: false, error: `Invalid chain: ${chain}. Valid chains: ${validChains.join(', ')}` },
        { status: 400 }
      )
    }

    // Detect bridge transaction
    const result = await BridgeMonitorService.detectBridgeTransaction(
      txHash,
      chain as BlockchainType
    )

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[Bridge Detection] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}