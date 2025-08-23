import { WalletSecurityService, WalletSecurityResult } from './wallet-security'
import { CrossChainActivityTracker } from './cross-chain-activity-tracker'
import { CrossChainRiskAnalyzer } from './cross-chain-risk-analyzer'
import { MultiChainBalanceAggregator } from './multi-chain-balance-aggregator'
import { BridgeMonitorService } from './bridge-monitor'
import { AddressValidationService } from './address-validation'
import { BlockchainType } from '@/lib/models/multi-chain'
import { ObjectId } from 'mongodb'

/**
 * Enhanced wallet security result with multi-chain analysis
 */
export interface EnhancedWalletSecurityResult extends WalletSecurityResult {
  multiChainAnalysis?: {
    chainsAnalyzed: BlockchainType[]
    crossChainRiskScore: number
    bridgeActivity: {
      totalBridges: number
      suspiciousPatterns: string[]
      riskScore: number
    }
    addressConnections: Array<{
      chain: BlockchainType
      address: string
      riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
    }>
    totalPortfolioValue: number
    consolidatedRecommendations: string[]
  }
}

/**
 * Multi-chain wallet security integration service
 */
export class MultiChainWalletSecurityIntegration {
  /**
   * Enhanced wallet analysis with multi-chain support
   */
  static async analyzeWalletComprehensive(
    primaryAddress: string,
    userId?: ObjectId,
    options: {
      enableMultiChain?: boolean
      chainsToAnalyze?: BlockchainType[]
      includeBridgeAnalysis?: boolean
      includePortfolioAnalysis?: boolean
    } = {}
  ): Promise<EnhancedWalletSecurityResult> {
    const {
      enableMultiChain = true,
      chainsToAnalyze = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base'],
      includeBridgeAnalysis = true,
      includePortfolioAnalysis = true
    } = options

    // First, perform the standard Solana-based analysis
    const baseResult = await WalletSecurityService.analyzeWallet(primaryAddress, userId)
    
    if (!enableMultiChain) {
      return baseResult
    }

    console.log(`[Enhanced Analysis] Starting multi-chain analysis for ${primaryAddress}`)

    // Detect which chains the address is valid for
    const possibleChains = AddressValidationService.detectChainFromAddress(primaryAddress)
    const validChains = chainsToAnalyze.filter(chain => possibleChains.includes(chain))

    if (validChains.length === 0) {
      console.log(`[Enhanced Analysis] No valid chains detected for ${primaryAddress}`)
      return baseResult
    }

    try {
      // Check if wallet is already tracked in multi-chain system
      let multiChainWallet = (await CrossChainActivityTracker.findWalletByAddress(primaryAddress))[0]
      
      if (!multiChainWallet) {
        // Track wallet across valid chains
        multiChainWallet = await CrossChainActivityTracker.trackWallet(
          primaryAddress,
          validChains,
          `Auto-tracked for security analysis`
        )
      }

      const walletId = multiChainWallet._id!

      // Perform multi-chain risk assessment
      const crossChainRisk = await CrossChainRiskAnalyzer.assessWalletRisk(walletId)

      let bridgeAnalysis = {
        totalBridges: 0,
        suspiciousPatterns: [] as string[],
        riskScore: 0
      }

      if (includeBridgeAnalysis) {
        // Analyze bridge activity
        const bridgePatterns = await BridgeMonitorService.detectSuspiciousBridgePatterns(primaryAddress)
        bridgeAnalysis = {
          totalBridges: (await BridgeMonitorService.getUserBridgeActivity(primaryAddress, 1000)).length,
          suspiciousPatterns: bridgePatterns.suspiciousPatterns,
          riskScore: bridgePatterns.riskScore
        }
      }

      let totalPortfolioValue = 0
      if (includePortfolioAnalysis) {
        try {
          const balance = await MultiChainBalanceAggregator.getAggregatedBalance(walletId)
          totalPortfolioValue = balance.totalValueUsd
        } catch (error) {
          console.warn('Failed to get portfolio value:', error)
        }
      }

      // Build address connections
      const addressConnections = validChains.map(chain => ({
        chain,
        address: primaryAddress,
        riskLevel: crossChainRisk.chainRisks[chain]?.riskLevel || 'low' as const
      }))

      // Consolidate recommendations from all sources
      const consolidatedRecommendations = [
        ...baseResult.recommendations,
        ...crossChainRisk.recommendations
      ].filter((rec, index, arr) => arr.indexOf(rec) === index) // Remove duplicates

      // Add cross-chain specific recommendations
      if (crossChainRisk.crossChainRisks.bridgeActivity.riskScore > 50) {
        consolidatedRecommendations.push('🌉 High bridge activity risk detected - monitor for money laundering')
      }

      if (validChains.length > 3) {
        consolidatedRecommendations.push('🔗 Active across multiple chains - enhanced KYC recommended')
      }

      if (totalPortfolioValue > 100000) {
        consolidatedRecommendations.push('💰 High portfolio value - implement enhanced security measures')
      }

      // Adjust overall risk score based on multi-chain analysis
      const adjustedRiskScore = Math.max(
        baseResult.riskScore,
        crossChainRisk.overallRiskScore,
        bridgeAnalysis.riskScore
      )

      const adjustedRiskLevel = this.getRiskLevel(adjustedRiskScore)

      const enhancedResult: EnhancedWalletSecurityResult = {
        ...baseResult,
        riskScore: adjustedRiskScore,
        riskLevel: adjustedRiskLevel,
        recommendations: consolidatedRecommendations,
        multiChainAnalysis: {
          chainsAnalyzed: validChains,
          crossChainRiskScore: crossChainRisk.overallRiskScore,
          bridgeActivity: bridgeAnalysis,
          addressConnections,
          totalPortfolioValue,
          consolidatedRecommendations
        }
      }

      return enhancedResult
    } catch (error) {
      console.error('[Enhanced Analysis] Multi-chain analysis failed:', error)
      
      // Return base result with error indication
      return {
        ...baseResult,
        multiChainAnalysis: {
          chainsAnalyzed: [],
          crossChainRiskScore: 0,
          bridgeActivity: {
            totalBridges: 0,
            suspiciousPatterns: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            riskScore: 0
          },
          addressConnections: [],
          totalPortfolioValue: 0,
          consolidatedRecommendations: ['Multi-chain analysis unavailable - using Solana-only analysis']
        }
      }
    }
  }

