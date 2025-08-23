import { NextRequest, NextResponse } from 'next/server'
import { BridgeMonitorService } from '@/lib/services/bridge-monitor'
import { BlockchainType } from '@/lib/models/multi-chain'

/**
 * GET /api/multi-chain/bridges - Get bridge activity and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userAddress = url.searchParams.get('userAddress')
    const chain = url.searchParams.get('chain') as BlockchainType | null
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const includeStats = url.searchParams.get('stats') === 'true'

    let result: any = {}

    if (userAddress) {
      // Get bridge activity for specific user
      result.userActivity = await BridgeMonitorService.getUserBridgeActivity(userAddress, limit)
      
      // Get suspicious patterns for the user
      result.suspiciousPatterns = await BridgeMonitorService.detectSuspiciousBridgePatterns(userAddress)
    }

    if (chain) {
      // Get bridge activity for specific chain
      result.chainActivity = await BridgeMonitorService.getChainBridgeActivity(chain)
    }

    if (includeStats) {
      // Get overall bridge statistics
      result.stats = await BridgeMonitorService.getBridgeStats()
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[Multi-chain Bridges] GET error:', error)
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
 * POST /api/multi-chain/bridges - Track new bridge activity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userAddress,
      txHash,
      sourceChain,
      bridgeProtocol,
      amount,
      tokenSymbol,
      destinationChain
    } = body

    if (!userAddress || !txHash || !sourceChain || !bridgeProtocol || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userAddress, txHash, sourceChain, bridgeProtocol, amount' },
        { status: 400 }
      )
    }

    // Validate chain types
    const validChains = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base']
    if (!validChains.includes(sourceChain)) {
      return NextResponse.json(
        { success: false, error: `Invalid source chain: ${sourceChain}` },
        { status: 400 }
      )
    }

    if (destinationChain && !validChains.includes(destinationChain)) {
      return NextResponse.json(
        { success: false, error: `Invalid destination chain: ${destinationChain}` },
        { status: 400 }
      )
    }

    // Track bridge activity
    const bridgeActivity = await BridgeMonitorService.trackBridgeActivity(
      userAddress,
      txHash,
      sourceChain as BlockchainType,
      bridgeProtocol,
      amount,
      tokenSymbol,
      destinationChain as BlockchainType
    )

    return NextResponse.json({
      success: true,
      data: bridgeActivity,
      message: 'Bridge activity tracked successfully'
    })
  } catch (error) {
    console.error('[Multi-chain Bridge Tracking] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}