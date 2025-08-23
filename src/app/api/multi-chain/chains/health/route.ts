import { NextRequest, NextResponse } from 'next/server'
import { MultiChainProviders } from '@/lib/services/multi-chain-providers'
import { MultiChainConfig } from '@/lib/services/multi-chain-config'

/**
 * GET /api/multi-chain/chains/health - Get health status of all blockchain connections
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const chain = url.searchParams.get('chain')

    if (chain) {
      // Check specific chain
      if (!MultiChainConfig.isValidChain(chain)) {
        return NextResponse.json(
          { success: false, error: `Invalid chain: ${chain}` },
          { status: 400 }
        )
      }

      const health = await MultiChainProviders.testConnection(chain)
      const config = MultiChainConfig.getChainConfig(chain)

      return NextResponse.json({
        success: true,
        data: {
          chain,
          health,
          config
        }
      })
    } else {
      // Check all chains
      const healthStatuses = await MultiChainProviders.getAllChainHealth()
      const configs = MultiChainConfig.getAllChainConfigs()
      
      const results = Array.from(healthStatuses.entries()).map(([chainType, health]) => ({
        chain: chainType,
        health,
        config: configs.get(chainType)
      }))

      // Calculate overall health
      const totalChains = results.length
      const healthyChains = results.filter(r => r.health.isHealthy).length
      const avgLatency = results.reduce((sum, r) => sum + r.health.latency, 0) / totalChains

      return NextResponse.json({
        success: true,
        data: {
          overall: {
            totalChains,
            healthyChains,
            unhealthyChains: totalChains - healthyChains,
            healthyPercentage: Math.round((healthyChains / totalChains) * 100),
            averageLatency: Math.round(avgLatency)
          },
          chains: results
        }
      })
    }
  } catch (error) {
    console.error('[Chain Health] GET error:', error)
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
 * POST /api/multi-chain/chains/health - Refresh chain connections
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshConnections } = body

    if (refreshConnections) {
      MultiChainProviders.refreshConnections()
      
      return NextResponse.json({
        success: true,
        message: 'Chain connections refreshed successfully'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'No action taken'
    })
  } catch (error) {
    console.error('[Chain Health Refresh] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}