  /**
   * Analyze multiple addresses as a connected wallet set
   */
  static async analyzeConnectedWallets(
    addresses: Array<{ address: string; chain: BlockchainType }>,
    userId?: ObjectId
  ): Promise<{
    addresses: Array<{
      address: string
      chain: BlockchainType
      analysis: EnhancedWalletSecurityResult
    }>
    consolidatedRisk: {
      overallRiskScore: number
      overallRiskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
      crossChainConnections: number
      totalPortfolioValue: number
      highestRiskAddress: string
      recommendations: string[]
    }
  }> {
    const analyses: Array<{
      address: string
      chain: BlockchainType
      analysis: EnhancedWalletSecurityResult
    }> = []

    // Analyze each address
    for (const { address, chain } of addresses) {
      try {
        const analysis = await this.analyzeWalletComprehensive(
          address,
          userId,
          {
            enableMultiChain: true,
            chainsToAnalyze: [chain],
            includeBridgeAnalysis: true,
            includePortfolioAnalysis: true
          }
        )

        analyses.push({
          address,
          chain,
          analysis
        })
      } catch (error) {
        console.error(`Failed to analyze ${address} on ${chain}:`, error)
      }
    }

    // Calculate consolidated risk
    const riskScores = analyses.map(a => a.analysis.riskScore)
    const portfolioValues = analyses.map(a => a.analysis.multiChainAnalysis?.totalPortfolioValue || 0)
    
    const overallRiskScore = riskScores.length > 0 ? Math.max(...riskScores) : 0
    const totalPortfolioValue = portfolioValues.reduce((sum, val) => sum + val, 0)
    
    const highestRiskAnalysis = analyses.reduce((max, current) => 
      current.analysis.riskScore > max.analysis.riskScore ? current : max
    , analyses[0])

    // Count cross-chain connections (simplified)
    const uniqueChains = [...new Set(addresses.map(a => a.chain))]
    const crossChainConnections = uniqueChains.length > 1 ? uniqueChains.length - 1 : 0

    // Consolidate recommendations
    const allRecommendations = analyses.flatMap(a => a.analysis.recommendations)
    const uniqueRecommendations = [...new Set(allRecommendations)]

    // Add connected wallet specific recommendations
    if (crossChainConnections > 0) {
      uniqueRecommendations.push('🔗 Cross-chain wallet connections detected - monitor for coordinated activity')
    }

    if (analyses.some(a => a.analysis.multiChainAnalysis?.bridgeActivity.totalBridges && 
                           a.analysis.multiChainAnalysis.bridgeActivity.totalBridges > 5)) {
      uniqueRecommendations.push('🌉 High bridge activity across connected wallets')
    }

    return {
      addresses: analyses,
      consolidatedRisk: {
        overallRiskScore,
        overallRiskLevel: this.getRiskLevel(overallRiskScore),
        crossChainConnections,
        totalPortfolioValue,
        highestRiskAddress: highestRiskAnalysis?.address || 'unknown',
        recommendations: uniqueRecommendations
      }
    }
  }

