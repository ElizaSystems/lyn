/**
 * Input validation schemas and utilities
 */

import { z } from 'zod'
import { PublicKey } from '@solana/web3.js'

// Solana wallet address validation
const walletAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .refine((address) => {
    try {
      new PublicKey(address)
      return true
    } catch {
      return false
    }
  }, 'Invalid Solana wallet address')

// URL validation for phishing detection
const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .max(2048, 'URL too long')
  .refine((url) => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
      return true
    } catch {
      return false
    }
  }, 'Invalid URL format')

// File validation
const fileValidationSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().min(1).max(50 * 1024 * 1024), // 50MB max
  type: z.string().refine((type) => {
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/javascript',
      'application/javascript',
      'text/html',
      'text/xml',
      'application/xml',
      'text/csv',
    ]
    return allowedTypes.includes(type)
  }, 'File type not allowed'),
})

// Authentication schemas
export const authSchemas = {
  nonce: z.object({
    walletAddress: walletAddressSchema,
  }),

  login: z.object({
    walletAddress: walletAddressSchema,
    signature: z.string().min(1, 'Signature is required'),
    message: z.string().min(1, 'Message is required'),
  }),
}

// Security analysis schemas
export const securitySchemas = {
  analyzeLink: z.object({
    url: urlSchema,
    sessionId: z.string().optional(),
  }),

  analyzeDocument: z.object({
    file: z.any().refine((file) => file instanceof File, 'Valid file is required'),
    sessionId: z.string().optional(),
  }).refine((data) => {
    const file = data.file as File
    const validation = fileValidationSchema.safeParse({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    return validation.success
  }, 'Invalid file'),

  chat: z.object({
    message: z.string().min(1, 'Message is required').max(4000, 'Message too long'),
    sessionId: z.string().min(1, 'Session ID is required'),
    walletAddress: walletAddressSchema.optional(),
  }),

  checkAccess: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    walletAddress: walletAddressSchema.optional(),
  }),
}

// Wallet and blockchain schemas
export const walletSchemas = {
  balance: z.object({
    walletAddress: walletAddressSchema,
  }),

  transactions: z.object({
    walletAddress: walletAddressSchema,
    limit: z.number().min(1).max(100).optional().default(10),
  }),

  tokens: z.object({
    walletAddress: walletAddressSchema,
  }),
}

// Task automation schemas
export const taskSchemas = {
  create: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
    type: z.enum(['SECURITY_SCAN', 'WALLET_MONITOR', 'PRICE_ALERT', 'AUTO_TRADE']),
    frequency: z.string().min(1, 'Frequency is required'),
    config: z.object({}).passthrough(),
  }),

  update: z.object({
    id: z.string().cuid(),
    updates: z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().min(1).max(500).optional(),
      frequency: z.string().min(1).optional(),
      config: z.object({}).passthrough().optional(),
    }),
  }),

  toggle: z.object({
    id: z.string().cuid(),
  }),

  delete: z.object({
    id: z.string().cuid(),
  }),
}

// Terminal schemas
export const terminalSchemas = {
  execute: z.object({
    command: z.string().min(1, 'Command is required').max(1000, 'Command too long'),
    sessionId: z.string().optional(),
  }),
}

// Analytics schemas
export const analyticsSchemas = {
  metrics: z.object({
    range: z.enum(['24h', '7d', '30d', '90d']).default('7d'),
  }),
}

// Common utility functions
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/data:/gi, '') // Remove data: protocols
    .substring(0, 10000) // Limit length
}

export function sanitizeUrl(url: string): string {
  const sanitized = sanitizeInput(url)
  
  // Ensure URL has protocol
  if (!sanitized.match(/^https?:\/\//)) {
    return `https://${sanitized}`
  }
  
  return sanitized
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s.-]/g, '') // Remove special characters except dots, spaces, hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 255) // Limit length
}

// Rate limiting for different actions
export const rateLimits = {
  auth: {
    nonce: { windowMs: 60 * 1000, maxRequests: 10 },
    login: { windowMs: 60 * 1000, maxRequests: 5 },
  },
  security: {
    analyze: { windowMs: 60 * 1000, maxRequests: 20 },
    chat: { windowMs: 60 * 1000, maxRequests: 30 },
    checkAccess: { windowMs: 60 * 1000, maxRequests: 30 },
  },
  wallet: {
    balance: { windowMs: 60 * 1000, maxRequests: 60 },
    transactions: { windowMs: 60 * 1000, maxRequests: 30 },
    tokens: { windowMs: 60 * 1000, maxRequests: 30 },
  },
  tasks: {
    crud: { windowMs: 60 * 1000, maxRequests: 60 },
  },
  terminal: {
    execute: { windowMs: 60 * 1000, maxRequests: 100 },
  },
  analytics: {
    metrics: { windowMs: 60 * 1000, maxRequests: 120 },
  },
}

// Security headers for different content types
export const securityHeaders = {
  json: {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  },
  html: {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  },
  file: {
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'attachment',
  },
}