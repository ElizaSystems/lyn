import { SolanaVerificationService, BurnTransactionDetails } from './solana-verification'
import { BurnService } from './burn-service'
import { BurnRecord } from '@/lib/models/burn'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export interface BurnMonitorStats {
  totalScanned: number
  newBurnsFound: number
  verifiedBurns: number
  failedVerifications: number
  lastScanTime: Date
  nextScanTime: Date
  errors: string[]
}

export interface PendingBurnVerification {
  _id?: ObjectId
  transactionSignature: string
  walletAddress: string
  expectedAmount?: number
  retryCount: number
  lastAttempt: Date
  status: 'pending' | 'verifying' | 'verified' | 'failed'
  error?: string
  createdAt: Date
  updatedAt: Date
}

export class BurnMonitorService {
  private solanaService: SolanaVerificationService
  private isMonitoring = false
  
  constructor() {
    this.solanaService = new SolanaVerificationService()
  }
  
  /**
   * Start monitoring burn transactions
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('[BurnMonitor] Already monitoring')
      return
    }
    
    this.isMonitoring = true
    console.log('[BurnMonitor] Starting burn monitoring service')
    
    // Run initial scan
    await this.scanForNewBurns()
    
    // Verify pending burns
    await this.verifyPendingBurns()
  }
  
  /**
   * Stop monitoring burn transactions
   */
  stopMonitoring(): void {
    this.isMonitoring = false
    console.log('[BurnMonitor] Stopped burn monitoring service')
  }
  
