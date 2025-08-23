import crypto from 'crypto'
import { ThreatData, ThreatType, ThreatSeverity } from '@/lib/models/threat-feed'
import { ThreatFeedService } from './threat-feed-service'
import { logger } from '@/lib/logger'

interface ExternalThreatSource {
  id: string
  name: string
  type: 'api' | 'webhook' | 'rss' | 'json' | 'csv'
  url: string
  apiKey?: string
  updateInterval: number // milliseconds
  isActive: boolean
  lastUpdate?: Date
  mapping: {
    threatId?: string
    type: string
    severity: string
    target: string
    description: string
    confidence?: string
    tags?: string
    timestamp?: string
  }
}

export class ExternalThreatSourceService {
  private static sources: Map<string, ExternalThreatSource> = new Map()
  private static intervals: Map<string, NodeJS.Timeout> = new Map()
  private static readonly DEFAULT_UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes

  /**
   * Initialize with default threat sources
   */
  static initialize(): void {
    // Simulated external threat sources
    const defaultSources: ExternalThreatSource[] = [
      {
        id: 'phishing_tracker',
        name: 'Phishing Tracker API',
        type: 'api',
        url: 'https://api.phishingtracker.com/threats',
        updateInterval: 10 * 60 * 1000, // 10 minutes
        isActive: true,
        mapping: {
          threatId: 'id',
          type: 'category',
          severity: 'risk_level',
          target: 'url',
          description: 'description',
          confidence: 'confidence',
          tags: 'tags',
          timestamp: 'discovered_at'
        }
      },
      {
        id: 'scam_database',
        name: 'Crypto Scam Database',
        type: 'json',
        url: 'https://api.cryptoscamdb.org/v1/addresses',
        updateInterval: 30 * 60 * 1000, // 30 minutes
        isActive: true,
        mapping: {
          threatId: 'address',
          type: 'category',
          severity: 'risk',
          target: 'address',
          description: 'description',
          confidence: 'verified',
          timestamp: 'reported_at'
        }
      },
      {
        id: 'malware_bazaar',
        name: 'Malware Bazaar Feed',
        type: 'json',
        url: 'https://mb-api.abuse.ch/api/v1/samples/recent/',
        updateInterval: 15 * 60 * 1000, // 15 minutes
        isActive: true,
        mapping: {
          threatId: 'sha256_hash',
          type: 'malware_family',
          severity: 'confidence',
          target: 'file_name',
          description: 'signature',
          timestamp: 'first_seen'
        }
      },
      {
        id: 'blockchain_monitor',
        name: 'Blockchain Threat Monitor',
        type: 'api',
        url: 'https://api.blockchainmonitor.com/threats',
        updateInterval: 5 * 60 * 1000, // 5 minutes
        isActive: true,
        mapping: {
          threatId: 'hash',
          type: 'threat_type',
          severity: 'severity',
          target: 'wallet_address',
          description: 'details',
          confidence: 'confidence_score',
          timestamp: 'detected_at'
        }
      }
    ]

    // Initialize default sources
    for (const source of defaultSources) {
      this.addSource(source)
    }

    logger.info(`[ExternalThreats] Initialized ${defaultSources.length} external threat sources`)
  }

  /**
   * Add a new threat source
   */
  static addSource(source: ExternalThreatSource): void {
    this.sources.set(source.id, source)
    
    if (source.isActive) {
      this.startSourcePolling(source)
    }
    
    logger.info(`[ExternalThreats] Added source: ${source.name}`)
  }

  /**
   * Remove a threat source
   */
  static removeSource(sourceId: string): boolean {
    this.stopSourcePolling(sourceId)
    return this.sources.delete(sourceId)
  }

  /**
   * Start polling for a specific source
   */
  private static startSourcePolling(source: ExternalThreatSource): void {
    // Clear existing interval if any
    this.stopSourcePolling(source.id)

    // Start immediate fetch
    this.fetchFromSource(source).catch(error => {
      logger.error(`[ExternalThreats] Initial fetch failed for ${source.name}:`, error)
    })

    // Set up interval
    const interval = setInterval(() => {
      this.fetchFromSource(source).catch(error => {
        logger.error(`[ExternalThreats] Scheduled fetch failed for ${source.name}:`, error)
      })
    }, source.updateInterval)

    this.intervals.set(source.id, interval)
    logger.info(`[ExternalThreats] Started polling for ${source.name} every ${source.updateInterval / 1000}s`)
  }

  /**
   * Stop polling for a specific source
   */
  private static stopSourcePolling(sourceId: string): void {
    const interval = this.intervals.get(sourceId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(sourceId)
      logger.info(`[ExternalThreats] Stopped polling for source: ${sourceId}`)
    }
  }

