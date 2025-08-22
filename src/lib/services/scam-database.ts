interface ScamReport {
  address: string
  reportType: 'scam' | 'phishing' | 'rugpull' | 'honeypot' | 'exploit'
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  reportedDate: Date
  description: string
  verified: boolean
}

export class ScamDatabaseService {
  // External API endpoints for scam checking
  private static readonly SCAM_APIS = {
    // SolanaFM API (example endpoint)
    solanaFm: 'https://api.solana.fm/v1/addresses',
    // Solscan API
    solscan: 'https://public-api.solscan.io/account',
    // GoPlus Security API for Solana
    goPlus: 'https://api.gopluslabs.io/api/v1/address_security',
  }

  /**
   * Check multiple external sources for scam reports
   */
  static async checkExternalDatabases(walletAddress: string): Promise<{
    isScammer: boolean
    reports: ScamReport[]
    confidence: number
  }> {
    const reports: ScamReport[] = []
    let isScammer = false
    let totalConfidence = 0
    let sourceCount = 0

    // Check GoPlus Security API (free tier available)
    try {
      const goPlusResult = await this.checkGoPlusSecurity(walletAddress)
      if (goPlusResult.isRisky) {
        isScammer = true
        reports.push(...goPlusResult.reports)
        totalConfidence += goPlusResult.confidence
        sourceCount++
      }
    } catch (error) {
      console.error('[ScamDB] GoPlus check failed:', error)
    }

    // Check against known phishing domains and addresses
    const phishingCheck = await this.checkPhishingDatabase(walletAddress)
    if (phishingCheck.isPhishing) {
      isScammer = true
      reports.push(...phishingCheck.reports)
      totalConfidence += phishingCheck.confidence
      sourceCount++
    }

    // Check community-maintained blacklists
    const blacklistCheck = await this.checkCommunityBlacklists(walletAddress)
    if (blacklistCheck.isBlacklisted) {
      isScammer = true
      reports.push(...blacklistCheck.reports)
      totalConfidence += blacklistCheck.confidence
      sourceCount++
    }

    const averageConfidence = sourceCount > 0 ? totalConfidence / sourceCount : 0

    return {
      isScammer,
      reports,
      confidence: averageConfidence
    }
  }

