import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { SecurityScan, ScanStatistics } from '@/lib/models/scan'
import crypto from 'crypto'

export class ScanService {
  private static async getScansCollection() {
    const db = await getDatabase()
    return db.collection<SecurityScan>('security_scans')
  }

  private static async getStatsCollection() {
    const db = await getDatabase()
    return db.collection<ScanStatistics>('scan_statistics')
  }

  /**
   * Generate a unique hash for a scan
   */
  static generateScanHash(userId: string, type: string, target: string): string {
    const timestamp = Date.now().toString()
    const data = `${userId}-${type}-${target}-${timestamp}`
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)
  }

  /**
   * Create a new security scan
   */
  static async createScan(
    userId: string,
    type: SecurityScan['type'],
    target: string,
    metadata?: SecurityScan['metadata']
  ): Promise<SecurityScan> {
    const scans = await this.getScansCollection()
    
    const scan: SecurityScan = {
      userId: userId === 'anonymous' ? null : new ObjectId(userId),
      hash: this.generateScanHash(userId, type, target),
      type,
      target,
      severity: 'safe', // Will be updated when scan completes
      status: 'pending',
      result: {
        isSafe: true,
        threats: [],
        confidence: 0,
        details: 'Scan in progress...'
      },
      metadata,
      createdAt: new Date()
    }

    const result = await scans.insertOne(scan)
    return { ...scan, _id: result.insertedId }
  }

  /**
   * Update scan results
   */
  static async updateScanResult(
    scanId: string,
    result: {
      isSafe: boolean
      threats: string[]
      confidence: number
      details: string
      recommendations?: string[]
    },
    severity: SecurityScan['severity']
  ): Promise<SecurityScan | null> {
    const scans = await this.getScansCollection()
    
    const updateResult = await scans.findOneAndUpdate(
      { _id: new ObjectId(scanId) },
      {
        $set: {
          result,
          severity,
          status: 'completed',
          completedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (updateResult && updateResult.userId) {
      // Update user statistics
      await this.updateUserStatistics(updateResult.userId.toString(), severity, result.isSafe)
    }

    return updateResult
  }

  /**
   * Get recent scans for a user
   */
  static async getUserRecentScans(
    userId: string,
    limit: number = 10
  ): Promise<SecurityScan[]> {
    const scans = await this.getScansCollection()
    
    return await scans
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Get scan by hash
   */
  static async getScanByHash(hash: string): Promise<SecurityScan | null> {
    const scans = await this.getScansCollection()
    return await scans.findOne({ hash })
  }

  /**
   * Get user scan statistics
   */
  static async getUserStatistics(userId: string): Promise<ScanStatistics | null> {
    const stats = await this.getStatsCollection()
    return await stats.findOne({ userId: new ObjectId(userId) })
  }

  /**
   * Update user statistics after a scan
   */
  private static async updateUserStatistics(
    userId: string,
    severity: SecurityScan['severity'],
    isSafe: boolean
  ): Promise<void> {
    const stats = await this.getStatsCollection()
    const userIdObj = new ObjectId(userId)

    const existingStats = await stats.findOne({ userId: userIdObj })

    if (existingStats) {
      // Update existing statistics
      await stats.updateOne(
        { userId: userIdObj },
        {
          $inc: {
            totalScans: 1,
            safeScans: isSafe ? 1 : 0,
            threatsDetected: !isSafe ? 1 : 0,
            [`scansBySeverity.${severity}`]: 1
          },
          $set: {
            lastScanDate: new Date(),
            updatedAt: new Date()
          }
        }
      )
    } else {
      // Create new statistics
      const newStats: ScanStatistics = {
        userId: userIdObj,
        totalScans: 1,
        safeScans: isSafe ? 1 : 0,
        threatsDetected: !isSafe ? 1 : 0,
        lastScanDate: new Date(),
        scansByType: {
          url: 0,
          document: 0,
          wallet: 0,
          smart_contract: 0,
          transaction: 0
        },
        scansBySeverity: {
          safe: severity === 'safe' ? 1 : 0,
          low: severity === 'low' ? 1 : 0,
          medium: severity === 'medium' ? 1 : 0,
          high: severity === 'high' ? 1 : 0,
          critical: severity === 'critical' ? 1 : 0
        },
        updatedAt: new Date()
      }
      await stats.insertOne(newStats)
    }
  }

  /**
   * Get scans by type
   */
  static async getUserScansByType(
    userId: string,
    type: SecurityScan['type'],
    limit: number = 20
  ): Promise<SecurityScan[]> {
    const scans = await this.getScansCollection()
    
    return await scans
      .find({ 
        userId: new ObjectId(userId),
        type
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Get scans by severity
   */
  static async getUserScansBySeverity(
    userId: string,
    severity: SecurityScan['severity'],
    limit: number = 20
  ): Promise<SecurityScan[]> {
    const scans = await this.getScansCollection()
    
    return await scans
      .find({ 
        userId: new ObjectId(userId),
        severity
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Delete old scans (cleanup)
   */
  static async deleteOldScans(daysToKeep: number = 30): Promise<number> {
    const scans = await this.getScansCollection()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await scans.deleteMany({
      createdAt: { $lt: cutoffDate }
    })

    return result.deletedCount
  }
}