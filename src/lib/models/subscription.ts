import { ObjectId } from 'mongodb'

// Subscription Tiers
export enum SubscriptionTier {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

// Payment Tokens
export enum PaymentToken {
  SOL = 'SOL',
  USDC = 'USDC'
}

// Subscription Status
export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

// Payment Status
export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled'
}

// Payment Method
export enum PaymentMethod {
  CRYPTO_TRANSFER = 'crypto_transfer',
  SUBSCRIPTION_RENEWAL = 'subscription_renewal'
}

// Pricing configuration for different tiers
export interface TierPricing {
  tier: SubscriptionTier
  name: string
  description: string
  features: string[]
  pricing: {
    monthly: {
      [PaymentToken.SOL]: number
      [PaymentToken.USDC]: number
    }
    yearly: {
      [PaymentToken.SOL]: number
      [PaymentToken.USDC]: number
      discountPercent: number
    }
  }
  limits: {
    maxScans?: number
    maxWallets?: number
    maxTasks?: number
    apiCallsPerMonth?: number
    prioritySupport?: boolean
    customIntegrations?: boolean
  }
}

// Enhanced Subscription interface
export interface Subscription {
  _id?: ObjectId
  walletAddress: string
  userId?: string
  username?: string
  
  // Subscription details
  tier: SubscriptionTier
  status: SubscriptionStatus
  paymentToken: PaymentToken
  
  // Dates and duration
  startDate: Date
  endDate: Date
  billingCycle: 'monthly' | 'yearly'
  
  // Payment information
  amount: number // Amount paid in the selected token
  amountUsd?: number // USD equivalent at time of payment
  paymentReference: string // Unique payment reference
  transactionSignature: string
  paymentMethod: PaymentMethod
  
  // Auto-renewal settings
  autoRenewal: boolean
  nextBillingDate?: Date
  gracePeriodEnd?: Date
  
  // Referral information
  referralCode?: string
  referrerWallet?: string
  tier1RewardAmount?: number
  tier2RewardAmount?: number
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  cancelledAt?: Date
  suspendedAt?: Date
  lastPaymentAt?: Date
  
  // Usage tracking
  usageStats?: {
    scansUsed: number
    apiCallsUsed: number
    lastResetDate: Date
  }
}

// Payment Transaction record
export interface PaymentTransaction {
  _id?: ObjectId
  paymentReference: string
  subscriptionId?: ObjectId
  walletAddress: string
  
  // Payment details
  amount: number
  token: PaymentToken
  amountUsd?: number
  transactionSignature: string
  blockNumber?: number
  blockTimestamp?: Date
  
  // Status and metadata
  status: PaymentStatus
  paymentMethod: PaymentMethod
  description: string
  
  // Fee information
  networkFee?: number
  platformFee?: number
  referralFees?: {
    tier1: number
    tier2: number
  }
  
  // Retry and failure handling
  retryCount: number
  lastRetryAt?: Date
  failureReason?: string
  
  // Timestamps
  initiatedAt: Date
  confirmedAt?: Date
  failedAt?: Date
  refundedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Payment Invoice
export interface PaymentInvoice {
  _id?: ObjectId
  invoiceNumber: string
  paymentReference: string
  subscriptionId: ObjectId
  transactionId: ObjectId
  walletAddress: string
  
  // Invoice details
  customerInfo: {
    walletAddress: string
    username?: string
    email?: string
  }
  
  // Billing information
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    token: PaymentToken
    total: number
  }>
  
  subtotal: number
  fees: number
  total: number
  token: PaymentToken
  amountUsd?: number
  
  // Dates
  issueDate: Date
  dueDate: Date
  paidDate?: Date
  
  // Status
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  
  createdAt: Date
  updatedAt: Date
}

// Refund Request
export interface RefundRequest {
  _id?: ObjectId
  refundReference: string
  originalPaymentReference: string
  subscriptionId: ObjectId
  transactionId: ObjectId
  walletAddress: string
  
  // Refund details
  reason: 'service_failure' | 'user_request' | 'chargeback' | 'error' | 'other'
  description: string
  refundAmount: number
  refundToken: PaymentToken
  
  // Status and processing
  status: 'pending' | 'approved' | 'processed' | 'rejected' | 'failed'
  approvedBy?: string
  processedBy?: string
  
  // Refund transaction details
  refundTransactionSignature?: string
  refundProcessedAt?: Date
  
  // Metadata
  requestedAt: Date
  reviewedAt?: Date
  processedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Webhook Event
export interface WebhookEvent {
  _id?: ObjectId
  eventId: string
  eventType: 'payment.confirmed' | 'payment.failed' | 'subscription.created' | 'subscription.renewed' | 'subscription.cancelled' | 'subscription.expired' | 'refund.processed'
  
  // Event data
  data: {
    subscriptionId?: ObjectId
    paymentReference?: string
    transactionId?: ObjectId
    walletAddress: string
    amount?: number
    token?: PaymentToken
    [key: string]: any
  }
  
  // Delivery information
  webhookUrl?: string
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'retrying'
  deliveryAttempts: number
  lastDeliveryAttempt?: Date
  responseCode?: number
  responseBody?: string
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  deliveredAt?: Date
}

// Payment Configuration
export interface PaymentConfig {
  tiers: TierPricing[]
  wallets: {
    treasury: string
    agent: string
    fees: string
  }
  tokens: {
    [PaymentToken.SOL]: {
      mintAddress?: string
      decimals: number
      symbol: string
      name: string
    }
    [PaymentToken.USDC]: {
      mintAddress: string
      decimals: number
      symbol: string
      name: string
    }
  }
  fees: {
    platformFeePercent: number
    referralTier1Percent: number
    referralTier2Percent: number
  }
  limits: {
    maxRetries: number
    paymentTimeoutMinutes: number
    gracePeriodDays: number
  }
}

// Usage analytics
export interface SubscriptionAnalytics {
  totalSubscriptions: number
  activeSubscriptions: number
  expiredSubscriptions: number
  cancelledSubscriptions: number
  
  // Revenue analytics
  totalRevenue: {
    [PaymentToken.SOL]: number
    [PaymentToken.USDC]: number
    usd: number
  }
  
  // Tier analytics
  tierDistribution: {
    [key in SubscriptionTier]: number
  }
  
  // Payment analytics
  averageSubscriptionValue: {
    [PaymentToken.SOL]: number
    [PaymentToken.USDC]: number
    usd: number
  }
  
  // Time analytics
  averageSubscriptionLength: number
  churnRate: number
  renewalRate: number
  
  // Referral analytics
  totalReferralRewards: {
    [PaymentToken.SOL]: number
    [PaymentToken.USDC]: number
    usd: number
  }
}