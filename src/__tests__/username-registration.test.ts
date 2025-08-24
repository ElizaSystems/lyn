import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST as registerUsername } from '@/app/api/user/register-username/route'
import { GET as checkUsername } from '@/app/api/user/register-username/route'
import { GET as getAuthMe } from '@/app/api/auth/me/route'
import { getDatabase } from '@/lib/mongodb'
import jwt from 'jsonwebtoken'

// Mock dependencies
jest.mock('@/lib/mongodb')
jest.mock('@/lib/solana', () => ({
  getTokenBalance: jest.fn().mockResolvedValue(15000), // Mock sufficient balance
  connection: {}
}))
jest.mock('@/lib/solana-burn', () => ({
  verifyBurnTransaction: jest.fn().mockResolvedValue(true) // Mock successful burn verification
}))
jest.mock('@/lib/services/burn-service', () => ({
  BurnService: {
    recordBurn: jest.fn().mockResolvedValue({ _id: 'burn123' })
  }
}))
jest.mock('@/lib/services/referral-service-v2', () => ({
  ReferralServiceV2: {
    trackReferral: jest.fn().mockResolvedValue(true)
  }
}))

describe('Username Registration', () => {
  let mockDb: any
  let mockUsersCollection: any
  let mockSessionsCollection: any
  
  beforeEach(() => {
    // Setup mock database collections
    mockUsersCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn()
    }
    
    mockSessionsCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn()
    }
    
    mockDb = {
      collection: jest.fn((name: string) => {
        switch(name) {
          case 'users':
            return mockUsersCollection
          case 'sessions':
            return mockSessionsCollection
          case 'burn_validations':
          case 'burns':
          case 'referral_codes_v2':
          case 'user_reputation':
          case 'audit_logs':
            return {
              insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
              updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
            }
          default:
            return {
              findOne: jest.fn(),
              insertOne: jest.fn(),
              updateOne: jest.fn()
            }
        }
      })
    }
    
    ;(getDatabase as jest.Mock).mockResolvedValue(mockDb)
    
    // Mock JWT secret
    process.env.JWT_SECRET = 'test-secret'
  })
  
  afterEach(() => {
    jest.clearAllMocks()
  })
  
  describe('POST /api/user/register-username', () => {
    it('should successfully register a new username', async () => {
      const walletAddress = 'GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg'
      const username = 'testuser123'
      
      // Mock no existing user with this username
      mockUsersCollection.findOne.mockResolvedValueOnce(null)
      // Mock no existing username for this wallet
      mockUsersCollection.findOne.mockResolvedValueOnce(null)
      // Mock user creation
      mockUsersCollection.insertOne.mockResolvedValue({ insertedId: 'user123' })
      // Mock user retrieval after creation
      mockUsersCollection.findOne.mockResolvedValue({
        _id: 'user123',
        walletAddress,
        username,
        tokenBalance: 15000,
        hasTokenAccess: true
      })
      
      const request = new NextRequest('http://localhost:3000/api/user/register-username', {
        method: 'POST',
        body: JSON.stringify({
          username,
          walletAddress,
          signature: 'mock_signature',
          transaction: 'mock_signature'
        })
      })
      
      const response = await registerUsername(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.username).toBe(username)
      expect(data.token).toBeDefined()
      
      // Verify session was created
      expect(mockSessionsCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(String),
          token: expect.any(String),
          expiresAt: expect.any(Date)
        })
      )
      
      // Verify auth cookie was set
      const setCookieHeader = response.headers.get('set-cookie')
      expect(setCookieHeader).toContain('auth-token=')
    })
    
    it('should reject duplicate usernames', async () => {
      const walletAddress = 'GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg'
      const username = 'existinguser'
      
      // Mock existing user with this username
      mockUsersCollection.findOne.mockResolvedValueOnce({
        _id: 'existinguser123',
        username,
        walletAddress: 'different-wallet'
      })
      
      const request = new NextRequest('http://localhost:3000/api/user/register-username', {
        method: 'POST',
        body: JSON.stringify({
          username,
          walletAddress,
          signature: 'mock_signature',
          transaction: 'mock_signature'
        })
      })
      
      const response = await registerUsername(request)
      const data = await response.json()
      
      expect(response.status).toBe(409)
      expect(data.error).toBe('Username is already taken')
    })
    
    it('should update existing user with username', async () => {
      const walletAddress = 'GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg'
      const username = 'newusername'
      
      // Mock no existing user with this username
      mockUsersCollection.findOne.mockResolvedValueOnce(null)
      // Mock existing user without username
      mockUsersCollection.findOne.mockResolvedValueOnce({
        _id: 'user123',
        walletAddress,
        tokenBalance: 15000,
        hasTokenAccess: true
      })
      // Mock successful update
      mockUsersCollection.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
      // Mock user after update
      mockUsersCollection.findOne.mockResolvedValue({
        _id: 'user123',
        walletAddress,
        username,
        tokenBalance: 15000,
        hasTokenAccess: true
      })
      
      const request = new NextRequest('http://localhost:3000/api/user/register-username', {
        method: 'POST',
        body: JSON.stringify({
          username,
          walletAddress,
          signature: 'mock_signature',
          transaction: 'mock_signature'
        })
      })
      
      const response = await registerUsername(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.username).toBe(username)
      
      // Verify user was updated
      expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
        { walletAddress },
        expect.objectContaining({
          $set: expect.objectContaining({
            username,
            'profile.username': username
          })
        })
      )
    })
  })
  
  describe('GET /api/user/register-username', () => {
    it('should check username availability', async () => {
      const username = 'availableuser'
      
      // Mock no existing user
      mockUsersCollection.findOne.mockResolvedValue(null)
      
      const request = new NextRequest(`http://localhost:3000/api/user/register-username?username=${username}`)
      
      const response = await checkUsername(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.available).toBe(true)
      expect(data.username).toBe(username)
    })
    
    it('should detect taken usernames', async () => {
      const username = 'takenuser'
      
      // Mock existing user
      mockUsersCollection.findOne.mockResolvedValue({
        _id: 'user123',
        username
      })
      
      const request = new NextRequest(`http://localhost:3000/api/user/register-username?username=${username}`)
      
      const response = await checkUsername(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.available).toBe(false)
      expect(data.username).toBe(username)
    })
  })
  
  describe('Authentication Persistence', () => {
    it('should maintain auth state after registration', async () => {
      const walletAddress = 'GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg'
      const username = 'authtest'
      const userId = 'user123'
      
      // Create a valid JWT token
      const token = jwt.sign(
        { 
          userId,
          walletAddress,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        },
        process.env.JWT_SECRET!
      )
      
      // Mock session exists
      mockSessionsCollection.findOne.mockResolvedValue({
        userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })
      
      // Mock user with username
      mockUsersCollection.findOne.mockResolvedValue({
        _id: userId,
        walletAddress,
        username,
        tokenBalance: 15000,
        hasTokenAccess: true
      })
      
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'authorization': `Bearer ${token}`
        }
      })
      
      const response = await getAuthMe(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe(username)
      expect(data.user.walletAddress).toBe(walletAddress)
    })
    
    it('should retrieve username from database if missing in token', async () => {
      const walletAddress = 'GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg'
      const username = 'dbusername'
      
      // Mock user found by wallet address
      mockUsersCollection.findOne.mockResolvedValue({
        _id: 'user123',
        walletAddress,
        username,
        tokenBalance: 15000,
        hasTokenAccess: true
      })
      
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'x-wallet-address': walletAddress
        }
      })
      
      const response = await getAuthMe(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe(username)
    })
  })
  
  describe('Username Validation', () => {
    it('should reject invalid username formats', async () => {
      const testCases = [
        { username: 'ab', error: 'must be 3-20 characters' }, // Too short
        { username: 'a'.repeat(21), error: 'must be 3-20 characters' }, // Too long
        { username: 'user@name', error: 'must be 3-20 characters' }, // Invalid characters
        { username: 'user name', error: 'must be 3-20 characters' }, // Space
        { username: '', error: 'Username is required' } // Empty
      ]
      
      for (const testCase of testCases) {
        const request = new NextRequest('http://localhost:3000/api/user/register-username', {
          method: 'POST',
          body: JSON.stringify({
            username: testCase.username,
            walletAddress: 'GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg',
            signature: 'mock_signature',
            transaction: 'mock_signature'
          })
        })
        
        const response = await registerUsername(request)
        const data = await response.json()
        
        expect(response.status).toBe(400)
        expect(data.error).toContain(testCase.error)
      }
    })
    
    it('should accept valid username formats', async () => {
      const validUsernames = [
        'abc',           // Minimum length
        'a'.repeat(20),  // Maximum length
        'user_name',     // Underscore
        'user-name',     // Hyphen
        'User123',       // Mixed case and numbers
        '123user'        // Starting with number
      ]
      
      for (const username of validUsernames) {
        // Mock no existing user
        mockUsersCollection.findOne.mockResolvedValue(null)
        
        const request = new NextRequest(`http://localhost:3000/api/user/register-username?username=${username}`)
        const response = await checkUsername(request)
        const data = await response.json()
        
        expect(response.status).toBe(200)
        // If validation passes, it should check availability
        expect(data).toHaveProperty('available')
      }
    })
  })
})