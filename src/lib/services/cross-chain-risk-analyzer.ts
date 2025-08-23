import { getDatabase } from '@/lib/mongodb'
import { 
  BlockchainType, 
  CrossChainRiskAssessment,
  MultiChainWallet,
  CrossChainTransaction,
  BridgeActivity 
} from '@/lib/models/multi-chain'
import { CrossChainActivityTracker } from './cross-chain-activity-tracker'
import { BridgeMonitorService } from './bridge-monitor'
import { MultiChainConfig } from './multi-chain-config'
import { ObjectId } from 'mongodb'

/**
 * Cross-chain risk scoring and analysis service
 */
export class CrossChainRiskAnalyzer {
  /**
   * Get database collections
   */
  private static async getCollections() {
    const db = await getDatabase()
    return {
      riskAssessments: db.collection<CrossChainRiskAssessment>('cross_chain_risk_assessments'),
      wallets: db.collection<MultiChainWallet>('multi_chain_wallets'),
      transactions: db.collection<CrossChainTransaction>('cross_chain_transactions'),
      bridgeActivity: db.collection<BridgeActivity>('bridge_activity')
    }
  }

  /**
   * Perform comprehensive cross-chain risk assessment for a wallet
   */
  static async assessWalletRisk(walletId: ObjectId): Promise<CrossChainRiskAssessment> {
    const { riskAssessments, wallets, transactions, bridgeActivity } = await this.getCollections()
    
    const wallet = await wallets.findOne({ _id: walletId })
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    const allAddresses = Object.values(wallet.addresses).flat()
    
    // Initialize risk assessment
    const assessment: CrossChainRiskAssessment = {
      walletId,
      addresses: allAddresses,
      overallRiskScore: 0,
      overallRiskLevel: 'low',
      chainRisks: {},
      crossChainRisks: {
        bridgeActivity: {
          riskScore: 0,
          totalBridgeVolume: 0,
          suspiciousBridgeActivity: []
        },
        addressReuse: {
          riskScore: 0,
          crossChainAddressConnections: []
        },
        timing: {
          riskScore: 0,
          suspiciousTimingPatterns: []
        }
      },
      recommendations: [],
      lastAnalyzed: new Date(),
      createdAt: new Date()
    }

    // Analyze each chain
    for (const [chain, addressList] of Object.entries(wallet.addresses)) {
      if (!addressList || addressList.length === 0) continue

      const chainType = chain as BlockchainType
      const chainRisk = await this.analyzeChainRisk(addressList[0], chainType)
      assessment.chainRisks[chainType] = chainRisk
    }

    // Analyze cross-chain specific risks
    assessment.crossChainRisks.bridgeActivity = await this.analyzeBridgeRisk(allAddresses)
    assessment.crossChainRisks.addressReuse = await this.analyzeAddressReuseRisk(wallet)
    assessment.crossChainRisks.timing = await this.analyzeTimingRisk(allAddresses)

    // Calculate overall risk score
    assessment.overallRiskScore = this.calculateOverallRiskScore(assessment)
    assessment.overallRiskLevel = this.getRiskLevel(assessment.overallRiskScore)

    // Generate recommendations
    assessment.recommendations = this.generateRecommendations(assessment)

    // Save assessment
    await riskAssessments.replaceOne(
      { walletId },
      assessment,
      { upsert: true }
    )

    // Update wallet risk level
    await CrossChainActivityTracker.updateWalletRiskLevel(walletId, assessment.overallRiskLevel)

    return assessment
  }

