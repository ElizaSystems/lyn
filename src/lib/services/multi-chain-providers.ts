import { ethers } from 'ethers'
import { Connection, PublicKey } from '@solana/web3.js'
import { BlockchainType } from '@/lib/models/multi-chain'
import { MultiChainConfig } from './multi-chain-config'

/**
 * Multi-chain provider management for blockchain connections
 */
export class MultiChainProviders {
  private static solanaConnection: Connection | null = null
  private static evmProviders: Map<BlockchainType, ethers.JsonRpcProvider> = new Map()

  /**
   * Get Solana connection
   */
  static getSolanaConnection(): Connection {
    if (!this.solanaConnection) {
      const config = MultiChainConfig.getChainConfig('solana')
      if (!config) {
        throw new Error('Solana configuration not found')
      }
      this.solanaConnection = new Connection(config.rpcUrl, 'confirmed')
    }
    return this.solanaConnection
  }

  /**
   * Get EVM provider for a specific chain
   */
  static getEvmProvider(chain: BlockchainType): ethers.JsonRpcProvider {
    if (!MultiChainConfig.isEvmChain(chain)) {
      throw new Error(`${chain} is not an EVM chain`)
    }

    if (!this.evmProviders.has(chain)) {
      const config = MultiChainConfig.getChainConfig(chain)
      if (!config) {
        throw new Error(`Configuration for ${chain} not found`)
      }
      
      const provider = new ethers.JsonRpcProvider(config.rpcUrl)
      this.evmProviders.set(chain, provider)
    }

    return this.evmProviders.get(chain)!
  }

  /**
   * Get provider for any chain type
   */
  static getProvider(chain: BlockchainType): Connection | ethers.JsonRpcProvider {
    if (chain === 'solana') {
      return this.getSolanaConnection()
    } else if (MultiChainConfig.isEvmChain(chain)) {
      return this.getEvmProvider(chain)
    } else {
      throw new Error(`Unsupported chain: ${chain}`)
    }
  }

  /**
   * Test connection health for a specific chain
   */
  static async testConnection(chain: BlockchainType): Promise<{
    isHealthy: boolean
    latency: number
    error?: string
  }> {
    const startTime = Date.now()
    
    try {
      if (chain === 'solana') {
        const connection = this.getSolanaConnection()
        await connection.getSlot()
      } else if (MultiChainConfig.isEvmChain(chain)) {
        const provider = this.getEvmProvider(chain)
        await provider.getBlockNumber()
      } else {
        throw new Error(`Unsupported chain: ${chain}`)
      }

      const latency = Date.now() - startTime
      return {
        isHealthy: true,
        latency
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        isHealthy: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Switch to fallback RPC for a chain
   */
  static async switchToFallback(chain: BlockchainType): Promise<boolean> {
    const fallbackUrls = MultiChainConfig.getFallbackRpcUrls(chain)
    
    for (const url of fallbackUrls) {
      try {
        if (chain === 'solana') {
          const testConnection = new Connection(url, 'confirmed')
          await testConnection.getSlot()
          this.solanaConnection = testConnection
          MultiChainConfig.updateRpcUrl(chain, url)
          return true
        } else if (MultiChainConfig.isEvmChain(chain)) {
          const testProvider = new ethers.JsonRpcProvider(url)
          await testProvider.getBlockNumber()
          this.evmProviders.set(chain, testProvider)
          MultiChainConfig.updateRpcUrl(chain, url)
          return true
        }
      } catch (error) {
        console.warn(`Fallback RPC ${url} for ${chain} failed:`, error)
        continue
      }
    }
    
    return false
  }

  /**
   * Get all chain health statuses
   */
  static async getAllChainHealth(): Promise<Map<BlockchainType, {
    isHealthy: boolean
    latency: number
    error?: string
  }>> {
    const chains = MultiChainConfig.getSupportedChains()
    const healthPromises = chains.map(async (chain) => {
      const health = await this.testConnection(chain)
      return [chain, health] as const
    })

    const results = await Promise.all(healthPromises)
    return new Map(results)
  }

  /**
   * Refresh all connections (useful for RPC updates)
   */
  static refreshConnections(): void {
    this.solanaConnection = null
    this.evmProviders.clear()
  }

  /**
   * Get connection info for debugging
   */
  static getConnectionInfo(): {
    solana: string | null
    evm: Array<{ chain: BlockchainType; url: string }>
  } {
    const solanaConfig = MultiChainConfig.getChainConfig('solana')
    const evmInfo: Array<{ chain: BlockchainType; url: string }> = []

    for (const [chain, provider] of this.evmProviders) {
      const config = MultiChainConfig.getChainConfig(chain)
      if (config) {
        evmInfo.push({ chain, url: config.rpcUrl })
      }
    }

    return {
      solana: solanaConfig?.rpcUrl || null,
      evm: evmInfo
    }
  }
}

/**
 * Utility function to get the appropriate provider with automatic fallback
 */
export async function getProviderWithFallback(chain: BlockchainType): Promise<Connection | ethers.JsonRpcProvider> {
  try {
    const provider = MultiChainProviders.getProvider(chain)
    
    // Test the connection
    const health = await MultiChainProviders.testConnection(chain)
    if (!health.isHealthy) {
      console.warn(`Primary RPC for ${chain} unhealthy, switching to fallback`)
      const switched = await MultiChainProviders.switchToFallback(chain)
      if (!switched) {
        throw new Error(`All RPC endpoints for ${chain} are unavailable`)
      }
      return MultiChainProviders.getProvider(chain)
    }
    
    return provider
  } catch (error) {
    console.error(`Failed to get provider for ${chain}:`, error)
    throw error
  }
}