import { NextRequest, NextResponse } from 'next/server'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence'
import { ScanService } from '@/lib/services/scan-service'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication (now handles anonymous users with sessionId)
    const authResult = await requireAuth(request)
    const userId = authResult.user?.id || authResult.user.id // Will have sessionId for anonymous users
    
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    let validUrl: string
    try {
      validUrl = url.startsWith('http') ? url : `https://${url}`
      new URL(validUrl) // Validate URL format
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Create scan record
    const scan = await ScanService.createScan(
      userId,
      'url',
      validUrl,
      {
        domain: new URL(validUrl).hostname,
        sslCertificate: validUrl.startsWith('https')
      }
    )

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

    // Update scan with results
    if (scan._id) {
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
    return NextResponse.json(
      { error: 'Failed to analyze link. Please try again.' },
      { status: 500 }
    )
  }
}