import { getDatabase } from '@/lib/mongodb'
import { getWalletBalance, getTokenBalance, getRecentTransactions } from '@/lib/solana'
import { ObjectId } from 'mongodb'
import { BlockchainAnalysisService } from './blockchain-analysis'
import { CommunityFeedbackService } from './community-feedback'
import { WalletListService } from './wallet-list-service'

export interface WalletSecurityResult {
  address: string
  riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
  riskScore: number // 0-100, where 100 is highest risk
  isBlacklisted: boolean
  isWhitelisted: boolean
  listStatus?: {
    overallStatus: 'whitelisted' | 'blacklisted' | 'neutral' | 'conflicted'
    confidence: number
    sources: Array<{
      type: 'user' | 'global' | 'community'
      count: number
      highestConfidence: number
    }>
    conflictingEntries: number
    listRecommendations: string[]
  }
  reputation: {
    score: number // 0-1000
    reports: number
    verifiedReports: number
    communityTrust: number
  }
  threats: string[]
  flags: Array<{
    type: 'suspicious_pattern' | 'known_scammer' | 'high_volume' | 'mixer_usage' | 'new_wallet' | 'bot_activity'
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    confidence: number
  }>
  analysis: {
    accountAge: number // days
    transactionCount: number
    averageTransactionValue: number
    uniqueInteractions: number
    suspiciousPatterns: string[]
    knownAssociations: string[]
  }
  recommendations: string[]
  lastChecked: Date
}

export interface WalletReport {
  _id?: ObjectId
  walletAddress: string
  reporterAddress: string
  reportType: 'scam' | 'phishing' | 'rugpull' | 'impersonation' | 'bot' | 'other'
  description: string
  evidence?: {
    transactionHashes?: string[]
    screenshots?: string[]
    additionalInfo?: string
  }
  status: 'pending' | 'verified' | 'rejected' | 'investigating'
  verifiedBy?: string
  createdAt: Date
  updatedAt: Date
}

export class WalletSecurityService {
  private static async getSecurityCollection() {
    const db = await getDatabase()
    return db.collection('wallet_security')
  }

  private static async getReportsCollection() {
    const db = await getDatabase()
    return db.collection<WalletReport>('wallet_reports')
  }

  private static async getBlacklistCollection() {
    const db = await getDatabase()
    return db.collection('wallet_blacklist')
  }

