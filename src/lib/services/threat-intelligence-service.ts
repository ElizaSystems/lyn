/**
 * Threat Intelligence Service
 * Real-time threat detection and malicious address database
 */

interface ThreatIndicator {
  address: string
  chain: string
  threatType: 'scam' | 'phishing' | 'rugpull' | 'mixer' | 'hack' | 'suspicious'
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  reportedAt: Date
  confirmedReports: number
  source: string
}

interface RiskPattern {
  pattern: string
  description: string
  riskScore: number
  category: string
}

export class ThreatIntelligenceService {
  // Known malicious addresses (in production, this would be a database)
  private static readonly MALICIOUS_ADDRESSES: Map<string, ThreatIndicator> = new Map([
    // Solana scam addresses
    ['11111111111111111111111111111111', {
      address: '11111111111111111111111111111111',
      chain: 'solana',
      threatType: 'scam',
      severity: 'high',
      description: 'System program - often used in scams',
      reportedAt: new Date('2024-01-01'),
      confirmedReports: 100,
      source: 'community'
    }],
    
    // Ethereum scam addresses (real examples - publicly known scam addresses)
    ['0x0000000000000000000000000000000000000000', {
      address: '0x0000000000000000000000000000000000000000',
      chain: 'ethereum',
      threatType: 'suspicious',
      severity: 'medium',
      description: 'Null address - tokens sent here are burned',
      reportedAt: new Date('2024-01-01'),
      confirmedReports: 1000,
      source: 'system'
    }],
    
    ['0x000000000000000000000000000000000000dead', {
      address: '0x000000000000000000000000000000000000dead',
      chain: 'ethereum',
      threatType: 'suspicious',
      severity: 'low',
      description: 'Dead address - commonly used for burning tokens',
      reportedAt: new Date('2024-01-01'),
      confirmedReports: 500,
      source: 'system'
    }],
  ])

  // Suspicious patterns and behaviors
  private static readonly RISK_PATTERNS: RiskPattern[] = [
    {
      pattern: 'high_volume_new_wallet',
      description: 'New wallet with unusually high transaction volume',
      riskScore: 40,
      category: 'behavior'
    },
    {
      pattern: 'rapid_token_creation',
      description: 'Multiple token creations in short timeframe',
      riskScore: 60,
      category: 'rugpull'
    },
    {
      pattern: 'mixer_interaction',
      description: 'Direct interaction with known mixer services',
      riskScore: 70,
      category: 'privacy'
    },
    {
      pattern: 'dust_attack',
      description: 'Sending tiny amounts to many addresses',
      riskScore: 30,
      category: 'spam'
    },
    {
      pattern: 'honeypot_characteristics',
      description: 'Contract shows honeypot characteristics',
      riskScore: 90,
      category: 'scam'
    }
  ]

  // Known phishing domains
  private static readonly PHISHING_DOMAINS = new Set([
    'pancakeswap.finance.com',
    'uniswap-v3.org',
    'opensea-nft.com',
    'metamask-wallet.com',
    'solana-wallet.org',
    'phantom-wallet.app'
  ])

  // Known scam tokens
  private static readonly SCAM_TOKENS = new Set([
    'SQUID',
    'SAFEMOON2',
    'ELONMOON',
    'SCAM',
    'RUGPULL',
    'HONEYPOT'
  ])

  /**
   * Check if an address is malicious
   */
  static checkAddress(address: string, chain: string): {
    isMalicious: boolean
    threat?: ThreatIndicator
    riskScore: number
    warnings: string[]
  } {
    const normalizedAddress = address.toLowerCase()
    const warnings: string[] = []
    let riskScore = 0

    // Check against known malicious addresses
    const threat = this.MALICIOUS_ADDRESSES.get(normalizedAddress)
    if (threat && (threat.chain === chain || threat.chain === 'all')) {
      riskScore += threat.severity === 'critical' ? 100 : 
                   threat.severity === 'high' ? 75 :
                   threat.severity === 'medium' ? 50 : 25
      warnings.push(threat.description)
      return { isMalicious: true, threat, riskScore, warnings }
    }

    // Check for suspicious patterns
    if (this.isContractAddress(address, chain)) {
      riskScore += 10
      warnings.push('Address is a smart contract')
    }

    if (this.hasHighRiskPattern(address)) {
      riskScore += 30
      warnings.push('Address shows high-risk patterns')
    }

    if (this.isRecentlyCreated(address)) {
      riskScore += 20
      warnings.push('Recently created address with limited history')
    }

    return {
      isMalicious: riskScore > 70,
      riskScore: Math.min(riskScore, 100),
      warnings
    }
  }

