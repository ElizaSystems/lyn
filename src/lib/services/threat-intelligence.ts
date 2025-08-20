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

    // If no API services are configured or all failed, use fallback analysis
    if (results.length === 0) {
      console.warn('[ThreatIntel] No API services available, using fallback analysis')
      results.push(this.getFallbackURLResult(url))
    }

    // Cache the results
    this.saveToCache(urlHash, results)
    
    return results
  }

  /**
   * Check file against VirusTotal or use enhanced local analysis
   */
  static async checkFile(fileBuffer: Buffer, fileName: string): Promise<ThreatIntelligenceResult> {
    // For production, we'll use enhanced local analysis since VirusTotal requires special handling in Node.js
    // VirusTotal upload in Node.js requires the 'form-data' package which is not installed
    
    const apiKey = process.env.VIRUSTOTAL_API_KEY
    
    // If API key is configured and we have a way to check the file hash
    if (apiKey) {
      try {
        // Calculate file hash
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
        
        // Try to check if file is already known by hash
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
        
        // If file not found, we can't upload from Node.js without form-data package
        // Fall through to local analysis
        console.log('[ThreatIntel] File not in VirusTotal database, using enhanced local analysis')
      } catch (error) {
        console.error('[ThreatIntel] VirusTotal lookup failed:', error)
      }
    }
    
    // Use enhanced local analysis for production
    return this.getEnhancedFileAnalysis(fileBuffer, fileName)
  }

  /**
   * Enhanced file analysis for production use
   */
  private static getEnhancedFileAnalysis(fileBuffer: Buffer, fileName: string): ThreatIntelligenceResult {
    try {
      const threats = []
      let score = 100
      
      // Calculate file hashes for reporting
      const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex')
      const sha1Hash = crypto.createHash('sha1').update(fileBuffer).digest('hex')
      const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
      
      // Get file extension and size
      const fileExt = fileName.split('.').pop()?.toLowerCase() || ''
      const fileSizeKB = fileBuffer.length / 1024
      
      // Define file type categories
      const documentExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'rtf', 'odt']
      const textExtensions = ['txt', 'csv', 'log', 'md', 'json', 'xml', 'html', 'htm']
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
      const executableExtensions = ['exe', 'dll', 'bat', 'cmd', 'ps1', 'vbs', 'jar', 'scr', 'com', 'msi', 'app', 'deb', 'rpm']
      const scriptExtensions = ['js', 'py', 'rb', 'sh', 'bash', 'php']
      const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']
      
      // Check for suspicious file sizes
      if (fileSizeKB < 0.5) {
        threats.push('Very small file size (possible decoy)')
        score -= 10
      } else if (fileSizeKB > 100000) { // > 100MB
        threats.push('Unusually large file')
        score -= 5
      }
      
      // Check for executable files
      if (executableExtensions.includes(fileExt)) {
        threats.push(`Executable file type (.${fileExt})`)
        score -= 40
      }
      
      // Check for scripts
      if (scriptExtensions.includes(fileExt)) {
        threats.push(`Script file type (.${fileExt})`)
        score -= 20
      }
      
      // Check for archives (might contain malware)
      if (archiveExtensions.includes(fileExt)) {
        threats.push('Archive file (may contain hidden threats)')
        score -= 15
      }
      
      // Analyze content based on file type
      if (documentExtensions.includes(fileExt)) {
        // Check for Office macros
        const hasMacroIndicators = fileBuffer.includes(Buffer.from('vbaProject.bin')) ||
                                   fileBuffer.includes(Buffer.from('macros/')) ||
                                   fileBuffer.includes(Buffer.from('_VBA_PROJECT'))
        
        if (hasMacroIndicators) {
          threats.push('Document contains macros')
          score -= 30
        }
        
        // Check for embedded objects
        if (fileBuffer.includes(Buffer.from('oleObject')) || 
            fileBuffer.includes(Buffer.from('embeddings/'))) {
          threats.push('Document contains embedded objects')
          score -= 20
        }
      }
      
      // PDF-specific checks
      if (fileExt === 'pdf') {
        const pdfContent = fileBuffer.toString('ascii', 0, Math.min(fileBuffer.length, 50000))
        
        // Check for JavaScript in PDF
        if (/\/JavaScript|\/JS\s|\/JS\[/.test(pdfContent)) {
          threats.push('PDF contains JavaScript')
          score -= 35
        }
        
        // Check for embedded files
        if (/\/EmbeddedFile|\/Filespec/.test(pdfContent)) {
          threats.push('PDF contains embedded files')
          score -= 25
        }
        
        // Check for launch actions
        if (/\/Launch|\/URI|\/SubmitForm/.test(pdfContent)) {
          threats.push('PDF contains external actions')
          score -= 20
        }
        
        // Check for suspicious forms
        if (/\/AcroForm/.test(pdfContent)) {
          threats.push('PDF contains forms')
          score -= 10
        }
      }
      
      // Text-based file analysis
      if (textExtensions.includes(fileExt) || documentExtensions.includes(fileExt) || scriptExtensions.includes(fileExt)) {
        try {
          const textContent = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 200000))
          
          // Check for obfuscation
          const hexPatterns = (textContent.match(/\\x[0-9a-f]{2}/gi) || []).length
          const unicodePatterns = (textContent.match(/\\u[0-9a-f]{4}/gi) || []).length
          const base64Patterns = (textContent.match(/[A-Za-z0-9+\/]{50,}={0,2}/g) || []).length
          
          if (hexPatterns > 100 || unicodePatterns > 100) {
            threats.push('Heavy obfuscation detected')
            score -= 25
          }
          
          if (base64Patterns > 10) {
            threats.push('Multiple base64 encoded strings')
            score -= 15
          }
          
          // Check for malicious patterns
          const maliciousPatterns = [
            { pattern: /eval\s*\(|new\s+Function\s*\(/gi, threat: 'Dynamic code execution', penalty: 30 },
            { pattern: /document\.write|innerHTML\s*=/gi, threat: 'DOM manipulation', penalty: 15 },
            { pattern: /ActiveXObject|WScript\.Shell/gi, threat: 'Windows scripting objects', penalty: 35 },
            { pattern: /cmd\.exe|powershell|bash\s+-c/gi, threat: 'System command execution', penalty: 40 },
            { pattern: /\$\{jndi:|ldap:|rmi:/gi, threat: 'Log4j exploit attempt', penalty: 50 },
            { pattern: /(?:wget|curl)\s+https?:\/\//gi, threat: 'Download commands', penalty: 25 },
            { pattern: /rm\s+-rf|del\s+\/f|format\s+c:/gi, threat: 'Destructive commands', penalty: 45 }
          ]
          
          for (const { pattern, threat, penalty } of maliciousPatterns) {
            if (pattern.test(textContent)) {
              threats.push(threat)
              score -= penalty
            }
          }
          
          // Check for suspicious URLs
          const urls = textContent.match(/https?:\/\/[^\s\"'<>]+/gi) || []
          const suspiciousUrlIndicators = [
            /bit\.ly|tinyurl|goo\.gl|ow\.ly|short\.link/i,
            /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
            /\.tk$|\.ml$|\.ga$|\.cf$/i,
            /:(?:8080|8888|4444|1337|31337)/
          ]
          
          for (const url of urls.slice(0, 20)) { // Check first 20 URLs
            if (suspiciousUrlIndicators.some(pattern => pattern.test(url))) {
              threats.push('Suspicious URLs detected')
              score -= 20
              break
            }
          }
          
          // Check for phishing indicators
          const phishingPatterns = [
            /verify.{0,20}account|account.{0,20}suspend/i,
            /click.{0,20}here.{0,20}immediately/i,
            /urgent.{0,20}action.{0,20}required/i,
            /confirm.{0,20}identity|validate.{0,20}information/i,
            /suspended.{0,20}account|locked.{0,20}account/i
          ]
          
          if (phishingPatterns.some(pattern => pattern.test(textContent))) {
            threats.push('Phishing content detected')
            score -= 25
          }
        } catch {
          // If can't parse as text, might be binary
          console.log('[ThreatIntel] Could not parse file as text')
        }
      }
      
      // Image file checks (basic)
      if (imageExtensions.includes(fileExt)) {
        // Check for polyglot files (images with embedded code)
        const hasScriptTags = fileBuffer.includes(Buffer.from('<script')) || 
                             fileBuffer.includes(Buffer.from('<?php'))
        if (hasScriptTags) {
          threats.push('Image file contains script tags')
          score -= 30
        }
      }
      
      // Final safety determination
      const isSafe = threats.length === 0 || (score >= 70 && threats.length <= 1)
      
      return {
        source: 'LYN AI Security Scanner',
        safe: isSafe,
        score: Math.max(0, Math.min(100, score)),
        threats,
        details: {
          fileName,
          fileSize: fileBuffer.length,
          fileSizeKB: Math.round(fileSizeKB * 10) / 10,
          fileType: fileExt,
          md5: md5Hash,
          sha1: sha1Hash,
          sha256: sha256Hash,
          analysisType: 'Enhanced Local Analysis',
          scanEngine: 'Pattern Matching, Heuristics & Signature Detection',
          scanTime: new Date().toISOString(),
          threatCount: threats.length,
          recommendation: isSafe 
            ? 'File appears to be safe based on local analysis' 
            : 'Exercise caution with this file. Consider additional scanning before opening.'
        }
      }
    } catch (error) {
      console.error('[ThreatIntel] Enhanced analysis error:', error)
      // Return a cautious result on error
      return {
        source: 'LYN AI Security Scanner',
        safe: false,
        score: 40,
        threats: ['Analysis encountered an error - treating file as potentially unsafe'],
        details: {
          fileName,
          fileSize: fileBuffer.length,
          error: error instanceof Error ? error.message : 'Unknown error',
          analysisType: 'Enhanced Local Analysis',
          recommendation: 'Unable to fully analyze file. Recommend caution.'
        }
      }
    }
  }

  /**
   * Fallback file analysis (legacy method kept for compatibility)
   */
  private static getFallbackFileResult(fileBuffer: Buffer, fileName: string): ThreatIntelligenceResult {
    return this.getEnhancedFileAnalysis(fileBuffer, fileName)
  }

  /**
   * Check with VirusTotal
   */
  private static async checkVirusTotal(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY
    if (!apiKey) {
      console.log('[ThreatIntel] VirusTotal API key not configured')
      return null
    }

    try {
      // First, submit the URL for scanning
      const urlId = Buffer.from(url).toString('base64url')
      
      const response = await fetch(
        `https://www.virustotal.com/api/v3/urls/${urlId}`,
        {
          headers: {
            'x-apikey': apiKey
          }
        }
      )

      if (!response.ok) {
        // If not found, submit for scanning
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

        if (!scanResponse.ok) {
          throw new Error(`VirusTotal submission failed: ${scanResponse.status}`)
        }

        // Return preliminary result
        return {
          source: 'VirusTotal',
          safe: true, // Assume safe until scan completes
          score: 75,
          threats: [],
          details: { status: 'scanning' }
        }
      }

      const data: VirusTotalResponse = await response.json()
      return this.parseVirusTotalResponse(data)
    } catch (error) {
      console.error('[ThreatIntel] VirusTotal check failed:', error)
      return null
    }
  }

  /**
   * Parse VirusTotal response
   */
  private static parseVirusTotalResponse(data: VirusTotalResponse): ThreatIntelligenceResult {
    const stats = data?.data?.attributes?.last_analysis_stats || {}
    const malicious = stats.malicious || 0
    const suspicious = stats.suspicious || 0
    const harmless = stats.harmless || 0
    const undetected = stats.undetected || 0
    const total = malicious + suspicious + harmless + undetected

    const threats = []
    if (malicious > 0) threats.push(`${malicious} engines detected as malicious`)
    if (suspicious > 0) threats.push(`${suspicious} engines detected as suspicious`)

    const score = total > 0 ? Math.round(((harmless + undetected) / total) * 100) : 75

    return {
      source: 'VirusTotal',
      safe: malicious === 0 && suspicious === 0,
      score,
      threats,
      details: {
        stats,
        reputation: data?.data?.attributes?.reputation || 0,
        categories: data?.data?.attributes?.categories || {}
      }
    }
  }

  /**
   * Parse VirusTotal file report
   */
  private static parseVirusTotalFileReport(data: Record<string, unknown>): ThreatIntelligenceResult {
    const dataObj = data?.data as Record<string, unknown>
    const attributes = dataObj?.attributes as Record<string, unknown>
    const stats = (attributes?.last_analysis_stats as Record<string, unknown>) || {}
    const malicious = (stats.malicious as number) || 0
    const suspicious = (stats.suspicious as number) || 0
    const harmless = (stats.harmless as number) || 0
    const undetected = (stats.undetected as number) || 0
    const total = malicious + suspicious + harmless + undetected

    const threats = []
    if (malicious > 0) threats.push(`${malicious} antivirus engines detected malware`)
    if (suspicious > 0) threats.push(`${suspicious} engines marked as suspicious`)

    // Get specific threat names
    const results = (attributes?.last_analysis_results as Record<string, unknown>) || {}
    const detectedThreats: string[] = []
    Object.entries(results).forEach(([engine, result]) => {
      const resultObj = result as Record<string, unknown>
      if (resultObj.category === 'malicious' && detectedThreats.length < 5) {
        detectedThreats.push(`${engine}: ${resultObj.result}`)
      }
    })

    threats.push(...detectedThreats)

    const score = total > 0 ? Math.round(((harmless + undetected) / total) * 100) : 75

    return {
      source: 'VirusTotal',
      safe: malicious === 0 && suspicious === 0,
      score,
      threats,
      details: {
        stats,
        fileType: attributes?.type_description,
        md5: attributes?.md5,
        sha256: attributes?.sha256,
        firstSubmission: attributes?.first_submission_date
      }
    }
  }

  /**
   * Parse VirusTotal analysis response
   */
  private static parseVirusTotalAnalysis(data: Record<string, unknown>): ThreatIntelligenceResult {
    const dataObj = data?.data as Record<string, unknown>
    const attributes = dataObj?.attributes as Record<string, unknown>
    const stats = (attributes?.stats as Record<string, unknown>) || {}
    const malicious = (stats.malicious as number) || 0
    const suspicious = (stats.suspicious as number) || 0
    const harmless = (stats.harmless as number) || 0
    const undetected = (stats.undetected as number) || 0
    const total = malicious + suspicious + harmless + undetected

    const threats = []
    if (malicious > 0) threats.push(`${malicious} detections`)
    if (suspicious > 0) threats.push(`${suspicious} suspicious`)

    const score = total > 0 ? Math.round(((harmless + undetected) / total) * 100) : 75

    return {
      source: 'VirusTotal',
      safe: malicious === 0 && suspicious === 0,
      score,
      threats,
      details: {
        stats,
        status: attributes?.status || 'completed'
      }
    }
  }

  /**
   * Check with Google Safe Browsing
   */
  private static async checkGoogleSafeBrowsing(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY
    if (!apiKey) {
      console.log('[ThreatIntel] Google Safe Browsing API key not configured')
      return null
    }

    try {
      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: {
              clientId: 'lynai-security',
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

      if (!response.ok) {
        throw new Error(`Google Safe Browsing check failed: ${response.status}`)
      }

      const data = await response.json()
      const matches = data.matches || []
      
      return {
        source: 'Google Safe Browsing',
        safe: matches.length === 0,
        score: matches.length === 0 ? 100 : 0,
        threats: matches.map((m: Record<string, unknown>) => m.threatType as string),
        details: { matches }
      }
    } catch (error) {
      console.error('[ThreatIntel] Google Safe Browsing check failed:', error)
      return null
    }
  }

  /**
   * Check with IPQualityScore
   */
  private static async checkIPQualityScore(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.IPQUALITYSCORE_API_KEY
    if (!apiKey) {
      console.log('[ThreatIntel] IPQualityScore API key not configured')
      return null
    }

    try {
      const response = await fetch(
        `https://ipqualityscore.com/api/json/url/${apiKey}/${encodeURIComponent(url)}`,
        {
          method: 'GET'
        }
      )

      if (!response.ok) {
        throw new Error(`IPQualityScore check failed: ${response.status}`)
      }

      const data = await response.json()
      const threats = []
      
      if (data.phishing) threats.push('Phishing')
      if (data.malware) threats.push('Malware')
      if (data.suspicious) threats.push('Suspicious')
      if (data.risk_score > 75) threats.push('High risk score')

      return {
        source: 'IPQualityScore',
        safe: !data.unsafe && data.risk_score < 50,
        score: Math.max(0, 100 - data.risk_score),
        threats,
        details: {
          riskScore: data.risk_score,
          category: data.category,
          domain: data.domain
        }
      }
    } catch (error) {
      console.error('[ThreatIntel] IPQualityScore check failed:', error)
      return null
    }
  }

  /**
   * Check with URLVoid
   */
  private static async checkURLVoid(_url: string): Promise<ThreatIntelligenceResult | null> {
    // URLVoid requires a paid API key and special setup
    // This is a placeholder for future implementation
    const apiKey = process.env.URLVOID_API_KEY
    if (!apiKey) {
      return null
    }

    // Implementation would go here
    return null
  }

  /**
   * Check with PhishTank
   */
  private static async checkPhishTank(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.PHISHTANK_API_KEY
    if (!apiKey) {
      return null
    }

    try {
      const response = await fetch(
        'https://checkurl.phishtank.com/checkurl/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `url=${encodeURIComponent(url)}&format=json&app_key=${apiKey}`
        }
      )

      if (!response.ok) {
        throw new Error(`PhishTank check failed: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        source: 'PhishTank',
        safe: !data.results?.in_database || !data.results?.valid,
        score: data.results?.in_database ? 0 : 100,
        threats: data.results?.in_database ? ['Known phishing site'] : [],
        details: data.results || {}
      }
    } catch (error) {
      console.error('[ThreatIntel] PhishTank check failed:', error)
      return null
    }
  }

  /**
   * Check with AbuseIPDB
   */
  private static async checkAbuseIPDB(url: string): Promise<ThreatIntelligenceResult | null> {
    const apiKey = process.env.ABUSEIPDB_API_KEY
    if (!apiKey) {
      return null
    }

    try {
      // Extract domain/IP from URL
      const urlObj = new URL(url)
      const host = urlObj.hostname
      
      // Check if it's an IP address
      const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
      if (!isIP) {
        return null // AbuseIPDB only checks IPs
      }

      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${host}`,
        {
          headers: {
            'Key': apiKey,
            'Accept': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`AbuseIPDB check failed: ${response.status}`)
      }

      const data = await response.json()
      const abuseScore = data.data?.abuseConfidenceScore || 0
      
      return {
        source: 'AbuseIPDB',
        safe: abuseScore < 25,
        score: Math.max(0, 100 - abuseScore),
        threats: abuseScore > 25 ? [`Abuse score: ${abuseScore}%`] : [],
        details: {
          abuseScore,
          reports: data.data?.totalReports || 0,
          country: data.data?.countryCode
        }
      }
    } catch (error) {
      console.error('[ThreatIntel] AbuseIPDB check failed:', error)
      return null
    }
  }

  /**
   * Aggregate results from multiple sources
   */
  static aggregateResults(results: ThreatIntelligenceResult[]): {
    overallSafe: boolean
    overallScore: number
    consensus: 'safe' | 'suspicious' | 'dangerous'
    totalThreats: string[]
    sourceCount: number
  } {
    if (results.length === 0) {
      return {
        overallSafe: false,
        overallScore: 50,
        consensus: 'suspicious',
        totalThreats: ['No threat intelligence available'],
        sourceCount: 0
      }
    }

    const safeCount = results.filter(r => r.safe).length
    const totalScore = results.reduce((sum, r) => sum + r.score, 0)
    const avgScore = totalScore / results.length
    const allThreats = results.flatMap(r => r.threats)
    
    // Determine consensus
    let consensus: 'safe' | 'suspicious' | 'dangerous'
    if (safeCount === results.length) {
      consensus = 'safe'
    } else if (safeCount === 0) {
      consensus = 'dangerous'
    } else {
      consensus = 'suspicious'
    }

    return {
      overallSafe: safeCount > results.length / 2 && avgScore > 60,
      overallScore: Math.round(avgScore),
      consensus,
      totalThreats: [...new Set(allThreats)], // Remove duplicates
      sourceCount: results.length
    }
  }

  /**
   * Fallback URL analysis when no APIs are available
   */
  private static getFallbackURLResult(url: string): ThreatIntelligenceResult {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase()
      const threats = []
      let score = 100
      
      // Check for HTTPS
      if (urlObj.protocol !== 'https:') {
        threats.push('Not using HTTPS encryption')
        score -= 20
      }
      
      // Check for suspicious URL patterns
      if (/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/.test(domain)) {
        threats.push('Uses IP address instead of domain name')
        score -= 25
      }
      
      // Check for URL shorteners
      const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'short.link', 't.co']
      if (shorteners.some(s => domain.includes(s))) {
        threats.push('URL shortener detected')
        score -= 15
      }
      
      // Check for suspicious TLDs
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf']
      if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
        threats.push('Suspicious top-level domain')
        score -= 20
      }
      
      // Check for typosquatting patterns
      const commonDomains = ['google', 'facebook', 'amazon', 'microsoft', 'apple', 'paypal']
      for (const common of commonDomains) {
        if (domain.includes(common) && !domain.includes(`.${common}.`)) {
          const legitimate = [`${common}.com`, `${common}.org`, `${common}.net`]
          if (!legitimate.some(legit => domain.endsWith(legit))) {
            threats.push('Possible typosquatting')
            score -= 30
            break
          }
        }
      }
      
      // Check for excessive subdomains
      const subdomainCount = domain.split('.').length - 2
      if (subdomainCount > 3) {
        threats.push('Excessive subdomains')
        score -= 15
      }
      
      // Check for homograph attacks (basic check)
      if (/[а-яА-Я]/.test(domain)) {
        threats.push('Contains Cyrillic characters (possible homograph attack)')
        score -= 30
      }
      
      // Check for suspicious URL paths
      const suspiciousPatterns = [
        /\/(verify|confirm|update|secure|account|suspended|locked)/i,
        /\.(exe|scr|vbs|bat|cmd|com|pif|jar)$/i,
        /[\u0000-\u001F\u007F-\u009F]/ // Control characters
      ]
      
      const fullPath = urlObj.pathname + urlObj.search
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(fullPath)) {
          threats.push('Suspicious URL pattern')
          score -= 20
          break
        }
      }
      
      // Check against known safe domains
      const knownSafeDomains = [
        'google.com', 'facebook.com', 'twitter.com', 'microsoft.com', 'apple.com',
        'amazon.com', 'github.com', 'stackoverflow.com', 'wikipedia.org', 'reddit.com',
        'youtube.com', 'linkedin.com', 'instagram.com', 'netflix.com', 'spotify.com'
      ]
      
      const isKnownSafe = knownSafeDomains.some(safeDomain => 
        domain === safeDomain || domain.endsWith('.' + safeDomain)
      )
      
      if (isKnownSafe) {
        score = Math.max(score, 85) // Boost score for known safe domains
      }
      
      return {
        source: 'Local Analysis',
        safe: threats.length === 0 || score >= 70,
        score: Math.max(0, score),
        threats,
        details: {
          domain,
          protocol: urlObj.protocol,
          path: urlObj.pathname,
          hasHttps: urlObj.protocol === 'https:',
          subdomainCount
        }
      }
    } catch {
      return {
        source: 'Local Analysis',
        safe: false,
        score: 0,
        threats: ['Invalid URL format'],
        details: { error: 'URL parsing failed' }
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
   * Get cached result
   */
  private static getFromCache(hash: string): ThreatIntelligenceResult[] | null {
    const cached = this.cache.get(hash)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(hash)
      return null
    }
    
    return cached.data
  }

  /**
   * Save to cache
   */
  private static saveToCache(hash: string, data: ThreatIntelligenceResult[]): void {
    this.cache.set(hash, {
      data,
      timestamp: Date.now(),
      hash
    })
    
    // Clean old cache entries
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      // Remove oldest 20 entries
      for (let i = 0; i < 20; i++) {
        this.cache.delete(entries[i][0])
      }
    }
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}