  /**
   * Analyze risk for a specific chain
   */
  private static async analyzeChainRisk(
    address: string,
    chain: BlockchainType
  ): Promise<{
    riskScore: number
    riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
    riskFactors: string[]
    lastTransactionDate?: Date
    transactionCount: number
  }> {
    const { transactions } = await this.getCollections()
    
    const chainTransactions = await transactions
      .find({ chain, addresses: address })
      .sort({ timestamp: -1 })
      .toArray()

    const riskFactors: string[] = []
    let riskScore = 0

    // Transaction volume analysis
    const transactionCount = chainTransactions.length
    if (transactionCount === 0) {
      return {
        riskScore: 0,
        riskLevel: 'very-low',
        riskFactors: ['No transaction history'],
        transactionCount: 0
      }
    }

    // High transaction frequency
    const recentTransactions = chainTransactions.filter(tx => 
      tx.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    )
    
    if (recentTransactions.length > 50) {
      riskFactors.push('Extremely high transaction frequency (possible bot activity)')
      riskScore += 30
    } else if (recentTransactions.length > 20) {
      riskFactors.push('High transaction frequency')
      riskScore += 15
    }

    // Failed transaction ratio
    const failedTransactions = chainTransactions.filter(tx => tx.status === 'failed')
    const failureRate = failedTransactions.length / transactionCount
    
    if (failureRate > 0.2) {
      riskFactors.push(`High failure rate: ${Math.round(failureRate * 100)}%`)
      riskScore += 25
    } else if (failureRate > 0.1) {
      riskFactors.push(`Moderate failure rate: ${Math.round(failureRate * 100)}%`)
      riskScore += 15
    }

    // Large transaction values
    const largeTransactions = chainTransactions.filter(tx => {
      const value = parseFloat(tx.value)
      return value > this.getLargeTransactionThreshold(chain)
    })
    
    if (largeTransactions.length > 10) {
      riskFactors.push('Multiple large value transactions')
      riskScore += 20
    } else if (largeTransactions.length > 5) {
      riskFactors.push('Several large value transactions')
      riskScore += 10
    }

    // Bridge activity frequency
    const bridgeTransactions = chainTransactions.filter(tx => tx.isBridge)
    if (bridgeTransactions.length > 10) {
      riskFactors.push('High bridge activity frequency')
      riskScore += 15
    }

    // Interaction with many unique addresses
    const uniqueAddresses = new Set<string>()
    chainTransactions.forEach(tx => {
      tx.addresses.forEach(addr => uniqueAddresses.add(addr))
    })
    
    if (uniqueAddresses.size > 1000) {
      riskFactors.push('Interactions with unusually high number of unique addresses')
      riskScore += 25
    } else if (uniqueAddresses.size > 500) {
      riskFactors.push('Interactions with high number of unique addresses')
      riskScore += 15
    }

    // Recent account creation with high activity
    const firstTransaction = chainTransactions[chainTransactions.length - 1]
    const accountAge = Date.now() - firstTransaction.timestamp.getTime()
    const daysSinceCreation = accountAge / (24 * 60 * 60 * 1000)
    
    if (daysSinceCreation < 7 && transactionCount > 100) {
      riskFactors.push('New account with unusually high activity')
      riskScore += 30
    } else if (daysSinceCreation < 30 && transactionCount > 500) {
      riskFactors.push('Young account with very high activity')
      riskScore += 20
    }

    // High average risk score from individual transactions
    const avgTransactionRisk = chainTransactions.reduce((sum, tx) => sum + tx.riskScore, 0) / transactionCount
    if (avgTransactionRisk > 50) {
      riskFactors.push('High average transaction risk score')
      riskScore += 20
    }

    const lastTransactionDate = chainTransactions.length > 0 ? chainTransactions[0].timestamp : undefined

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel: this.getRiskLevel(Math.min(100, riskScore)),
      riskFactors,
      lastTransactionDate,
      transactionCount
    }
  }

  /**
   * Analyze bridge activity risk
   */
  private static async analyzeBridgeRisk(addresses: string[]): Promise<{
    riskScore: number
    totalBridgeVolume: number
    suspiciousBridgeActivity: string[]
  }> {
    const { bridgeActivity } = await this.getCollections()
    
    const bridges = await bridgeActivity
      .find({ userAddress: { $in: addresses } })
      .toArray()

    const suspiciousBridgeActivity: string[] = []
    let riskScore = 0
    let totalBridgeVolume = 0

    if (bridges.length === 0) {
      return { riskScore: 0, totalBridgeVolume: 0, suspiciousBridgeActivity: [] }
    }

    // Calculate total bridge volume
    totalBridgeVolume = bridges.reduce((sum, bridge) => {
      const amount = parseFloat(bridge.amount) || 0
      return sum + amount
    }, 0)

    // High frequency bridging
    const recentBridges = bridges.filter(bridge => 
      bridge.createdAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
    )
    
    if (recentBridges.length > 10) {
      suspiciousBridgeActivity.push('Excessive bridging frequency in 24 hours')
      riskScore += 30
    } else if (recentBridges.length > 5) {
      suspiciousBridgeActivity.push('High bridging frequency in 24 hours')
      riskScore += 15
    }

    // Round-trip bridging patterns
    const roundTripPatterns = this.detectRoundTripBridging(bridges)
    if (roundTripPatterns.length > 0) {
      suspiciousBridgeActivity.push(`${roundTripPatterns.length} round-trip bridging patterns detected`)
      riskScore += 25
    }

    // Large volume through uncommon routes
    const uncommonRoutes = ['base-arbitrum', 'polygon-bsc', 'arbitrum-polygon']
    const largeUncommonBridges = bridges.filter(bridge => {
      const route = `${bridge.sourceChain}-${bridge.destinationChain}`
      const amount = parseFloat(bridge.amount) || 0
      return uncommonRoutes.includes(route) && amount > 50000
    })
    
    if (largeUncommonBridges.length > 0) {
      suspiciousBridgeActivity.push('Large volume through uncommon bridge routes')
      riskScore += 20
    }

    // Failed bridge attempts
    const failedBridges = bridges.filter(bridge => bridge.status === 'failed')
    if (failedBridges.length > 3) {
      suspiciousBridgeActivity.push(`${failedBridges.length} failed bridge attempts`)
      riskScore += 15
    }

    // Rapid successive bridging
    const rapidBridging = this.detectRapidBridging(bridges)
    if (rapidBridging) {
      suspiciousBridgeActivity.push('Rapid successive bridging detected')
      riskScore += 20
    }

    return {
      riskScore: Math.min(100, riskScore),
      totalBridgeVolume,
      suspiciousBridgeActivity
    }
  }

  /**
   * Analyze address reuse risk across chains
   */
  private static async analyzeAddressReuseRisk(wallet: MultiChainWallet): Promise<{
    riskScore: number
    crossChainAddressConnections: Array<{
      chain1: BlockchainType
      chain2: BlockchainType
      confidence: number
    }>
  }> {
    const connections: Array<{
      chain1: BlockchainType
      chain2: BlockchainType
      confidence: number
    }> = []
    
    let riskScore = 0

    // For EVM chains, same address can be used across chains
    const evmChains = MultiChainConfig.getEvmChains()
    const walletEvmChains = evmChains.filter(chain => wallet.addresses[chain]?.length)
    
    if (walletEvmChains.length > 1) {
      // Check if same address is used across EVM chains
      const evmAddresses = new Set<string>()
      let hasReusedAddress = false
      
      for (const chain of walletEvmChains) {
        const addresses = wallet.addresses[chain] || []
        for (const address of addresses) {
          if (evmAddresses.has(address.toLowerCase())) {
            hasReusedAddress = true
            break
          }
          evmAddresses.add(address.toLowerCase())
        }
      }
      
      if (hasReusedAddress) {
        riskScore += 10 // Moderate risk for address reuse
        
        // Add connections for all EVM chain pairs
        for (let i = 0; i < walletEvmChains.length; i++) {
          for (let j = i + 1; j < walletEvmChains.length; j++) {
            connections.push({
              chain1: walletEvmChains[i],
              chain2: walletEvmChains[j],
              confidence: 95 // High confidence for address reuse
            })
          }
        }
      }
    }

    // Cross-chain transaction timing correlation (behavioral linking)
    const timingCorrelations = await this.findTimingCorrelations(wallet)
    riskScore += timingCorrelations * 5

    return {
      riskScore: Math.min(100, riskScore),
      crossChainAddressConnections: connections
    }
  }

  /**
   * Analyze timing-based risk patterns
   */
  private static async analyzeTimingRisk(addresses: string[]): Promise<{
    riskScore: number
    suspiciousTimingPatterns: string[]
  }> {
    const { transactions } = await this.getCollections()
    
    const allTransactions = await transactions
      .find({ addresses: { $in: addresses } })
      .sort({ timestamp: 1 })
      .toArray()

    const suspiciousTimingPatterns: string[] = []
    let riskScore = 0

    if (allTransactions.length < 10) {
      return { riskScore: 0, suspiciousTimingPatterns: [] }
    }

    // Detect rapid cross-chain activity
    const rapidCrossChainActivity = this.detectRapidCrossChainActivity(allTransactions)
    if (rapidCrossChainActivity > 5) {
      suspiciousTimingPatterns.push('Rapid cross-chain activity detected')
      riskScore += 25
    }

    // Detect synchronized activity across chains
    const synchronizedActivity = this.detectSynchronizedActivity(allTransactions)
    if (synchronizedActivity > 3) {
      suspiciousTimingPatterns.push('Synchronized activity across multiple chains')
      riskScore += 30
    }

    // Detect burst activity patterns
    const burstPatterns = this.detectBurstPatterns(allTransactions)
    if (burstPatterns > 2) {
      suspiciousTimingPatterns.push('Burst activity patterns detected')
      riskScore += 20
    }

    return {
      riskScore: Math.min(100, riskScore),
      suspiciousTimingPatterns
    }
  }

  /**
   * Calculate overall risk score from individual risk components
   */
  private static calculateOverallRiskScore(assessment: CrossChainRiskAssessment): number {
    let totalScore = 0
    let componentCount = 0

    // Chain-specific risks (weighted by transaction volume)
    let chainRiskSum = 0
    let totalTransactions = 0
    
    for (const chainRisk of Object.values(assessment.chainRisks)) {
      if (chainRisk) {
        chainRiskSum += chainRisk.riskScore * chainRisk.transactionCount
        totalTransactions += chainRisk.transactionCount
      }
    }
    
    const weightedChainRisk = totalTransactions > 0 ? chainRiskSum / totalTransactions : 0
    totalScore += weightedChainRisk * 0.4 // 40% weight
    componentCount++

    // Bridge activity risk
    totalScore += assessment.crossChainRisks.bridgeActivity.riskScore * 0.3 // 30% weight
    componentCount++

    // Address reuse risk
    totalScore += assessment.crossChainRisks.addressReuse.riskScore * 0.15 // 15% weight
    componentCount++

    // Timing risk
    totalScore += assessment.crossChainRisks.timing.riskScore * 0.15 // 15% weight
    componentCount++

    return Math.min(100, totalScore)
  }

  /**
   * Convert risk score to risk level
   */
  private static getRiskLevel(score: number): 'very-low' | 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 40) return 'medium'
    if (score >= 20) return 'low'
    return 'very-low'
  }

  /**
   * Generate risk-based recommendations
   */
  private static generateRecommendations(assessment: CrossChainRiskAssessment): string[] {
    const recommendations: string[] = []

    if (assessment.overallRiskLevel === 'critical') {
      recommendations.push('🚨 CRITICAL RISK - Immediate investigation recommended')
      recommendations.push('Consider blocking or flagging this wallet for manual review')
    } else if (assessment.overallRiskLevel === 'high') {
      recommendations.push('⚠️ HIGH RISK - Enhanced monitoring required')
      recommendations.push('Implement additional verification steps for transactions')
    }

    // Bridge-specific recommendations
    const bridgeRisk = assessment.crossChainRisks.bridgeActivity
    if (bridgeRisk.riskScore > 50) {
      recommendations.push('Monitor bridge transactions closely for money laundering patterns')
      
      if (bridgeRisk.suspiciousBridgeActivity.includes('round-trip')) {
        recommendations.push('Potential money laundering through round-trip bridging detected')
      }
    }

    // Address reuse recommendations
    const addressRisk = assessment.crossChainRisks.addressReuse
    if (addressRisk.crossChainAddressConnections.length > 0) {
      recommendations.push('Cross-chain address reuse detected - track all connected chains')
    }

    // Chain-specific recommendations
    for (const [chain, chainRisk] of Object.entries(assessment.chainRisks)) {
      if (!chainRisk || chainRisk.riskScore < 60) continue

      if (chainRisk.riskFactors.includes('bot activity')) {
        recommendations.push(`Potential bot activity detected on ${chain}`)
      }
      
      if (chainRisk.riskFactors.includes('High failure rate')) {
        recommendations.push(`High transaction failure rate on ${chain} - possible exploit attempts`)
      }
    }

    // General recommendations
    if (assessment.overallRiskScore > 30) {
      recommendations.push('Implement transaction limits and enhanced KYC procedures')
    }

    return recommendations
  }

  /**
   * Helper methods for pattern detection
   */
  private static detectRoundTripBridging(bridges: BridgeActivity[]): Array<{
    outbound: BridgeActivity
    return: BridgeActivity
    timeDiff: number
  }> {
    const patterns: Array<{
      outbound: BridgeActivity
      return: BridgeActivity
      timeDiff: number
    }> = []

    for (let i = 0; i < bridges.length - 1; i++) {
      for (let j = i + 1; j < bridges.length; j++) {
        const bridge1 = bridges[i]
        const bridge2 = bridges[j]
        
        if (bridge1.sourceChain === bridge2.destinationChain &&
            bridge1.destinationChain === bridge2.sourceChain) {
          const timeDiff = Math.abs(bridge2.initiatedAt.getTime() - bridge1.initiatedAt.getTime())
          
          // Consider round-trip if within 24 hours
          if (timeDiff < 24 * 60 * 60 * 1000) {
            patterns.push({
              outbound: bridge1,
              return: bridge2,
              timeDiff
            })
          }
        }
      }
    }

    return patterns
  }

  private static detectRapidBridging(bridges: BridgeActivity[]): boolean {
    if (bridges.length < 3) return false

    const sortedBridges = [...bridges].sort((a, b) => 
      a.initiatedAt.getTime() - b.initiatedAt.getTime()
    )

    for (let i = 0; i < sortedBridges.length - 2; i++) {
      const timeSpan = sortedBridges[i + 2].initiatedAt.getTime() - sortedBridges[i].initiatedAt.getTime()
      
      // 3 bridges within 1 hour
      if (timeSpan < 60 * 60 * 1000) {
        return true
      }
    }

    return false
  }

  private static async findTimingCorrelations(wallet: MultiChainWallet): Promise<number> {
    // Simplified correlation analysis
    // In practice, you'd perform statistical correlation analysis
    return 0
  }

  private static detectRapidCrossChainActivity(transactions: CrossChainTransaction[]): number {
    let rapidCount = 0
    
    for (let i = 0; i < transactions.length - 1; i++) {
      const tx1 = transactions[i]
      const tx2 = transactions[i + 1]
      
      if (tx1.chain !== tx2.chain) {
        const timeDiff = Math.abs(tx2.timestamp.getTime() - tx1.timestamp.getTime())
        
        // Cross-chain activity within 5 minutes
        if (timeDiff < 5 * 60 * 1000) {
          rapidCount++
        }
      }
    }
    
    return rapidCount
  }

  private static detectSynchronizedActivity(transactions: CrossChainTransaction[]): number {
    // Detect transactions happening at similar times across different chains
    let synchronizedCount = 0
    const timeWindow = 10 * 60 * 1000 // 10 minutes
    
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]
      const simultaneousChains = new Set<string>()
      
      for (let j = 0; j < transactions.length; j++) {
        if (i === j) continue
        
        const otherTx = transactions[j]
        const timeDiff = Math.abs(tx.timestamp.getTime() - otherTx.timestamp.getTime())
        
        if (timeDiff <= timeWindow && tx.chain !== otherTx.chain) {
          simultaneousChains.add(otherTx.chain)
        }
      }
      
      if (simultaneousChains.size >= 2) {
        synchronizedCount++
      }
    }
    
    return synchronizedCount
  }

  private static detectBurstPatterns(transactions: CrossChainTransaction[]): number {
    let burstCount = 0
    const timeWindow = 60 * 60 * 1000 // 1 hour
    const burstThreshold = 10 // 10 transactions in 1 hour
    
    for (let i = 0; i < transactions.length; i++) {
      const baseTime = transactions[i].timestamp.getTime()
      let txInWindow = 0
      
      for (let j = i; j < transactions.length; j++) {
        if (transactions[j].timestamp.getTime() - baseTime <= timeWindow) {
          txInWindow++
        } else {
          break
        }
      }
      
      if (txInWindow >= burstThreshold) {
        burstCount++
        i += txInWindow - 1 // Skip the burst window
      }
    }
    
    return burstCount
  }

  private static getLargeTransactionThreshold(chain: BlockchainType): number {
    const thresholds: Record<BlockchainType, number> = {
      solana: 1000000000000, // 1000 SOL in lamports
      ethereum: 5000000000000000000, // 5 ETH in wei
      bsc: 50000000000000000000, // 50 BNB in wei
      polygon: 50000000000000000000000, // 50000 MATIC in wei
      arbitrum: 5000000000000000000, // 5 ETH in wei
      base: 5000000000000000000 // 5 ETH in wei
    }
    
    return thresholds[chain] || 0
  }

  /**
   * Get risk assessment for a wallet
   */
  static async getRiskAssessment(walletId: ObjectId): Promise<CrossChainRiskAssessment | null> {
    const { riskAssessments } = await this.getCollections()
    return await riskAssessments.findOne({ walletId })
  }

  /**
   * Get high-risk wallets
   */
  static async getHighRiskWallets(
    minRiskScore: number = 70,
    limit: number = 100
  ): Promise<CrossChainRiskAssessment[]> {
    const { riskAssessments } = await this.getCollections()
    
    return await riskAssessments
      .find({ overallRiskScore: { $gte: minRiskScore } })
      .sort({ overallRiskScore: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Update risk assessment with external intelligence
   */
  static async updateWithExternalIntelligence(
    walletId: ObjectId,
    externalRiskFactors: string[],
    externalRiskScore: number
  ): Promise<void> {
    const { riskAssessments } = await this.getCollections()
    
    await riskAssessments.updateOne(
      { walletId },
      {
        $push: { 'recommendations': { $each: externalRiskFactors } },
        $max: { overallRiskScore: externalRiskScore }
      }
    )
  }
}