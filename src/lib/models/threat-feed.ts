import { ObjectId } from 'mongodb'

// Core threat data interface
export interface ThreatData {
  _id?: ObjectId
  threatId: string // Unique identifier for deduplication
  hash: string // Hash of the threat for quick lookups
  source: ThreatSource
  type: ThreatType
  category: ThreatCategory
  severity: ThreatSeverity
  confidence: number // 0-100 confidence score
  target: {
    type: 'wallet' | 'contract' | 'url' | 'ip' | 'domain' | 'email' | 'token' | 'other'
    value: string
    network?: string // For blockchain-related threats
    metadata?: Record<string, unknown>
  }
  indicators: ThreatIndicator[]
  context: {
    title: string
    description: string
    tags: string[]
    references?: string[]
    evidence?: ThreatEvidence[]
  }
  attribution?: {
    actor?: string
    campaign?: string
    malwareFamily?: string
    techniques?: string[]
  }
  impact: {
    financialLoss?: number
    affectedUsers?: number
    estimatedReach?: number
  }
  timeline: {
    firstSeen: Date
    lastSeen: Date
    discoveredAt: Date
    reportedAt?: Date
    verifiedAt?: Date
    resolvedAt?: Date
  }
  status: 'active' | 'expired' | 'resolved' | 'false_positive' | 'under_review'
  expiresAt?: Date
  correlatedThreats: ObjectId[]
  votes: {
    upvotes: number
    downvotes: number
    totalVotes: number
    score: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface ThreatSource {
  id: string
  name: string
  type: 'community' | 'external_api' | 'on_chain' | 'manual' | 'ai_detected' | 'honeypot'
  reliability: number // 0-100 reliability score
  subscription?: {
    active: boolean
    lastUpdate: Date
    updateInterval: number // milliseconds
  }
}

export type ThreatType = 
  | 'scam' 
  | 'phishing' 
  | 'rugpull' 
  | 'honeypot' 
  | 'exploit' 
  | 'malware'
  | 'drainer'
  | 'pump_dump'
  | 'fake_token'
  | 'impersonation'
  | 'ransomware'
  | 'mixer'
  | 'sanctioned'
  | 'fraud'
  | 'spam'
  | 'botnet'

export type ThreatCategory = 
  | 'financial' 
  | 'identity_theft' 
  | 'data_breach' 
  | 'infrastructure' 
  | 'social_engineering'
  | 'technical'
  | 'compliance'

export type ThreatSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface ThreatIndicator {
  type: 'hash' | 'ip' | 'domain' | 'url' | 'email' | 'wallet' | 'contract' | 'signature'
  value: string
  context?: string
}

export interface ThreatEvidence {
  type: 'transaction' | 'screenshot' | 'url' | 'contract_code' | 'email' | 'social_post'
  value: string
  description?: string
  timestamp?: Date
}

// Threat subscription management
export interface ThreatSubscription {
  _id?: ObjectId
  userId: ObjectId | null
  sessionId?: string // For anonymous users
  subscriberId: string // Unique subscriber identifier
  filters: {
    types?: ThreatType[]
    categories?: ThreatCategory[]
    severities?: ThreatSeverity[]
    sources?: string[]
    targets?: string[] // Specific wallets/contracts to monitor
    minimumConfidence?: number
    tags?: string[]
  }
  delivery: {
    realTime: boolean
    webhook?: {
      url: string
      secret?: string
      enabled: boolean
    }
    email?: {
      address: string
      enabled: boolean
      frequency: 'realtime' | 'hourly' | 'daily' | 'weekly'
    }
    inApp: boolean
  }
  statistics: {
    threatsReceived: number
    lastDelivery?: Date
    failedDeliveries: number
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Threat feed analytics and statistics
export interface ThreatFeedStats {
  _id?: ObjectId
  period: 'hourly' | 'daily' | 'weekly' | 'monthly'
  periodDate: Date
  metrics: {
    totalThreats: number
    newThreats: number
    expiredThreats: number
    resolvedThreats: number
    falsePositives: number
    uniqueTargets: number
    topThreatTypes: Array<{ type: ThreatType; count: number }>
    topSeverities: Array<{ severity: ThreatSeverity; count: number }>
    topSources: Array<{ source: string; count: number }>
    averageConfidence: number
    correlationRate: number // Percentage of threats that were correlated
  }
  createdAt: Date
  updatedAt: Date
}

// Threat correlation patterns
export interface ThreatCorrelation {
  _id?: ObjectId
  parentThreatId: ObjectId
  childThreatId: ObjectId
  correlationType: 'duplicate' | 'related' | 'campaign' | 'attribution' | 'target_overlap'
  confidence: number // 0-100 confidence in correlation
  evidence: {
    commonIndicators: string[]
    timelineSimilarity?: number
    attributionSimilarity?: number
    targetSimilarity?: number
  }
  status: 'active' | 'disputed' | 'confirmed'
  createdAt: Date
  updatedAt: Date
}

// Threat source management
export interface ThreatSourceConfig {
  _id?: ObjectId
  sourceId: string
  name: string
  description: string
  type: ThreatSource['type']
  config: {
    url?: string
    apiKey?: string
    format: 'json' | 'xml' | 'csv' | 'stix' | 'custom'
    updateInterval: number // milliseconds
    batchSize?: number
    timeout?: number
    retryAttempts?: number
  }
  mapping: {
    threatIdField: string
    typeField: string
    severityField: string
    confidenceField: string
    targetField: string
    timestampField: string
    descriptionField?: string
    tagsField?: string
  }
  reliability: number
  statistics: {
    totalFetched: number
    lastFetch?: Date
    successfulFetches: number
    failedFetches: number
    averageLatency: number
    uptime: number // percentage
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Real-time threat stream events
export interface ThreatStreamEvent {
  eventId: string
  eventType: 'threat_added' | 'threat_updated' | 'threat_resolved' | 'threat_expired' | 'correlation_found'
  threatId: ObjectId
  threat?: ThreatData
  changes?: Partial<ThreatData>
  metadata: {
    source: string
    triggeredBy?: 'user' | 'system' | 'external'
    subscriptionFilters?: string[]
  }
  timestamp: Date
}

// User threat watchlist
export interface ThreatWatchlist {
  _id?: ObjectId
  userId: ObjectId
  name: string
  description?: string
  targets: Array<{
    type: 'wallet' | 'contract' | 'domain' | 'email'
    value: string
    network?: string
    addedAt: Date
  }>
  alertSettings: {
    realTime: boolean
    minimumSeverity: ThreatSeverity
    notificationChannels: ('email' | 'webhook' | 'in_app')[]
  }
  statistics: {
    totalAlerts: number
    lastAlert?: Date
    threatsDetected: number
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Threat intelligence patterns
export interface ThreatPattern {
  _id?: ObjectId
  patternId: string
  name: string
  description: string
  category: ThreatCategory
  indicators: Array<{
    field: string // e.g., 'target.value', 'context.title'
    operator: 'equals' | 'contains' | 'regex' | 'starts_with' | 'ends_with'
    value: string
    weight: number // How important this indicator is
  }>
  threshold: number // Minimum score to trigger pattern match
  actions: Array<{
    type: 'increase_severity' | 'add_tag' | 'correlate' | 'notify' | 'auto_resolve'
    parameters: Record<string, unknown>
  }>
  statistics: {
    timesTriggered: number
    lastTriggered?: Date
    accuracy: number // Percentage of correct predictions
    falsePositives: number
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Export all interfaces for easy importing
export type {
  ThreatSource,
  ThreatType,
  ThreatCategory, 
  ThreatSeverity,
  ThreatIndicator,
  ThreatEvidence,
  ThreatStreamEvent
}