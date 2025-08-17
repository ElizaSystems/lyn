import { PublicKey, Keypair } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export function generateTestWallet() {
  const keypair = Keypair.generate()
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey
  }
}

export function signMessage(message: string, secretKey: Uint8Array): string {
  const messageBytes = new TextEncoder().encode(message)
  const signature = nacl.sign.detached(messageBytes, secretKey)
  return bs58.encode(signature)
}

export function createTestUser(overrides: Partial<any> = {}) {
  const wallet = generateTestWallet()
  return {
    walletAddress: wallet.publicKey,
    publicKey: wallet.publicKey,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      theme: 'system',
      notifications: true,
      autoRefresh: true
    },
    ...overrides
  }
}

export function createTestTask(userId: string, overrides: Partial<any> = {}) {
  return {
    userId,
    name: 'Test Task',
    description: 'A test task for automation',
    status: 'active',
    type: 'security-scan',
    frequency: 'Every 24 hours',
    lastRun: new Date(),
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
    successRate: 100,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function createTestSession(userId: string, token: string, overrides: Partial<any> = {}) {
  return {
    userId,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides
  }
}

export function mockRequest(options: {
  method?: string
  headers?: Record<string, string>
  body?: any
  url?: string
} = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    url = 'http://localhost:3000/api/test'
  } = options

  return {
    method,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
      ...headers
    },
    json: () => Promise.resolve(body),
    url,
    cookies: {
      get: (name: string) => ({ value: headers[`cookie-${name}`] }),
    },
    ip: '127.0.0.1'
  } as any
}

export function expectValidObjectId(id: any) {
  expect(typeof id).toBe('object')
  expect(id.toString()).toMatch(/^[0-9a-fA-F]{24}$/)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}