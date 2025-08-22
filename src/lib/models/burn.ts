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
  }
  timestamp: Date
  blockHeight?: number
  verified: boolean
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
}