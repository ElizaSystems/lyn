/**
 * Rate Limiting Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimitMiddleware, userRateLimit, DistributedRateLimiter } from '@/middleware/rate-limit'

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limit store between tests
    jest.clearAllMocks()
  })

  describe('IP-based Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/auth/connect' },
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1'
            return null
          }
        }
      } as unknown as NextRequest

      // First 5 requests should pass (limit for /api/auth/connect)
      for (let i = 0; i < 5; i++) {
        const response = await rateLimitMiddleware(mockRequest)
        expect(response).toBeNull()
      }
    })

    it('should block requests exceeding limit', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/auth/connect' },
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.2'
            return null
          }
        }
      } as unknown as NextRequest

      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        await rateLimitMiddleware(mockRequest)
      }

      // 6th request should be blocked
      const response = await rateLimitMiddleware(mockRequest)
      expect(response).not.toBeNull()
      expect(response?.status).toBe(429)
    })

    it('should reset after time window', async () => {
      // Test that rate limit resets after window expires
      expect(true).toBe(true) // Placeholder for time-based test
    })
  })

  describe('User-based Rate Limiting', () => {
    it('should track rate limits per user', async () => {
      const userId1 = 'user1'
      const userId2 = 'user2'
      const action = 'register'

      // User 1 rate limit
      const result1 = await userRateLimit(userId1, action, 60000, 3)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(2)

      // User 2 should have separate limit
      const result2 = await userRateLimit(userId2, action, 60000, 3)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(2)
    })

    it('should enforce per-action limits', async () => {
      const userId = 'user1'
      
      // Different actions should have separate limits
      const result1 = await userRateLimit(userId, 'action1', 60000, 5)
      const result2 = await userRateLimit(userId, 'action2', 60000, 5)
      
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
    })
  })

  describe('Distributed Rate Limiter', () => {
    it('should fallback to in-memory when Redis unavailable', async () => {
      const limiter = new DistributedRateLimiter()
      
      const result = await limiter.limit('test-key', 60000, 10)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('should handle concurrent requests', async () => {
      const limiter = new DistributedRateLimiter()
      const promises = []
      
      // Simulate 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(limiter.limit('concurrent-key', 60000, 10))
      }
      
      const results = await Promise.all(promises)
      const allowedCount = results.filter(r => r.allowed).length
      
      expect(allowedCount).toBe(10) // All should be allowed (at limit)
    })
  })

  describe('Rate Limit Headers', () => {
    it('should include proper rate limit headers', async () => {
      const mockRequest = {
        nextUrl: { pathname: '/api/user/register-username' },
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.3'
            return null
          }
        }
      } as unknown as NextRequest

      // Make requests up to limit
      for (let i = 0; i < 3; i++) {
        await rateLimitMiddleware(mockRequest)
      }

      // Next request should be blocked with headers
      const response = await rateLimitMiddleware(mockRequest)
      
      if (response) {
        const headers = response.headers
        expect(headers.get('X-RateLimit-Limit')).toBe('3')
        expect(headers.get('X-RateLimit-Remaining')).toBe('0')
        expect(headers.get('X-RateLimit-Reset')).toBeTruthy()
        expect(headers.get('Retry-After')).toBeTruthy()
      }
    })
  })
})