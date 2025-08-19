/**
 * Authentication and authorization system
 */

import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { PublicKey } from '@solana/web3.js'
import { config } from './config'
import { db } from './mongodb'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export interface AuthUser {
  id: string
  walletAddress: string
  tokenBalance: number
  hasTokenAccess: boolean
  questionsAsked: number
}

export interface JWTPayload {
  userId: string
  walletAddress: string
  iat: number
  exp: number
}

/**
 * Verify a Solana wallet signature
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = bs58.decode(signature)
    const publicKeyBytes = new PublicKey(publicKey).toBytes()

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

/**
 * Generate a nonce for wallet authentication
 */
export function generateNonce(): string {
  return `Sign this message to authenticate with LYN AI: ${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Create a JWT token for authenticated user
 */
export function createToken(user: AuthUser): string {
  const payload: JWTPayload = {
    userId: user.id,
    walletAddress: user.walletAddress,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  }

  return jwt.sign(payload, config.security.jwtSecret)
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, config.security.jwtSecret) as JWTPayload
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

/**
 * Extract authentication token from request
 */
export function extractToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Check cookie
  const tokenCookie = request.cookies.get('auth-token')
  if (tokenCookie) {
    return tokenCookie.value
  }

  return null
}

/**
 * Get current user from request
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const token = extractToken(request)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  // Check if session exists in database
  const session = await db.sessions.findByToken(token)
  if (!session || session.expiresAt < new Date()) {
    return null
  }

  // Get user data
  const user = await db.users.findByWalletAddress(payload.walletAddress)
  if (!user) return null

  return {
    id: user._id!.toString(),
    walletAddress: user.walletAddress,
    tokenBalance: user.tokenBalance,
    hasTokenAccess: user.hasTokenAccess,
    questionsAsked: 0, // This will be tracked separately in analytics
  }
}

/**
 * Require authentication middleware
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: AuthUser
  error?: never
} | {
  user?: never
  error: { message: string; status: number }
} | {
  user: AuthUser
  error: { message: string; status: number }
}> {
  const user = await getCurrentUser(request)
  
  if (!user) {
    // For anonymous users, create a session-based user
    const sessionId = request.headers.get('x-session-id') || 
                     request.cookies.get('sessionId')?.value ||
                     `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // Return a session-based user for anonymous access
    const anonymousUser: AuthUser = {
      id: sessionId,
      walletAddress: '',
      tokenBalance: 0,
      hasTokenAccess: false,
      questionsAsked: 0
    }
    
    // Return both user and error to indicate anonymous access
    return {
      user: anonymousUser,
      error: {
        message: 'Authentication required',
        status: 401,
      },
    }
  }

  return { user }
}

/**
 * Check if user has token access
 */
export function requireTokenAccess(user: AuthUser): boolean {
  return user.hasTokenAccess
}

/**
 * Check rate limiting for user
 */
export async function checkUserRateLimit(
  userId: string,
  action: string,
  windowMs: number = 60 * 1000, // 1 minute
  maxRequests: number = config.security.rateLimitPerMinute
): Promise<{
  allowed: boolean
  count: number
  resetTime: Date
}> {
  const key = `user:${userId}:${action}`
  const result = await db.rateLimit.increment(key, windowMs)
  
  return {
    allowed: result.count <= maxRequests,
    count: result.count,
    resetTime: result.expiresAt
  }
}

/**
 * Check rate limiting for IP address
 */
export async function checkIPRateLimit(
  request: NextRequest,
  action: string,
  windowMs: number = 60 * 1000, // 1 minute
  maxRequests: number = config.security.rateLimitPerMinute
): Promise<{
  allowed: boolean
  count: number
  resetTime: Date
}> {
  const ip = getClientIP(request)
  const key = `ip:${ip}:${action}`
  const result = await db.rateLimit.increment(key, windowMs)
  
  return {
    allowed: result.count <= maxRequests,
    count: result.count,
    resetTime: result.expiresAt
  }
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(rateLimit: {
  count: number
  resetTime: Date
}, maxRequests: number) {
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, maxRequests - rateLimit.count).toString(),
    'X-RateLimit-Reset': Math.floor(rateLimit.resetTime.getTime() / 1000).toString(),
  }
}

/**
 * Authentication flow for wallet connection
 */
export const walletAuth = {
  /**
   * Step 1: Request nonce for wallet signature
   */
  async requestNonce(walletAddress: string): Promise<{
    nonce: string
    message: string
  }> {
    // Validate wallet address
    try {
      new PublicKey(walletAddress)
    } catch {
      throw new Error('Invalid wallet address')
    }

    const nonce = generateNonce()
    
    // Update or create user with new nonce
    await db.users.updateNonce(walletAddress, nonce)

    return {
      nonce,
      message: nonce,
    }
  },

  /**
   * Step 2: Verify signature and create session
   */
  async verifyAndLogin(
    walletAddress: string,
    signature: string,
    message: string
  ): Promise<{
    token: string
    user: AuthUser
  }> {
    // Get user from database
    let user = await db.users.findByWalletAddress(walletAddress)
    if (!user) {
      throw new Error('Nonce not found. Please request nonce first.')
    }

    // Verify signature
    if (!verifyWalletSignature(message, signature, walletAddress)) {
      throw new Error('Invalid signature')
    }

    // Verify message matches nonce
    if (message !== user.nonce) {
      throw new Error('Invalid nonce')
    }

    // Update last login
    user = await db.users.update(user._id!.toString(), {
      lastLoginAt: new Date()
    })

    if (!user) {
      throw new Error('Failed to update user')
    }

    // Create JWT token
    const authUser: AuthUser = {
      id: user._id!.toString(),
      walletAddress: user.walletAddress,
      tokenBalance: user.tokenBalance,
      hasTokenAccess: user.hasTokenAccess,
      questionsAsked: 0, // Tracked separately in analytics
    }

    const token = createToken(authUser)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create session in database
    await db.sessions.create({
      userId: user._id!.toString(),
      token,
      expiresAt
    })

    // Generate new nonce for next login
    await db.users.updateNonce(walletAddress, generateNonce())

    // Log authentication event
    await db.audit.log({
      userId: user._id!.toString(),
      action: 'wallet_login',
      resource: 'authentication',
      details: { walletAddress },
    })

    return {
      token,
      user: authUser,
    }
  },

  /**
   * Logout and invalidate session
   */
  async logout(token: string): Promise<void> {
    await db.sessions.deleteByToken(token)
    
    await db.audit.log({
      action: 'logout',
      resource: 'authentication',
      details: { token: token.substring(0, 10) + '...' },
    })
  },
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await db.sessions.deleteExpired()
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}