import { BlockchainType, ChainConfig } from '@/lib/models/multi-chain'

/**
 * Multi-chain configuration and RPC management
 */
export class MultiChainConfig {
  private static chainConfigs: Map<BlockchainType, ChainConfig> = new Map()

  /**
   * Initialize chain configurations
   */
  static initialize() {
    // Solana
    this.chainConfigs.set('solana', {
      id: 101, // Mainnet
      name: 'Solana',
      type: 'solana',
      rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      explorerUrl: 'https://solscan.io',
      nativeCurrency: {
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9
      }
    })

    // Ethereum
    this.chainConfigs.set('ethereum', {
      id: 1,
      name: 'Ethereum',
      type: 'ethereum',
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/demo',
      explorerUrl: 'https://etherscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    })

    // Binance Smart Chain
    this.chainConfigs.set('bsc', {
      id: 56,
      name: 'BNB Smart Chain',
      type: 'bsc',
      rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
      explorerUrl: 'https://bscscan.com',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      }
    })

    // Polygon
    this.chainConfigs.set('polygon', {
      id: 137,
      name: 'Polygon',
      type: 'polygon',
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      explorerUrl: 'https://polygonscan.com',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      }
    })

    // Arbitrum
    this.chainConfigs.set('arbitrum', {
      id: 42161,
      name: 'Arbitrum One',
      type: 'arbitrum',
      rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      explorerUrl: 'https://arbiscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    })

    // Base
    this.chainConfigs.set('base', {
      id: 8453,
      name: 'Base',
      type: 'base',
      rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      explorerUrl: 'https://basescan.org',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    })
  }

  /**
   * Get chain configuration
   */
  static getChainConfig(chain: BlockchainType): ChainConfig | undefined {
    if (this.chainConfigs.size === 0) {
      this.initialize()
    }
    return this.chainConfigs.get(chain)
  }

  /**
   * Get all chain configurations
   */
  static getAllChainConfigs(): Map<BlockchainType, ChainConfig> {
    if (this.chainConfigs.size === 0) {
      this.initialize()
    }
    return new Map(this.chainConfigs)
  }

  /**
   * Get EVM chains only
   */
  static getEvmChains(): BlockchainType[] {
    return ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base']
  }

  /**
   * Check if chain is EVM compatible
   */
  static isEvmChain(chain: BlockchainType): boolean {
    return this.getEvmChains().includes(chain)
  }

  /**
   * Get chain by ID
   */
  static getChainById(chainId: number): BlockchainType | undefined {
    if (this.chainConfigs.size === 0) {
      this.initialize()
    }
    
    for (const [type, config] of this.chainConfigs) {
      if (config.id === chainId) {
        return type
      }
    }
    return undefined
  }

  /**
   * Update RPC URL for a chain
   */
  static updateRpcUrl(chain: BlockchainType, rpcUrl: string): void {
    const config = this.chainConfigs.get(chain)
    if (config) {
      config.rpcUrl = rpcUrl
      this.chainConfigs.set(chain, config)
    }
  }

  /**
   * Get fallback RPC URLs
   */
  static getFallbackRpcUrls(chain: BlockchainType): string[] {
    const fallbacks: Record<BlockchainType, string[]> = {
      solana: [
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
        'https://rpc.ankr.com/solana'
      ],
      ethereum: [
        'https://eth-mainnet.alchemyapi.io/v2/demo',
        'https://mainnet.infura.io/v3/demo',
        'https://rpc.ankr.com/eth'
      ],
      bsc: [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://rpc.ankr.com/bsc'
      ],
      polygon: [
        'https://polygon-rpc.com',
        'https://rpc-mainnet.maticvigil.com',
        'https://rpc.ankr.com/polygon'
      ],
      arbitrum: [
        'https://arb1.arbitrum.io/rpc',
        'https://arbitrum-mainnet.infura.io/v3/demo',
        'https://rpc.ankr.com/arbitrum'
      ],
      base: [
        'https://mainnet.base.org',
        'https://developer-access-mainnet.base.org',
        'https://rpc.ankr.com/base'
      ]
    }

    return fallbacks[chain] || []
  }

  /**
   * Get supported chains list
   */
  static getSupportedChains(): BlockchainType[] {
    return Array.from(this.chainConfigs.keys())
  }

  /**
   * Validate chain type
   */
  static isValidChain(chain: string): chain is BlockchainType {
    return ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base'].includes(chain as BlockchainType)
  }
}

// Initialize on import
MultiChainConfig.initialize()