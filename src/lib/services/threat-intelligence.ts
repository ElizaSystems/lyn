import crypto from 'crypto'

interface ThreatIntelligenceResult {
  source: string
  safe: boolean
  score: number // 0-100, where 100 is safest
  threats: string[]
  details: Record<string, unknown>
}

interface CachedResult {
  data: ThreatIntelligenceResult[]
  timestamp: number
  hash: string
}

interface VirusTotalResponse {
  data?: {
    attributes?: {
      last_analysis_stats?: Record<string, number>
      reputation?: number
      categories?: Record<string, string>
      stats?: Record<string, number>
      type_description?: string
      md5?: string
      sha256?: string
      first_submission_date?: string
      last_analysis_results?: Record<string, {
        category: string
        result: string
      }>
    }
  }
}

export class ThreatIntelligenceService {
  private static cache = new Map<string, CachedResult>()
  private static CACHE_TTL = 3600000 // 1 hour in milliseconds

  /**
   * Check URL against multiple threat intelligence sources
   */
  static async checkURL(url: string): Promise<ThreatIntelligenceResult[]> {
    const urlHash = this.hashURL(url)
    
    // Check cache first
    const cached = this.getFromCache(urlHash)
    if (cached) {
      console.log(`[ThreatIntel] Using cached result for ${url}`)
      return cached
    }

    const results: ThreatIntelligenceResult[] = []
    
    // Run all checks in parallel for better performance
    const checks = await Promise.allSettled([
      this.checkVirusTotal(url),
      this.checkGoogleSafeBrowsing(url),
      this.checkIPQualityScore(url),
      this.checkURLVoid(url),
      this.checkPhishTank(url),
      this.checkAbuseIPDB(url)
    ])

    checks.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      } else if (result.status === 'rejected') {
        console.error(`Check ${index} failed:`, result.reason)
      }
    })

    // Cache the results
    this.saveToCache(urlHash, results)
    
    return results
  }

  /**
   * Check file against VirusTotal
   */
  static async checkFile(fileBuffer: Buffer, fileName: string): Promise<ThreatIntelligenceResult> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY
    if (!apiKey) {
      console.warn('[ThreatIntel] VirusTotal API key not configured')
      return this.getFallbackFileResult(fileBuffer, fileName)
    }

    try {
      // Calculate file hash
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
      
      // First, check if file is already known
      const reportResponse = await fetch(
        `https://www.virustotal.com/api/v3/files/${fileHash}`,
        {
          headers: {
            'x-apikey': apiKey
          }
        }
      )

      if (reportResponse.ok) {
        const report = await reportResponse.json()
        return this.parseVirusTotalFileReport(report)
      }

      // If not found, upload the file
      const formData = new FormData()
      const arrayBuffer = fileBuffer.buffer instanceof ArrayBuffer 
        ? fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
        : new ArrayBuffer(0) // Fallback for SharedArrayBuffer case
      formData.append('file', new Blob([arrayBuffer]), fileName)

      const uploadResponse = await fetch(
        'https://www.virustotal.com/api/v3/files',
        {
          method: 'POST',
          headers: {
            'x-apikey': apiKey
          },
          body: formData
        }
      )

      if (!uploadResponse.ok) {
        throw new Error(`VirusTotal upload failed: ${uploadResponse.status}`)
      }

      const uploadResult = await uploadResponse.json()
      
      // Poll for results (in production, use webhooks)
      await this.delay(5000) // Wait 5 seconds for initial scan
      
      const analysisResponse = await fetch(
        `https://www.virustotal.com/api/v3/analyses/${uploadResult.data.id}`,
        {
          headers: {
            'x-apikey': apiKey
          }
        }
      )

      if (analysisResponse.ok) {
        const analysis = await analysisResponse.json()
        return this.parseVirusTotalFileAnalysis(analysis)
      }

      return this.getFallbackFileResult(fileBuffer, fileName)
    } catch (error) {
      console.error('[ThreatIntel] VirusTotal file check failed:', error)
      return this.getFallbackFileResult(fileBuffer, fileName)
    }
  }

  /**
   * VirusTotal URL check
   */
  private static async checkVirusTotal(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY
    if (!apiKey) return null

    try {
      // URL needs to be base64 encoded for the API
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '')
      
      const response = await fetch(
        `https://www.virustotal.com/api/v3/urls/${urlId}`,
        {
          headers: {
            'x-apikey': apiKey
          }
        }
      )

      if (!response.ok) {
        // If URL not found, submit it for scanning
        const scanResponse = await fetch(
          'https://www.virustotal.com/api/v3/urls',
          {
            method: 'POST',
            headers: {
              'x-apikey': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `url=${encodeURIComponent(url)}`
          }
        )

        if (scanResponse.ok) {
          // Wait a bit and try to get results
          await this.delay(3000)
          const retryResponse = await fetch(
            `https://www.virustotal.com/api/v3/urls/${urlId}`,
            {
              headers: {
                'x-apikey': apiKey
              }
            }
          )
          if (retryResponse.ok) {
            const data = await retryResponse.json()
            return this.parseVirusTotalResult(data as VirusTotalResponse)
          }
        }
        return null
      }

      const data = await response.json()
      return this.parseVirusTotalResult(data as VirusTotalResponse)
    } catch (error) {
      console.error('[ThreatIntel] VirusTotal check failed:', error)
      return null
    }
  }

  /**
   * Google Safe Browsing check
   */
  private static async checkGoogleSafeBrowsing(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY
    if (!apiKey) return null

    try {
      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client: {
              clientId: 'lyn-ai',
              clientVersion: '1.0.0'
            },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url }]
            }
          })
        }
      )

      const data = await response.json()
      
      const threats = data.matches?.map((m: { threatType: string }) => m.threatType) || []
      const safe = threats.length === 0

      return {
        source: 'Google Safe Browsing',
        safe,
        score: safe ? 100 : 0,
        threats,
        details: data
      }
    } catch (error) {
      console.error('[ThreatIntel] Google Safe Browsing check failed:', error)
      return null
    }
  }

  /**
   * IPQualityScore check
   */
  private static async checkIPQualityScore(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.IPQUALITYSCORE_API_KEY
    if (!apiKey) return null

    try {
      const response = await fetch(
        `https://ipqualityscore.com/api/json/url/${apiKey}/${encodeURIComponent(url)}`,
        {
          method: 'GET'
        }
      )

      const data = await response.json()
      
      const threats = []
      if (data.phishing) threats.push('phishing')
      if (data.malware) threats.push('malware')
      if (data.suspicious) threats.push('suspicious')
      if (data.adult) threats.push('adult_content')
      if (data.spamming) threats.push('spam')

      return {
        source: 'IPQualityScore',
        safe: !data.unsafe && threats.length === 0,
        score: Math.max(0, 100 - (data.risk_score || 0)),
        threats,
        details: data
      }
    } catch (error) {
      console.error('[ThreatIntel] IPQualityScore check failed:', error)
      return null
    }
  }

  /**
   * URLVoid check
   */
  private static async checkURLVoid(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.URLVOID_API_KEY
    if (!apiKey) return null

    try {
      const host = new URL(url).hostname
      const response = await fetch(
        `https://api.urlvoid.com/api1000/${apiKey}/host/${host}/`,
        {
          method: 'GET'
        }
      )

      const text = await response.text()
      // URLVoid returns XML, so we need to parse it
      const detections = text.match(/<detections>(\d+)<\/detections>/)?.[1] || '0'
      const engines = text.match(/<engines>(\d+)<\/engines>/)?.[1] || '40'
      
      const detectionCount = parseInt(detections)
      const engineCount = parseInt(engines)
      const score = Math.max(0, 100 - (detectionCount / engineCount * 100))

      return {
        source: 'URLVoid',
        safe: detectionCount === 0,
        score,
        threats: detectionCount > 0 ? ['blacklisted'] : [],
        details: {
          detections: detectionCount,
          engines: engineCount
        }
      }
    } catch (error) {
      console.error('[ThreatIntel] URLVoid check failed:', error)
      return null
    }
  }

  /**
   * PhishTank check
   */
  private static async checkPhishTank(url: string): Promise<ThreatIntelligenceResult | null> {
    try {
      // PhishTank requires registration but offers a public API
      const response = await fetch(
        'https://checkurl.phishtank.com/checkurl/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `url=${encodeURIComponent(url)}&format=json&app_key=lyn_ai_security`
        }
      )

      if (!response.ok) return null

      const data = await response.json()
      
      return {
        source: 'PhishTank',
        safe: !data.results?.in_database || !data.results?.valid,
        score: data.results?.in_database && data.results?.valid ? 0 : 100,
        threats: data.results?.in_database && data.results?.valid ? ['phishing'] : [],
        details: data
      }
    } catch (error) {
      console.error('[ThreatIntel] PhishTank check failed:', error)
      return null
    }
  }

  /**
   * AbuseIPDB check (for IP addresses in URLs)
   */
  private static async checkAbuseIPDB(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.ABUSEIPDB_API_KEY
    if (!apiKey) return null

    try {
      const urlObj = new URL(url)
      const host = urlObj.hostname
      
      // Check if it's an IP address
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
      if (!ipPattern.test(host)) return null

      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${host}&maxAgeInDays=90`,
        {
          headers: {
            'Key': apiKey,
            'Accept': 'application/json'
          }
        }
      )

      const data = await response.json()
      const abuseScore = data.data?.abuseConfidenceScore || 0
      
      return {
        source: 'AbuseIPDB',
        safe: abuseScore < 25,
        score: Math.max(0, 100 - abuseScore),
        threats: abuseScore > 25 ? ['malicious_ip'] : [],
        details: data.data
      }
    } catch (error) {
      console.error('[ThreatIntel] AbuseIPDB check failed:', error)
      return null
    }
  }

  /**
   * Parse VirusTotal results
   */
  private static parseVirusTotalResult(data: VirusTotalResponse): ThreatIntelligenceResult {
    const stats = data.data?.attributes?.last_analysis_stats || {}
    const malicious = stats.malicious || 0
    const suspicious = stats.suspicious || 0
    const total = Object.values(stats).reduce((a, b) => (a as number) + (b as number), 0) as number
    
    const score = total > 0 ? Math.max(0, 100 - ((malicious + suspicious) / total * 100)) : 100
    const threats = []
    
    if (malicious > 0) threats.push(`${malicious} engines detected as malicious`)
    if (suspicious > 0) threats.push(`${suspicious} engines detected as suspicious`)

    return {
      source: 'VirusTotal',
      safe: malicious === 0 && suspicious === 0,
      score,
      threats,
      details: {
        stats,
        reputation: data.data?.attributes?.reputation,
        categories: data.data?.attributes?.categories
      }
    }
  }

  /**
   * Parse VirusTotal file report
   */
  private static parseVirusTotalFileReport(data: VirusTotalResponse): ThreatIntelligenceResult {
    const stats = data.data?.attributes?.last_analysis_stats || {}
    const malicious = stats.malicious || 0
    const suspicious = stats.suspicious || 0
    const total = Object.values(stats).reduce((a, b) => (a as number) + (b as number), 0) as number
    
    const score = total > 0 ? Math.max(0, 100 - ((malicious + suspicious) / total * 100)) : 100
    const threats = []
    
    if (malicious > 0) threats.push(`${malicious} antivirus engines detected malware`)
    if (suspicious > 0) threats.push(`${suspicious} antivirus engines marked as suspicious`)

    // Extract specific threat names
    const results = data.data?.attributes?.last_analysis_results || {}
    const detectedThreats = Object.values(results)
      .filter((r) => r.category === 'malicious')
      .map((r) => r.result)
      .filter(Boolean)
      .slice(0, 5) // Limit to top 5

    if (detectedThreats.length > 0) {
      threats.push(...detectedThreats)
    }

    return {
      source: 'VirusTotal',
      safe: malicious === 0 && suspicious === 0,
      score,
      threats,
      details: {
        stats,
        fileType: data.data?.attributes?.type_description,
        md5: data.data?.attributes?.md5,
        sha256: data.data?.attributes?.sha256,
        firstSeen: data.data?.attributes?.first_submission_date
      }
    }
  }

  /**
   * Parse VirusTotal file analysis
   */
  private static parseVirusTotalFileAnalysis(data: VirusTotalResponse): ThreatIntelligenceResult {
    const stats = data.data?.attributes?.stats || {}
    return this.parseVirusTotalFileReport({ data: { attributes: { last_analysis_stats: stats } } })
  }

  /**
   * Fallback file analysis when APIs are not available
   */
  private static getFallbackFileResult(fileBuffer: Buffer, fileName: string): ThreatIntelligenceResult {
    // Use our existing pattern matching as a fallback
    const content = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 100000)) // Check first 100KB
    const threats = []
    let score = 100

    // Check for known malicious patterns
    if (/eval\s*\(|new\s+Function\s*\(/gi.test(content)) {
      threats.push('Dynamic code execution detected')
      score -= 20
    }

    if (/ActiveXObject|WScript\.Shell/gi.test(content)) {
      threats.push('Windows scripting objects detected')
      score -= 30
    }

    if (/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi.test(content)) {
      const matches = content.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi)
      if (matches && matches.length > 50) {
        threats.push('Heavy obfuscation detected')
        score -= 25
      }
    }

    const suspiciousExtensions = ['.exe', '.dll', '.bat', '.ps1', '.vbs', '.jar', '.scr', '.com']
    if (suspiciousExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
      threats.push('Executable file type')
      score -= 15
    }

    return {
      source: 'Local Analysis',
      safe: threats.length === 0,
      score: Math.max(0, score),
      threats,
      details: {
        fileSize: fileBuffer.length,
        fileName
      }
    }
  }

  /**
   * Hash URL for caching
   */
  private static hashURL(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex')
  }

  /**
   * Get cached result if available and not expired
   */
  private static getFromCache(hash: string): ThreatIntelligenceResult[] | null {
    const cached = this.cache.get(hash)
    if (!cached) return null
    
    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(hash)
      return null
    }
    
    return cached.data
  }

  /**
   * Save results to cache
   */
  private static saveToCache(hash: string, data: ThreatIntelligenceResult[]): void {
    this.cache.set(hash, {
      data,
      timestamp: Date.now(),
      hash
    })

    // Clean up old cache entries
    if (this.cache.size > 1000) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      // Remove oldest 100 entries
      for (let i = 0; i < 100; i++) {
        this.cache.delete(sortedEntries[i][0])
      }
    }
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Aggregate results from multiple sources
   */
  static aggregateResults(results: ThreatIntelligenceResult[]): {
    overallSafe: boolean
    overallScore: number
    totalThreats: string[]
    sourceCount: number
    consensus: 'safe' | 'suspicious' | 'dangerous'
  } {
    if (results.length === 0) {
      return {
        overallSafe: true,
        overallScore: 50, // Unknown
        totalThreats: [],
        sourceCount: 0,
        consensus: 'suspicious'
      }
    }

    const safeCount = results.filter(r => r.safe).length
    const totalScore = results.reduce((sum, r) => sum + r.score, 0)
    const overallScore = Math.round(totalScore / results.length)
    const allThreats = results.flatMap(r => r.threats)
    const uniqueThreats = Array.from(new Set(allThreats))
    
    let consensus: 'safe' | 'suspicious' | 'dangerous'
    const safePercentage = (safeCount / results.length) * 100
    
    if (safePercentage >= 80) {
      consensus = 'safe'
    } else if (safePercentage >= 40) {
      consensus = 'suspicious'
    } else {
      consensus = 'dangerous'
    }

    return {
      overallSafe: safePercentage >= 80,
      overallScore,
      totalThreats: uniqueThreats,
      sourceCount: results.length,
      consensus
    }
  }
}