import { ObjectId } from 'mongodb'

export interface User {
  _id?: ObjectId
  walletAddress: string
  publicKey: string
  createdAt: Date
  updatedAt: Date
  preferences?: {
    theme?: 'light' | 'dark' | 'system'
    notifications?: boolean
    autoRefresh?: boolean
  }
  profile?: {
    username?: string
    avatar?: string
    bio?: string
  }
}

export interface UserTask {
  _id?: ObjectId
  userId: ObjectId
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  type: 'security-scan' | 'wallet-monitor' | 'price-alert' | 'auto-trade'
  frequency: string
  lastRun?: Date
  nextRun?: Date | null
  successRate: number
  config?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UserWallet {
  _id?: ObjectId
  userId: ObjectId
  address: string
  name?: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserSession {
  _id?: ObjectId
  userId: ObjectId
  walletAddress: string
  signature: string
  nonce: string
  expiresAt: Date
  createdAt: Date
}