  /**
   * Comprehensive wallet security analysis using real blockchain data
   */
  static async analyzeWallet(walletAddress: string, userId?: ObjectId): Promise<WalletSecurityResult> {
    console.log(`[WalletSecurity] Analyzing wallet: ${walletAddress}`)
    
    const result: WalletSecurityResult = {
      address: walletAddress,
      riskLevel: 'low',
      riskScore: 0,
      isBlacklisted: false,
      isWhitelisted: false,
      reputation: {
        score: 500, // Neutral starting score
        reports: 0,
        verifiedReports: 0,
        communityTrust: 50
      },
      threats: [],
      flags: [],
      analysis: {
        accountAge: 0,
        transactionCount: 0,
        averageTransactionValue: 0,
        uniqueInteractions: 0,
        suspiciousPatterns: [],
        knownAssociations: []
      },
      recommendations: [],
      lastChecked: new Date()
    }

    try {
      // Check comprehensive wallet lists first (new enhanced system)
      try {
        const listAssessment = await WalletListService.getWalletAssessment(walletAddress, userId)
        
        result.listStatus = {
          overallStatus: listAssessment.overallStatus,
          confidence: listAssessment.confidence,
          sources: listAssessment.sources,
          conflictingEntries: listAssessment.entries.filter(e => 
            listAssessment.entries.some(other => 
              other.walletAddress === e.walletAddress && 
              other.listType !== e.listType
            )
          ).length,
          listRecommendations: listAssessment.recommendations
        }

        // Update result based on list assessment
        result.isWhitelisted = listAssessment.overallStatus === 'whitelisted'
        result.isBlacklisted = listAssessment.overallStatus === 'blacklisted'

        // Apply list-based risk adjustments
        switch (listAssessment.overallStatus) {
          case 'blacklisted':
            result.riskLevel = listAssessment.riskLevel
            result.riskScore = Math.max(result.riskScore, 
              listAssessment.confidence > 80 ? 95 : 
              listAssessment.confidence > 60 ? 85 : 75
            )
            result.threats.push(`Found in blacklist with ${listAssessment.confidence}% confidence`)
            
            // Add specific entries as threats
            for (const entry of listAssessment.entries.filter(e => e.listType === 'blacklist')) {
              result.threats.push(`${entry.category}: ${entry.reason}`)
              result.flags.push({
                type: entry.category === 'scam' ? 'known_scammer' : 'suspicious_pattern',
                severity: entry.severity,
                description: `Listed: ${entry.reason}`,
                confidence: entry.confidence
              })
            }
            
            // For high-confidence blacklist entries, return early with critical assessment
            if (listAssessment.confidence > 90) {
              result.recommendations = [...result.recommendations, ...listAssessment.recommendations]
              return result
            }
            break

          case 'whitelisted':
            // Whitelisted wallets get risk reduction
            result.riskScore = Math.max(0, result.riskScore - 30)
            result.threats.push(`Found in whitelist - generally considered safe`)
            
            for (const entry of listAssessment.entries.filter(e => e.listType === 'whitelist')) {
              result.analysis.knownAssociations.push(`Whitelisted: ${entry.category}`)
            }
            break

          case 'conflicted':
            result.riskLevel = 'medium'
            result.riskScore = Math.max(result.riskScore, 50)
            result.threats.push('Conflicting list entries found - manual review required')
            result.flags.push({
              type: 'suspicious_pattern',
              severity: 'medium',
              description: 'Wallet appears in both whitelist and blacklist',
              confidence: 80
            })
            break
        }

        // Integrate list recommendations
        result.recommendations.push(...listAssessment.recommendations)
        
      } catch (listError) {
        console.error('[WalletSecurity] List assessment failed:', listError)
        // Continue with legacy blacklist check
      }

      // Legacy blacklist check (fallback/additional check)
      const blacklistEntry = await this.checkBlacklist(walletAddress)
      if (blacklistEntry && !result.isBlacklisted) {
        result.isBlacklisted = true
        result.riskLevel = 'critical'
        result.riskScore = Math.max(result.riskScore, 95)
        result.threats.push(`Legacy blacklist: ${blacklistEntry.reason}`)
        result.flags.push({
          type: 'known_scammer',
          severity: 'critical',
          description: blacklistEntry.reason,
          confidence: 95
        })
      }

      // Get community reports and enhanced community feedback
      const reports = await this.getCommunityReports(walletAddress)
      result.reputation.reports = reports.length
      result.reputation.verifiedReports = reports.filter(r => r.status === 'verified').length

      // Get community consensus and integrate with analysis
      let communityConsensus
      try {
        communityConsensus = await CommunityFeedbackService.getCommunityConsensus(walletAddress)
        
        // Enhance reputation with community data
        if (communityConsensus.totalFeedback > 0) {
          result.reputation.communityTrust = communityConsensus.trustScore
          
          // Adjust risk level based on community consensus
          if (communityConsensus.riskLevel === 'critical' && result.riskLevel !== 'critical') {
            result.riskLevel = 'critical'
            result.riskScore = Math.max(result.riskScore, 85)
            result.threats.push('Community consensus indicates critical risk')
          } else if (communityConsensus.riskLevel === 'high' && !['critical', 'high'].includes(result.riskLevel)) {
            result.riskLevel = 'high'
            result.riskScore = Math.max(result.riskScore, 65)
            result.threats.push('Community consensus indicates high risk')
          }
          
          // Add community-based flags
          if (communityConsensus.majorityFeedbackType) {
            const majorityType = communityConsensus.majorityFeedbackType
            if (['scam', 'phishing', 'rugpull'].includes(majorityType)) {
              result.flags.push({
                type: majorityType === 'scam' ? 'known_scammer' : 'suspicious_pattern',
                severity: 'high',
                description: `Community reports majority feedback as ${majorityType}`,
                confidence: Math.round(communityConsensus.consensusScore)
              })
            }
          }
          
          // Add threat information based on community feedback
          if (communityConsensus.trustScore < 30) {
            result.threats.push(`Low community trust score (${communityConsensus.trustScore}/100)`)
          }
          
          // Enhance reputation scoring with community data
          const communityWeight = Math.min(0.6, communityConsensus.totalFeedback / 15) // Up to 60% weight
          const originalScore = result.reputation.score
          result.reputation.score = Math.round(
            (originalScore * (1 - communityWeight)) + 
            (communityConsensus.trustScore * 10 * communityWeight)
          )
        }
      } catch (error) {
        console.error('[WalletSecurity] Failed to integrate community consensus:', error)
        // Continue without community data
      }

      // Use real blockchain data from Helius API
      const [
        walletAge,
        balances,
        transactionPatterns,
        defiActivity,
        scamCheck,
        tokenRisk,
        riskScore
      ] = await Promise.all([
        BlockchainAnalysisService.getWalletAge(walletAddress),
        BlockchainAnalysisService.getWalletBalances(walletAddress),
        BlockchainAnalysisService.analyzeTransactionPatterns(walletAddress),
        BlockchainAnalysisService.checkDeFiActivity(walletAddress),
        BlockchainAnalysisService.checkScamDatabase(walletAddress),
        BlockchainAnalysisService.checkTokenRugpullRisk(walletAddress),
        BlockchainAnalysisService.calculateRiskScore(walletAddress)
      ])

      // Update analysis with real data
      result.analysis.accountAge = walletAge.ageInDays
      result.analysis.transactionCount = transactionPatterns.transactionVelocity.weekly
      
      // Add suspicious patterns
      result.analysis.suspiciousPatterns = transactionPatterns.suspiciousPatterns
      
      // Add risk flags from pattern analysis
      for (const flag of transactionPatterns.riskFlags) {
        result.flags.push(flag as typeof result.flags[0])
      }

      // Add DeFi activity information
      if (defiActivity.hasActivity) {
        result.analysis.knownAssociations = defiActivity.protocols
      }
      for (const indicator of defiActivity.riskIndicators) {
        result.threats.push(indicator)
      }

      // Check if known scammer
      if (scamCheck.isKnownScammer) {
        result.isBlacklisted = true
        result.threats.push(`Known scammer: ${scamCheck.scamType}`)
        result.flags.push({
          type: 'known_scammer',
          severity: 'critical',
          description: scamCheck.scamType || 'Reported scammer',
          confidence: scamCheck.confidence
        })
      }

      // Add token risks
      if (tokenRisk.hasRiskTokens) {
        for (const token of tokenRisk.riskTokens) {
          if (token.riskLevel === 'high') {
            result.threats.push(`High-risk token: ${token.name}`)
            result.flags.push({
              type: 'suspicious_pattern',
              severity: 'high',
              description: `Holds high-risk token: ${token.reasons.join(', ')}`,
              confidence: 75
            })
          }
        }
      }

      // Get enhanced transaction data
      const heliusTransactions = await BlockchainAnalysisService.getHeliusTransactionHistory(walletAddress, 100)
      
      // Calculate unique interactions
      const uniqueAddresses = new Set<string>()
      let totalValue = 0
      let txCount = 0
      
      for (const tx of heliusTransactions) {
        if (tx.nativeTransfers) {
          for (const transfer of tx.nativeTransfers) {
            const counterparty = transfer.fromUserAccount === walletAddress 
              ? transfer.toUserAccount 
              : transfer.fromUserAccount
            uniqueAddresses.add(counterparty)
            totalValue += transfer.amount / 1e9 // Convert to SOL
            txCount++
          }
        }
      }
      
      result.analysis.uniqueInteractions = uniqueAddresses.size
      result.analysis.averageTransactionValue = txCount > 0 ? totalValue / txCount : 0

      // Use the comprehensive risk score from blockchain analysis
      result.riskScore = riskScore.score
      result.riskLevel = riskScore.level

      // Add risk factors as threats
      for (const factor of riskScore.factors) {
        if (factor.impact > 15) {
          result.threats.push(factor.description)
        }
      }

      // Adjust reputation based on risk score
      result.reputation.score = Math.max(0, 1000 - (riskScore.score * 10))
      result.reputation.communityTrust = Math.max(0, 100 - riskScore.score)

      // Generate recommendations based on real data
      this.generateRecommendations(result)

      // Cache the result
      await this.cacheSecurityResult(walletAddress, result)

      return result

    } catch (error) {
      console.error(`[WalletSecurity] Analysis failed for ${walletAddress}:`, error)
      
      // Fallback to basic analysis if APIs fail
      try {
        const transactions = await getRecentTransactions(walletAddress, 100)
        result.analysis.transactionCount = transactions.length
        
        if (transactions.length > 0) {
          const oldestTx = transactions[transactions.length - 1]
          if (oldestTx.blockTime) {
            const firstTxDate = new Date(oldestTx.blockTime * 1000)
            result.analysis.accountAge = Math.floor((Date.now() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24))
          }
        }
        
        await this.analyzeTransactionPatterns(walletAddress, transactions, result)
        await this.checkScammerPatterns(walletAddress, result)
        this.calculateRiskScore(result)
        this.generateRecommendations(result)
        await this.cacheSecurityResult(walletAddress, result)
        
        return result
      } catch (fallbackError) {
        console.error(`[WalletSecurity] Fallback analysis also failed:`, fallbackError)
        result.riskLevel = 'medium'
        result.riskScore = 50
        result.threats.push('Analysis failed - treat with caution')
        return result
      }
    }
  }

