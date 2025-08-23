import { ethers } from 'ethers'
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js'
import { getDatabase } from '@/lib/mongodb'
import { 
  BlockchainType, 
  CrossChainTransaction,
  MultiChainWallet 
} from '@/lib/models/multi-chain'
import { MultiChainProviders } from './multi-chain-providers'
import { MultiChainConfig } from './multi-chain-config'
import { AddressValidationService } from './address-validation'
import { BridgeMonitorService } from './bridge-monitor'
import { ObjectId } from 'mongodb'

/**
 * Cross-chain transaction history tracking service
 */
export class CrossChainTransactionTracker {
  /**
   * Get database collections
   */
  private static async getCollections() {
    const db = await getDatabase()
    return {
      transactions: db.collection<CrossChainTransaction>('cross_chain_transactions'),
      wallets: db.collection<MultiChainWallet>('multi_chain_wallets')
    }
  }

  /**
   * Sync transaction history for a wallet across all tracked chains
   */
  static async syncWalletTransactions(
    walletId: ObjectId,
    limit: number = 100
  ): Promise<{
    synced: number
    newTransactions: CrossChainTransaction[]
    errors: Array<{ chain: BlockchainType; error: string }>
  }> {
    const { wallets } = await this.getCollections()
    
    const wallet = await wallets.findOne({ _id: walletId })
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    let totalSynced = 0
    const newTransactions: CrossChainTransaction[] = []
    const errors: Array<{ chain: BlockchainType; error: string }> = []

    // Sync each chain
    for (const [chain, addressList] of Object.entries(wallet.addresses)) {
      if (!addressList || addressList.length === 0) continue

      const chainType = chain as BlockchainType
      const address = addressList[0] // Use first address

      try {
        console.log(`Syncing transactions for ${chainType}: ${address}`)
        const result = await this.syncChainTransactions(address, chainType, limit)
        
        totalSynced += result.synced
        newTransactions.push(...result.newTransactions)
      } catch (error) {
        console.error(`Failed to sync ${chainType} transactions:`, error)
        errors.push({
          chain: chainType,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return {
      synced: totalSynced,
      newTransactions,
      errors
    }
  }

  /**
   * Sync transactions for a specific chain and address
   */
  static async syncChainTransactions(
    address: string,
    chain: BlockchainType,
    limit: number = 100
  ): Promise<{
    synced: number
    newTransactions: CrossChainTransaction[]
  }> {
    const { transactions } = await this.getCollections()

    // Get existing transaction hashes to avoid duplicates
    const existingHashes = new Set(
      (await transactions
        .find({ chain, addresses: address })
        .project({ hash: 1 })
        .toArray()
      ).map(tx => tx.hash)
    )

    // Fetch transactions from blockchain
    const chainTransactions = await this.fetchChainTransactions(address, chain, limit)
    
    // Filter out existing transactions
    const newTransactions = chainTransactions.filter(tx => !existingHashes.has(tx.hash))

    if (newTransactions.length === 0) {
      return { synced: 0, newTransactions: [] }
    }

    // Insert new transactions
    await transactions.insertMany(newTransactions)

    console.log(`Synced ${newTransactions.length} new ${chain} transactions for ${address}`)

    return {
      synced: newTransactions.length,
      newTransactions
    }
  }

  /**
   * Fetch transactions from a specific blockchain
   */
  private static async fetchChainTransactions(
    address: string,
    chain: BlockchainType,
    limit: number
  ): Promise<CrossChainTransaction[]> {
    if (chain === 'solana') {
      return await this.fetchSolanaTransactions(address, limit)
    } else if (MultiChainConfig.isEvmChain(chain)) {
      return await this.fetchEvmTransactions(address, chain, limit)
    } else {
      throw new Error(`Unsupported chain: ${chain}`)
    }
  }

  /**
   * Fetch Solana transactions
   */
  private static async fetchSolanaTransactions(
    address: string,
    limit: number
  ): Promise<CrossChainTransaction[]> {
    const connection = MultiChainProviders.getSolanaConnection()
    const publicKey = new PublicKey(address)

    const signatures = await connection.getSignaturesForAddress(publicKey, { limit })
    const transactions: CrossChainTransaction[] = []

    for (const sig of signatures) {
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        })
        
        if (!tx || !tx.meta || !tx.blockTime) continue

        // Parse transaction details
        const parsedTx = await this.parseSolanaTransaction(tx, address, sig.signature)
        if (parsedTx) {
          transactions.push(parsedTx)
        }
      } catch (error) {
        console.warn(`Failed to parse Solana transaction ${sig.signature}:`, error)
      }
    }

    return transactions
  }

  /**
   * Parse Solana transaction
   */
  private static async parseSolanaTransaction(
    tx: ParsedTransactionWithMeta,
    userAddress: string,
    signature: string
  ): Promise<CrossChainTransaction | null> {
    try {
      const message = tx.transaction.message
      const meta = tx.meta!

      // Get all involved addresses
      const addresses: string[] = []
      
      if ('accountKeys' in message) {
        // Legacy transaction format
        for (const key of message.accountKeys) {
          const keyString = typeof key === 'string' ? key : key.toString()
          addresses.push(keyString)
        }
      } else if ('staticAccountKeys' in message) {
        // Versioned transaction format
        for (const key of message.staticAccountKeys) {
          addresses.push(key.toString())
        }
        if (message.addressTableLookups) {
          // Would need to resolve address table lookups
        }
      }

      // Calculate transaction value (simplified)
      let value = '0'
      let from = userAddress
      let to = 'unknown'

      // Check for SOL transfers
      if (meta.preBalances && meta.postBalances) {
        for (let i = 0; i < meta.preBalances.length; i++) {
          const balanceChange = meta.postBalances[i] - meta.preBalances[i]
          if (Math.abs(balanceChange) > 0 && addresses[i] === userAddress) {
            value = Math.abs(balanceChange).toString()
            if (balanceChange < 0) {
              from = userAddress
              // Find recipient (simplified)
              for (let j = 0; j < meta.preBalances.length; j++) {
                const otherChange = meta.postBalances[j] - meta.preBalances[j]
                if (otherChange > 0 && j !== i) {
                  to = addresses[j] || 'unknown'
                  break
                }
              }
            } else {
              to = userAddress
              // Find sender (simplified)
              for (let j = 0; j < meta.preBalances.length; j++) {
                const otherChange = meta.postBalances[j] - meta.preBalances[j]
                if (otherChange < 0 && j !== i) {
                  from = addresses[j] || 'unknown'
                  break
                }
              }
            }
            break
          }
        }
      }

      // Check if it's a bridge transaction
      const bridgeResult = await BridgeMonitorService.detectBridgeTransaction(signature, 'solana')

      const crossChainTx: CrossChainTransaction = {
        hash: signature,
        chain: 'solana',
        blockNumber: tx.slot,
        timestamp: new Date(tx.blockTime! * 1000),
        from,
        to,
        value,
        status: meta.err ? 'failed' : 'success',
        isBridge: bridgeResult.isBridge,
        bridgeInfo: bridgeResult.bridgeInfo ? {
          sourceChain: bridgeResult.bridgeInfo.sourceChain,
          destinationChain: bridgeResult.bridgeInfo.destinationChain || 'ethereum',
          bridgeProtocol: bridgeResult.bridgeInfo.protocol,
        } : undefined,
        riskScore: 0, // Will be calculated separately
        addresses: [...new Set(addresses)],
        createdAt: new Date()
      }

      // Calculate risk score
      crossChainTx.riskScore = await this.calculateTransactionRiskScore(crossChainTx)

      return crossChainTx
    } catch (error) {
      console.error('Failed to parse Solana transaction:', error)
      return null
    }
  }

  /**
   * Fetch EVM transactions
   */
  private static async fetchEvmTransactions(
    address: string,
    chain: BlockchainType,
    limit: number
  ): Promise<CrossChainTransaction[]> {
    // For demo purposes, return empty array
    // In production, you would use services like:
    // - Etherscan API
    // - Moralis API
    // - Alchemy API
    // - Covalent API
    // - The Graph Protocol
    
    console.log(`EVM transaction fetching for ${chain} would require API integration`)
    
    // Placeholder implementation
    const provider = MultiChainProviders.getEvmProvider(chain)
    const transactions: CrossChainTransaction[] = []

    try {
      // Get latest block number
      const latestBlock = await provider.getBlockNumber()
      
      // This is just a placeholder - you'd typically use an indexing service
      // instead of scanning blocks directly
      for (let i = 0; i < Math.min(10, limit); i++) {
        const blockNumber = latestBlock - i
        try {
          const block = await provider.getBlock(blockNumber, true)
          if (!block || !block.transactions) continue

          for (const tx of block.transactions) {
            if (typeof tx === 'string') continue
            
            // Check if transaction involves our address
            if (tx.from?.toLowerCase() === address.toLowerCase() || 
                tx.to?.toLowerCase() === address.toLowerCase()) {
              
              const receipt = await provider.getTransactionReceipt(tx.hash)
              if (!receipt) continue

              // Check if it's a bridge transaction
              const bridgeResult = await BridgeMonitorService.detectBridgeTransaction(tx.hash, chain)

              const crossChainTx: CrossChainTransaction = {
                hash: tx.hash,
                chain,
                blockNumber: tx.blockNumber || 0,
                timestamp: new Date(block.timestamp * 1000),
                from: tx.from || '',
                to: tx.to || '',
                value: tx.value.toString(),
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: tx.gasPrice?.toString(),
                status: receipt.status === 1 ? 'success' : 'failed',
                isBridge: bridgeResult.isBridge,
                bridgeInfo: bridgeResult.bridgeInfo ? {
                  sourceChain: bridgeResult.bridgeInfo.sourceChain,
                  destinationChain: bridgeResult.bridgeInfo.destinationChain || 'ethereum',
                  bridgeProtocol: bridgeResult.bridgeInfo.protocol,
                } : undefined,
                riskScore: 0,
                addresses: [tx.from, tx.to].filter(Boolean) as string[],
                createdAt: new Date()
              }

              // Parse token transfers from logs
              crossChainTx.tokenTransfers = this.parseTokenTransfers(receipt.logs)

              // Calculate risk score
              crossChainTx.riskScore = await this.calculateTransactionRiskScore(crossChainTx)

              transactions.push(crossChainTx)
              
              if (transactions.length >= limit) break
            }
          }
          
          if (transactions.length >= limit) break
        } catch (blockError) {
          console.warn(`Failed to fetch block ${blockNumber}:`, blockError)
        }
      }
    } catch (error) {
      console.error(`Failed to fetch EVM transactions for ${chain}:`, error)
    }

    return transactions
  }

  /**
   * Parse token transfers from transaction logs
   */
  private static parseTokenTransfers(logs: Array<{ address: string; topics: string[]; data: string }>): Array<{
    token: string
    from: string
    to: string
    amount: string
  }> {
    const transfers: Array<{
      token: string
      from: string
      to: string
      amount: string
    }> = []

    for (const log of logs) {
      // ERC-20 Transfer event signature
      if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        try {
          const from = ethers.getAddress('0x' + log.topics[1].slice(26))
          const to = ethers.getAddress('0x' + log.topics[2].slice(26))
          const amount = ethers.getBigInt(log.data).toString()

          transfers.push({
            token: log.address,
            from,
            to,
            amount
          })
        } catch (error) {
          console.warn('Failed to parse transfer log:', error)
        }
      }
    }

    return transfers
  }