  /**
   * Scan for new burn transactions
   */
  async scanForNewBurns(): Promise<BurnMonitorStats> {
    console.log('[BurnMonitor] Scanning for new burn transactions...')
    
    const stats: BurnMonitorStats = {
      totalScanned: 0,
      newBurnsFound: 0,
      verifiedBurns: 0,
      failedVerifications: 0,
      lastScanTime: new Date(),
      nextScanTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      errors: []
    }
    
    try {
      // Get the last scan time from the database
      const lastScanTime = await this.getLastScanTime()
      console.log(`[BurnMonitor] Last scan time: ${lastScanTime?.toISOString() || 'never'}`)
      
      // Get new burn transactions since last scan
      const since = lastScanTime ? Math.floor(lastScanTime.getTime() / 1000) : undefined
      const newBurns = await this.solanaService.getNewBurnTransactions(since)
      
      stats.totalScanned = newBurns.length
      console.log(`[BurnMonitor] Found ${newBurns.length} potential burn transactions`)
      
      // Process each new burn transaction
      for (const burnTx of newBurns) {
        try {
          const existingBurn = await this.findExistingBurn(burnTx.signature)
          
          if (!existingBurn) {
            // Create new burn record
            const burnRecord = await this.createBurnRecord(burnTx)
            if (burnRecord) {
              stats.newBurnsFound++
              stats.verifiedBurns++
              console.log(`[BurnMonitor] Created new burn record: ${burnRecord._id}`)
            }
          } else if (!existingBurn.verified) {
            // Update existing unverified burn
            await this.updateBurnRecord(existingBurn, burnTx)
            stats.verifiedBurns++
            console.log(`[BurnMonitor] Updated burn record: ${existingBurn._id}`)
          }
          
        } catch (error) {
          stats.failedVerifications++
          const errorMsg = `Failed to process burn ${burnTx.signature}: ${error instanceof Error ? error.message : 'Unknown error'}`
          stats.errors.push(errorMsg)
          console.error(`[BurnMonitor] ${errorMsg}`)
        }
      }
      
      // Update last scan time
      await this.updateLastScanTime(stats.lastScanTime)
      
    } catch (error) {
      const errorMsg = `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      stats.errors.push(errorMsg)
      console.error(`[BurnMonitor] ${errorMsg}`)
    }
    
    console.log('[BurnMonitor] Scan completed:', stats)
    return stats
  }
  
  /**
   * Verify pending burn transactions
   */
  async verifyPendingBurns(): Promise<void> {
    console.log('[BurnMonitor] Verifying pending burn transactions...')
    
    const pendingBurns = await this.getPendingBurns()
    console.log(`[BurnMonitor] Found ${pendingBurns.length} pending burns`)
    
    for (const pending of pendingBurns) {
      try {
        await this.updatePendingBurnStatus(pending._id!.toString(), 'verifying')
        
        const burnDetails = await this.solanaService.verifyBurnTransaction(pending.transactionSignature)
        
        if (burnDetails) {
          // Create or update burn record
          const burnRecord = await this.createBurnRecordFromDetails(burnDetails, pending.walletAddress)
          
          if (burnRecord) {
            await this.updatePendingBurnStatus(pending._id!.toString(), 'verified')
            console.log(`[BurnMonitor] Verified pending burn: ${pending.transactionSignature}`)
          } else {
            await this.updatePendingBurnStatus(pending._id!.toString(), 'failed', 'Failed to create burn record')
          }
        } else {
          const retryCount = pending.retryCount + 1
          if (retryCount >= 3) {
            await this.updatePendingBurnStatus(pending._id!.toString(), 'failed', 'Transaction verification failed after 3 attempts')
          } else {
            await this.updatePendingBurn(pending._id!.toString(), { retryCount, lastAttempt: new Date() })
          }
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        await this.updatePendingBurnStatus(pending._id!.toString(), 'failed', errorMsg)
        console.error(`[BurnMonitor] Failed to verify pending burn ${pending.transactionSignature}:`, error)
      }
    }
  }
  
  /**
   * Add a transaction signature for verification
   */
  async addPendingBurn(signature: string, walletAddress: string, expectedAmount?: number): Promise<void> {
    const db = await getDatabase()
    const pendingCollection = db.collection<PendingBurnVerification>('pending_burn_verifications')
    
    const existingPending = await pendingCollection.findOne({ transactionSignature: signature })
    if (existingPending) {
      console.log(`[BurnMonitor] Pending burn already exists: ${signature}`)
      return
    }
    
    const pendingBurn: PendingBurnVerification = {
      transactionSignature: signature,
      walletAddress,
      expectedAmount,
      retryCount: 0,
      lastAttempt: new Date(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await pendingCollection.insertOne(pendingBurn)
    console.log(`[BurnMonitor] Added pending burn verification: ${signature}`)
  }
  
  /**
   * Create burn record from blockchain data
   */
  private async createBurnRecord(burnTx: BurnTransactionDetails): Promise<BurnRecord | null> {
    try {
      const burnRecord: Omit<BurnRecord, '_id' | 'timestamp' | 'verified'> = {
        walletAddress: burnTx.fromAddress,
        amount: burnTx.amount,
        type: 'manual', // Will be updated based on amount or other logic
        transactionSignature: burnTx.signature,
        description: `On-chain burn of ${burnTx.amount} LYN`,
        metadata: {
          blockTime: burnTx.blockTime.toISOString(),
          slot: burnTx.slot,
          confirmations: burnTx.confirmations,
          fee: burnTx.fee,
          burnAddress: burnTx.burnAddress,
          tokenMint: burnTx.tokenMint
        },
        blockHeight: burnTx.slot
      }
      
      return await BurnService.recordBurn(burnRecord)
    } catch (error) {
      console.error('[BurnMonitor] Failed to create burn record:', error)
      return null
    }
  }
  
  /**
   * Create burn record from pending burn details
   */
  private async createBurnRecordFromDetails(
    burnTx: BurnTransactionDetails, 
    walletAddress: string
  ): Promise<BurnRecord | null> {
    // Use the wallet address from pending burn if available
    const effectiveWalletAddress = walletAddress || burnTx.fromAddress
    
    return await this.createBurnRecord({
      ...burnTx,
      fromAddress: effectiveWalletAddress
    })
  }
  
  /**
   * Update existing burn record with verified data
   */
  private async updateBurnRecord(existingBurn: BurnRecord, burnTx: BurnTransactionDetails): Promise<void> {
    const burns = await BurnService['getBurnsCollection']()
    
    await burns.updateOne(
      { _id: existingBurn._id },
      {
        $set: {
          verified: true,
          amount: burnTx.amount,
          blockHeight: burnTx.slot,
          metadata: {
            ...existingBurn.metadata,
            blockTime: burnTx.blockTime.toISOString(),
            slot: burnTx.slot,
            confirmations: burnTx.confirmations,
            fee: burnTx.fee,
            burnAddress: burnTx.burnAddress,
            tokenMint: burnTx.tokenMint,
            verifiedAt: new Date().toISOString()
          }
        }
      }
    )
  }
  
  /**
   * Find existing burn record by transaction signature
   */
  private async findExistingBurn(signature: string): Promise<BurnRecord | null> {
    const burns = await BurnService['getBurnsCollection']()
    return await burns.findOne({ transactionSignature: signature })
  }
  
  /**
   * Get pending burn verifications
   */
  private async getPendingBurns(): Promise<PendingBurnVerification[]> {
    const db = await getDatabase()
    const pendingCollection = db.collection<PendingBurnVerification>('pending_burn_verifications')
    
    return await pendingCollection.find({
      status: { $in: ['pending', 'verifying'] },
      retryCount: { $lt: 3 }
    }).toArray()
  }
  
  /**
   * Update pending burn status
   */
  private async updatePendingBurnStatus(
    id: string, 
    status: PendingBurnVerification['status'], 
    error?: string
  ): Promise<void> {
    const db = await getDatabase()
    const pendingCollection = db.collection<PendingBurnVerification>('pending_burn_verifications')
    
    await pendingCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          error,
          updatedAt: new Date(),
          ...(status === 'verifying' && { lastAttempt: new Date() })
        }
      }
    )
  }
  
  /**
   * Update pending burn data
   */
  private async updatePendingBurn(
    id: string, 
    updates: Partial<PendingBurnVerification>
  ): Promise<void> {
    const db = await getDatabase()
    const pendingCollection = db.collection<PendingBurnVerification>('pending_burn_verifications')
    
    await pendingCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    )
  }
  
  /**
   * Get last scan time from database
   */
  private async getLastScanTime(): Promise<Date | null> {
    const db = await getDatabase()
    const settingsCollection = db.collection('burn_monitor_settings')
    
    const settings = await settingsCollection.findOne({ key: 'lastScanTime' })
    return settings?.value ? new Date(settings.value) : null
  }
  
  /**
   * Update last scan time in database
   */
  private async updateLastScanTime(scanTime: Date): Promise<void> {
    const db = await getDatabase()
    const settingsCollection = db.collection('burn_monitor_settings')
    
    await settingsCollection.updateOne(
      { key: 'lastScanTime' },
      { $set: { key: 'lastScanTime', value: scanTime.toISOString(), updatedAt: new Date() } },
      { upsert: true }
    )
  }
  
  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<BurnMonitorStats & { isActive: boolean; pendingBurns: number }> {
    const stats = await this.scanForNewBurns()
    const pendingBurns = await this.getPendingBurns()
    
    return {
      ...stats,
      isActive: this.isMonitoring,
      pendingBurns: pendingBurns.length
    }
  }
  
  /**
   * Clean up old pending verifications
   */
  async cleanupPendingBurns(olderThanDays = 7): Promise<number> {
    const db = await getDatabase()
    const pendingCollection = db.collection<PendingBurnVerification>('pending_burn_verifications')
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    
    const result = await pendingCollection.deleteMany({
      $or: [
        { status: 'verified', updatedAt: { $lt: cutoffDate } },
        { status: 'failed', retryCount: { $gte: 3 }, updatedAt: { $lt: cutoffDate } }
      ]
    })
    
    console.log(`[BurnMonitor] Cleaned up ${result.deletedCount} old pending burns`)
    return result.deletedCount
  }
}