  /**
   * Check if wallet is on blacklist
   */
  private static async checkBlacklist(walletAddress: string): Promise<{
    reason: string
    addedBy: string
    addedAt: Date
  } | null> {
    try {
      const blacklistCollection = await this.getBlacklistCollection()
      const entry = await blacklistCollection.findOne({ walletAddress })
      if (!entry) return null
      
      return {
        reason: entry.reason as string,
        addedBy: entry.addedBy as string,
        addedAt: entry.addedAt as Date
      }
    } catch (error) {
      console.error('[WalletSecurity] Blacklist check failed:', error)
      return null
    }
  }

  /**
   * Get community reports for wallet
   */
  private static async getCommunityReports(walletAddress: string): Promise<WalletReport[]> {
    try {
      const reportsCollection = await this.getReportsCollection()
      return await reportsCollection.find({ walletAddress }).toArray()
    } catch (error) {
      console.error('[WalletSecurity] Failed to get community reports:', error)
      return []
    }
  }

  /**
   * Analyze transaction patterns for suspicious activity
   */
  private static async analyzeTransactionPatterns(
    walletAddress: string, 
    transactions: unknown[], 
    result: WalletSecurityResult
  ): Promise<void> {
    try {
      const recentTxs = transactions.slice(0, 50) // Last 50 transactions
      
      // Calculate transaction metrics
      const values = recentTxs.map(tx => {
        const transaction = tx as Record<string, unknown>
        const meta = (transaction.transaction as Record<string, unknown>)?.meta as Record<string, unknown>
        if (!meta) return 0
        const preBalance = (meta.preBalances as number[])?.[0] || 0
        const postBalance = (meta.postBalances as number[])?.[0] || 0
        return Math.abs(postBalance - preBalance) / 1e9 // Convert to SOL
      }).filter(v => v > 0)

      if (values.length > 0) {
        result.analysis.averageTransactionValue = values.reduce((a, b) => a + b, 0) / values.length
      }

      // Check for suspicious patterns
      
      // 1. High frequency trading (potential bot)
      const recentHour = recentTxs.filter(tx => {
        const transaction = tx as Record<string, unknown>
        return transaction.blockTime && (Date.now() / 1000 - (transaction.blockTime as number)) < 3600
      })
      
      if (recentHour.length > 50) {
        result.flags.push({
          type: 'bot_activity',
          severity: 'medium',
          description: `${recentHour.length} transactions in the last hour`,
          confidence: 80
        })
        result.riskScore += 15
      }

      // 2. Very new wallet with high activity
      if (result.analysis.accountAge < 7 && transactions.length > 100) {
        result.flags.push({
          type: 'new_wallet',
          severity: 'medium',
          description: 'New wallet with unusually high activity',
          confidence: 70
        })
        result.riskScore += 20
      }

      // 3. Large transaction volumes
      const largeTransactions = values.filter(v => v > 1000) // > 1000 SOL
      if (largeTransactions.length > 5) {
        result.flags.push({
          type: 'high_volume',
          severity: 'medium',
          description: `${largeTransactions.length} large transactions (>1000 SOL)`,
          confidence: 60
        })
        result.riskScore += 10
      }

      // 4. Failed transactions (potential failed attacks)
      const failedTxs = recentTxs.filter(tx => {
        const transaction = tx as Record<string, unknown>
        const meta = (transaction.transaction as Record<string, unknown>)?.meta as Record<string, unknown>
        return meta?.err !== null
      })
      if (failedTxs.length > 10) {
        result.flags.push({
          type: 'suspicious_pattern',
          severity: 'medium',
          description: `${failedTxs.length} failed transactions`,
          confidence: 65
        })
        result.riskScore += 12
      }

      // 5. Check for known mixer/tumbler usage patterns
      const uniqueInteractions = new Set()
      recentTxs.forEach(tx => {
        const transaction = tx as Record<string, unknown>
        const message = (transaction.transaction as Record<string, unknown>)?.message as Record<string, unknown>
        const accounts = (message?.accountKeys as Array<Record<string, unknown>>) || []
        accounts.forEach((account: Record<string, unknown>) => {
          if (account.pubkey && account.pubkey !== walletAddress) {
            uniqueInteractions.add(account.pubkey)
          }
        })
      })

      result.analysis.uniqueInteractions = uniqueInteractions.size

      // If interacting with too many unique addresses, could be mixer usage
      if (uniqueInteractions.size > 200 && transactions.length < 500) {
        result.flags.push({
          type: 'mixer_usage',
          severity: 'high',
          description: 'Potential mixer/tumbler usage detected',
          confidence: 75
        })
        result.riskScore += 25
      }

    } catch (error) {
      console.error('[WalletSecurity] Transaction pattern analysis failed:', error)
      result.analysis.suspiciousPatterns.push('Failed to analyze transaction patterns')
    }
  }

