import { NextResponse } from 'next/server'
import { healthCheck, withSecurityHeaders } from '@/lib/middleware'

export async function GET() {
  try {
    const health = await healthCheck()
    
    const response = NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 503,
    })

    return withSecurityHeaders(response)
  } catch (error) {
    console.error('Health check error:', error)
    
    const response = NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    }, { status: 503 })

    return withSecurityHeaders(response)
  }
}