  /**
   * Calculate risk score for a transaction
   */
  private static async calculateTransactionRiskScore(tx: CrossChainTransaction): Promise<number> {
    let riskScore = 0

    // Base risk factors
    if (tx.isBridge) {
      riskScore += 15 // Bridge transactions have inherent risk
    }

    if (tx.status === 'failed') {
      riskScore += 10 // Failed transactions are suspicious
    }

    // High value transactions
    const valueFloat = parseFloat(tx.value)
    if (valueFloat > 1000000000000000000) { // > 1 ETH/SOL equivalent
      riskScore += 10
    }
    if (valueFloat > 10000000000000000000) { // > 10 ETH/SOL equivalent
      riskScore += 20
    }

    // Many addresses involved (potential mixing)
    if (tx.addresses.length > 10) {
      riskScore += 15
    }

    // Token transfers (more complex transactions)
    if (tx.tokenTransfers && tx.tokenTransfers.length > 5) {
      riskScore += 10
    }

    return Math.min(100, riskScore)
  }

  /**
   * Get transaction history for a wallet with filtering and pagination
   */
  static async getTransactionHistory(
    walletId: ObjectId,
    options: {
      chain?: BlockchainType
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
      minRiskScore?: number
      bridgeOnly?: boolean
      status?: 'success' | 'failed' | 'pending'
    } = {}
  ): Promise<{
    transactions: CrossChainTransaction[]
    total: number
    hasMore: boolean
  }> {
    const { transactions, wallets } = await this.getCollections()
    
    const wallet = await wallets.findOne({ _id: walletId })
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    // Build query
    const query: any = {}
    
    // Get all addresses from wallet
    const allAddresses = Object.values(wallet.addresses).flat()
    query.addresses = { $in: allAddresses }

    if (options.chain) {
      query.chain = options.chain
    }

    if (options.startDate || options.endDate) {
      query.timestamp = {}
      if (options.startDate) query.timestamp.$gte = options.startDate
      if (options.endDate) query.timestamp.$lte = options.endDate
    }

    if (options.minRiskScore !== undefined) {
      query.riskScore = { $gte: options.minRiskScore }
    }

    if (options.bridgeOnly) {
      query.isBridge = true
    }

    if (options.status) {
      query.status = options.status
    }

    // Execute query with pagination
    const limit = options.limit || 50
    const offset = options.offset || 0

    const [txList, total] = await Promise.all([
      transactions
        .find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      transactions.countDocuments(query)
    ])

    return {
      transactions: txList,
      total,
      hasMore: offset + txList.length < total
    }
  }

