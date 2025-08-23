import { ObjectId } from 'mongodb'

export type ListType = 'whitelist' | 'blacklist'
export type ListVisibility = 'private' | 'public' | 'shared'
export type ListCategory = 
  | 'scam' 
  | 'phishing' 
  | 'rugpull' 
  | 'legitimate' 
  | 'partner' 
  | 'exchange' 
  | 'defi_protocol' 
  | 'verified_user'
  | 'suspicious'
  | 'bot'
  | 'mixer'
  | 'other'

export interface WalletListEntry {
  _id?: ObjectId
  walletAddress: string
  listType: ListType
  category: ListCategory
  reason: string
  evidence?: {
    transactionHashes?: string[]
    screenshots?: string[]
    urls?: string[]
    additionalInfo?: string
  }
  confidence: number // 0-100, confidence in the listing
  severity: 'low' | 'medium' | 'high' | 'critical'
  tags: string[] // Custom tags for filtering
  
  // Ownership and visibility
  ownerId: ObjectId // User who created this entry
  ownerAddress: string // Wallet address of the owner
  visibility: ListVisibility
  
  // Sharing and collaboration
  sharedWith?: ObjectId[] // Specific users this is shared with
  allowContributions: boolean // Whether others can suggest changes
  isGlobal: boolean // Admin-managed global list
  
  // Temporal data
  expiresAt?: Date // For temporary listings
  lastVerified?: Date // Last time this was verified
  verificationCount: number // How many times this has been verified
  
  // Community voting (for public lists)
  votes: {
    upvotes: number
    downvotes: number
    voters: Array<{
      userId: ObjectId
      walletAddress: string
      vote: 'up' | 'down'
      votedAt: Date
    }>
  }
  
  // Analytics
  timesQueried: number // How often this entry has been checked
  lastQueried?: Date
  reportCount: number // Number of reports for this wallet
  
  // Metadata
  source: string // Where this information came from
  createdAt: Date
  updatedAt: Date
  version: number // For versioning changes
}

export interface WalletList {
  _id?: ObjectId
  name: string
  description: string
  listType: ListType
  category: ListCategory[]
  
  // Ownership
  ownerId: ObjectId
  ownerAddress: string
  
  // Settings
  visibility: ListVisibility
  isActive: boolean
  allowVoting: boolean // Whether community can vote on entries
  requireVerification: boolean // Whether entries need verification
  
  // Sharing
  sharedWith: ObjectId[]
  collaborators: Array<{
    userId: ObjectId
    walletAddress: string
    permissions: ('read' | 'write' | 'admin')[]
    addedAt: Date
  }>
  
  // Statistics
  entryCount: number
  subscriberCount: number
  lastActivity: Date
  
  // Metadata
  tags: string[]
  source: string
  createdAt: Date
  updatedAt: Date
}

export interface ListSubscription {
  _id?: ObjectId
  userId: ObjectId
  walletAddress: string
  listId: ObjectId
  listOwnerId: ObjectId
  
  // Subscription settings
  autoSync: boolean // Whether to automatically sync updates
  notifyOnChanges: boolean
  priority: number // 1-10, higher priority lists checked first
  
  // Status
  isActive: boolean
  lastSynced?: Date
  syncCount: number
  
  createdAt: Date
  updatedAt: Date
}

export interface ListImportExportJob {
  _id?: ObjectId
  userId: ObjectId
  walletAddress: string
  listId?: ObjectId
  
  type: 'import' | 'export'
  format: 'json' | 'csv' | 'txt'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  
  // Job data
  fileName?: string
  fileSize?: number
  totalEntries?: number
  processedEntries?: number
  failedEntries?: number
  
  // Results
  resultUrl?: string // S3 URL for export files
  errors?: string[]
  warnings?: string[]
  
  // Processing details
  startedAt?: Date
  completedAt?: Date
  processingTime?: number
  
  createdAt: Date
  updatedAt: Date
}

export interface ListAnalytics {
  _id?: ObjectId
  listId?: ObjectId // null for global analytics
  ownerId?: ObjectId
  period: 'daily' | 'weekly' | 'monthly'
  date: Date
  
  // Usage metrics
  queriesCount: number
  uniqueQueryUsers: number
  entriesAdded: number
  entriesRemoved: number
  entriesUpdated: number
  
  // Community metrics
  votesReceived: number
  reportsReceived: number
  verificationsCount: number
  
  // Top categories/reasons
  topCategories: Array<{
    category: ListCategory
    count: number
  }>
  
  // Performance metrics
  averageQueryTime: number
  cacheHitRate: number
  
  createdAt: Date
}

export interface GlobalListConfig {
  _id?: ObjectId
  
  // Auto-blacklist settings
  autoBlacklistThreshold: number // Number of reports to auto-blacklist
  autoBlacklistCategories: ListCategory[]
  requireAdminApproval: boolean
  
  // Community voting settings
  votingEnabled: boolean
  minVotesForAction: number
  voteThresholdPercent: number // % of positive votes needed
  
  // Expiration settings
  defaultExpirationDays: Record<ListCategory, number>
  maxExpirationDays: number
  
  // Rate limiting
  maxEntriesPerUser: number
  maxListsPerUser: number
  rateLimitPerHour: number
  
  // Verification requirements
  requireVerificationForPublic: boolean
  minVerificationCount: number
  verificationExpiryDays: number
  
  updatedAt: Date
  updatedBy: ObjectId
}

// Query interfaces
export interface ListQuery {
  walletAddress?: string
  listType?: ListType
  category?: ListCategory
  ownerId?: ObjectId
  visibility?: ListVisibility
  isActive?: boolean
  tags?: string[]
  minConfidence?: number
  maxAge?: number // in days
  includeExpired?: boolean
}

export interface BulkListOperation {
  operation: 'add' | 'remove' | 'update'
  entries: Partial<WalletListEntry>[]
  listId?: ObjectId
  options?: {
    skipDuplicates?: boolean
    updateExisting?: boolean
    validateAll?: boolean
  }
}

export interface ListSyncResult {
  listId: ObjectId
  entriesAdded: number
  entriesUpdated: number
  entriesRemoved: number
  conflicts: Array<{
    walletAddress: string
    reason: string
    localEntry: WalletListEntry
    remoteEntry: WalletListEntry
  }>
  errors: string[]
  lastSyncAt: Date
}