  /**
   * Fetch threats from external source
   */
  private static async fetchFromSource(source: ExternalThreatSource): Promise<void> {
    try {
      logger.info(`[ExternalThreats] Fetching from ${source.name}...`)

      // Simulate external API call
      const threats = await this.simulateExternalFetch(source)
      
      if (threats.length === 0) {
        logger.info(`[ExternalThreats] No new threats from ${source.name}`)
        return
      }

      let addedCount = 0
      let skippedCount = 0

      for (const threat of threats) {
        try {
          await ThreatFeedService.addThreat(threat)
          addedCount++
        } catch (error) {
          // Likely a duplicate, which is fine
          skippedCount++
        }
      }

      // Update last fetch time
      source.lastUpdate = new Date()
      this.sources.set(source.id, source)

      logger.info(`[ExternalThreats] ${source.name}: Added ${addedCount}, Skipped ${skippedCount} threats`)

    } catch (error) {
      logger.error(`[ExternalThreats] Failed to fetch from ${source.name}:`, error)
    }
  }

  /**
   * Simulate external threat source (for demo purposes)
   */
  private static async simulateExternalFetch(source: ExternalThreatSource): Promise<Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>[]> {
    // Simulate API delay
    await this.delay(100 + Math.random() * 500)

    const threats: Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'>[] = []
    const now = new Date()
    
    // Generate 0-5 random threats per fetch
    const threatCount = Math.floor(Math.random() * 6)

    for (let i = 0; i < threatCount; i++) {
      const threat = this.generateSimulatedThreat(source)
      threats.push(threat)
    }

    return threats
  }