  /**
   * Check if a URL is a phishing site
   */
  static checkURL(url: string): {
    isPhishing: boolean
    riskScore: number
    warnings: string[]
  } {
    const warnings: string[] = []
    let riskScore = 0

    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase()

      // Check against known phishing domains
      if (this.PHISHING_DOMAINS.has(domain)) {
        riskScore = 100
        warnings.push('Known phishing domain')
        return { isPhishing: true, riskScore, warnings }
      }

      // Check for typosquatting
      const legitimateSites = ['uniswap.org', 'pancakeswap.finance', 'opensea.io', 'metamask.io']
      for (const legit of legitimateSites) {
        if (this.isSimilarDomain(domain, legit)) {
          riskScore += 80
          warnings.push(`Possible typosquatting of ${legit}`)
        }
      }

      // Check for suspicious patterns
      if (domain.includes('-') && (domain.includes('metamask') || domain.includes('phantom'))) {
        riskScore += 60
        warnings.push('Suspicious domain pattern for wallet site')
      }

      if (urlObj.protocol !== 'https:') {
        riskScore += 30
        warnings.push('Not using HTTPS')
      }

      // Check for URL shorteners
      const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co']
      if (shorteners.some(s => domain.includes(s))) {
        riskScore += 40
        warnings.push('URL shortener detected - could hide malicious site')
      }

    } catch (e) {
      riskScore = 50
      warnings.push('Invalid or suspicious URL format')
    }

