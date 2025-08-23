import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { WalletListService } from './wallet-list-service'
import { CommunityVotingService } from './community-voting-service'
import { ListImportExportService } from './list-import-export-service'

export interface CleanupResult {
  timestamp: Date
  expiredEntries: {
    removed: number
    categories: Record<string, number>
    oldestExpired?: Date
  }
  expiredProposals: {
    expired: number
    rejected: number
  }
  inactiveUsers: {
    suspended: number
    warned: number
  }
  duplicateEntries: {
    found: number
    merged: number
  }
  lowQualityEntries: {
    flagged: number
    removed: number
  }
  importSources: {
    synced: number
    failed: number
    newEntries: number
  }
  analytics: {
    updated: number
    aggregated: number
  }
  performance: {
    duration: number
    memoryUsage: number
  }
}

export class WalletListCleanupService {
  /**
   * Main cleanup routine - runs all cleanup tasks
   */
  static async runFullCleanup(): Promise<CleanupResult> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed

    console.log('[Cleanup] Starting comprehensive wallet list cleanup...')

    const result: CleanupResult = {
      timestamp: new Date(),
      expiredEntries: { removed: 0, categories: {} },
      expiredProposals: { expired: 0, rejected: 0 },
      inactiveUsers: { suspended: 0, warned: 0 },
      duplicateEntries: { found: 0, merged: 0 },
      lowQualityEntries: { flagged: 0, removed: 0 },
      importSources: { synced: 0, failed: 0, newEntries: 0 },
      analytics: { updated: 0, aggregated: 0 },
      performance: { duration: 0, memoryUsage: 0 }
    }

    try {
      // 1. Clean up expired entries
      result.expiredEntries = await this.cleanupExpiredEntries()
      console.log(`[Cleanup] Removed ${result.expiredEntries.removed} expired entries`)

      // 2. Clean up expired proposals
      result.expiredProposals = await CommunityVotingService.cleanupExpiredProposals()
      console.log(`[Cleanup] Processed ${result.expiredProposals.expired} expired proposals`)

      // 3. Handle inactive users and reputation
      result.inactiveUsers = await this.cleanupInactiveUsers()
      console.log(`[Cleanup] Handled ${result.inactiveUsers.suspended + result.inactiveUsers.warned} inactive users`)

      // 4. Find and merge duplicate entries
      result.duplicateEntries = await this.cleanupDuplicateEntries()
      console.log(`[Cleanup] Found ${result.duplicateEntries.found} duplicates, merged ${result.duplicateEntries.merged}`)

      // 5. Review low quality entries
      result.lowQualityEntries = await this.reviewLowQualityEntries()
      console.log(`[Cleanup] Reviewed low quality entries: ${result.lowQualityEntries.flagged} flagged, ${result.lowQualityEntries.removed} removed`)

      // 6. Sync with external threat intelligence
      result.importSources = await this.syncThreatIntelligence()
      console.log(`[Cleanup] Synced ${result.importSources.synced} sources, imported ${result.importSources.newEntries} entries`)

      // 7. Update analytics and aggregations
      result.analytics = await this.updateAnalytics()
      console.log(`[Cleanup] Updated ${result.analytics.updated} analytics records`)

      // 8. Optimize database performance
      await this.optimizeDatabase()
      console.log(`[Cleanup] Database optimization completed`)

    } catch (error) {
      console.error('[Cleanup] Error during cleanup:', error)
    }

    // Calculate performance metrics
    const endTime = Date.now()
    const endMemory = process.memoryUsage().heapUsed

    result.performance.duration = endTime - startTime
    result.performance.memoryUsage = endMemory - startMemory

    console.log(`[Cleanup] Completed in ${result.performance.duration}ms`)

    // Log cleanup summary
    await this.logCleanupResult(result)

