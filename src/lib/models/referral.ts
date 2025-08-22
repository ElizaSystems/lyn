import { ObjectId } from 'mongodb'

export interface ReferralCode {
  _id?: ObjectId
  userId: ObjectId | string // Owner of the referral code
  code: string // Unique referral code
  walletAddress: string // Wallet to receive rewards
  createdAt: Date
  updatedAt: Date
  
  // Stats
  totalReferrals: number // Total users who used this code
  totalBurned: number // Total LYN burned by referrals
  totalRewards: number // Total rewards earned (20% of burns)
  
  // Settings
  isActive: boolean
  customMessage?: string // Optional custom message for referrals
}

export interface ReferralRelationship {
  _id?: ObjectId
  referrerId: ObjectId | string // User who referred
  referredId: ObjectId | string // User who was referred
  referralCode: string
  createdAt: Date
  
  // Tracking
  registrationBurnAmount?: number // Amount burned for registration
  registrationBurnTx?: string
  totalBurnsByReferred: number // All burns by this referred user
  totalRewardsGenerated: number // 20% of totalBurnsByReferred
}

export interface ReferralReward {
  _id?: ObjectId
  referrerId: ObjectId | string
  referredId: ObjectId | string
  burnTransaction: string // The burn transaction that triggered this reward
  burnAmount: number // Amount burned
  rewardAmount: number // 20% of burn amount
  rewardType: 'registration' | 'feature' | 'other'
  
  // Payout info
  status: 'pending' | 'paid' | 'failed'
  payoutTransaction?: string // Transaction hash when paid
  paidAt?: Date
  
  createdAt: Date
}

export interface ReferralAnalytics {
  _id?: ObjectId
  userId: ObjectId | string
  period: 'daily' | 'weekly' | 'monthly' | 'all-time'
  date: Date
  
  // Metrics
  newReferrals: number
  activeReferrals: number // Referrals who burned tokens
  totalBurns: number
  totalRewards: number
  conversionRate: number // % of referrals who burned
  
  // Top performers
  topReferral?: {
    userId: string
    username?: string
    burned: number
    rewards: number
  }
  
  updatedAt: Date
}

// Helper types
export interface ReferralDashboard {
  referralCode: string
  referralLink: string
  stats: {
    totalReferrals: number
    activeReferrals: number
    totalBurned: number
    totalRewards: number
    pendingRewards: number
    paidRewards: number
    conversionRate: number
  }
  recentReferrals: Array<{
    username?: string
    walletAddress: string
    joinedAt: Date
    burned: number
    rewardsGenerated: number
  }>
  recentRewards: ReferralReward[]
  analytics: {
    daily: ReferralAnalytics[]
    weekly: ReferralAnalytics[]
    monthly: ReferralAnalytics[]
  }
}