  /**
   * Check for known scammer patterns
   */
  private static async checkScammerPatterns(walletAddress: string, result: WalletSecurityResult): Promise<void> {
    try {
      // Check against known scammer wallet patterns
      const knownScammerPatterns = [
        // Common scammer wallet prefixes (these are examples)
        /^1111111111111111111111111111111/,
        /^2222222222222222222222222222222/,
        /^AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/,
      ]

      for (const pattern of knownScammerPatterns) {
        if (pattern.test(walletAddress)) {
          result.flags.push({
            type: 'suspicious_pattern',
            severity: 'high',
            description: 'Matches known scammer wallet pattern',
            confidence: 85
          })
          result.riskScore += 30
          break
        }
      }

      // Check for vanity addresses (could be impersonation)
      const repeatingChars = /(.)\1{4,}/.test(walletAddress)
      if (repeatingChars) {
        result.flags.push({
          type: 'suspicious_pattern',
          severity: 'low',
          description: 'Vanity address detected (potential impersonation)',
          confidence: 40
        })
        result.riskScore += 5
      }

    } catch (error) {
      console.error('[WalletSecurity] Scammer pattern check failed:', error)
    }
  }

  /**
   * Calculate final risk score and level
   */
  private static calculateRiskScore(result: WalletSecurityResult): void {
    // Adjust risk score based on community reports
    if (result.reputation.verifiedReports > 0) {
      result.riskScore += result.reputation.verifiedReports * 20
    }

    // Adjust based on account age
    if (result.analysis.accountAge < 1) {
      result.riskScore += 15 // Very new accounts are riskier
    } else if (result.analysis.accountAge > 365) {
      result.riskScore -= 10 // Older accounts are generally safer
    }

    // Cap the risk score
    result.riskScore = Math.min(100, Math.max(0, result.riskScore))

    // Determine risk level based on score
    if (result.riskScore >= 80) {
      result.riskLevel = 'critical'
    } else if (result.riskScore >= 60) {
      result.riskLevel = 'high'
    } else if (result.riskScore >= 40) {
      result.riskLevel = 'medium'
    } else if (result.riskScore >= 20) {
      result.riskLevel = 'low'
    } else {
      result.riskLevel = 'very-low'
    }

    // Update reputation score (inverse of risk)
    result.reputation.score = Math.max(0, 1000 - (result.riskScore * 10))
    result.reputation.communityTrust = Math.max(0, 100 - result.riskScore)
  }