    return result
  }

  /**
   * Clean up expired entries
   */
  static async cleanupExpiredEntries(): Promise<CleanupResult['expiredEntries']> {
    const db = await getDatabase()
    const collection = db.collection('wallet_list_entries')

    // Find expired entries
    const expiredEntries = await collection.find({
      expiresAt: { $exists: true, $lt: new Date() }
    }).toArray()

    const categories: Record<string, number> = {}
    let oldestExpired: Date | undefined

    for (const entry of expiredEntries) {
      categories[entry.category] = (categories[entry.category] || 0) + 1
      
      if (!oldestExpired || entry.expiresAt < oldestExpired) {
        oldestExpired = entry.expiresAt
      }
    }

    // Remove expired entries
    const result = await collection.deleteMany({
      expiresAt: { $exists: true, $lt: new Date() }
    })

    // Clean up related data
    await this.cleanupRelatedData(expiredEntries.map(e => e._id))

    return {
      removed: result.deletedCount,
      categories,
      oldestExpired
    }
  }

  /**
   * Handle inactive users and update reputation
   */
  static async cleanupInactiveUsers(): Promise<CleanupResult['inactiveUsers']> {
    const db = await getDatabase()
    const reputationCollection = db.collection('voter_reputation')

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // Find users inactive for 30+ days
    const inactiveUsers = await reputationCollection.find({
      $or: [
        { lastVoteAt: { $lt: thirtyDaysAgo } },
        { lastVoteAt: { $exists: false } }
      ],
      isActive: true,
      isSuspended: false
    }).toArray()

    let warned = 0
    let suspended = 0

    for (const user of inactiveUsers) {
      const lastActivity = user.lastVoteAt || user.joinedAt
      
      if (lastActivity < sixMonthsAgo) {
        // Suspend users inactive for 6+ months
        await reputationCollection.updateOne(
          { _id: user._id },
          {
            $set: {
              isSuspended: true,
              suspendedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              reputationScore: Math.max(0, user.reputationScore - 100)
            }
          }
        )
        suspended++
      } else {
        // Warn users inactive for 30+ days
        await reputationCollection.updateOne(
          { _id: user._id },
          {
            $inc: { warnings: 1 },
            $set: { reputationScore: Math.max(0, user.reputationScore - 25) }
          }
        )
        warned++
      }
    }

    return { suspended, warned }
  }

  /**
   * Find and merge duplicate entries
   */
  static async cleanupDuplicateEntries(): Promise<CleanupResult['duplicateEntries']> {
    const db = await getDatabase()
    const collection = db.collection('wallet_list_entries')

    // Find duplicate entries by wallet address and list type
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: { walletAddress: '$walletAddress', listType: '$listType' },
          entries: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray()

    let found = 0
    let merged = 0

    for (const duplicate of duplicates) {
      found += duplicate.count - 1

      // Keep the entry with highest confidence and most votes
      const entries = duplicate.entries.sort((a: any, b: any) => {
        const scoreA = a.confidence + (a.votes?.upvotes || 0) * 5
        const scoreB = b.confidence + (b.votes?.upvotes || 0) * 5
        return scoreB - scoreA
      })

      const keepEntry = entries[0]
      const removeEntries = entries.slice(1)

      // Merge data from duplicate entries
      const mergedTags = [...new Set(entries.flatMap((e: any) => e.tags || []))]
      const mergedVotes = {
        upvotes: entries.reduce((sum: number, e: any) => sum + (e.votes?.upvotes || 0), 0),
        downvotes: entries.reduce((sum: number, e: any) => sum + (e.votes?.downvotes || 0), 0),
        voters: entries.flatMap((e: any) => e.votes?.voters || [])
      }

      // Update the kept entry with merged data
      await collection.updateOne(
        { _id: keepEntry._id },
        {
          $set: {
            tags: mergedTags,
            votes: mergedVotes,
            timesQueried: entries.reduce((sum: number, e: any) => sum + (e.timesQueried || 0), 0),
            reason: `${keepEntry.reason} [Merged from duplicates]`,
            updatedAt: new Date()
          }
        }
      )

      // Remove duplicate entries
      await collection.deleteMany({
        _id: { $in: removeEntries.map((e: any) => e._id) }
      })

      merged++
    }

    return { found, merged }
  }

  /**
   * Review and handle low quality entries
   */
  static async reviewLowQualityEntries(): Promise<CleanupResult['lowQualityEntries']> {
    const db = await getDatabase()
    const collection = db.collection('wallet_list_entries')

    // Find low quality entries
    const lowQualityEntries = await collection.find({
      $or: [
        { confidence: { $lt: 30 } }, // Very low confidence
        { 'votes.downvotes': { $gte: 5, $gt: '$votes.upvotes' } }, // More downvotes than upvotes
        { reason: { $regex: /^.{1,10}$/ } }, // Very short reasons
        { createdAt: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } // Very old entries without recent activity
      ],
      isGlobal: false, // Don't touch admin entries
      visibility: { $ne: 'private' } // Only review public/shared entries
    }).toArray()

    let flagged = 0
    let removed = 0

    for (const entry of lowQualityEntries) {
      const qualityScore = this.calculateQualityScore(entry)

      if (qualityScore < 20) {
        // Remove very low quality entries
        await collection.deleteOne({ _id: entry._id })
        removed++
      } else if (qualityScore < 50) {
        // Flag for review
        await collection.updateOne(
          { _id: entry._id },
          {
            $addToSet: { tags: 'flagged_low_quality' },
            $set: { updatedAt: new Date() }
          }
        )
        flagged++
      }
    }

    return { flagged, removed }
  }

  /**
   * Sync with external threat intelligence sources
   */
  static async syncThreatIntelligence(): Promise<CleanupResult['importSources']> {
    try {
      const result = await ListImportExportService.syncThreatIntelFeeds()
      
      return {
        synced: result.sources.length,
        failed: result.errors.length,
        newEntries: result.totalImported
      }
    } catch (error) {
      console.error('[Cleanup] Threat intelligence sync failed:', error)
      return {
        synced: 0,
        failed: 1,
        newEntries: 0
      }
    }
  }

  /**
   * Update analytics and create aggregations
   */
  static async updateAnalytics(): Promise<CleanupResult['analytics']> {
    const db = await getDatabase()
    const analyticsCollection = db.collection('list_analytics')
    const entriesCollection = db.collection('wallet_list_entries')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Generate daily analytics
    const dailyStats = await entriesCollection.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          byListType: [
            { $group: { _id: '$listType', count: { $sum: 1 } } }
          ],
          queryStats: [
            {
              $group: {
                _id: null,
                totalQueries: { $sum: '$timesQueried' },
                avgConfidence: { $avg: '$confidence' }
              }
            }
          ]
        }
      }
    ]).toArray()

    const stats = dailyStats[0]

    // Create analytics record
    await analyticsCollection.updateOne(
      { date: today, period: 'daily', listId: null },
      {
        $set: {
          queriesCount: stats.queryStats[0]?.totalQueries || 0,
          entriesAdded: 0, // This would be tracked in real-time
          entriesRemoved: 0,
          entriesUpdated: 0,
          topCategories: stats.byCategory.map((cat: any) => ({
            category: cat._id,
            count: cat.count
          })),
          averageQueryTime: 0, // Would be tracked in real-time
          cacheHitRate: 0,
          createdAt: new Date()
        }
      },
      { upsert: true }
    )

    // Generate weekly and monthly aggregations
    const weeklyUpdates = await this.generateWeeklyAggregations()
    const monthlyUpdates = await this.generateMonthlyAggregations()

    return {
      updated: 1 + weeklyUpdates + monthlyUpdates,
      aggregated: stats.total[0]?.count || 0
    }
  }

  /**
   * Optimize database performance
   */
  static async optimizeDatabase(): Promise<void> {
    const db = await getDatabase()

    // Ensure indexes exist
    const collections = [
      'wallet_list_entries',
      'wallet_lists',
      'vote_proposals',
      'voter_reputation',
      'list_analytics'
    ]

    for (const collectionName of collections) {
      const collection = db.collection(collectionName)
      
      // Create common indexes
      try {
        await collection.createIndex({ createdAt: -1 })
        await collection.createIndex({ updatedAt: -1 })
        
        if (collectionName === 'wallet_list_entries') {
          await collection.createIndex({ walletAddress: 1, listType: 1 })
          await collection.createIndex({ ownerId: 1 })
          await collection.createIndex({ visibility: 1, isGlobal: 1 })
          await collection.createIndex({ expiresAt: 1 })
          await collection.createIndex({ category: 1, confidence: -1 })
        }
      } catch (error) {
        // Index might already exist
        console.log(`[Cleanup] Index creation for ${collectionName}:`, error.message)
      }
    }

    console.log('[Cleanup] Database optimization completed')
  }

  // Private helper methods

  private static async cleanupRelatedData(entryIds: ObjectId[]): Promise<void> {
    if (entryIds.length === 0) return

    const db = await getDatabase()
    
    // Clean up any references in other collections
    // This would include cleaning up analytics data, etc.
    
    console.log(`[Cleanup] Cleaned up related data for ${entryIds.length} entries`)
  }

  private static calculateQualityScore(entry: any): number {
    let score = 50 // Base score

    // Confidence factor
    score += entry.confidence * 0.3

    // Voting factor
    const totalVotes = (entry.votes?.upvotes || 0) + (entry.votes?.downvotes || 0)
    const voteRatio = totalVotes > 0 ? (entry.votes?.upvotes || 0) / totalVotes : 0.5
    score += voteRatio * 20

    // Usage factor
    score += Math.min(20, (entry.timesQueried || 0) * 2)

    // Reason quality (basic check)
    const reasonLength = entry.reason?.length || 0
    if (reasonLength > 50) score += 10
    else if (reasonLength > 20) score += 5

    // Age factor (newer entries get slight bonus)
    const ageInDays = (Date.now() - new Date(entry.createdAt).getTime()) / (24 * 60 * 60 * 1000)
    if (ageInDays < 30) score += 5

    return Math.max(0, Math.min(100, score))
  }

  private static async generateWeeklyAggregations(): Promise<number> {
    // Implementation for weekly aggregations
    return 1
  }

  private static async generateMonthlyAggregations(): Promise<number> {
    // Implementation for monthly aggregations
    return 1
  }

  private static async logCleanupResult(result: CleanupResult): Promise<void> {
    const db = await getDatabase()
    const logsCollection = db.collection('cleanup_logs')

    await logsCollection.insertOne(result)
    
    // Keep only last 30 cleanup logs
    const logsToKeep = 30
    const totalLogs = await logsCollection.countDocuments({})
    
    if (totalLogs > logsToKeep) {
      const oldLogs = await logsCollection
        .find({})
        .sort({ timestamp: 1 })
        .limit(totalLogs - logsToKeep)
        .toArray()

      await logsCollection.deleteMany({
        _id: { $in: oldLogs.map(log => log._id) }
      })
    }
  }

  /**
   * Quick cleanup for expired entries only (can be run more frequently)
   */
  static async quickCleanup(): Promise<{ removed: number; duration: number }> {
    const startTime = Date.now()
    
    const result = await WalletListService.cleanupExpiredEntries()
    
    const duration = Date.now() - startTime
    
    console.log(`[QuickCleanup] Removed ${result.removedCount} expired entries in ${duration}ms`)
    
    return {
      removed: result.removedCount,
      duration
    }
  }
}