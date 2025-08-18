import { ObjectId } from 'mongodb'

export interface SecurityScan {
  _id?: ObjectId
  userId: ObjectId | null
  hash: string // Unique hash for this scan
  type: 'url' | 'document' | 'wallet' | 'smart_contract' | 'transaction'
  target: string // URL, file name, wallet address, etc.
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'completed' | 'failed'
  result: {
    isSafe: boolean
    threats: string[]
    confidence: number
    details: string
    recommendations?: string[]
  }
  metadata?: {
    fileSize?: number
    fileType?: string
    domain?: string
    ipAddress?: string
    sslCertificate?: boolean
    smartContractAddress?: string
    network?: string
  }
  createdAt: Date
  completedAt?: Date
}

export interface ScanStatistics {
  userId: ObjectId
  totalScans: number
  safeScans: number
  threatsDetected: number
  lastScanDate: Date
  scansByType: {
    url: number
    document: number
    wallet: number
    smart_contract: number
    transaction: number
  }
  scansBySeverity: {
    safe: number
    low: number
    medium: number
    high: number
    critical: number
  }
  updatedAt: Date
}