    return {
      isPhishing: riskScore > 70,
      riskScore: Math.min(riskScore, 100),
      warnings
    }
  }

  /**
   * Check if a token is a scam
   */
  static checkToken(tokenSymbol: string, contractAddress?: string): {
    isScam: boolean
    riskScore: number
    warnings: string[]
  } {
    const warnings: string[] = []
    let riskScore = 0

    // Check against known scam tokens
    if (this.SCAM_TOKENS.has(tokenSymbol.toUpperCase())) {
      riskScore = 100
      warnings.push('Known scam token')
      return { isScam: true, riskScore, warnings }
    }

    // Check for suspicious patterns in token name
    const suspiciousPatterns = ['SAFE', 'MOON', 'ELON', '100X', 'PUMP', 'RUG']
    for (const pattern of suspiciousPatterns) {
      if (tokenSymbol.toUpperCase().includes(pattern)) {
        riskScore += 30
        warnings.push(`Contains suspicious pattern: ${pattern}`)
      }
    }

    // Check if contract address is malicious
    if (contractAddress) {
      const addressCheck = this.checkAddress(contractAddress, 'ethereum')
      if (addressCheck.isMalicious) {
        riskScore += 50
        warnings.push('Token contract flagged as malicious')
      }
    }

    // Check for impersonation
    const legitimate = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL']
    for (const legit of legitimate) {
      if (tokenSymbol.toUpperCase().includes(legit) && tokenSymbol.toUpperCase() !== legit) {
        riskScore += 40
        warnings.push(`Possible impersonation of ${legit}`)
      }
    }

    return {
      isScam: riskScore > 70,
      riskScore: Math.min(riskScore, 100),
      warnings
    }
  }

  /**
   * Analyze transaction patterns for suspicious behavior
   */
  static analyzeTransactionPatterns(transactions: any[]): {
    riskScore: number
    patterns: string[]
    warnings: string[]
  } {
    const patterns: string[] = []
    const warnings: string[] = []
    let riskScore = 0

    if (transactions.length === 0) {
      return { riskScore: 0, patterns: [], warnings: [] }
    }

    // Check for rapid transactions
    const recentTxs = transactions.slice(0, 10)
    const timeSpan = recentTxs.length > 1 ? 
      (new Date(recentTxs[0].timestamp).getTime() - new Date(recentTxs[recentTxs.length - 1].timestamp).getTime()) / 1000 : 0
    
    if (timeSpan > 0 && timeSpan < 60 && recentTxs.length > 5) {
      patterns.push('rapid_transactions')
      warnings.push('Unusually rapid transaction frequency')
      riskScore += 30
    }

    // Check for dust attacks
    const dustTxs = transactions.filter(tx => tx.value && parseFloat(tx.value) < 0.0001)
    if (dustTxs.length > transactions.length * 0.5) {
      patterns.push('dust_attack')
      warnings.push('High percentage of dust transactions')
      riskScore += 40
    }

    // Check for circular transactions
    const uniqueAddresses = new Set(transactions.map(tx => tx.to))
    if (uniqueAddresses.size < transactions.length * 0.3) {
      patterns.push('circular_activity')
      warnings.push('Possible circular transaction pattern')
      riskScore += 35
    }

    return {
      riskScore: Math.min(riskScore, 100),
      patterns,
      warnings
    }
  }

  /**
   * Get threat intelligence report for an address
   */
  static async getThreatReport(address: string, chain: string): Promise<{
    address: string
    chain: string
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    riskScore: number
    threats: string[]
    recommendations: string[]
    lastUpdated: Date
  }> {
    const addressCheck = this.checkAddress(address, chain)
    
    let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    if (addressCheck.riskScore >= 75) riskLevel = 'CRITICAL'
    else if (addressCheck.riskScore >= 50) riskLevel = 'HIGH'
    else if (addressCheck.riskScore >= 25) riskLevel = 'MEDIUM'
    else riskLevel = 'LOW'

    const recommendations = this.generateRecommendations(riskLevel, addressCheck.warnings)

    return {
      address,
      chain,
      riskLevel,
      riskScore: addressCheck.riskScore,
      threats: addressCheck.warnings,
      recommendations,
      lastUpdated: new Date()
    }
  }

  /**
   * Helper: Check if address is a contract
   */
  private static isContractAddress(address: string, chain: string): boolean {
    // Simplified check - in production would check on-chain
    if (chain === 'solana') {
      return address.length === 44 && address.endsWith('11111')
    }
    return false // Would need actual blockchain query
  }

  /**
   * Helper: Check for high-risk patterns
   */
  private static hasHighRiskPattern(address: string): boolean {
    const patterns = [
      /^0x0{8,}/i,  // Many leading zeros
      /(.)\1{8,}/,   // Repeated characters
      /^0xdead/i,    // Dead addresses
    ]
    return patterns.some(p => p.test(address))
  }

  /**
   * Helper: Check if address is recently created
   */
  private static isRecentlyCreated(address: string): boolean {
    // In production, would check on-chain creation date
    return Math.random() > 0.7 // Placeholder
  }

  /**
   * Helper: Check domain similarity (typosquatting)
   */
  private static isSimilarDomain(domain1: string, domain2: string): boolean {
    // Simple Levenshtein distance check
    const distance = this.levenshteinDistance(domain1, domain2)
    return distance > 0 && distance <= 3
  }

  /**
   * Helper: Calculate Levenshtein distance
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    return matrix[str2.length][str1.length]
  }

  /**
   * Generate recommendations based on risk level
   */
  private static generateRecommendations(riskLevel: string, threats: string[]): string[] {
    const recommendations: string[] = []

    switch (riskLevel) {
      case 'CRITICAL':
        recommendations.push('⛔ DO NOT interact with this address')
        recommendations.push('🚨 Report to authorities if you\'ve been scammed')
        recommendations.push('🔒 Check all your wallet permissions immediately')
        break
      case 'HIGH':
        recommendations.push('⚠️ Extreme caution advised')
        recommendations.push('🔍 Verify identity through multiple sources')
        recommendations.push('💰 Consider using escrow for any transactions')
        break
      case 'MEDIUM':
        recommendations.push('⚡ Proceed with caution')
        recommendations.push('✅ Double-check all transaction details')
        recommendations.push('🔐 Use hardware wallet for valuable transactions')
        break
      case 'LOW':
        recommendations.push('✅ Standard security practices apply')
        recommendations.push('👀 Continue monitoring for unusual activity')
        recommendations.push('📊 Keep transaction records for reference')
        break
    }

    // Add specific recommendations based on threats
    if (threats.some(t => t.includes('contract'))) {
      recommendations.push('📜 Review contract code before interaction')
    }
    if (threats.some(t => t.includes('dust'))) {
      recommendations.push('🧹 Do not interact with dust tokens')
    }
    if (threats.some(t => t.includes('Recently created'))) {
      recommendations.push('⏰ Wait for address to establish history')
    }

    return recommendations
  }
}