  /**
   * Get transaction statistics for a wallet
   */
  static async getTransactionStats(walletId: ObjectId): Promise<{
    totalTransactions: number
    transactionsByChain: { [K in BlockchainType]?: number }
    bridgeTransactions: number
    failedTransactions: number
    avgRiskScore: number
    totalVolume: { [K in BlockchainType]?: number }
    timeRange: { earliest: Date; latest: Date } | null
  }> {
    const { transactions, wallets } = await this.getCollections()
    
    const wallet = await wallets.findOne({ _id: walletId })
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    const allAddresses = Object.values(wallet.addresses).flat()
    
    const stats = await transactions.aggregate([
      { $match: { addresses: { $in: allAddresses } } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          bridgeTransactions: { $sum: { $cond: ['$isBridge', 1, 0] } },
          failedTransactions: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          avgRiskScore: { $avg: '$riskScore' },
          chains: { $addToSet: '$chain' },
          earliestTimestamp: { $min: '$timestamp' },
          latestTimestamp: { $max: '$timestamp' }
        }
      }
    ]).toArray()

    if (stats.length === 0) {
      return {
        totalTransactions: 0,
        transactionsByChain: {},
        bridgeTransactions: 0,
        failedTransactions: 0,
        avgRiskScore: 0,
        totalVolume: {},
        timeRange: null
      }
    }

