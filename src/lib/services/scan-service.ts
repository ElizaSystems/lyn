import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { SecurityScan, ScanStatistics } from '@/lib/models/scan'
import crypto from 'crypto'

export class ScanService {
  private static async getScansCollection() {
    try {
      const db = await getDatabase()
      return db.collection<SecurityScan>('security_scans')
    } catch (error) {
      console.error('Failed to connect to scans collection:', error)
      throw new Error('Database connection failed')
    }
  }

  private static async getStatsCollection() {
    try {
      const db = await getDatabase()
      return db.collection<ScanStatistics>('scan_statistics')
    } catch (error) {
      console.error('Failed to connect to stats collection:', error)
      throw new Error('Database connection failed')
    }
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
    try {
      const scans = await this.getScansCollection()
    
    // Handle both authenticated users and session-based tracking
    let userIdValue: ObjectId | null = null
    let sessionId: string | undefined
    
    if (userId === 'anonymous' || userId.startsWith('session_')) {
      // For anonymous users, use session ID in metadata
      sessionId = userId.startsWith('session_') ? userId : `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      userIdValue = null
    } else {
      // For authenticated users, use their ObjectId
      try {
        userIdValue = new ObjectId(userId)
      } catch {
        // If invalid ObjectId, treat as session
        sessionId = userId
        userIdValue = null
      }
    }
    
    const scan: SecurityScan = {
      userId: userIdValue,
      sessionId,
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
      metadata: { ...metadata, sessionId },
      createdAt: new Date()
    }

      const result = await scans.insertOne(scan)
      return { ...scan, _id: result.insertedId }
    } catch (error) {
      console.error('Failed to create scan:', error)
      
      // Return a fallback scan object for continued operation
      const fallbackScan: SecurityScan = {
        _id: new ObjectId(),
        userId: null,
        sessionId: userId.startsWith('session_') ? userId : `session_${Date.now()}`,
        hash: this.generateScanHash(userId, type, target),
        type,
        target,
        severity: 'safe',
        status: 'pending',
        result: {
          isSafe: true,
          threats: [],
          confidence: 0,
          details: 'Scan created in offline mode'
        },
        metadata: { ...metadata, offline: true },
        createdAt: new Date()
      }
      
      return fallbackScan
    }
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
    try {
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
    } catch (error) {
      console.error('Failed to update scan result:', error)
      return null
    }
  }

  /**
   * Get recent scans for a user
   */
  static async getUserRecentScans(
    userId: string,
    limit: number = 10
  ): Promise<SecurityScan[]> {
    const scans = await this.getScansCollection()
    
    // Build query to find scans by either userId or sessionId
    const query: { $or: Array<Record<string, unknown>> } = { $or: [] }
    
    // Try to match by ObjectId if valid
    try {
      query.$or.push({ userId: new ObjectId(userId) })
    } catch {
      // Not a valid ObjectId, skip
    }
    
    // Also match by sessionId in metadata or root level
    query.$or.push(
      { sessionId: userId },
      { 'metadata.sessionId': userId },
      { sessionId: { $regex: userId } }
    )
    
    // If userId starts with 'session_', also match it directly
    if (userId.startsWith('session_')) {
      query.$or.push({ sessionId: userId })
    }
    
    return await scans
      .find(query)
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
    
    // Try to find by ObjectId first
    try {
      const result = await stats.findOne({ userId: new ObjectId(userId) })
      if (result) return result
    } catch {
      // Not a valid ObjectId
    }
    
    // Fall back to session-based statistics
    const scans = await this.getScansCollection()
    const userScans = await this.getUserRecentScans(userId, 1000) // Get more scans for stats
    
    if (userScans.length === 0) return null
    
    // Calculate statistics from scans
    const statistics: ScanStatistics = {
      userId: null,
      totalScans: userScans.length,
      safeScans: userScans.filter(s => s.severity === 'safe').length,
      threatsDetected: userScans.filter(s => s.severity !== 'safe').length,
      lastScanDate: userScans[0]?.createdAt || new Date(),
      scansByType: {
        url: userScans.filter(s => s.type === 'url').length,
        document: userScans.filter(s => s.type === 'document').length,
        wallet: userScans.filter(s => s.type === 'wallet').length,
        smart_contract: userScans.filter(s => s.type === 'smart_contract').length,
        transaction: userScans.filter(s => s.type === 'transaction').length
      },
      scansBySeverity: {
        safe: userScans.filter(s => s.severity === 'safe').length,
        low: userScans.filter(s => s.severity === 'low').length,
        medium: userScans.filter(s => s.severity === 'medium').length,
        high: userScans.filter(s => s.severity === 'high').length,
        critical: userScans.filter(s => s.severity === 'critical').length
      },
      updatedAt: new Date()
    }
    
    return statistics
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
    
    // Build query to find scans by either userId or sessionId
    const query: { type: SecurityScan['type']; $or: Array<Record<string, unknown>> } = { type, $or: [] }
    
    // Try to match by ObjectId if valid
    try {
      query.$or.push({ userId: new ObjectId(userId) })
    } catch {
      // Not a valid ObjectId, skip
    }
    
    // Also match by sessionId
    query.$or.push(
      { sessionId: userId },
      { 'metadata.sessionId': userId }
    )
    
    return await scans
      .find(query)
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
    
    // Build query to find scans by either userId or sessionId
    const query: { severity: SecurityScan['severity']; $or: Array<Record<string, unknown>> } = { severity, $or: [] }
    
    // Try to match by ObjectId if valid
    try {
      query.$or.push({ userId: new ObjectId(userId) })
    } catch {
      // Not a valid ObjectId, skip
    }
    
    // Also match by sessionId
    query.$or.push(
      { sessionId: userId },
      { 'metadata.sessionId': userId }
    )
    
    return await scans
      .find(query)
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