import { NextRequest, NextResponse } from 'next/server'

interface PhishingIndicators {
  suspicious_domain: boolean
  url_shortener: boolean
  homograph_attack: boolean
  suspicious_tld: boolean
  ip_address: boolean
  suspicious_path: boolean
  typosquatting: boolean
  excessive_subdomains: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const analysis = analyzePhishingIndicators(url)
    
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Link analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze link' },
      { status: 500 }
    )
  }
}

function analyzePhishingIndicators(url: string): {
  safe: boolean
  risk_level?: 'low' | 'medium' | 'high' | 'critical'
  details: string[]
  recommendations: string[]
} {
  const indicators: PhishingIndicators = {
    suspicious_domain: false,
    url_shortener: false,
    homograph_attack: false,
    suspicious_tld: false,
    ip_address: false,
    suspicious_path: false,
    typosquatting: false,
    excessive_subdomains: false
  }
  
  const details: string[] = []
  const recommendations: string[] = []
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    const domain = urlObj.hostname.toLowerCase()
    const path = urlObj.pathname.toLowerCase()
    
    const urlShorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 't.co', 'short.link', 'tiny.cc']
    if (urlShorteners.some(shortener => domain.includes(shortener))) {
      indicators.url_shortener = true
      details.push('URL shortener detected - often used to hide malicious destinations')
      recommendations.push('Expand the shortened URL to see the actual destination before clicking')
    }
    
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.click', '.download', '.bid', '.win', '.loan', '.racing']
    if (suspiciousTlds.some(tld => domain.endsWith(tld))) {
      indicators.suspicious_tld = true
      details.push('Suspicious top-level domain detected - commonly used in phishing attacks')
      recommendations.push('Verify the legitimacy of the website before entering any information')
    }
    
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipPattern.test(domain)) {
      indicators.ip_address = true
      details.push('Direct IP address used instead of domain name - highly suspicious')
      recommendations.push('Legitimate websites use domain names, not IP addresses')
    }
    
    const homographChars = /[а-яА-Я]|[αβγδεζηθικλμνξοπρστυφχψω]/
    if (homographChars.test(domain)) {
      indicators.homograph_attack = true
      details.push('Potential homograph attack detected - foreign characters mimicking Latin letters')
      recommendations.push('Check the URL carefully for unusual characters')
    }
    
    const legitimateDomains = ['google', 'facebook', 'amazon', 'microsoft', 'apple', 'paypal', 'ebay', 'netflix', 'linkedin', 'twitter', 'instagram']
    const typoVariations = legitimateDomains.some(legit => {
      const variations = [
        domain.includes(legit + '-'),
        domain.includes('-' + legit),
        domain.includes(legit.slice(0, -1)),
        domain.includes(legit + legit.slice(-1)),
        domain.includes(legit.replace(/[aeiou]/g, match => {
          const vowels: {[key: string]: string} = { 'a': 'e', 'e': 'a', 'i': 'l', 'o': '0', 'u': 'v' }
          return vowels[match] || match
        }))
      ]
      return variations.some(v => v) && !domain.includes('.' + legit + '.')
    })
    
    if (typoVariations) {
      indicators.typosquatting = true
      details.push('Possible typosquatting attempt - domain similar to legitimate website')
      recommendations.push('Double-check the spelling of the domain name')
    }
    
    const subdomainCount = domain.split('.').length - 2
    if (subdomainCount > 3) {
      indicators.excessive_subdomains = true
      details.push('Excessive subdomains detected - often used to confuse users')
      recommendations.push('Be cautious of URLs with many dots/subdomains')
    }
    
    const suspiciousPaths = ['/verify', '/confirm', '/secure', '/account', '/suspended', '/locked', '/update-payment']
    if (suspiciousPaths.some(suspicious => path.includes(suspicious))) {
      indicators.suspicious_path = true
      details.push('Suspicious URL path detected - commonly used in phishing emails')
      recommendations.push('Verify the email sender and navigate to the website directly instead of clicking links')
    }
    
    const suspiciousPatterns = [
      /[0-9]{2,}[a-z]+[0-9]+/i,
      /\d+\.html?$/,
      /@/,
      /[а-яА-Я]/
    ]
    
    if (suspiciousPatterns.some(pattern => pattern.test(domain))) {
      indicators.suspicious_domain = true
      details.push('Domain contains suspicious patterns')
      recommendations.push('Legitimate websites typically have clean, professional domain names')
    }
    
  } catch {
    details.push('Invalid URL format')
    recommendations.push('Ensure the URL is properly formatted')
  }
  
  const indicatorCount = Object.values(indicators).filter(Boolean).length
  
  let risk_level: 'low' | 'medium' | 'high' | 'critical'
  if (indicatorCount === 0) {
    risk_level = 'low'
  } else if (indicatorCount <= 2) {
    risk_level = 'medium'
  } else if (indicatorCount <= 4) {
    risk_level = 'high'
  } else {
    risk_level = 'critical'
  }
  
  const safe = indicatorCount === 0
  
  if (safe) {
    details.push('No obvious phishing indicators detected')
    recommendations.push('Still exercise caution and verify the website\'s SSL certificate')
    recommendations.push('Check for HTTPS encryption before entering sensitive information')
  }
  
  return {
    safe,
    risk_level,
    details,
    recommendations
  }
}