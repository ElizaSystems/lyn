import { NextRequest } from 'next/server'
import { MongoClient, Db } from 'mongodb'
import { authenticateUser, requireAuth } from '@/lib/middleware/auth'
import { setupTestDb, teardownTestDb, clearTestDb } from '../../utils/test-db'
import { generateTestWallet, signMessage, mockRequest } from '../../utils/test-helpers'

// Mock the auth and mongodb modules
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn()
}))

jest.mock('@/lib/mongodb', () => {
  let testDb: Db
  
  return {
    getDatabase: jest.fn(async () => {
      if (!testDb) {
        throw new Error('Test database not initialized')
      }
      return testDb
    }),
    __setTestDb: (db: Db) => {
      testDb = db
    }
  }
})

describe('Authentication Middleware', () => {
  let client: MongoClient
  let db: Db
  let testWallet: { publicKey: string; secretKey: Uint8Array }

  beforeAll(async () => {
    const testDbSetup = await setupTestDb()
    client = testDbSetup.client
    db = testDbSetup.db
    
    // Set the test database for the mocked module
    const mongodb = require('@/lib/mongodb')
    mongodb.__setTestDb(db)
    
    testWallet = generateTestWallet()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
    jest.clearAllMocks()
  })

  describe('authenticateUser', () => {
    it('should return null when no authorization header is present', async () => {
      const req = mockRequest() as NextRequest
      
      const result = await authenticateUser(req)
      
      expect(result).toBeNull()
    })

    it('should return null when authorization header is malformed', async () => {
      const req = mockRequest({
        headers: { authorization: 'InvalidFormat token' }
      }) as NextRequest
      
      const result = await authenticateUser(req)
      
      expect(result).toBeNull()
    })

    it('should return null when token is invalid', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockResolvedValue(null)
      
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      }) as NextRequest
      
      const result = await authenticateUser(req)
      
      expect(result).toBeNull()
      expect(getCurrentUser).toHaveBeenCalledWith(req)
    })

    it('should return user data when token is valid', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      const mockUser = {
        id: 'user-123',
        walletAddress: testWallet.publicKey,
        tokenBalance: 1000,
        hasTokenAccess: true,
        questionsAsked: 5
      }
      getCurrentUser.mockResolvedValue(mockUser)
      
      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as NextRequest
      
      const result = await authenticateUser(req)
      
      expect(result).toEqual({
        userId: mockUser.id,
        walletAddress: mockUser.walletAddress
      })
    })

    it('should handle authentication errors gracefully', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockRejectedValue(new Error('Authentication error'))
      
      const req = mockRequest({
        headers: { authorization: 'Bearer error-token' }
      }) as NextRequest
      
      const result = await authenticateUser(req)
      
      expect(result).toBeNull()
    })

    it('should extract token from Bearer format correctly', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockResolvedValue({
        id: 'user-123',
        walletAddress: testWallet.publicKey
      })
      
      const testToken = 'test-jwt-token-123'
      const req = mockRequest({
        headers: { authorization: `Bearer ${testToken}` }
      }) as NextRequest
      
      await authenticateUser(req)
      
      expect(getCurrentUser).toHaveBeenCalledWith(req)
    })
  })

  describe('requireAuth', () => {
    it('should call handler when authentication succeeds', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      const mockUser = {
        id: 'user-123',
        walletAddress: testWallet.publicKey,
        tokenBalance: 1000,
        hasTokenAccess: true
      }
      getCurrentUser.mockResolvedValue(mockUser)
      
      const mockHandler = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
      
      const authenticatedHandler = requireAuth(mockHandler)
      
      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as NextRequest
      
      const response = await authenticatedHandler(req)
      
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            userId: mockUser.id,
            walletAddress: mockUser.walletAddress
          }
        }),
        {
          userId: mockUser.id,
          walletAddress: mockUser.walletAddress
        }
      )
      
      expect(response.status).toBe(200)
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
    })

    it('should return 401 when authentication fails', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockResolvedValue(null)
      
      const mockHandler = jest.fn()
      const authenticatedHandler = requireAuth(mockHandler)
      
      const req = mockRequest() as NextRequest
      
      const response = await authenticatedHandler(req)
      
      expect(response.status).toBe(401)
      const responseData = await response.json()
      expect(responseData.error).toBe('Authentication required')
      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should return 401 when no authorization header is present', async () => {
      const mockHandler = jest.fn()
      const authenticatedHandler = requireAuth(mockHandler)
      
      const req = mockRequest() as NextRequest
      
      const response = await authenticatedHandler(req)
      
      expect(response.status).toBe(401)
      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should handle handler errors gracefully', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockResolvedValue({
        id: 'user-123',
        walletAddress: testWallet.publicKey
      })
      
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'))
      const authenticatedHandler = requireAuth(mockHandler)
      
      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as NextRequest
      
      await expect(authenticatedHandler(req)).rejects.toThrow('Handler error')
    })

    it('should preserve request object properties', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      const mockUser = {
        id: 'user-123',
        walletAddress: testWallet.publicKey
      }
      getCurrentUser.mockResolvedValue(mockUser)
      
      const mockHandler = jest.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )
      
      const authenticatedHandler = requireAuth(mockHandler)
      
      const originalReq = mockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/test',
        headers: { 
          authorization: 'Bearer valid-token',
          'content-type': 'application/json'
        }
      }) as NextRequest
      
      await authenticatedHandler(originalReq)
      
      const calledRequest = mockHandler.mock.calls[0][0]
      expect(calledRequest.method).toBe('POST')
      expect(calledRequest.url).toBe('http://localhost:3000/api/test')
      expect(calledRequest.headers.get('content-type')).toBe('application/json')
      expect(calledRequest.user).toEqual({
        userId: mockUser.id,
        walletAddress: mockUser.walletAddress
      })
    })

    it('should work with different response types', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockResolvedValue({
        id: 'user-123',
        walletAddress: testWallet.publicKey
      })
      
      // Test with JSON response
      const jsonHandler = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      
      const authenticatedJsonHandler = requireAuth(jsonHandler)
      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as NextRequest
      
      const jsonResponse = await authenticatedJsonHandler(req)
      expect(jsonResponse.status).toBe(200)
      expect(jsonResponse.headers.get('Content-Type')).toBe('application/json')
      
      // Test with text response
      const textHandler = jest.fn().mockResolvedValue(
        new Response('Plain text response', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        })
      )
      
      const authenticatedTextHandler = requireAuth(textHandler)
      const textResponse = await authenticatedTextHandler(req)
      expect(textResponse.status).toBe(200)
      expect(textResponse.headers.get('Content-Type')).toBe('text/plain')
    })

    it('should handle concurrent authentication requests', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockResolvedValue({
        id: 'user-123',
        walletAddress: testWallet.publicKey
      })
      
      const mockHandler = jest.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )
      
      const authenticatedHandler = requireAuth(mockHandler)
      
      const requests = Array.from({ length: 5 }, () =>
        mockRequest({
          headers: { authorization: 'Bearer valid-token' }
        }) as NextRequest
      )
      
      const responses = await Promise.all(
        requests.map(req => authenticatedHandler(req))
      )
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      expect(mockHandler).toHaveBeenCalledTimes(5)
    })
  })

  describe('Token Extraction', () => {
    it('should extract token from Authorization header correctly', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      const testCases = [
        'Bearer token123',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'Bearer a-very-long-token-string-with-many-characters'
      ]
      
      for (const authHeader of testCases) {
        getCurrentUser.mockResolvedValue({
          id: 'user-123',
          walletAddress: testWallet.publicKey
        })
        
        const req = mockRequest({
          headers: { authorization: authHeader }
        }) as NextRequest
        
        const result = await authenticateUser(req)
        
        expect(result).not.toBeNull()
        expect(getCurrentUser).toHaveBeenCalledWith(req)
        
        getCurrentUser.mockReset()
      }
    })

    it('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'Basic token123',
        'Bearer',
        'token123',
        'Bearer ',
        'BEARER token123',
        'bearer token123'
      ]
      
      for (const authHeader of malformedHeaders) {
        const req = mockRequest({
          headers: { authorization: authHeader }
        }) as NextRequest
        
        const result = await authenticateUser(req)
        
        if (authHeader === 'Bearer' || authHeader === 'Bearer ') {
          // These should still try to authenticate with empty/undefined token
          expect(result).toBeNull()
        } else {
          expect(result).toBeNull()
        }
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors during authentication', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockRejectedValue(new Error('Network timeout'))
      
      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as NextRequest
      
      const result = await authenticateUser(req)
      
      expect(result).toBeNull()
    })

    it('should handle database connection errors', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockRejectedValue(new Error('Database connection failed'))
      
      const mockHandler = jest.fn()
      const authenticatedHandler = requireAuth(mockHandler)
      
      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as NextRequest
      
      const response = await authenticatedHandler(req)
      
      expect(response.status).toBe(401)
      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should handle malformed JWT tokens', async () => {
      const { getCurrentUser } = require('@/lib/auth')
      getCurrentUser.mockRejectedValue(new Error('JsonWebTokenError: invalid token'))
      
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid.jwt.token' }
      }) as NextRequest
      
      const result = await authenticateUser(req)
      
      expect(result).toBeNull()
    })
  })
})