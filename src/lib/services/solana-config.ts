import { Connection, PublicKey, clusterApiUrl, Cluster } from '@solana/web3.js'

export interface SolanaConfig {
  network: Cluster
  rpcUrl: string
  tokenMintAddress: string
  burnAddress: string
  decimals: number
  maxRetries: number
  retryDelayMs: number
  requestTimeoutMs: number
}

export class SolanaConfigService {
  private static config: SolanaConfig | null = null
  
  static getConfig(): SolanaConfig {
    if (!this.config) {
      this.config = {
        network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || 'mainnet-beta',
        rpcUrl: process.env.SOLANA_PRIVATE_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('mainnet-beta'),
        tokenMintAddress: process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump',
        burnAddress: process.env.BURN_ADDRESS || '1111111111111111111111111111111111111111',
        decimals: parseInt(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || '6'),
        maxRetries: parseInt(process.env.SOLANA_MAX_RETRIES || '3'),
        retryDelayMs: parseInt(process.env.SOLANA_RETRY_DELAY_MS || '1000'),
        requestTimeoutMs: parseInt(process.env.SOLANA_REQUEST_TIMEOUT_MS || '30000')
      }
      
      console.log(`[SolanaConfig] Initialized with network: ${this.config.network}, RPC: ${this.config.rpcUrl}`)
    }
    
    return this.config
  }
  
  static getConnection(): Connection {
    const config = this.getConfig()
    return new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: undefined,
      httpHeaders: {
        'Content-Type': 'application/json'
      }
    })
  }
  
  static getBurnAddressPublicKey(): PublicKey {
    const config = this.getConfig()
    try {
      return new PublicKey(config.burnAddress)
    } catch (error) {
      console.error('[SolanaConfig] Invalid burn address:', config.burnAddress)
      throw new Error('Invalid burn address configuration')
    }
  }
  
  static getTokenMintPublicKey(): PublicKey {
    const config = this.getConfig()
    try {
      return new PublicKey(config.tokenMintAddress)
    } catch (error) {
      console.error('[SolanaConfig] Invalid token mint address:', config.tokenMintAddress)
      throw new Error('Invalid token mint address configuration')
    }
  }
  
  /**
   * Convert raw token amount to human-readable amount
   */
  static fromRawAmount(rawAmount: bigint): number {
    const config = this.getConfig()
    return Number(rawAmount) / Math.pow(10, config.decimals)
  }
  
  /**
   * Convert human-readable amount to raw token amount
   */
  static toRawAmount(amount: number): bigint {
    const config = this.getConfig()
    return BigInt(Math.round(amount * Math.pow(10, config.decimals)))
  }
  
  /**
   * Validate if an address is a valid Solana public key
   */
  static isValidPublicKey(address: string): boolean {
    try {
      new PublicKey(address)
      return true
    } catch {
      return false
    }
  }
}