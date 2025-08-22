import { NextRequest, NextResponse } from 'next/server'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence'
import { ScanService } from '@/lib/services/scan-service'

// Handle GET requests for testing
export async function GET() {
  return NextResponse.json({
    error: 'Use POST method to analyze a link',
    example: {
      method: 'POST',
      body: { url: 'https://example.com' }
    }
  }, { status: 405 })
}

export async function POST(request: NextRequest) {
  try {
    // Get session ID for tracking (no auth required)
    const sessionId = request.headers.get('x-session-id') || 
                     request.cookies.get('sessionId')?.value ||
                     `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate and fix URL format
    let validUrl: string
    let fixedUrl = url
    
    // Fix common typos in protocol first
    if (fixedUrl.startsWith('htps://')) {
      fixedUrl = 'https://' + fixedUrl.substring(7)
    } else if (fixedUrl.startsWith('htp://')) {
      fixedUrl = 'http://' + fixedUrl.substring(6)
    } else if (fixedUrl.startsWith('htttp://')) {
      fixedUrl = 'http://' + fixedUrl.substring(8)
    } else if (fixedUrl.startsWith('htttps://')) {
      fixedUrl = 'https://' + fixedUrl.substring(9)
    } else if (fixedUrl.startsWith('ttp://')) {
      fixedUrl = 'http://' + fixedUrl.substring(6)
    } else if (fixedUrl.startsWith('ttps://')) {
      fixedUrl = 'https://' + fixedUrl.substring(7)
    } else if (!fixedUrl.match(/^https?:\/\//i)) {
      // Add https:// if no valid http/https protocol
      fixedUrl = `https://${fixedUrl}`
    }
    
    // Now validate the URL
    try {
      const parsedUrl = new URL(fixedUrl)
      // Ensure it's http or https protocol
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 })
      }
      validUrl = fixedUrl
    } catch {
      return NextResponse.json({ error: 'Invalid URL format. Please check the URL and try again.' }, { status: 400 })
    }

    // Try to create scan record in database, but continue if it fails
    let scan = null
    try {
      scan = await ScanService.createScan(
        sessionId,
        'url',
        validUrl,
        {
          domain: new URL(validUrl).hostname,
          sslCertificate: validUrl.startsWith('https')
        }
      )
    } catch (dbError) {
      console.log('Could not save scan to database, continuing without persistence')
      // Create a mock scan object for the response
      scan = {
        _id: null,
        hash: `temp-${Date.now()}`,
        userId: null,
        sessionId: sessionId
      }
    }

    // Get real threat intelligence
    const threatResults = await ThreatIntelligenceService.checkURL(validUrl)
    
    // Aggregate results from all sources
    const aggregated = ThreatIntelligenceService.aggregateResults(threatResults)
    
    // Build detailed response
    const details: string[] = []
    const recommendations: string[] = []
    
    // Add source-specific details
    threatResults.forEach(result => {
      if (!result.safe) {
        details.push(`${result.source}: ${result.threats.join(', ')}`)
      }
    })
    
    // Add aggregated analysis
    if (aggregated.overallSafe) {
      details.push(`✅ Checked by ${aggregated.sourceCount} security services - No threats detected`)
      recommendations.push('This URL appears to be safe based on multiple threat intelligence sources')
      recommendations.push('Still exercise caution with any sensitive information')
    } else if (aggregated.consensus === 'suspicious') {
      details.push(`⚠️ Mixed results from ${aggregated.sourceCount} security services`)
      details.push(`Threats identified: ${aggregated.totalThreats.join(', ')}`)
      recommendations.push('This URL has suspicious indicators - proceed with extreme caution')
      recommendations.push('Do not enter any personal or financial information')
      recommendations.push('Consider using a sandbox or isolated browser')
    } else {
      details.push(`🚨 Dangerous URL detected by multiple security services`)
      details.push(`Critical threats: ${aggregated.totalThreats.join(', ')}`)
      recommendations.push('DO NOT VISIT THIS URL - High risk of malware or phishing')
      recommendations.push('If you already visited, scan your device for malware immediately')
      recommendations.push('Change passwords if you entered any credentials')
    }

    // Add source breakdown if we have results
    if (threatResults.length > 0) {
      const sourceBreakdown = threatResults.map(r => 
        `${r.source}: ${r.safe ? '✅ Safe' : '⚠️ Threats detected'} (Score: ${r.score}/100)`
      )
      details.push('', 'Detailed Analysis:', ...sourceBreakdown)
    }

    // Determine risk level and severity based on consensus
    const riskLevelMap = {
      'safe': 'low',
      'suspicious': 'medium',
      'dangerous': 'critical'
    } as const
    
    const severityMap = {
      'safe': 'safe',
      'suspicious': aggregated.overallScore > 60 ? 'low' : 'medium',
      'dangerous': aggregated.overallScore < 30 ? 'critical' : 'high'
    } as const

    // Try to update scan with results if we have a database connection
    if (scan._id) {
      try {
        await ScanService.updateScanResult(
          scan._id.toString(),
          {
            isSafe: aggregated.overallSafe,
            threats: aggregated.totalThreats,
            confidence: aggregated.overallScore,
            details: details.join('\n'),
            recommendations
          },
          severityMap[aggregated.consensus]
        )
      } catch (dbError) {
        console.log('Could not update scan in database')
      }
    }

    return NextResponse.json({
      scanId: scan._id?.toString(),
      scanHash: scan.hash,
      safe: aggregated.overallSafe,
      risk_level: riskLevelMap[aggregated.consensus],
      confidence_score: aggregated.overallScore,
      details,
      recommendations,
      threat_sources: threatResults.map(r => ({
        name: r.source,
        safe: r.safe,
        score: r.score,
        threats: r.threats
      })),
      consensus: aggregated.consensus,
      checked_url: validUrl,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Link analysis error:', error)
    
    // Return a fallback analysis result instead of complete failure
    const { url } = await request.json().catch(() => ({ url: 'unknown' }))
    
    return NextResponse.json({
      scanId: `fallback-${Date.now()}`,
      scanHash: `fallback-${Date.now()}`,
      safe: false,
      risk_level: 'medium',
      confidence_score: 50,
      details: [
        '⚠️ Analysis service temporarily unavailable',
        'Unable to connect to threat intelligence services',
        'Please try again in a few moments'
      ],
      recommendations: [
        'Exercise caution when visiting this link',
        'Check the URL manually for suspicious patterns',
        'Consider using a sandbox environment',
        'Try the analysis again later when services are restored'
      ],
      threat_sources: [],
      consensus: 'suspicious',
      checked_url: url,
      timestamp: new Date().toISOString(),
      fallback: true
    })
  }
}