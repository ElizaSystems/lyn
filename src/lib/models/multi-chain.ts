import { ObjectId } from 'mongodb'

/**
 * Supported blockchain types
 */
export type BlockchainType = 'solana' | 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'base'

/**
 * Chain configurations
 */
export interface ChainConfig {
  id: number
  name: string
  type: BlockchainType
  rpcUrl: string
  explorerUrl: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
}

/**
 * Multi-chain wallet data
 */
export interface MultiChainWallet {
  _id?: ObjectId
  // Primary identifier (can be any format)
  primaryAddress: string
  // Chain-specific addresses
  addresses: {
    [K in BlockchainType]?: string[]
  }
  // Metadata
  label?: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
  // Analytics data
  totalBalance: {
    usd: number
    lastUpdated: Date
  }
  riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
  lastAnalyzed: Date
}

/**
 * Cross-chain transaction data
 */
export interface CrossChainTransaction {
  _id?: ObjectId
  // Transaction identifiers
  hash: string
  chain: BlockchainType
  blockNumber: number
  timestamp: Date
  
  // Transaction details
  from: string
  to: string
  value: string // String to handle large numbers
  gasUsed?: string
  gasPrice?: string
  status: 'success' | 'failed' | 'pending'
  
  // Token transfer information
  tokenTransfers?: Array<{
    token: string
    from: string
    to: string
    amount: string
    symbol?: string
    decimals?: number
  }>
  
  // Bridge information
  isBridge: boolean
  bridgeInfo?: {
    sourceChain: BlockchainType
    destinationChain: BlockchainType
    bridgeProtocol: string
    correspondingTx?: string // Hash on destination chain
  }
  
  // Risk assessment
  riskScore: number
  riskFactors?: string[]
  
  // Indexing
  addresses: string[] // All addresses involved for easy querying
  createdAt: Date
}

/**
 * Multi-chain balance aggregation
 */
export interface MultiChainBalance {
  _id?: ObjectId
  walletId: ObjectId
  address: string
  
  // Balance by chain
  balances: {
    [K in BlockchainType]?: {
      nativeBalance: string
      tokens: Array<{
        address: string
        symbol: string
        name?: string
        decimals: number
        balance: string
        valueUsd?: number
      }>
      totalValueUsd: number
    }
  }
  
  // Aggregated totals
  totalValueUsd: number
  lastUpdated: Date
  createdAt: Date
}

/**
 * Bridge activity tracking
 */
export interface BridgeActivity {
  _id?: ObjectId
  
  // Transaction IDs
  sourceTxHash: string
  destinationTxHash?: string
  
  // Bridge details
  sourceChain: BlockchainType
  destinationChain: BlockchainType
  bridgeProtocol: string
  
  // User information
  userAddress: string // Normalized address
  sourceAddress: string
  destinationAddress: string
  
  // Asset information
  tokenAddress?: string
  tokenSymbol?: string
  amount: string
  valueUsd?: number
  
  // Status tracking
  status: 'initiated' | 'pending' | 'completed' | 'failed'
  initiatedAt: Date
  completedAt?: Date
  
  // Risk analysis
  riskScore: number
  riskFactors?: string[]
  
  createdAt: Date
  updatedAt: Date
}

/**
 * Cross-chain risk assessment
 */
export interface CrossChainRiskAssessment {
  _id?: ObjectId
  walletId: ObjectId
  addresses: string[]
  
  // Overall risk metrics
  overallRiskScore: number
  overallRiskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
  
  // Chain-specific risks
  chainRisks: {
    [K in BlockchainType]?: {
      riskScore: number
      riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
      riskFactors: string[]
      lastTransactionDate?: Date
      transactionCount: number
    }
  }
  
  // Cross-chain specific risks
  crossChainRisks: {
    bridgeActivity: {
      riskScore: number
      totalBridgeVolume: number
      suspiciousBridgeActivity: string[]
    }
    addressReuse: {
      riskScore: number
      crossChainAddressConnections: Array<{
        chain1: BlockchainType
        chain2: BlockchainType
        confidence: number
      }>
    }
    timing: {
      riskScore: number
      suspiciousTimingPatterns: string[]
    }
  }
  
  // Recommendations
  recommendations: string[]
  
  lastAnalyzed: Date
  createdAt: Date
}

/**
 * Multi-chain analytics data
 */
export interface MultiChainAnalytics {
  _id?: ObjectId
  date: Date // Daily aggregation
  
  // Overall platform metrics
  totalWallets: number
  totalTransactions: number
  totalVolumeUsd: number
  
  // Chain-specific metrics
  chainMetrics: {
    [K in BlockchainType]?: {
      activeWallets: number
      transactionCount: number
      volumeUsd: number
      averageTransactionValue: number
    }
  }
  
  // Bridge activity
  bridgeMetrics: {
    totalBridgeTransactions: number
    bridgeVolumeUsd: number
    popularRoutes: Array<{
      sourceChain: BlockchainType
      destinationChain: BlockchainType
      count: number
      volumeUsd: number
    }>
  }
  
  // Risk metrics
  riskMetrics: {
    highRiskWallets: number
    suspiciousTransactions: number
    bridgeAnomalies: number
  }
  
  createdAt: Date
}

/**
 * RPC endpoint configuration
 */
export interface RpcEndpoint {
  _id?: ObjectId
  chain: BlockchainType
  url: string
  priority: number // Lower number = higher priority
  isActive: boolean
  
  // Health metrics
  latency?: number
  successRate?: number
  lastChecked?: Date
  
  // Rate limiting
  requestsPerSecond?: number
  dailyRequestLimit?: number
  
  createdAt: Date
  updatedAt: Date
}

/**
 * Address validation results
 */
export interface AddressValidation {
  address: string
  chain: BlockchainType
  isValid: boolean
  format: string // e.g., 'base58', 'hex', 'bech32'
  errorMessage?: string
}

/**
 * Token information for multi-chain tokens
 */
export interface MultiChainToken {
  _id?: ObjectId
  
  // Token identification
  symbol: string
  name: string
  
  // Chain deployments
  deployments: {
    [K in BlockchainType]?: {
      address: string
      decimals: number
      isNative?: boolean
    }
  }
  
  // Metadata
  logoUrl?: string
  description?: string
  website?: string
  
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high'
  riskFactors?: string[]
  
  // Market data
  priceUsd?: number
  marketCapUsd?: number
  
  createdAt: Date
  updatedAt: Date
}

/**
 * Chain activity summary for UI display
 */
export interface ChainActivitySummary {
  chain: BlockchainType
  totalTransactions: number
  totalVolumeUsd: number
  lastActivity: Date
  riskScore: number
  bridgeTransactions: number
}