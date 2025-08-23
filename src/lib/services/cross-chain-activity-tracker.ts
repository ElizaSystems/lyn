import { ethers } from 'ethers'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getDatabase } from '@/lib/mongodb'
import { 
  BlockchainType, 
  CrossChainTransaction, 
  MultiChainWallet, 
  MultiChainBalance,
  ChainActivitySummary 
} from '@/lib/models/multi-chain'
import { MultiChainProviders } from './multi-chain-providers'
import { MultiChainConfig } from './multi-chain-config'
import { AddressValidationService } from './address-validation'
import { ObjectId } from 'mongodb'

/**
 * Cross-chain wallet activity tracking service
 */
export class CrossChainActivityTracker {
  /**
   * Get database collections
   */
  private static async getCollections() {
    const db = await getDatabase()
    return {
      wallets: db.collection<MultiChainWallet>('multi_chain_wallets'),
      transactions: db.collection<CrossChainTransaction>('cross_chain_transactions'),
      balances: db.collection<MultiChainBalance>('multi_chain_balances')
    }
  }

  /**
   * Track wallet across multiple chains
   */
  static async trackWallet(
    primaryAddress: string, 
    chains: BlockchainType[],
    label?: string
  ): Promise<MultiChainWallet> {
    const { wallets } = await this.getCollections()

    // Validate addresses for all chains
    const addresses: { [K in BlockchainType]?: string[] } = {}
    let totalBalance = 0

    for (const chain of chains) {
      const validation = AddressValidationService.validateAddress(primaryAddress, chain)
      if (validation.isValid) {
        const normalizedAddress = AddressValidationService.normalizeAddress(primaryAddress, chain)
        addresses[chain] = [normalizedAddress]

        // Get initial balance
        try {
          const balance = await this.getChainBalance(normalizedAddress, chain)
          totalBalance += balance.totalValueUsd
        } catch (error) {
          console.warn(`Failed to get initial balance for ${chain}:`, error)
        }
      }
    }

    const wallet: MultiChainWallet = {
      primaryAddress,
      addresses,
      label,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      totalBalance: {
        usd: totalBalance,
        lastUpdated: new Date()
      },
      riskLevel: 'low',
      lastAnalyzed: new Date()
    }

    const result = await wallets.insertOne(wallet)
    return { ...wallet, _id: result.insertedId }
  }

  /**
   * Get wallet balance for a specific chain
   */
  static async getChainBalance(address: string, chain: BlockchainType): Promise<{
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
  }> {
    try {
      if (chain === 'solana') {
        return await this.getSolanaBalance(address)
      } else if (MultiChainConfig.isEvmChain(chain)) {
        return await this.getEvmBalance(address, chain)
      } else {
        throw new Error(`Unsupported chain: ${chain}`)
      }
    } catch (error) {
      console.error(`Failed to get balance for ${address} on ${chain}:`, error)
      return {
        nativeBalance: '0',
        tokens: [],
        totalValueUsd: 0
      }
    }
  }

  /**
   * Get Solana wallet balance
   */
  private static async getSolanaBalance(address: string): Promise<{
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
  }> {
    const connection = MultiChainProviders.getSolanaConnection()
    const publicKey = new PublicKey(address)

    // Get SOL balance
    const lamports = await connection.getBalance(publicKey)
    const solBalance = lamports / LAMPORTS_PER_SOL

    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    )

    const tokens = tokenAccounts.value
      .filter(account => {
        const tokenAmount = account.account.data.parsed.info.tokenAmount
        return parseFloat(tokenAmount.amount) > 0
      })
      .map(account => {
        const info = account.account.data.parsed.info
        const tokenAmount = info.tokenAmount
        
        return {
          address: info.mint,
          symbol: 'Unknown', // Would need token registry lookup
          decimals: tokenAmount.decimals,
          balance: tokenAmount.amount,
          valueUsd: 0 // Would need price lookup
        }
      })

    // Estimate total USD value (would need price API)
    const totalValueUsd = solBalance * 100 // Placeholder SOL price

