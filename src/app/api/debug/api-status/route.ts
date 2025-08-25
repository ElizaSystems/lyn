import { NextResponse } from 'next/server'

export async function GET() {
  // Check which APIs are configured (without revealing the actual keys)
  const apiStatus = {
    venice_ai: !!process.env.VENICE_API_KEY,
    virustotal: !!process.env.VIRUSTOTAL_API_KEY,
    google_safe_browsing: !!process.env.GOOGLE_SAFE_BROWSING_API_KEY,
    ipqualityscore: !!process.env.IPQUALITYSCORE_API_KEY,
    abuseipdb: !!process.env.ABUSEIPDB_API_KEY,
    mongodb: !!process.env.MONGODB_URI,
    nextauth_secret: !!process.env.NEXTAUTH_SECRET,
    environment: process.env.NODE_ENV || 'development',
    vercel: !!process.env.VERCEL,
    vercel_env: process.env.VERCEL_ENV || 'not-on-vercel'
  }

  // Count configured APIs
  const securityApis = [
    apiStatus.virustotal,
    apiStatus.google_safe_browsing, 
    apiStatus.ipqualityscore,
    apiStatus.abuseipdb
  ]
  
  const configuredCount = securityApis.filter(Boolean).length

  return NextResponse.json({
    status: 'ok',
    apis_configured: configuredCount,
    total_apis: securityApis.length,
    details: apiStatus,
    message: configuredCount === 0 
      ? 'No security APIs configured - will use fallback analysis'
      : `${configuredCount} of ${securityApis.length} security APIs configured`
  })
}