  /**
   * Generate security recommendations
   */
  private static generateRecommendations(result: WalletSecurityResult): void {
    result.recommendations = []

    if (result.isBlacklisted) {
      result.recommendations.push('⚠️ DO NOT INTERACT - Wallet is blacklisted')
      result.recommendations.push('Report any suspicious contact from this address')
      return
    }

    switch (result.riskLevel) {
      case 'critical':
        result.recommendations.push('🚨 EXTREME CAUTION - High risk of scam')
        result.recommendations.push('Do not send funds to this address')
        result.recommendations.push('Verify any claims through official channels')
        break

      case 'high':
        result.recommendations.push('⚠️ HIGH RISK - Exercise extreme caution')
        result.recommendations.push('Verify identity before any transactions')
        result.recommendations.push('Use escrow services for large transactions')
        break

      case 'medium':
        result.recommendations.push('⚡ MODERATE RISK - Additional verification recommended')
        result.recommendations.push('Check transaction history before interacting')
        result.recommendations.push('Start with small test transactions')
        break

      case 'low':
        result.recommendations.push('✅ LOW RISK - Standard precautions apply')
        result.recommendations.push('Always verify recipient addresses')
        break

      case 'very-low':
        result.recommendations.push('✅ VERY LOW RISK - Appears legitimate')
        result.recommendations.push('Standard security practices recommended')
        break
    }

    // Add specific recommendations based on flags
    for (const flag of result.flags) {
      switch (flag.type) {
        case 'bot_activity':
          result.recommendations.push('• Potential bot activity detected - verify human interaction')
          break
        case 'mixer_usage':
          result.recommendations.push('• Mixer usage detected - funds may be from questionable sources')
          break
        case 'new_wallet':
          result.recommendations.push('• Very new wallet - higher risk of abandonment after scam')
          break
      }
    }
  }