    return {
      nativeBalance: lamports.toString(),
      tokens,
      totalValueUsd
    }
  }

  /**
   * Get EVM wallet balance
   */
  private static async getEvmBalance(address: string, chain: BlockchainType): Promise<{
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
  }> {
    const provider = MultiChainProviders.getEvmProvider(chain)
    
    // Get native balance
    const balance = await provider.getBalance(address)
    const nativeBalance = balance.toString()

    // For now, return basic balance (would need token detection)
    // In production, you'd use services like Moralis, Alchemy, or CovalentHQ
    const ethPriceUsd = 2000 // Placeholder price
    const balanceEth = parseFloat(ethers.formatEther(balance))
    const totalValueUsd = balanceEth * ethPriceUsd

    return {
      nativeBalance,
      tokens: [], // Would need token detection implementation
      totalValueUsd
    }
  }

  /**
   * Get transaction history for a wallet across all chains
   */
  static async getWalletTransactionHistory(
    walletId: ObjectId,
    limit: number = 100
  ): Promise<CrossChainTransaction[]> {
    const { transactions } = await this.getCollections()

    return await transactions
      .find({ addresses: { $exists: true } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Get chain-specific transaction history
   */
  static async getChainTransactionHistory(
    address: string,
    chain: BlockchainType,
    limit: number = 100
  ): Promise<CrossChainTransaction[]> {
    try {
      if (chain === 'solana') {
        return await this.getSolanaTransactionHistory(address, limit)
      } else if (MultiChainConfig.isEvmChain(chain)) {
        return await this.getEvmTransactionHistory(address, chain, limit)
      } else {
        throw new Error(`Unsupported chain: ${chain}`)
      }
    } catch (error) {
      console.error(`Failed to get transaction history for ${address} on ${chain}:`, error)
      return []
    }
  }

  /**
   * Get Solana transaction history
   */
  private static async getSolanaTransactionHistory(
    address: string,
    limit: number
  ): Promise<CrossChainTransaction[]> {
    const connection = MultiChainProviders.getSolanaConnection()
    const publicKey = new PublicKey(address)

    const signatures = await connection.getSignaturesForAddress(publicKey, { limit })
    const transactions: CrossChainTransaction[] = []

    for (const sig of signatures) {
      const tx = await connection.getParsedTransaction(sig.signature)
      if (!tx || !tx.meta || !tx.blockTime) continue

      const crossChainTx: CrossChainTransaction = {
        hash: sig.signature,
        chain: 'solana',
        blockNumber: tx.slot,
        timestamp: new Date(tx.blockTime * 1000),
        from: address, // Simplified
        to: 'unknown', // Would need to parse instructions
        value: '0', // Would need to calculate from transfers
        status: tx.meta.err ? 'failed' : 'success',
        isBridge: false, // Would need bridge detection
        riskScore: 0,
        addresses: [address],
        createdAt: new Date()
      }

      transactions.push(crossChainTx)
    }

    return transactions
  }

  /**
   * Get EVM transaction history
   */
  private static async getEvmTransactionHistory(
    address: string,
    chain: BlockchainType,
    limit: number
  ): Promise<CrossChainTransaction[]> {
    // For now, return empty array
    // In production, you'd use services like Etherscan API, Moralis, etc.
    console.log(`EVM transaction history for ${address} on ${chain} - would need API integration`)
    return []
  }

  /**
   * Update wallet balances across all chains
   */
  static async updateWalletBalances(walletId: ObjectId): Promise<MultiChainBalance> {
    const { wallets, balances } = await this.getCollections()
    
    const wallet = await wallets.findOne({ _id: walletId })
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    const chainBalances: { [K in BlockchainType]?: any } = {}
    let totalValueUsd = 0

    // Update balances for each chain
    for (const [chain, addressList] of Object.entries(wallet.addresses)) {
      if (addressList && addressList.length > 0) {
        const chainType = chain as BlockchainType
        const address = addressList[0] // Use first address

        try {
          const balance = await this.getChainBalance(address, chainType)
          chainBalances[chainType] = balance
          totalValueUsd += balance.totalValueUsd
        } catch (error) {
          console.warn(`Failed to update balance for ${chain}:`, error)
        }
      }
    }

    const balanceDoc: MultiChainBalance = {
      walletId,
      address: wallet.primaryAddress,
      balances: chainBalances,
      totalValueUsd,
      lastUpdated: new Date(),
      createdAt: new Date()
    }

    await balances.replaceOne(
      { walletId },
      balanceDoc,
      { upsert: true }
    )

    // Update wallet total balance
    await wallets.updateOne(
      { _id: walletId },
      {
        $set: {
          'totalBalance.usd': totalValueUsd,
          'totalBalance.lastUpdated': new Date(),
          updatedAt: new Date()
        }
      }
    )

    return balanceDoc
  }

  /**
   * Get activity summary across all chains for a wallet
   */
  static async getWalletActivitySummary(walletId: ObjectId): Promise<ChainActivitySummary[]> {
    const { wallets, transactions } = await this.getCollections()
    
    const wallet = await wallets.findOne({ _id: walletId })
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    const summaries: ChainActivitySummary[] = []

    for (const [chain, addressList] of Object.entries(wallet.addresses)) {
      if (addressList && addressList.length > 0) {
        const chainType = chain as BlockchainType
        const address = addressList[0]

        // Get transaction stats
        const chainTransactions = await transactions
          .find({ 
            chain: chainType,
            addresses: address
          })
          .toArray()

        const totalTransactions = chainTransactions.length
        const totalVolumeUsd = chainTransactions.reduce((sum, tx) => {
          return sum + (parseFloat(tx.value) || 0) * 100 // Placeholder price
        }, 0)

        const lastActivity = chainTransactions.length > 0 
          ? chainTransactions[0].timestamp 
          : new Date(0)

        const bridgeTransactions = chainTransactions.filter(tx => tx.isBridge).length
        const avgRiskScore = chainTransactions.length > 0
          ? chainTransactions.reduce((sum, tx) => sum + tx.riskScore, 0) / chainTransactions.length
          : 0

        summaries.push({
          chain: chainType,
          totalTransactions,
          totalVolumeUsd,
          lastActivity,
          riskScore: Math.round(avgRiskScore),
          bridgeTransactions
        })
      }
    }

    return summaries
  }

  /**
   * Search wallets by address across chains
   */
  static async findWalletByAddress(address: string): Promise<MultiChainWallet[]> {
    const { wallets } = await this.getCollections()

    // Search in primary address and all chain addresses
    return await wallets
      .find({
        $or: [
          { primaryAddress: address },
          { 'addresses.solana': address },
          { 'addresses.ethereum': address },
          { 'addresses.bsc': address },
          { 'addresses.polygon': address },
          { 'addresses.arbitrum': address },
          { 'addresses.base': address }
        ]
      })
      .toArray()
  }

  /**
   * Get all tracked wallets with pagination
   */
  static async getAllWallets(
    page: number = 1,
    limit: number = 50
  ): Promise<{
    wallets: MultiChainWallet[]
    total: number
    hasMore: boolean
  }> {
    const { wallets } = await this.getCollections()
    
    const skip = (page - 1) * limit
    
    const [walletList, total] = await Promise.all([
      wallets
        .find({})
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      wallets.countDocuments({})
    ])

    return {
      wallets: walletList,
      total,
      hasMore: skip + walletList.length < total
    }
  }

  /**
   * Delete wallet tracking
   */
  static async deleteWallet(walletId: ObjectId): Promise<void> {
    const { wallets, transactions, balances } = await this.getCollections()

    await Promise.all([
      wallets.deleteOne({ _id: walletId }),
      transactions.deleteMany({ walletId }),
      balances.deleteMany({ walletId })
    ])
  }

  /**
   * Add chain to existing wallet
   */
  static async addChainToWallet(
    walletId: ObjectId,
    chain: BlockchainType,
    address: string
  ): Promise<void> {
    const { wallets } = await this.getCollections()

    // Validate the address
    const validation = AddressValidationService.validateAddress(address, chain)
    if (!validation.isValid) {
      throw new Error(`Invalid ${chain} address: ${validation.errorMessage}`)
    }

    const normalizedAddress = AddressValidationService.normalizeAddress(address, chain)

    await wallets.updateOne(
      { _id: walletId },
      {
        $addToSet: { [`addresses.${chain}`]: normalizedAddress },
        $set: { updatedAt: new Date() }
      }
    )
  }

  /**
   * Update wallet risk level
   */
  static async updateWalletRiskLevel(
    walletId: ObjectId,
    riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    const { wallets } = await this.getCollections()

    await wallets.updateOne(
      { _id: walletId },
      {
        $set: {
          riskLevel,
          lastAnalyzed: new Date(),
          updatedAt: new Date()
        }
      }
    )
  }
}