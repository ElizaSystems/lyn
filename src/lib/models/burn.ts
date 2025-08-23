import { ObjectId } from 'mongodb'

export interface BurnRecord {
  _id?: ObjectId
  walletAddress: string
  username?: string
  userId?: ObjectId | string
  amount: number
  type: 'username_registration' | 'feature_unlock' | 'community_event' | 'manual' | 'other'
  transactionSignature: string
  description?: string
  metadata?: {
    featureName?: string
    referralCode?: string
    referrerId?: string
    eventName?: string
    // On-chain verification metadata
    blockTime?: string
    slot?: number
    confirmations?: number
    fee?: number
    burnAddress?: string
    tokenMint?: string
    verifiedAt?: string
    manual?: boolean
  }
  timestamp: Date
  blockHeight?: number
  verified: boolean
  // On-chain verification fields
  verificationStatus?: 'pending' | 'verified' | 'failed'
  verificationAttempts?: number
  lastVerificationAttempt?: Date
  onChainAmount?: number  // Amount verified on-chain (may differ from reported amount)
}

export interface BurnStats {
  totalBurned: number
  burnCount: number
  lastBurnDate: Date | null
  largestBurn: number
  averageBurn: number
}

export interface BurnLeaderboardEntry {
  rank: number
  walletAddress: string
  username?: string
  totalBurned: number
  burnCount: number
  largestBurn: number
  lastBurnDate: Date
  badges?: string[]
}

export interface GlobalBurnStats {
  totalBurned: number
  totalBurnEvents: number
  uniqueBurners: number
  burnRate: {
    daily: number
    weekly: number
    monthly: number
  }
  topBurners: BurnLeaderboardEntry[]
  recentBurns: BurnRecord[]
  burnsByType: Record<string, number>
  verificationStats?: {
    verified: number
    pending: number
    failed: number
    totalOnChainBurned: number
  }
}

export interface BurnVerificationRequest {
  transactionSignature: string
  walletAddress: string
  expectedAmount?: number
  type?: BurnRecord['type']
  description?: string
}

export interface BurnVerificationResponse {
  success: boolean
  verified: boolean
  burnRecord?: BurnRecord
  onChainAmount?: number
  confirmations?: number
  error?: string
  retryAfter?: number  // seconds to wait before retrying
}

export interface BurnMonitoringStats {
  isActive: boolean
  lastScanTime?: Date
  nextScanTime?: Date
  totalScanned: number
  newBurnsFound: number
  verifiedBurns: number
  failedVerifications: number
  pendingBurns: number
  errors: string[]
}