  /**
   * Report a wallet for suspicious activity
   */
  static async reportWallet(
    walletAddress: string,
    reporterAddress: string,
    reportType: WalletReport['reportType'],
    description: string,
    evidence?: WalletReport['evidence']
  ): Promise<WalletReport> {
    try {
      const reportsCollection = await this.getReportsCollection()
      
      const report: WalletReport = {
        walletAddress,
        reporterAddress,
        reportType,
        description,
        evidence,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await reportsCollection.insertOne(report)
      return { ...report, _id: result.insertedId }

    } catch (error) {
      console.error('[WalletSecurity] Failed to submit report:', error)
      throw new Error('Failed to submit wallet report')
    }
  }

  /**
   * Add wallet to blacklist
   */
  static async blacklistWallet(
    walletAddress: string,
    reason: string,
    addedBy: string,
    evidence?: string[]
  ): Promise<void> {
    try {
      const blacklistCollection = await this.getBlacklistCollection()
      
      await blacklistCollection.updateOne(
        { walletAddress },
        {
          $set: {
            walletAddress,
            reason,
            addedBy,
            evidence,
            addedAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true }
      )

      console.log(`[WalletSecurity] Wallet ${walletAddress} added to blacklist: ${reason}`)

    } catch (error) {
      console.error('[WalletSecurity] Failed to blacklist wallet:', error)
      throw new Error('Failed to blacklist wallet')
    }
  }

  /**
   * Get wallet reputation and community feedback
   */
  static async getWalletReputation(walletAddress: string): Promise<{
    score: number
    reports: WalletReport[]
    communityFeedback: Array<{
      type: 'positive' | 'negative' | 'neutral'
      comment: string
      reporterReputation: number
      timestamp: Date
    }>
  }> {
    try {
      const reportsCollection = await this.getReportsCollection()
      const reports = await reportsCollection.find({ walletAddress }).toArray()
      
      // Get community consensus from the new feedback system
      let communityConsensus
      try {
        communityConsensus = await CommunityFeedbackService.getCommunityConsensus(walletAddress)
      } catch (error) {
        console.error('[WalletSecurity] Failed to get community consensus:', error)
        communityConsensus = null
      }
      
      // Calculate reputation score based on reports and community feedback
      let score = 500 // Neutral starting score
      
      const verifiedReports = reports.filter(r => r.status === 'verified')
      score -= verifiedReports.length * 100 // Each verified report reduces score
      
      const pendingReports = reports.filter(r => r.status === 'pending')
      score -= pendingReports.length * 25 // Pending reports have less impact
      
      // Integrate community feedback into score
      if (communityConsensus && communityConsensus.totalFeedback > 0) {
        // Use community trust score as a major factor
        const communityWeight = Math.min(0.7, communityConsensus.totalFeedback / 10) // Up to 70% weight with 10+ feedback
        const traditionalWeight = 1 - communityWeight
        
        // Blend traditional score with community trust score
        score = (score * traditionalWeight) + (communityConsensus.trustScore * 10 * communityWeight)
        
        // Apply risk level adjustments
        switch (communityConsensus.riskLevel) {
          case 'critical':
            score = Math.min(score, 100) // Cap at very low score for critical risk
            break
          case 'high':
            score = Math.min(score, 250) // Cap at low score for high risk
            break
          case 'medium':
            // No additional cap for medium risk
            break
          case 'low':
            score = Math.max(score, 600) // Boost score for low risk
            break
          case 'very-low':
            score = Math.max(score, 750) // Boost score for very low risk
            break
        }
      }
      
      score = Math.max(0, Math.min(1000, score))

      // Format community feedback for backward compatibility
      const communityFeedback = communityConsensus ? 
        communityConsensus.recentFeedback.slice(0, 10).map(feedback => ({
          type: feedback.sentiment as 'positive' | 'negative' | 'neutral',
          comment: `${feedback.type}: ${feedback.confidence}% confidence`,
          reporterReputation: communityConsensus.topContributors.find(c => 
            feedback.createdAt.getTime() // This is a simplified mapping
          )?.reputationScore || 500,
          timestamp: feedback.createdAt
        })) : []

      return {
        score,
        reports,
        communityFeedback
      }

    } catch (error) {
      console.error('[WalletSecurity] Failed to get reputation:', error)
      return {
        score: 500,
        reports: [],
        communityFeedback: []
      }
    }
  }

  /**
   * Cache security analysis result
   */
  private static async cacheSecurityResult(walletAddress: string, result: WalletSecurityResult): Promise<void> {
    try {
      const securityCollection = await this.getSecurityCollection()
      
      await securityCollection.updateOne(
        { walletAddress },
        {
          $set: {
            ...result,
            cachedAt: new Date()
          }
        },
        { upsert: true }
      )

    } catch (error) {
      console.error('[WalletSecurity] Failed to cache result:', error)
    }
  }

  /**
   * Get cached security result if recent
   */
  static async getCachedResult(walletAddress: string): Promise<WalletSecurityResult | null> {
    try {
      const securityCollection = await this.getSecurityCollection()
      const cached = await securityCollection.findOne({ walletAddress })
      
      if (cached && cached.cachedAt) {
        const age = Date.now() - cached.cachedAt.getTime()
        if (age < 3600000) { // 1 hour cache
          return {
            address: cached.address,
            riskLevel: cached.riskLevel,
            riskScore: cached.riskScore,
            isBlacklisted: cached.isBlacklisted,
            reputation: cached.reputation,
            threats: cached.threats,
            flags: cached.flags,
            analysis: cached.analysis,
            recommendations: cached.recommendations,
            lastChecked: cached.lastChecked
          } as WalletSecurityResult
        }
      }

      return null

    } catch (error) {
      console.error('[WalletSecurity] Failed to get cached result:', error)
      return null
    }
  }

  /**
   * Bulk analyze multiple wallets
   */
  static async bulkAnalyzeWallets(walletAddresses: string[]): Promise<WalletSecurityResult[]> {
    const results: WalletSecurityResult[] = []
    
    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 10
    
    for (let i = 0; i < walletAddresses.length; i += BATCH_SIZE) {
      const batch = walletAddresses.slice(i, i + BATCH_SIZE)
      
      const batchPromises = batch.map(async (address) => {
        try {
          // Check cache first
          const cached = await this.getCachedResult(address)
          if (cached) {
            return cached
          }
          
          // Perform full analysis
          return await this.analyzeWallet(address)
        } catch (error) {
          console.error(`[WalletSecurity] Bulk analysis failed for ${address}:`, error)
          return {
            address,
            riskLevel: 'medium' as const,
            riskScore: 50,
            isBlacklisted: false,
            reputation: { score: 500, reports: 0, verifiedReports: 0, communityTrust: 50 },
            threats: ['Analysis failed'],
            flags: [],
            analysis: {
              accountAge: 0,
              transactionCount: 0,
              averageTransactionValue: 0,
              uniqueInteractions: 0,
              suspiciousPatterns: [],
              knownAssociations: []
            },
            recommendations: ['Analysis failed - manual review recommended'],
            lastChecked: new Date()
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Get comprehensive wallet assessment including community feedback
   */
  static async getComprehensiveAssessment(walletAddress: string): Promise<{
    security: WalletSecurityResult
    community: {
      consensus: any
      recentFeedback: any[]
      trustScore: number
      riskLevel: string
      totalFeedback: number
      topContributors: any[]
    }
    combined: {
      overallRiskLevel: string
      overallScore: number
      confidenceLevel: 'low' | 'medium' | 'high'
      recommendations: string[]
    }
  }> {
    try {
      // Get security analysis
      const security = await this.analyzeWallet(walletAddress)
      
      // Get community consensus
      const consensus = await CommunityFeedbackService.getCommunityConsensus(walletAddress)
      
      // Combine assessments
      let overallRiskLevel = security.riskLevel
      let overallScore = security.riskScore
      
      // Community data takes precedence with sufficient feedback
      if (consensus.totalFeedback >= 5) {
        const communityRiskLevels = ['very-low', 'low', 'medium', 'high', 'critical']
        const securityRiskIndex = communityRiskLevels.indexOf(security.riskLevel)
        const communityRiskIndex = communityRiskLevels.indexOf(consensus.riskLevel)
        
        // Take the higher risk level
        if (communityRiskIndex > securityRiskIndex) {
          overallRiskLevel = consensus.riskLevel
        }
        
        // Blend scores with community weight
        const communityWeight = Math.min(0.7, consensus.totalFeedback / 10)
        overallScore = Math.round(
          (security.riskScore * (1 - communityWeight)) + 
          ((100 - consensus.trustScore) * communityWeight)
        )
      }
      
      // Determine confidence level
      const confidenceLevel = consensus.totalFeedback >= 10 ? 'high' :
                             consensus.totalFeedback >= 3 ? 'medium' : 'low'
      
      // Generate combined recommendations
      const recommendations = [...security.recommendations]
      
      if (consensus.totalFeedback > 0) {
        if (consensus.trustScore < 50) {
          recommendations.push('⚠️ Community feedback indicates potential risks - exercise caution')
        } else if (consensus.trustScore > 70) {
          recommendations.push('✅ Positive community feedback - generally considered trustworthy')
        }
        
        if (consensus.totalFeedback < 3) {
          recommendations.push('ℹ️ Limited community feedback available - consider multiple sources')
        }
      } else {
        recommendations.push('ℹ️ No community feedback available - be extra cautious')
      }
      
      return {
        security,
        community: {
          consensus,
          recentFeedback: consensus.recentFeedback.slice(0, 5),
          trustScore: consensus.trustScore,
          riskLevel: consensus.riskLevel,
          totalFeedback: consensus.totalFeedback,
          topContributors: consensus.topContributors
        },
        combined: {
          overallRiskLevel: overallRiskLevel as any,
          overallScore,
          confidenceLevel,
          recommendations: [...new Set(recommendations)] // Remove duplicates
        }
      }
      
    } catch (error) {
      console.error('[WalletSecurity] Comprehensive assessment failed:', error)
      
      // Fallback to security-only assessment
      const security = await this.analyzeWallet(walletAddress)
      
      return {
        security,
        community: {
          consensus: null,
          recentFeedback: [],
          trustScore: 50,
          riskLevel: 'medium',
          totalFeedback: 0,
          topContributors: []
        },
        combined: {
          overallRiskLevel: security.riskLevel,
          overallScore: security.riskScore,
          confidenceLevel: 'low',
          recommendations: [...security.recommendations, 'ℹ️ Community feedback unavailable']
        }
      }
    }
  }
}
