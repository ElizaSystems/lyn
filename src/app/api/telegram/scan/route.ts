import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

function verifyTelegramWebAppData(initData: string): TelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return null

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    urlParams.delete('hash')

    // Sort parameters
    const params = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Create secret key
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    
    // Verify hash
    const hmac = crypto.createHmac('sha256', secretKey).update(params).digest('hex')
    
    if (hmac !== hash) {
      console.log('Invalid Telegram hash')
      return null
    }

    // Parse user data
    const userStr = urlParams.get('user')
    if (userStr) {
      return JSON.parse(userStr)
    }
    return null
  } catch (error) {
    console.error('Error verifying Telegram data:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get('X-Telegram-Init-Data')
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Verify Telegram user (optional - allows anonymous usage too)
    let telegramUser: TelegramUser | null = null
    if (initData) {
      telegramUser = verifyTelegramWebAppData(initData)
    }

    // Fix and validate URL
    let validUrl: string
    let fixedUrl = url
    
    if (fixedUrl.startsWith('htps://')) {
      fixedUrl = 'https://' + fixedUrl.substring(7)
    } else if (fixedUrl.startsWith('htp://')) {
      fixedUrl = 'http://' + fixedUrl.substring(6)
    } else if (!fixedUrl.match(/^https?:\/\//i)) {
      fixedUrl = `https://${fixedUrl}`
    }
    
    try {
      const parsedUrl = new URL(fixedUrl)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 })
      }
      validUrl = fixedUrl
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Get threat intelligence
    console.log(`[Telegram] Checking URL for user ${telegramUser?.username || 'anonymous'}: ${validUrl}`)
    const threatResults = await ThreatIntelligenceService.checkURL(validUrl)
    const aggregated = ThreatIntelligenceService.aggregateResults(threatResults)
    
    // Build response
    const details: string[] = []
    const recommendations: string[] = []
    
    if (aggregated.overallSafe) {
      details.push(`✅ Checked by ${aggregated.sourceCount} security services`)
      recommendations.push('This URL appears to be safe')
      recommendations.push('Still be cautious with sensitive information')
    } else if (aggregated.consensus === 'suspicious') {
      details.push(`⚠️ Mixed results from ${aggregated.sourceCount} services`)
      details.push(`Threats: ${aggregated.totalThreats.join(', ')}`)
      recommendations.push('Proceed with extreme caution')
      recommendations.push('Do not enter personal information')
    } else {
      details.push(`🚨 Dangerous URL detected`)
      details.push(`Threats: ${aggregated.totalThreats.join(', ')}`)
      recommendations.push('DO NOT VISIT THIS URL')
      recommendations.push('High risk of malware or phishing')
    }

    // Add source breakdown
    if (threatResults.length > 0) {
      threatResults.forEach(r => {
        details.push(`${r.source}: ${r.safe ? '✅' : '⚠️'} (${r.score}/100)`)
      })
    }

    // Log usage for premium users
    if (telegramUser?.is_premium) {
      console.log(`[Telegram] Premium user ${telegramUser.username} scanned ${validUrl}`)
    }

    return NextResponse.json({
      scanId: `tg-${Date.now()}`,
      scanHash: crypto.randomBytes(16).toString('hex'),
      safe: aggregated.overallSafe,
      risk_level: aggregated.consensus === 'safe' ? 'low' : 
                  aggregated.consensus === 'suspicious' ? 'medium' : 'critical',
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
      timestamp: new Date().toISOString(),
      telegram_user: telegramUser ? {
        id: telegramUser.id,
        username: telegramUser.username,
        is_premium: telegramUser.is_premium
      } : null
    })
  } catch (error) {
    console.error('Telegram scan error:', error)
    return NextResponse.json({
      error: 'Failed to analyze URL',
      details: ['Service temporarily unavailable']
    }, { status: 500 })
  }
}