  /**
   * Check GoPlus Security API for Solana addresses
   */
  private static async checkGoPlusSecurity(address: string): Promise<{
    isRisky: boolean
    reports: ScamReport[]
    confidence: number
  }> {
    try {
      // GoPlus provides free tier API for security checks
      const url = `${this.SCAM_APIS.goPlus}?chain_id=solana&address=${address}`
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        return { isRisky: false, reports: [], confidence: 0 }
      }

      const data = await response.json()
      const reports: ScamReport[] = []
      let isRisky = false
      let confidence = 0

      if (data.result && data.result[address]) {
        const addressData = data.result[address]
        
        // Check various risk indicators
        if (addressData.honeypot_related_address === '1') {
          isRisky = true
          confidence = 90
          reports.push({
            address,
            reportType: 'honeypot',
            severity: 'critical',
            source: 'GoPlus Security',
            reportedDate: new Date(),
            description: 'Address associated with honeypot scams',
            verified: true
          })
        }

        if (addressData.phishing_activities === '1') {
          isRisky = true
          confidence = Math.max(confidence, 85)
          reports.push({
            address,
            reportType: 'phishing',
            severity: 'high',
            source: 'GoPlus Security',
            reportedDate: new Date(),
            description: 'Address involved in phishing activities',
            verified: true
          })
        }

        if (addressData.blacklist_doubt === '1') {
          isRisky = true
          confidence = Math.max(confidence, 70)
          reports.push({
            address,
            reportType: 'scam',
            severity: 'medium',
            source: 'GoPlus Security',
            reportedDate: new Date(),
            description: 'Address flagged as suspicious',
            verified: false
          })
        }
      }

      return { isRisky, reports, confidence }
    } catch (error) {
      console.error('[GoPlus] API error:', error)
      return { isRisky: false, reports: [], confidence: 0 }
    }
  }

  /**
   * Check against known phishing databases
   */
  private static async checkPhishingDatabase(address: string): Promise<{
    isPhishing: boolean
    reports: ScamReport[]
    confidence: number
  }> {
    // Known phishing wallet patterns and addresses
    const phishingPatterns = [
      // Common fake wallet patterns
      /^[A-Z]{10,}/, // All caps addresses (often fake)
      /^(admin|support|help|official)/i, // Impersonation patterns
      /^0x0{8,}/, // Null-like addresses
    ]

    const knownPhishingAddresses = new Set<string>([
      // Add known phishing addresses from community reports
      // These would be maintained in a database in production
    ])

    const reports: ScamReport[] = []
    let isPhishing = false
    let confidence = 0

    // Check patterns
    for (const pattern of phishingPatterns) {
      if (pattern.test(address)) {
        isPhishing = true
        confidence = 75
        reports.push({
          address,
          reportType: 'phishing',
          severity: 'high',
          source: 'Pattern Analysis',
          reportedDate: new Date(),
          description: 'Address matches known phishing patterns',
          verified: false
        })
        break
      }
    }

    // Check known addresses
    if (knownPhishingAddresses.has(address)) {
      isPhishing = true
      confidence = 95
      reports.push({
        address,
        reportType: 'phishing',
        severity: 'critical',
        source: 'Phishing Database',
        reportedDate: new Date(),
        description: 'Known phishing address',
        verified: true
      })
    }

    return { isPhishing, reports, confidence }
  }

  /**
   * Check community-maintained blacklists
   */
  private static async checkCommunityBlacklists(address: string): Promise<{
    isBlacklisted: boolean
    reports: ScamReport[]
    confidence: number
  }> {
    try {
      // Check various community sources
      // In production, this would query multiple community databases
      
      // Example: Check Solana scam list on GitHub
      const scamListUrl = 'https://raw.githubusercontent.com/solana-labs/scam-list/main/scam-addresses.json'
      
      try {
        const response = await fetch(scamListUrl)
        if (response.ok) {
          const scamList = await response.json()
          if (scamList.addresses && scamList.addresses.includes(address)) {
            return {
              isBlacklisted: true,
              reports: [{
                address,
                reportType: 'scam',
                severity: 'critical',
                source: 'Community Blacklist',
                reportedDate: new Date(),
                description: 'Listed in community scam database',
                verified: true
              }],
              confidence: 90
            }
          }
        }
      } catch (error) {
        // Fallback if external list is unavailable
        console.error('[Community Blacklist] Failed to fetch:', error)
      }

      // Additional community sources could be added here
      
      return {
        isBlacklisted: false,
        reports: [],
        confidence: 0
      }
    } catch (error) {
      console.error('[Community Blacklist] Error:', error)
      return {
        isBlacklisted: false,
        reports: [],
        confidence: 0
      }
    }
  }

  /**
   * Submit a new scam report to multiple databases
   */
  static async reportScammer(
    address: string,
    reportType: ScamReport['reportType'],
    description: string,
    evidence?: {
      transactionHashes?: string[]
      screenshots?: string[]
    }
  ): Promise<boolean> {
    try {
      // In production, this would submit to multiple databases
      // For now, we'll store it locally and could forward to external APIs
      
      console.log('[ScamDB] New scam report submitted:', {
        address,
        reportType,
        description,
        evidence
      })

      // Here you would:
      // 1. Submit to GoPlus community reporting
      // 2. Submit to Solana FM if they have an API
      // 3. Submit to other community databases
      // 4. Store in local database for reference

      return true
    } catch (error) {
      console.error('[ScamDB] Failed to submit report:', error)
      return false
    }
  }

  /**
   * Get aggregated risk score from multiple sources
   */
  static async getAggregatedRiskScore(address: string): Promise<{
    score: number
    sources: Array<{
      name: string
      score: number
      confidence: number
    }>
  }> {
    const sources: Array<{
      name: string
      score: number
      confidence: number
    }> = []

    // Check multiple sources in parallel
    const [external, phishing, blacklist] = await Promise.all([
      this.checkGoPlusSecurity(address),
      this.checkPhishingDatabase(address),
      this.checkCommunityBlacklists(address)
    ])

    if (external.isRisky) {
      sources.push({
        name: 'GoPlus Security',
        score: 90,
        confidence: external.confidence
      })
    }

    if (phishing.isPhishing) {
      sources.push({
        name: 'Phishing Detection',
        score: 85,
        confidence: phishing.confidence
      })
    }

    if (blacklist.isBlacklisted) {
      sources.push({
        name: 'Community Blacklist',
        score: 95,
        confidence: blacklist.confidence
      })
    }

    // Calculate weighted average score
    let totalScore = 0
    let totalWeight = 0
    
    for (const source of sources) {
      const weight = source.confidence / 100
      totalScore += source.score * weight
      totalWeight += weight
    }

    const aggregatedScore = totalWeight > 0 ? totalScore / totalWeight : 0

    return {
      score: Math.round(aggregatedScore),
      sources
    }
  }
}