  /**
   * Generate a simulated threat based on source type
   */
  private static generateSimulatedThreat(source: ExternalThreatSource): Omit<ThreatData, '_id' | 'createdAt' | 'updatedAt' | 'correlatedThreats' | 'votes'> {
    const now = new Date()
    const threatTypes: ThreatType[] = ['scam', 'phishing', 'rugpull', 'honeypot', 'exploit', 'malware']
    const severities: ThreatSeverity[] = ['low', 'medium', 'high', 'critical']
    
    // Generate realistic data based on source
    let type: ThreatType
    let target: { type: string; value: string; network?: string }
    let context: { title: string; description: string; tags: string[] }
    
    switch (source.id) {
      case 'phishing_tracker':
        type = 'phishing'
        target = {
          type: 'url',
          value: this.generatePhishingUrl()
        }
        context = {
          title: `Phishing Site Detected: ${target.value}`,
          description: `Phishing website impersonating legitimate service to steal credentials`,
          tags: ['phishing', 'fake_website', 'credential_theft']
        }
        break

      case 'scam_database':
        type = Math.random() > 0.5 ? 'scam' : 'rugpull'
        target = {
          type: 'wallet',
          value: this.generateWalletAddress(),
          network: 'solana'
        }
        context = {
          title: `Scam Wallet Detected: ${target.value}`,
          description: `Wallet address associated with fraudulent activities`,
          tags: ['scam', 'wallet', 'fraud', 'solana']
        }
        break

      case 'malware_bazaar':
        type = 'malware'
        target = {
          type: 'url',
          value: this.generateMalwareUrl()
        }
        context = {
          title: `Malware Distribution Site: ${target.value}`,
          description: `Website hosting or distributing malicious software`,
          tags: ['malware', 'distribution', 'trojan']
        }
        break

      case 'blockchain_monitor':
        type = this.randomChoice(['honeypot', 'exploit', 'drainer'])
        target = {
          type: 'contract',
          value: this.generateContractAddress(),
          network: 'solana'
        }
        context = {
          title: `Malicious Contract Detected: ${target.value}`,
          description: `Smart contract with malicious functionality detected`,
          tags: ['smart_contract', 'malicious', type, 'solana']
        }
        break

      default:
        type = this.randomChoice(threatTypes)
        target = {
          type: 'url',
          value: this.generateRandomUrl()
        }
        context = {
          title: `Threat Detected: ${type}`,
          description: `Generic threat detected by ${source.name}`,
          tags: [type, 'external']
        }
    }

    return {
      threatId: crypto.randomUUID(),
      source: {
        id: source.id,
        name: source.name,
        type: 'external_api',
        reliability: 70 + Math.floor(Math.random() * 30) // 70-99
      },
      type,
      category: 'financial',
      severity: this.randomChoice(severities),
      confidence: 60 + Math.floor(Math.random() * 40), // 60-99
      target,
      indicators: this.generateIndicators(target, type),
      context,
      timeline: {
        firstSeen: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000), // Within last 24h
        lastSeen: now,
        discoveredAt: now
      },
      status: 'active',
      impact: {
        estimatedReach: Math.floor(Math.random() * 10000)
      },
      hash: crypto.randomUUID()
    }
  }

  /**
   * Generate indicators based on target and type
   */
  private static generateIndicators(target: { type: string; value: string }, type: ThreatType) {
    const indicators = []
    
    // Always include the target itself
    indicators.push({
      type: target.type as any,
      value: target.value
    })

    // Add type-specific indicators
    switch (type) {
      case 'phishing':
        indicators.push(
          { type: 'domain', value: new URL(target.value).hostname },
          { type: 'ip', value: this.generateIPAddress() }
        )
        break
      
      case 'malware':
        indicators.push(
          { type: 'hash', value: crypto.createHash('sha256').update(target.value).digest('hex') },
          { type: 'ip', value: this.generateIPAddress() }
        )
        break
        
      case 'scam':
      case 'rugpull':
        if (target.type === 'wallet') {
          indicators.push(
            { type: 'signature', value: crypto.randomUUID() }
          )
        }
        break
    }

    return indicators
  }

  // Utility functions for generating realistic test data

  private static generatePhishingUrl(): string {
    const legitimate = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'facebook']
    const tlds = ['.com', '.net', '.org', '.info', '.biz']
    const variations = ['', '-security', '-support', '-login', '-verify']
    
    const base = this.randomChoice(legitimate)
    const variation = this.randomChoice(variations)
    const tld = this.randomChoice(tlds)
    
    return `https://${base}${variation}${tld}/login`
  }

  private static generateWalletAddress(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'
    let result = ''
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  private static generateContractAddress(): string {
    return this.generateWalletAddress() // Same format for Solana
  }

  private static generateMalwareUrl(): string {
    const domains = ['download-center', 'free-software', 'crack-tools', 'game-cheats']
    const tlds = ['.tk', '.ml', '.ga', '.cf', '.com']
    
    const domain = this.randomChoice(domains)
    const tld = this.randomChoice(tlds)
    
    return `https://${domain}${tld}/download/${crypto.randomUUID()}.exe`
  }

  private static generateRandomUrl(): string {
    const domains = ['suspicious-site', 'bad-domain', 'malicious-host', 'threat-source']
    const tlds = ['.com', '.net', '.tk', '.ml']
    
    const domain = this.randomChoice(domains)
    const tld = this.randomChoice(tlds)
    
    return `https://${domain}${tld}/${crypto.randomUUID()}`
  }

  private static generateIPAddress(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
  }

  private static randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get all active sources
   */
  static getActiveSources(): ExternalThreatSource[] {
    return Array.from(this.sources.values()).filter(source => source.isActive)
  }

  /**
   * Get source by ID
   */
  static getSource(sourceId: string): ExternalThreatSource | undefined {
    return this.sources.get(sourceId)
  }

  /**
   * Update source configuration
   */
  static updateSource(sourceId: string, updates: Partial<ExternalThreatSource>): boolean {
    const source = this.sources.get(sourceId)
    if (!source) return false

    const updatedSource = { ...source, ...updates }
    this.sources.set(sourceId, updatedSource)

    // Restart polling if the source is active and interval changed
    if (updatedSource.isActive && (updates.updateInterval || updates.isActive !== false)) {
      this.startSourcePolling(updatedSource)
    } else if (updates.isActive === false) {
      this.stopSourcePolling(sourceId)
    }

    return true
  }

  /**
   * Manual fetch from specific source
   */
  static async manualFetch(sourceId: string): Promise<{ success: boolean; threatsAdded: number; error?: string }> {
    const source = this.sources.get(sourceId)
    if (!source) {
      return { success: false, threatsAdded: 0, error: 'Source not found' }
    }

    try {
      const beforeCount = (await ThreatFeedService.queryThreats({ limit: 1 })).total
      await this.fetchFromSource(source)
      const afterCount = (await ThreatFeedService.queryThreats({ limit: 1 })).total
      
      return { 
        success: true, 
        threatsAdded: afterCount - beforeCount 
      }
    } catch (error) {
      return { 
        success: false, 
        threatsAdded: 0, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get source statistics
   */
  static getSourceStats(): {
    totalSources: number
    activeSources: number
    lastUpdate: Date | null
    threatsSources: Array<{ id: string; name: string; lastUpdate?: Date; isActive: boolean }>
  } {
    const sources = Array.from(this.sources.values())
    const activeSources = sources.filter(s => s.isActive)
    const lastUpdate = sources
      .filter(s => s.lastUpdate)
      .map(s => s.lastUpdate!)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null

    return {
      totalSources: sources.length,
      activeSources: activeSources.length,
      lastUpdate,
      threatsSources: sources.map(s => ({
        id: s.id,
        name: s.name,
        lastUpdate: s.lastUpdate,
        isActive: s.isActive
      }))
    }
  }

  /**
   * Stop all polling
   */
  static shutdown(): void {
    for (const sourceId of this.intervals.keys()) {
      this.stopSourcePolling(sourceId)
    }
    logger.info('[ExternalThreats] Shutdown complete')
  }
}