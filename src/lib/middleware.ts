/**
 * Middleware utilities for API protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  requireAuth, 
  checkIPRateLimit, 
  checkUserRateLimit, 
  createRateLimitHeaders,
  getCurrentUser,
  getClientIP,
  getUserAgent,
  AuthUser 
} from './auth'
import { db, checkDatabaseHealth } from './mongodb'
import { config } from './config'
import { log } from './logger'

export interface MiddlewareOptions {
  requireAuth?: boolean
  requireTokenAccess?: boolean
  rateLimit?: {
    windowMs: number
    maxRequests: number
    action?: string
  }
  analytics?: {
    trackEvent?: string
  }
}

export interface MiddlewareContext {
  user?: AuthUser
  ipAddress: string
  userAgent: string
  sessionId?: string
}

/**
 * Create a protected API route with middleware
 */
export function withMiddleware(
  handler: (req: NextRequest, context: MiddlewareContext) => Promise<NextResponse>,
  options: MiddlewareOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const context: MiddlewareContext = {
      ipAddress: getClientIP(req),
      userAgent: getUserAgent(req),
    }

    try {
      // Rate limiting
      if (options.rateLimit) {
        const { windowMs, maxRequests, action = 'api-request' } = options.rateLimit
        
        // Check IP-based rate limiting first
        const ipRateLimit = await checkIPRateLimit(req, action, windowMs, maxRequests)
        const headers = createRateLimitHeaders(ipRateLimit, maxRequests)

        if (!ipRateLimit.allowed) {
          log.security.rateLimitExceeded({
            key: `ip:${context.ipAddress}:${action}`,
            action,
            count: ipRateLimit.count,
            ip: context.ipAddress,
          })

          await db.audit.log({
            action: 'rate_limit_exceeded',
            resource: 'api',
            details: { 
              action,
              ip: context.ipAddress,
              count: ipRateLimit.count,
            },
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          })

          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429, headers }
          )
        }
      }

      // Authentication
      if (options.requireAuth) {
        const authResult = await requireAuth(req)
        
        if (authResult.error) {
          return NextResponse.json(
            { error: authResult.error.message },
            { status: authResult.error.status }
          )
        }

        context.user = authResult.user
        context.sessionId = authResult.user.id

        // User-specific rate limiting
        if (options.rateLimit) {
          const { windowMs, maxRequests, action = 'api-request' } = options.rateLimit
          const userRateLimit = await checkUserRateLimit(
            authResult.user.id, 
            action, 
            windowMs, 
            maxRequests
          )

          if (!userRateLimit.allowed) {
            await db.audit.log({
              userId: authResult.user.id,
              action: 'user_rate_limit_exceeded',
              resource: 'api',
              details: { 
                action,
                count: userRateLimit.count,
              },
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            })

            const headers = createRateLimitHeaders(userRateLimit, maxRequests)
            return NextResponse.json(
              { error: 'User rate limit exceeded. Please try again later.' },
              { status: 429, headers }
            )
          }
        }

        // Token access check
        if (options.requireTokenAccess && !authResult.user.hasTokenAccess) {
          return NextResponse.json(
            { error: 'Token access required. Please hold LYN tokens to use this feature.' },
            { status: 403 }
          )
        }
      } else {
        // For non-authenticated routes, try to get user if available
        context.user = (await getCurrentUser(req)) || undefined
        context.sessionId = context.user?.id || `anon-${context.ipAddress}`
      }

      // Analytics tracking
      if (options.analytics?.trackEvent) {
        await db.analytics.trackEvent({
          userId: context.user?.id,
          eventType: options.analytics.trackEvent,
          eventData: {
            path: req.nextUrl.pathname,
            method: req.method,
            userAgent: context.userAgent,
          },
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        })
      }

      // Execute the handler
      const response = await handler(req, context)
      
      // Log API call performance
      const duration = Date.now() - startTime
      log.performance.apiCall({
        method: req.method,
        path: req.nextUrl.pathname,
        duration,
        statusCode: response.status,
        userId: context.user?.id,
        ip: context.ipAddress,
      })

      return response

    } catch (error) {
      const duration = Date.now() - startTime
      
      log.error('Middleware error', {
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        userId: context.user?.id,
        ip: context.ipAddress,
      })
      
      // Log error
      await db.audit.log({
        userId: context.user?.id,
        action: 'api_error',
        resource: 'api',
        details: {
          path: req.nextUrl.pathname,
          method: req.method,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Input validation middleware
 */
export function validateInput<T>(
  schema: (input: unknown) => T,
  errorMessage = 'Invalid input'
) {
  return (input: unknown): T => {
    try {
      return schema(input)
    } catch {
      throw new Error(errorMessage)
    }
  }
}

/**
 * CORS middleware for API routes
 */
export function withCORS(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    origin?: string | string[]
    methods?: string[]
    headers?: string[]
  } = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const origin = req.headers.get('origin')
    const {
      origin: allowedOrigins = config.app.url,
      methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers = ['Content-Type', 'Authorization'],
    } = options

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': Array.isArray(allowedOrigins) 
            ? (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0])
            : allowedOrigins,
          'Access-Control-Allow-Methods': methods.join(', '),
          'Access-Control-Allow-Headers': headers.join(', '),
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // Execute handler
    const response = await handler(req)

    // Add CORS headers to response
    response.headers.set(
      'Access-Control-Allow-Origin',
      Array.isArray(allowedOrigins) 
        ? (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0])
        : allowedOrigins
    )
    response.headers.set('Access-Control-Allow-Methods', methods.join(', '))
    response.headers.set('Access-Control-Allow-Headers', headers.join(', '))

    return response
  }
}

/**
 * Security headers middleware
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;"
  )

  // Other security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  if (config.app.environment === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  return response
}

/**
 * Health check endpoint
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version?: string
  services: {
    database: 'up' | 'down'
    redis?: 'up' | 'down'
  }
}> {
  const timestamp = new Date().toISOString()
  
  // Check database
  const dbHealthy = await checkDatabaseHealth()
  
  const services = {
    database: dbHealthy ? 'up' as const : 'down' as const,
  }

  const allServicesUp = Object.values(services).every(status => status === 'up')

  return {
    status: allServicesUp ? 'healthy' : 'unhealthy',
    timestamp,
    version: process.env.npm_package_version,
    services,
  }
}