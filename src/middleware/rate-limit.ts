/**
 * Rate Limiting Middleware
 */

import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limit store (for production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

// Configuration for different endpoints
const RATE_LIMITS = {
  // Auth endpoints
  '/api/auth/connect': { windowMs: 60000, maxRequests: 5 },
  '/api/auth/me': { windowMs: 60000, maxRequests: 30 },
  '/api/auth/logout': { windowMs: 60000, maxRequests: 10 },
  
  // User endpoints
  '/api/user/register-username': { windowMs: 60000, maxRequests: 3 },
  '/api/user/register-username-v2': { windowMs: 60000, maxRequests: 3 },
  '/api/user/profile': { windowMs: 60000, maxRequests: 20 },
  
  // Security endpoints
  '/api/security/scan': { windowMs: 60000, maxRequests: 10 },
  '/api/security/audit': { windowMs: 60000, maxRequests: 5 },
  
  // Agent endpoints
  '/api/agents': { windowMs: 60000, maxRequests: 10 },
  '/api/chat': { windowMs: 60000, maxRequests: 20 },
  
  // Referral endpoints
  '/api/referral': { windowMs: 60000, maxRequests: 10 },
  
  // Default for unspecified endpoints
  default: { windowMs: 60000, maxRequests: 60 }
}

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

/**
 * Get rate limit configuration for path
 */
function getRateLimitConfig(path: string) {
  // Find matching configuration
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern === 'default') continue
    if (path.startsWith(pattern)) {
      return config
    }
  }
  return RATE_LIMITS.default
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  endpoint?: string
): Promise<NextResponse | null> {
  const path = endpoint || request.nextUrl.pathname
  const config = getRateLimitConfig(path)
  
  // Get client identifier (IP + path)
  const clientIP = getClientIP(request)
  const key = `${clientIP}:${path}`
  
  const now = Date.now()
  const resetTime = now + config.windowMs
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = { count: 1, resetTime }
    rateLimitStore.set(key, entry)
  } else {
    // Increment count
    entry.count++
  }
  
  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(entry.resetTime / 1000).toString(),
          'Retry-After': retryAfter.toString()
        }
      }
    )
  }
  
  // Request allowed - return null to continue
  return null
}

/**
 * Express-style rate limit wrapper for API routes
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  customConfig?: { windowMs: number; maxRequests: number }
) {
  return async (req: NextRequest) => {
    // Apply custom config if provided
    if (customConfig) {
      const path = req.nextUrl.pathname
      RATE_LIMITS[path] = customConfig
    }
    
    // Check rate limit
    const rateLimitResponse = await rateLimitMiddleware(req)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    
    // Call original handler
    return handler(req)
  }
}

/**
 * Rate limit by user ID (for authenticated endpoints)
 */
export async function userRateLimit(
  userId: string,
  action: string,
  windowMs: number = 60000,
  maxRequests: number = 10
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `user:${userId}:${action}`
  const now = Date.now()
  const resetTime = now + windowMs
  
  let entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetTime < now) {
    entry = { count: 1, resetTime }
    rateLimitStore.set(key, entry)
    return { allowed: true, remaining: maxRequests - 1, resetTime }
  }
  
  entry.count++
  
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }
  
  return { 
    allowed: true, 
    remaining: maxRequests - entry.count, 
    resetTime: entry.resetTime 
  }
}

/**
 * Distributed rate limiting with Redis (for production)
 */
export class DistributedRateLimiter {
  constructor(private redisClient?: any) {}
  
  async limit(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (!this.redisClient) {
      // Fallback to in-memory if Redis not available
      return this.inMemoryLimit(key, windowMs, maxRequests)
    }
    
    const now = Date.now()
    const window = Math.floor(now / windowMs)
    const redisKey = `ratelimit:${key}:${window}`
    
    try {
      // Increment counter
      const count = await this.redisClient.incr(redisKey)
      
      // Set expiry on first request
      if (count === 1) {
        await this.redisClient.expire(redisKey, Math.ceil(windowMs / 1000))
      }
      
      const allowed = count <= maxRequests
      const remaining = Math.max(0, maxRequests - count)
      const resetTime = (window + 1) * windowMs
      
      return { allowed, remaining, resetTime }
    } catch (error) {
      console.error('[RateLimit] Redis error:', error)
      // Fallback to in-memory
      return this.inMemoryLimit(key, windowMs, maxRequests)
    }
  }
  
  private inMemoryLimit(
    key: string,
    windowMs: number,
    maxRequests: number
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const resetTime = now + windowMs
    
    let entry = rateLimitStore.get(key)
    
    if (!entry || entry.resetTime < now) {
      entry = { count: 1, resetTime }
      rateLimitStore.set(key, entry)
      return { allowed: true, remaining: maxRequests - 1, resetTime }
    }
    
    entry.count++
    
    return {
      allowed: entry.count <= maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime
    }
  }
}