  /**
   * Get enhanced wallet reputation including multi-chain data
   */
  static async getEnhancedWalletReputation(
    address: string,
    includeMultiChain: boolean = true
  ): Promise<{
    solanaReputation: Awaited<ReturnType<typeof WalletSecurityService.getWalletReputation>>
    multiChainData?: {
      trackedChains: BlockchainType[]
      crossChainRiskScore: number
      totalBridgeActivity: number
      portfolioValue: number
    }
  }> {
    // Get base Solana reputation
    const solanaReputation = await WalletSecurityService.getWalletReputation(address)

    if (!includeMultiChain) {
      return { solanaReputation }
    }

    try {
      // Find multi-chain wallet
      const wallets = await CrossChainActivityTracker.findWalletByAddress(address)
      
      if (wallets.length === 0) {
        return { solanaReputation }
      }

      const wallet = wallets[0]
      const walletId = wallet._id!

      // Get cross-chain risk assessment
      const riskAssessment = await CrossChainRiskAnalyzer.getRiskAssessment(walletId)
      
      // Get bridge activity
      const bridgeActivity = await BridgeMonitorService.getUserBridgeActivity(address, 1000)
      
      // Get portfolio value
      let portfolioValue = 0
      try {
        const balance = await MultiChainBalanceAggregator.getAggregatedBalance(walletId)
        portfolioValue = balance.totalValueUsd
      } catch (error) {
        console.warn('Failed to get portfolio value for reputation:', error)
      }

      const multiChainData = {
        trackedChains: Object.keys(wallet.addresses) as BlockchainType[],
        crossChainRiskScore: riskAssessment?.overallRiskScore || 0,
        totalBridgeActivity: bridgeActivity.length,
        portfolioValue
      }

      return {
        solanaReputation,
        multiChainData
      }
    } catch (error) {
      console.error('Failed to get multi-chain reputation data:', error)
      return { solanaReputation }
    }
  }

  /**
   * Report wallet with multi-chain context
   */
  static async reportWalletEnhanced(
    walletAddress: string,
    reporterAddress: string,
    reportType: 'scam' | 'phishing' | 'rugpull' | 'impersonation' | 'bot' | 'other',
    description: string,
    evidence?: {
      transactionHashes?: string[]
      screenshots?: string[]
      additionalInfo?: string
      suspectedChains?: BlockchainType[]
      bridgeActivity?: string[]
    }
  ) {
    // Report to main security service
    const report = await WalletSecurityService.reportWallet(
      walletAddress,
      reporterAddress,
      reportType,
      description,
      evidence
    )

    // If multi-chain evidence provided, track across chains
    if (evidence?.suspectedChains && evidence.suspectedChains.length > 0) {
      try {
        // Find or create multi-chain wallet entry
        let multiChainWallets = await CrossChainActivityTracker.findWalletByAddress(walletAddress)
        
        if (multiChainWallets.length === 0) {
          await CrossChainActivityTracker.trackWallet(
            walletAddress,
            evidence.suspectedChains,
            `Reported for ${reportType}`
          )
        }

        // Add evidence to bridge monitoring if bridge activity reported
        if (evidence.bridgeActivity && evidence.bridgeActivity.length > 0) {
          for (const txHash of evidence.bridgeActivity) {
            for (const chain of evidence.suspectedChains) {
              try {
                const bridgeResult = await BridgeMonitorService.detectBridgeTransaction(txHash, chain)
                if (bridgeResult.isBridge) {
                  console.log(`[Report] Bridge transaction detected: ${txHash} on ${chain}`)
                  // Could track this as suspicious bridge activity
                }
              } catch (error) {
                console.warn(`Failed to check bridge transaction ${txHash}:`, error)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to process multi-chain report context:', error)
      }
    }

    return report
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
   * Bulk analyze addresses with multi-chain support
   */
  static async bulkAnalyzeWalletsEnhanced(
    addresses: string[],
    options: {
      enableMultiChain?: boolean
      maxConcurrent?: number
    } = {}
  ): Promise<Array<{
    address: string
    analysis: EnhancedWalletSecurityResult | null
    error?: string
  }>> {
    const { enableMultiChain = true, maxConcurrent = 5 } = options
    const results: Array<{
      address: string
      analysis: EnhancedWalletSecurityResult | null
      error?: string
    }> = []

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < addresses.length; i += maxConcurrent) {
      const batch = addresses.slice(i, i + maxConcurrent)
      
      const batchPromises = batch.map(async (address) => {
        try {
          const analysis = await this.analyzeWalletComprehensive(address, undefined, {
            enableMultiChain
          })
          return {
            address,
            analysis,
            error: undefined
          }
        } catch (error) {
          return {
            address,
            analysis: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return results
  }
}