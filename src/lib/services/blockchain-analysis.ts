import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js'

interface HeliusTransaction {
  signature: string
  timestamp: number
  type: string
  source: string
  fee: number
  feePayer: string
  slot: number
  description: string
  nativeTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    amount: number
  }>
  tokenTransfers?: Array<{
    fromUserAccount: string
    toUserAccount: string
    fromTokenAccount: string
    toTokenAccount: string
    tokenAmount: number
    mint: string
    tokenStandard: string
  }>
  accountData?: Array<{
    account: string
    nativeBalanceChange: number
    tokenBalanceChanges: Array<{
      userAccount: string
      tokenAccount: string
      mint: string
      rawTokenAmount: {
        tokenAmount: string
        decimals: number
      }
    }>
  }>
  transactionError?: string | null
  instructions?: Array<{
    programId: string
    accounts: string[]
    data: string
    innerInstructions?: Array<{
      programId: string
      accounts: string[]
      data: string
    }>
  }>
  events?: {
    nft?: unknown
    swap?: unknown
    compressed?: unknown
  }
}

interface HeliusAddressHistory {
  transactions: HeliusTransaction[]
  nativeBalance: {
    lamports: number
    price: number
    valueUsd: number
  }
  tokenBalances: Array<{
    mint: string
    amount: number
    decimals: number
    valueUsd?: number
  }>
}

interface SolscanAccountInfo {
  lamports: number
  ownerProgram: string
  type: string
  rentEpoch: number
  account: string
  onchainActivity?: {
    firstActivity: number
    lastActivity: number
    mostActiveProgram?: string
  }
}

interface BitqueryTransaction {
  hash: string
  block: {
    height: number
    timestamp: {
      time: string
    }
  }
  signer: string
  success: boolean
  fee: {
    amount: number
  }
  instructionCount: number
  logMessages: string[]
}

export class BlockchainAnalysisService {
  private static heliusApiKey = process.env.NEXT_PUBLIC_SOLANA_RPC?.split('api-key=')[1] || ''
  private static heliusBaseUrl = 'https://api.helius.xyz/v0'
  private static solscanBaseUrl = 'https://public-api.solscan.io'
  private static bitqueryBaseUrl = 'https://graphql.bitquery.io'
  
  /**
   * Get comprehensive transaction history from Helius
   */
  static async getHeliusTransactionHistory(walletAddress: string, limit: number = 100): Promise<HeliusTransaction[]> {
    try {
      const url = `${this.heliusBaseUrl}/addresses/${walletAddress}/transactions?api-key=${this.heliusApiKey}&limit=${limit}`
      
      const response = await fetch(url)
      if (!response.ok) {
        console.error('[Helius] Failed to fetch transactions:', response.statusText)
        return []
      }
      
      const data = await response.json()
      return data as HeliusTransaction[]
    } catch (error) {
      console.error('[Helius] Error fetching transactions:', error)
      return []
    }
  }

  /**
   * Get enhanced transaction details from Helius
   */
  static async getEnhancedTransactions(walletAddress: string): Promise<HeliusTransaction[]> {
    try {
      const url = `${this.heliusBaseUrl}/addresses/${walletAddress}/transactions?api-key=${this.heliusApiKey}&type=TRANSFER,SWAP,NFT,DEFI`
      
      const response = await fetch(url)
      if (!response.ok) {
        return []
      }
      
      const transactions = await response.json()
      return transactions
    } catch (error) {
      console.error('[Helius] Enhanced transactions error:', error)
      return []
    }
  }

