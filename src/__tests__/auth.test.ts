/**
 * Authentication System Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { verifyWalletSignature, generateNonce, createToken, verifyToken } from '@/lib/auth'
import { db } from '@/lib/mongodb'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Keypair } from '@solana/web3.js'

// Mock MongoDB
jest.mock('@/lib/mongodb', () => ({
  db: {
    users: {
      findByWalletAddress: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateNonce: jest.fn()
    },
    sessions: {
      create: jest.fn(),
      findByToken: jest.fn(),
      deleteByToken: jest.fn(),
      updateExpiry: jest.fn()
    }
  }
}))

describe('Authentication System', () => {
  let keypair: Keypair
  let walletAddress: string
  
  beforeEach(() => {
    jest.clearAllMocks()
    keypair = Keypair.generate()
    walletAddress = keypair.publicKey.toString()
  })

  describe('Wallet Signature Verification', () => {
    it('should verify valid signature', () => {
      const message = 'Test message'
      const messageBytes = new TextEncoder().encode(message)
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey)
      const signatureBase58 = bs58.encode(signature)
      
      const isValid = verifyWalletSignature(message, signatureBase58, walletAddress)
      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const message = 'Test message'
      const invalidSignature = bs58.encode(new Uint8Array(64)) // Invalid signature
      
      const isValid = verifyWalletSignature(message, invalidSignature, walletAddress)
      expect(isValid).toBe(false)
    })

    it('should reject signature for different message', () => {
      const message = 'Original message'
      const messageBytes = new TextEncoder().encode(message)
      const signature = nacl.sign.detached(messageBytes, keypair.secretKey)
      const signatureBase58 = bs58.encode(signature)
      
      const isValid = verifyWalletSignature('Different message', signatureBase58, walletAddress)
      expect(isValid).toBe(false)
    })
  })

  describe('Nonce Generation', () => {
    it('should generate unique nonces', () => {
      const nonce1 = generateNonce()
      const nonce2 = generateNonce()
      
      expect(nonce1).toContain('Sign this message to authenticate with LYN AI:')
      expect(nonce2).toContain('Sign this message to authenticate with LYN AI:')
      expect(nonce1).not.toBe(nonce2)
    })
  })

  describe('JWT Token Management', () => {
    const mockUser = {
      id: 'user123',
      walletAddress: 'wallet123',
      tokenBalance: 1000,
      hasTokenAccess: true,
      questionsAsked: 0
    }

    it('should create valid JWT token', () => {
      const token = createToken(mockUser)
      
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT format
    })

    it('should verify valid token', () => {
      const token = createToken(mockUser)
      const payload = verifyToken(token)
      
      expect(payload).toBeTruthy()
      expect(payload?.userId).toBe(mockUser.id)
      expect(payload?.walletAddress).toBe(mockUser.walletAddress)
    })

    it('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here'
      const payload = verifyToken(invalidToken)
      
      expect(payload).toBeNull()
    })

    it('should include expiration in token', () => {
      const token = createToken(mockUser)
      const payload = verifyToken(token)
      
      expect(payload?.exp).toBeTruthy()
      expect(payload?.exp).toBeGreaterThan(Date.now() / 1000)
    })
  })

  describe('Session Management', () => {
    it('should normalize tokens in session operations', async () => {
      const token = '  test-token  '
      const normalizedToken = 'test-token'
      
      // Mock session creation
      await db.sessions.create({
        userId: 'user123',
        token: token,
        expiresAt: new Date(Date.now() + 86400000)
      })
      
      expect(db.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          token: normalizedToken
        })
      )
    })
  })
})