    const stat = stats[0]

    // Get transactions by chain
    const chainStats = await transactions.aggregate([
      { $match: { addresses: { $in: allAddresses } } },
      {
        $group: {
          _id: '$chain',
          count: { $sum: 1 },
          volume: { $sum: { $toDouble: '$value' } }
        }
      }
    ]).toArray()

    const transactionsByChain: { [K in BlockchainType]?: number } = {}
    const totalVolume: { [K in BlockchainType]?: number } = {}

    for (const chainStat of chainStats) {
      transactionsByChain[chainStat._id as BlockchainType] = chainStat.count
      totalVolume[chainStat._id as BlockchainType] = chainStat.volume
    }

    return {
      totalTransactions: stat.totalTransactions,
      transactionsByChain,
      bridgeTransactions: stat.bridgeTransactions,
      failedTransactions: stat.failedTransactions,
      avgRiskScore: Math.round(stat.avgRiskScore || 0),
      totalVolume,
      timeRange: stat.earliestTimestamp && stat.latestTimestamp ? {
        earliest: stat.earliestTimestamp,
        latest: stat.latestTimestamp
      } : null
    }
  }

  /**
   * Get transaction by hash across all chains
   */
  static async getTransactionByHash(hash: string): Promise<CrossChainTransaction | null> {
    const { transactions } = await this.getCollections()
    return await transactions.findOne({ hash })
  }

  /**
   * Mark transaction as high risk
   */
  static async markTransactionHighRisk(
    transactionId: ObjectId,
    riskFactors: string[],
    riskScore?: number
  ): Promise<void> {
    const { transactions } = await this.getCollections()

    await transactions.updateOne(
      { _id: transactionId },
      {
        $set: {
          riskScore: riskScore || 90,
          riskFactors
        }
      }
    )
  }

  /**
   * Delete old transactions to manage storage
   */
  static async cleanupOldTransactions(olderThanDays: number = 90): Promise<number> {
    const { transactions } = await this.getCollections()
    
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    
    const result = await transactions.deleteMany({
      timestamp: { $lt: cutoffDate },
      riskScore: { $lt: 50 } // Keep high-risk transactions longer
    })

    console.log(`Cleaned up ${result.deletedCount} old transactions`)
    return result.deletedCount
  }
}