  /**
   * Analyze wallet balances and holdings
   */
  static async getWalletBalances(walletAddress: string): Promise<{
    nativeBalance: number
    tokenCount: number
    nftCount: number
    totalValueUsd: number
  }> {
    try {
      const url = `${this.heliusBaseUrl}/addresses/${walletAddress}/balances?api-key=${this.heliusApiKey}`
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch balances')
      }
      
      const data = await response.json()
      
      return {
        nativeBalance: data.nativeBalance?.lamports || 0,
        tokenCount: data.tokens?.length || 0,
        nftCount: data.nfts?.length || 0,
        totalValueUsd: data.totalValueUsd || 0
      }
    } catch (error) {
      console.error('[Helius] Balance fetch error:', error)
      return {
        nativeBalance: 0,
        tokenCount: 0,
        nftCount: 0,
        totalValueUsd: 0
      }
    }
  }

  /**
   * Check if wallet is associated with known DeFi protocols
   */
  static async checkDeFiActivity(walletAddress: string): Promise<{
    hasActivity: boolean
    protocols: string[]
    riskIndicators: string[]
  }> {
    try {
      const transactions = await this.getHeliusTransactionHistory(walletAddress, 50)
      
      const protocols = new Set<string>()
      const riskIndicators: string[] = []
      
      // Known DeFi protocol program IDs
      const defiPrograms: Record<string, string> = {
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
        '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Raydium V2',
        'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S': 'Lifinity',
        'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CPMM',
        'SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr': 'Saros',
      }
      
      // Known mixer/tumbler patterns
      const mixerPatterns = [
        'tornado',
        'mixer',
        'tumbler',
        'wasabi',
        'coinjoin'
      ]
      
      for (const tx of transactions) {
        // Check for DeFi protocol interactions
        if (tx.instructions) {
          for (const instruction of tx.instructions) {
            const protocolName = defiPrograms[instruction.programId]
            if (protocolName) {
              protocols.add(protocolName)
            }
          }
        }
        
        // Check for suspicious patterns in description
        const description = tx.description?.toLowerCase() || ''
        for (const pattern of mixerPatterns) {
          if (description.includes(pattern)) {
            riskIndicators.push(`Potential mixer usage: ${pattern}`)
          }
        }
        
        // Check for failed transactions (potential exploit attempts)
        if (tx.transactionError) {
          riskIndicators.push('Failed transaction detected')
        }
      }
      
      return {
        hasActivity: protocols.size > 0,
        protocols: Array.from(protocols),
        riskIndicators
      }
    } catch (error) {
      console.error('[DeFi Check] Error:', error)
      return {
        hasActivity: false,
        protocols: [],
        riskIndicators: []
      }
    }
  }

  /**
   * Get wallet creation date and age
   */
  static async getWalletAge(walletAddress: string): Promise<{
    createdAt: Date | null
    ageInDays: number
    firstTransaction: string | null
  }> {
    try {
      // Get transaction history ordered by time
      const transactions = await this.getHeliusTransactionHistory(walletAddress, 1000)
      
      if (transactions.length === 0) {
        return {
          createdAt: null,
          ageInDays: 0,
          firstTransaction: null
        }
      }
      
      // Find the oldest transaction
      const oldestTx = transactions[transactions.length - 1]
      const createdAt = new Date(oldestTx.timestamp * 1000)
      const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      
      return {
        createdAt,
        ageInDays,
        firstTransaction: oldestTx.signature
      }
    } catch (error) {
      console.error('[Wallet Age] Error:', error)
      return {
        createdAt: null,
        ageInDays: 0,
        firstTransaction: null
      }
    }
  }

  /**
   * Analyze transaction patterns for suspicious activity
   */
  static async analyzeTransactionPatterns(walletAddress: string): Promise<{
    suspiciousPatterns: string[]
    riskFlags: Array<{
      type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      description: string
      confidence: number
    }>
    transactionVelocity: {
      hourly: number
      daily: number
      weekly: number
    }
  }> {
    try {
      const transactions = await this.getHeliusTransactionHistory(walletAddress, 200)
      const suspiciousPatterns: string[] = []
      const riskFlags: Array<{
        type: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        confidence: number
      }> = []
      
      const now = Date.now() / 1000
      const oneHour = 3600
      const oneDay = 86400
      const oneWeek = 604800
      
      // Count transactions by time period
      const hourlyTxs = transactions.filter(tx => now - tx.timestamp < oneHour).length
      const dailyTxs = transactions.filter(tx => now - tx.timestamp < oneDay).length
      const weeklyTxs = transactions.filter(tx => now - tx.timestamp < oneWeek).length
      
      // Check for high-frequency trading (bot activity)
      if (hourlyTxs > 20) {
        riskFlags.push({
          type: 'bot_activity',
          severity: 'high',
          description: `Extremely high transaction frequency: ${hourlyTxs} transactions in the last hour`,
          confidence: 90
        })
        suspiciousPatterns.push('High-frequency trading detected')
      } else if (hourlyTxs > 10) {
        riskFlags.push({
          type: 'bot_activity',
          severity: 'medium',
          description: `High transaction frequency: ${hourlyTxs} transactions in the last hour`,
          confidence: 70
        })
      }
      
      // Check for rapid small transactions (dusting attacks or mixer patterns)
      const smallTxs = transactions.filter(tx => {
        const amount = tx.nativeTransfers?.[0]?.amount || 0
        return amount > 0 && amount < 0.001 * 1e9 // Less than 0.001 SOL
      })
      
      if (smallTxs.length > 50) {
        riskFlags.push({
          type: 'dusting_attack',
          severity: 'high',
          description: `${smallTxs.length} small transactions detected (potential dusting attack)`,
          confidence: 85
        })
        suspiciousPatterns.push('Potential dusting attack pattern')
      }
      
      // Check for circular transactions (money laundering pattern)
      const uniqueCounterparties = new Set<string>()
      const counterpartyFrequency = new Map<string, number>()
      
      for (const tx of transactions) {
        if (tx.nativeTransfers) {
          for (const transfer of tx.nativeTransfers) {
            const counterparty = transfer.fromUserAccount === walletAddress 
              ? transfer.toUserAccount 
              : transfer.fromUserAccount
            
            uniqueCounterparties.add(counterparty)
            counterpartyFrequency.set(
              counterparty, 
              (counterpartyFrequency.get(counterparty) || 0) + 1
            )
          }
        }
      }
      
      // Check for repeated interactions with same addresses
      const suspiciousInteractions = Array.from(counterpartyFrequency.entries())
        .filter(([_, count]) => count > 10)
      
      if (suspiciousInteractions.length > 0) {
        riskFlags.push({
          type: 'circular_transactions',
          severity: 'medium',
          description: `Repeated transactions with ${suspiciousInteractions.length} addresses`,
          confidence: 60
        })
        suspiciousPatterns.push('Circular transaction pattern detected')
      }
      
      // Check for flash loan patterns
      const flashLoanPattern = transactions.filter(tx => {
        return tx.type === 'DEFI' && 
               tx.instructions && 
               tx.instructions.length > 5 &&
               tx.timestamp && 
               transactions.some(otherTx => 
                 Math.abs(otherTx.timestamp - tx.timestamp) < 10 && 
                 otherTx.signature !== tx.signature
               )
      })
      
      if (flashLoanPattern.length > 0) {
        riskFlags.push({
          type: 'flash_loan',
          severity: 'high',
          description: `Potential flash loan activity detected`,
          confidence: 75
        })
        suspiciousPatterns.push('Flash loan pattern detected')
      }
      
      // Check for MEV bot patterns
      const mevPattern = transactions.filter(tx => {
        return tx.slot && transactions.filter(otherTx => 
          otherTx.slot === tx.slot && otherTx.signature !== tx.signature
        ).length > 2
      })
      
      if (mevPattern.length > 5) {
        riskFlags.push({
          type: 'mev_bot',
          severity: 'medium',
          description: `MEV bot activity detected`,
          confidence: 70
        })
        suspiciousPatterns.push('MEV bot pattern detected')
      }
      
      return {
        suspiciousPatterns,
        riskFlags,
        transactionVelocity: {
          hourly: hourlyTxs,
          daily: dailyTxs,
          weekly: weeklyTxs
        }
      }
    } catch (error) {
      console.error('[Pattern Analysis] Error:', error)
      return {
        suspiciousPatterns: [],
        riskFlags: [],
        transactionVelocity: {
          hourly: 0,
          daily: 0,
          weekly: 0
        }
      }
    }
  }

  /**
   * Check against known scam addresses database
   */
  static async checkScamDatabase(walletAddress: string): Promise<{
    isKnownScammer: boolean
    reportedBy: string[]
    scamType: string | null
    confidence: number
  }> {
    try {
      // Check against public scam databases
      // Note: These are example endpoints, you'd need actual API access
      
      // 1. Check Solana FM scam database (if available)
      // 2. Check community-reported scam lists
      // 3. Check against known phishing addresses
      
      // For now, we'll check against some known patterns
      const knownScamPatterns = [
        /^Scam/i,
        /^Fake/i,
        /^11111111/,  // Burn address pattern
        /^So11111111111111111111111111111111111111112/  // Wrapped SOL
      ]
      
      for (const pattern of knownScamPatterns) {
        if (pattern.test(walletAddress)) {
          return {
            isKnownScammer: true,
            reportedBy: ['Pattern matching'],
            scamType: 'Known suspicious pattern',
            confidence: 80
          }
        }
      }
      
      // Check against a maintained list (this would be from a real database)
      const knownScamAddresses: string[] = [
        // Add known scam addresses here
      ]
      
      if (knownScamAddresses.includes(walletAddress)) {
        return {
          isKnownScammer: true,
          reportedBy: ['Community database'],
          scamType: 'Reported scammer',
          confidence: 95
        }
      }
      
      return {
        isKnownScammer: false,
        reportedBy: [],
        scamType: null,
        confidence: 0
      }
    } catch (error) {
      console.error('[Scam Database] Error:', error)
      return {
        isKnownScammer: false,
        reportedBy: [],
        scamType: null,
        confidence: 0
      }
    }
  }

  /**
   * Get token rugpull analysis
   */
  static async checkTokenRugpullRisk(walletAddress: string): Promise<{
    hasRiskTokens: boolean
    riskTokens: Array<{
      mint: string
      name: string
      riskLevel: 'low' | 'medium' | 'high'
      reasons: string[]
    }>
  }> {
    try {
      const url = `${this.heliusBaseUrl}/addresses/${walletAddress}/balances?api-key=${this.heliusApiKey}`
      const response = await fetch(url)
      
      if (!response.ok) {
        return { hasRiskTokens: false, riskTokens: [] }
      }
      
      const data = await response.json()
      const riskTokens: Array<{
        mint: string
        name: string
        riskLevel: 'low' | 'medium' | 'high'
        reasons: string[]
      }> = []
      
      if (data.tokens) {
        for (const token of data.tokens) {
          const reasons: string[] = []
          let riskLevel: 'low' | 'medium' | 'high' = 'low'
          
          // Check for honeypot characteristics
          if (!token.tokenInfo?.supply || token.tokenInfo.supply === '1') {
            reasons.push('Single supply token (potential honeypot)')
            riskLevel = 'high'
          }
          
          // Check for no metadata
          if (!token.tokenInfo?.name || !token.tokenInfo?.symbol) {
            reasons.push('Missing token metadata')
            riskLevel = 'medium'
          }
          
          // Check for suspicious names
          const suspiciousNames = ['test', 'scam', 'rug', 'honeypot', 'fake']
          const tokenName = (token.tokenInfo?.name || '').toLowerCase()
          if (suspiciousNames.some(name => tokenName.includes(name))) {
            reasons.push('Suspicious token name')
            riskLevel = 'high'
          }
          
          if (reasons.length > 0) {
            riskTokens.push({
              mint: token.mint,
              name: token.tokenInfo?.name || 'Unknown',
              riskLevel,
              reasons
            })
          }
        }
      }
      
      return {
        hasRiskTokens: riskTokens.length > 0,
        riskTokens
      }
    } catch (error) {
      console.error('[Token Risk] Error:', error)
      return { hasRiskTokens: false, riskTokens: [] }
    }
  }

  /**
   * Calculate comprehensive risk score
   */
  static async calculateRiskScore(walletAddress: string): Promise<{
    score: number
    level: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
    factors: Array<{
      factor: string
      impact: number
      description: string
    }>
  }> {
    const factors: Array<{
      factor: string
      impact: number
      description: string
    }> = []
    
    let totalScore = 0
    
    // 1. Check wallet age
    const { ageInDays } = await this.getWalletAge(walletAddress)
    if (ageInDays < 7) {
      factors.push({
        factor: 'New wallet',
        impact: 25,
        description: `Wallet is only ${ageInDays} days old`
      })
      totalScore += 25
    } else if (ageInDays < 30) {
      factors.push({
        factor: 'Young wallet',
        impact: 15,
        description: `Wallet is ${ageInDays} days old`
      })
      totalScore += 15
    } else if (ageInDays > 365) {
      factors.push({
        factor: 'Established wallet',
        impact: -10,
        description: `Wallet is over 1 year old`
      })
      totalScore -= 10
    }
    
    // 2. Check transaction patterns
    const { riskFlags, transactionVelocity } = await this.analyzeTransactionPatterns(walletAddress)
    for (const flag of riskFlags) {
      const impact = flag.severity === 'critical' ? 30 : 
                     flag.severity === 'high' ? 20 : 
                     flag.severity === 'medium' ? 10 : 5
      factors.push({
        factor: flag.type,
        impact,
        description: flag.description
      })
      totalScore += impact
    }
    
    // 3. Check DeFi activity
    const { riskIndicators } = await this.checkDeFiActivity(walletAddress)
    for (const indicator of riskIndicators) {
      factors.push({
        factor: 'DeFi risk',
        impact: 10,
        description: indicator
      })
      totalScore += 10
    }
    
    // 4. Check scam database
    const { isKnownScammer, scamType } = await this.checkScamDatabase(walletAddress)
    if (isKnownScammer) {
      factors.push({
        factor: 'Known scammer',
        impact: 100,
        description: scamType || 'Reported in scam database'
      })
      totalScore += 100
    }
    
    // 5. Check token risks
    const { hasRiskTokens, riskTokens } = await this.checkTokenRugpullRisk(walletAddress)
    if (hasRiskTokens) {
      const highRiskTokens = riskTokens.filter(t => t.riskLevel === 'high').length
      if (highRiskTokens > 0) {
        factors.push({
          factor: 'High-risk tokens',
          impact: 20,
          description: `Holds ${highRiskTokens} high-risk tokens`
        })
        totalScore += 20
      }
    }
    
    // Cap the score between 0 and 100
    totalScore = Math.max(0, Math.min(100, totalScore))
    
    // Determine risk level
    let level: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
    if (totalScore >= 80) level = 'critical'
    else if (totalScore >= 60) level = 'high'
    else if (totalScore >= 40) level = 'medium'
    else if (totalScore >= 20) level = 'low'
    else level = 'very-low'
    
    return {
      score: totalScore,
      level,
      factors
    }
  }
}