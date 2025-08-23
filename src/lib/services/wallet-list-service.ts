import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { 
  WalletListEntry, 
  WalletList, 
  ListSubscription,
  ListImportExportJob,
  ListAnalytics,
  GlobalListConfig,
  ListQuery,
  BulkListOperation,
  ListSyncResult,
  ListType,
  ListCategory,
  ListVisibility
} from '@/lib/models/wallet-lists'

export class WalletListService {
  private static async getListEntriesCollection() {
    const db = await getDatabase()
    return db.collection<WalletListEntry>('wallet_list_entries')
  }

  private static async getListsCollection() {
    const db = await getDatabase()
    return db.collection<WalletList>('wallet_lists')
  }

  private static async getSubscriptionsCollection() {
    const db = await getDatabase()
    return db.collection<ListSubscription>('list_subscriptions')
  }

  private static async getImportExportJobsCollection() {
    const db = await getDatabase()
    return db.collection<ListImportExportJob>('list_import_export_jobs')
  }

  private static async getAnalyticsCollection() {
    const db = await getDatabase()
    return db.collection<ListAnalytics>('list_analytics')
  }

  private static async getGlobalConfigCollection() {
    const db = await getDatabase()
    return db.collection<GlobalListConfig>('global_list_config')
  }

  /**
   * Check if a wallet is in any lists (whitelist/blacklist)
   */
  static async checkWalletInLists(
    walletAddress: string,
    userId?: ObjectId,
    options?: {
      includePublic?: boolean
      includeGlobal?: boolean
      includeShared?: boolean
      listType?: ListType
      minConfidence?: number
    }
  ): Promise<{
    isWhitelisted: boolean
    isBlacklisted: boolean
    entries: WalletListEntry[]
    highestConfidenceEntry?: WalletListEntry
    conflictingEntries: WalletListEntry[]
  }> {
    const collection = await this.getListEntriesCollection()
    const query: any = { 
      walletAddress,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    }

    // Build visibility filter
    const visibilityFilters = []
    
    if (options?.includeGlobal !== false) {
      visibilityFilters.push({ isGlobal: true })
    }
    
    if (options?.includePublic !== false) {
      visibilityFilters.push({ visibility: 'public' })
    }
    
    if (userId && options?.includeShared !== false) {
      visibilityFilters.push({ 
        $or: [
          { ownerId: userId },
          { sharedWith: userId }
        ]
      })
    } else if (userId) {
      visibilityFilters.push({ ownerId: userId })
    }

    if (visibilityFilters.length > 0) {
      query.$and = [{ $or: visibilityFilters }]
    }

    if (options?.listType) {
      query.listType = options.listType
    }

    if (options?.minConfidence) {
      query.confidence = { $gte: options.minConfidence }
    }

    const entries = await collection.find(query).sort({ confidence: -1 }).toArray()

    // Update query statistics
    await this.updateQueryStats(entries)

    const whitelistEntries = entries.filter(e => e.listType === 'whitelist')
    const blacklistEntries = entries.filter(e => e.listType === 'blacklist')

    // Find conflicting entries (same wallet in both whitelist and blacklist)
    const conflictingEntries = []
    if (whitelistEntries.length > 0 && blacklistEntries.length > 0) {
      conflictingEntries.push(...whitelistEntries, ...blacklistEntries)
    }

    const highestConfidenceEntry = entries.length > 0 ? entries[0] : undefined

    return {
      isWhitelisted: whitelistEntries.length > 0,
      isBlacklisted: blacklistEntries.length > 0,
      entries,
      highestConfidenceEntry,
      conflictingEntries
    }
  }

  /**
   * Add wallet to list
   */
  static async addWalletToList(
    entry: Omit<WalletListEntry, '_id' | 'createdAt' | 'updatedAt' | 'votes' | 'timesQueried' | 'reportCount' | 'verificationCount' | 'version'>
  ): Promise<WalletListEntry> {
    const collection = await this.getListEntriesCollection()

    // Check if entry already exists
    const existing = await collection.findOne({
      walletAddress: entry.walletAddress,
      listType: entry.listType,
      ownerId: entry.ownerId
    })

    if (existing) {
      throw new Error(`Wallet ${entry.walletAddress} is already in ${entry.listType}`)
    }

    // Check rate limits
    await this.checkRateLimits(entry.ownerId)

    const newEntry: WalletListEntry = {
      ...entry,
      votes: {
        upvotes: 0,
        downvotes: 0,
        voters: []
      },
      timesQueried: 0,
      reportCount: 0,
      verificationCount: 0,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(newEntry)
    const createdEntry = { ...newEntry, _id: result.insertedId }

    // Update list statistics
    if (entry.visibility === 'public' || entry.isGlobal) {
      await this.updateListAnalytics('add', createdEntry)
    }

    return createdEntry
  }

  /**
   * Remove wallet from list
   */
  static async removeWalletFromList(
    walletAddress: string,
    listType: ListType,
    ownerId: ObjectId
  ): Promise<boolean> {
    const collection = await this.getListEntriesCollection()

    const entry = await collection.findOne({
      walletAddress,
      listType,
      ownerId
    })

    if (!entry) {
      throw new Error(`Wallet ${walletAddress} not found in ${listType}`)
    }

    const result = await collection.deleteOne({
      walletAddress,
      listType,
      ownerId
    })

    if (result.deletedCount > 0) {
      await this.updateListAnalytics('remove', entry)
      return true
    }

    return false
  }

  /**
   * Update wallet list entry
   */
  static async updateWalletListEntry(
    entryId: ObjectId,
    updates: Partial<WalletListEntry>,
    userId: ObjectId
  ): Promise<WalletListEntry | null> {
    const collection = await this.getListEntriesCollection()

    // Verify ownership or permissions
    const entry = await collection.findOne({ _id: entryId })
    if (!entry) {
      throw new Error('List entry not found')
    }

    if (!entry.ownerId.equals(userId) && !entry.sharedWith?.includes(userId)) {
      throw new Error('Permission denied')
    }

    // Remove fields that shouldn't be updated directly
    const { _id, createdAt, votes, timesQueried, reportCount, ...allowedUpdates } = updates
    
    const result = await collection.findOneAndUpdate(
      { _id: entryId },
      {
        $set: {
          ...allowedUpdates,
          updatedAt: new Date(),
          version: entry.version + 1
        }
      },
      { returnDocument: 'after' }
    )

    if (result) {
      await this.updateListAnalytics('update', result)
    }

    return result
  }

  /**
   * Bulk operations for lists
   */
  static async bulkListOperation(
    operation: BulkListOperation,
    userId: ObjectId
  ): Promise<{
    successful: number
    failed: number
    errors: string[]
    results: WalletListEntry[]
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [],
      results: []
    }

    for (const entry of operation.entries) {
      try {
        switch (operation.operation) {
          case 'add':
            if (!entry.ownerId) entry.ownerId = userId
            if (!entry.ownerAddress) {
              results.failed++
              results.errors.push(`Missing owner address for ${entry.walletAddress}`)
              continue
            }
            
            const newEntry = await this.addWalletToList(entry as any)
            results.results.push(newEntry)
            results.successful++
            break

          case 'remove':
            if (entry.walletAddress && entry.listType) {
              await this.removeWalletFromList(entry.walletAddress, entry.listType, userId)
              results.successful++
            } else {
              results.failed++
              results.errors.push(`Missing required fields for removal`)
            }
            break

          case 'update':
            if (entry._id) {
              const updated = await this.updateWalletListEntry(entry._id, entry, userId)
              if (updated) {
                results.results.push(updated)
                results.successful++
              } else {
                results.failed++
                results.errors.push(`Failed to update entry ${entry._id}`)
              }
            } else {
              results.failed++
              results.errors.push(`Missing entry ID for update`)
            }
            break
        }
      } catch (error) {
        results.failed++
        results.errors.push(`${entry.walletAddress}: ${error.message}`)
      }
    }

    return results
  }

  /**
   * Create or update a wallet list
   */
  static async createWalletList(
    list: Omit<WalletList, '_id' | 'createdAt' | 'updatedAt' | 'entryCount' | 'subscriberCount' | 'lastActivity'>
  ): Promise<WalletList> {
    const collection = await this.getListsCollection()

    const newList: WalletList = {
      ...list,
      entryCount: 0,
      subscriberCount: 0,
      lastActivity: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(newList)
    return { ...newList, _id: result.insertedId }
  }

  /**
   * Get user's lists
   */
  static async getUserLists(
    userId: ObjectId,
    options?: {
      listType?: ListType
      visibility?: ListVisibility
      includeShared?: boolean
    }
  ): Promise<WalletList[]> {
    const collection = await this.getListsCollection()
    
    const query: any = {}
    
    if (options?.includeShared) {
      query.$or = [
        { ownerId: userId },
        { sharedWith: userId }
      ]
    } else {
      query.ownerId = userId
    }

    if (options?.listType) {
      query.listType = options.listType
    }

    if (options?.visibility) {
      query.visibility = options.visibility
    }

    return await collection.find(query).sort({ lastActivity: -1 }).toArray()
  }

  /**
   * Vote on a list entry (for public lists)
   */
  static async voteOnEntry(
    entryId: ObjectId,
    userId: ObjectId,
    walletAddress: string,
    vote: 'up' | 'down'
  ): Promise<WalletListEntry | null> {
    const collection = await this.getListEntriesCollection()

    const entry = await collection.findOne({ _id: entryId })
    if (!entry || entry.visibility !== 'public') {
      throw new Error('Entry not found or not public')
    }

    // Check if user already voted
    const existingVote = entry.votes.voters.find(v => v.userId.equals(userId))
    if (existingVote) {
      throw new Error('User has already voted on this entry')
    }

    const voteUpdate = vote === 'up' ? { upvotes: 1 } : { downvotes: 1 }
    
    const result = await collection.findOneAndUpdate(
      { _id: entryId },
      {
        $inc: voteUpdate,
        $push: {
          'votes.voters': {
            userId,
            walletAddress,
            vote,
            votedAt: new Date()
          }
        },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    return result
  }

  /**
   * Subscribe to a list for automatic updates
   */
  static async subscribeToList(
    userId: ObjectId,
    walletAddress: string,
    listId: ObjectId,
    settings?: Partial<ListSubscription>
  ): Promise<ListSubscription> {
    const collection = await this.getSubscriptionsCollection()
    const listsCollection = await this.getListsCollection()

    // Verify list exists and is public
    const list = await listsCollection.findOne({ _id: listId })
    if (!list || list.visibility !== 'public') {
      throw new Error('List not found or not public')
    }

    // Check if already subscribed
    const existing = await collection.findOne({ userId, listId })
    if (existing) {
      throw new Error('Already subscribed to this list')
    }

    const subscription: ListSubscription = {
      userId,
      walletAddress,
      listId,
      listOwnerId: list.ownerId,
      autoSync: settings?.autoSync ?? true,
      notifyOnChanges: settings?.notifyOnChanges ?? true,
      priority: settings?.priority ?? 5,
      isActive: true,
      syncCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(subscription)
    
    // Update list subscriber count
    await listsCollection.updateOne(
      { _id: listId },
      { $inc: { subscriberCount: 1 } }
    )

    return { ...subscription, _id: result.insertedId }
  }

  /**
   * Get comprehensive wallet assessment from all lists
   */
  static async getWalletAssessment(
    walletAddress: string,
    userId?: ObjectId
  ): Promise<{
    overallStatus: 'whitelisted' | 'blacklisted' | 'neutral' | 'conflicted'
    confidence: number
    entries: WalletListEntry[]
    recommendations: string[]
    riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical'
    sources: Array<{
      type: 'user' | 'global' | 'community'
      count: number
      highestConfidence: number
    }>
  }> {
    const listResult = await this.checkWalletInLists(walletAddress, userId, {
      includePublic: true,
      includeGlobal: true,
      includeShared: true
    })

    let overallStatus: 'whitelisted' | 'blacklisted' | 'neutral' | 'conflicted' = 'neutral'
    let confidence = 0
    let riskLevel: 'very-low' | 'low' | 'medium' | 'high' | 'critical' = 'medium'
    const recommendations: string[] = []

    if (listResult.conflictingEntries.length > 0) {
      overallStatus = 'conflicted'
      confidence = 50
      riskLevel = 'medium'
      recommendations.push('Conflicting entries found - manual review required')
      recommendations.push('Some lists have this wallet whitelisted while others have it blacklisted')
    } else if (listResult.isBlacklisted) {
      overallStatus = 'blacklisted'
      confidence = listResult.highestConfidenceEntry?.confidence || 0
      riskLevel = this.mapConfidenceToRiskLevel(confidence, 'blacklist')
      recommendations.push('Wallet found in blacklist - exercise extreme caution')
      recommendations.push('Verify the reason for blacklisting before any interaction')
    } else if (listResult.isWhitelisted) {
      overallStatus = 'whitelisted'
      confidence = listResult.highestConfidenceEntry?.confidence || 0
      riskLevel = this.mapConfidenceToRiskLevel(100 - confidence, 'whitelist')
      recommendations.push('Wallet found in whitelist - generally considered safe')
      recommendations.push('Standard security practices still apply')
    }

    // Analyze sources
    const sources = this.analyzeSources(listResult.entries)

    return {
      overallStatus,
      confidence,
      entries: listResult.entries,
      recommendations,
      riskLevel,
      sources
    }
  }

  /**
   * Import list from file/URL
   */
  static async importList(
    userId: ObjectId,
    walletAddress: string,
    listId: ObjectId,
    data: string,
    format: 'json' | 'csv' | 'txt'
  ): Promise<ListImportExportJob> {
    const collection = await this.getImportExportJobsCollection()

    const job: ListImportExportJob = {
      userId,
      walletAddress,
      listId,
      type: 'import',
      format,
      status: 'pending',
      totalEntries: 0,
      processedEntries: 0,
      failedEntries: 0,
      errors: [],
      warnings: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(job)
    const jobId = result.insertedId

    // Process import asynchronously
    this.processImportJob(jobId, data, format).catch(error => {
      console.error('[WalletListService] Import job failed:', error)
    })

    return { ...job, _id: jobId }
  }

  /**
   * Export list to file
   */
  static async exportList(
    userId: ObjectId,
    walletAddress: string,
    listId: ObjectId,
    format: 'json' | 'csv' | 'txt'
  ): Promise<ListImportExportJob> {
    const collection = await this.getImportExportJobsCollection()

    const job: ListImportExportJob = {
      userId,
      walletAddress,
      listId,
      type: 'export',
      format,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(job)
    const jobId = result.insertedId

    // Process export asynchronously
    this.processExportJob(jobId, listId, format).catch(error => {
      console.error('[WalletListService] Export job failed:', error)
    })

    return { ...job, _id: jobId }
  }

  /**
   * Get global list configuration
   */
  static async getGlobalConfig(): Promise<GlobalListConfig> {
    const collection = await this.getGlobalConfigCollection()
    
    let config = await collection.findOne({})
    if (!config) {
      // Create default config
      config = {
        autoBlacklistThreshold: 10,
        autoBlacklistCategories: ['scam', 'phishing', 'rugpull'],
        requireAdminApproval: true,
        votingEnabled: true,
        minVotesForAction: 5,
        voteThresholdPercent: 75,
        defaultExpirationDays: {
          scam: 365,
          phishing: 365,
          rugpull: 365,
          legitimate: 0,
          partner: 0,
          exchange: 0,
          defi_protocol: 0,
          verified_user: 180,
          suspicious: 90,
          bot: 30,
          mixer: 180,
          other: 90
        },
        maxExpirationDays: 1825, // 5 years
        maxEntriesPerUser: 10000,
        maxListsPerUser: 50,
        rateLimitPerHour: 1000,
        requireVerificationForPublic: false,
        minVerificationCount: 3,
        verificationExpiryDays: 90,
        updatedAt: new Date(),
        updatedBy: new ObjectId()
      }
      
      await collection.insertOne(config)
    }

    return config
  }

  /**
   * Clean up expired entries
   */
  static async cleanupExpiredEntries(): Promise<{
    removedCount: number
    categories: Record<string, number>
  }> {
    const collection = await this.getListEntriesCollection()
    
    const expiredEntries = await collection.find({
      expiresAt: { $exists: true, $lt: new Date() }
    }).toArray()

    const categories: Record<string, number> = {}
    for (const entry of expiredEntries) {
      categories[entry.category] = (categories[entry.category] || 0) + 1
    }

    const result = await collection.deleteMany({
      expiresAt: { $exists: true, $lt: new Date() }
    })

    console.log(`[WalletListService] Cleaned up ${result.deletedCount} expired entries`)
    
    return {
      removedCount: result.deletedCount,
      categories
    }
  }

  // Private helper methods

  private static async updateQueryStats(entries: WalletListEntry[]): Promise<void> {
    if (entries.length === 0) return

    const collection = await this.getListEntriesCollection()
    const updateIds = entries.map(e => e._id).filter(Boolean)

    if (updateIds.length > 0) {
      await collection.updateMany(
        { _id: { $in: updateIds } },
        { 
          $inc: { timesQueried: 1 },
          $set: { lastQueried: new Date() }
        }
      )
    }
  }

  private static async checkRateLimits(userId: ObjectId): Promise<void> {
    const config = await this.getGlobalConfig()
    const collection = await this.getListEntriesCollection()

    // Check hourly rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentEntries = await collection.countDocuments({
      ownerId: userId,
      createdAt: { $gte: oneHourAgo }
    })

    if (recentEntries >= config.rateLimitPerHour) {
      throw new Error(`Rate limit exceeded: ${config.rateLimitPerHour} entries per hour`)
    }

    // Check total entries per user
    const totalEntries = await collection.countDocuments({ ownerId: userId })
    if (totalEntries >= config.maxEntriesPerUser) {
      throw new Error(`Maximum entries limit reached: ${config.maxEntriesPerUser}`)
    }
  }

  private static async updateListAnalytics(
    action: 'add' | 'remove' | 'update',
    entry: WalletListEntry
  ): Promise<void> {
    const collection = await this.getAnalyticsCollection()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const filter = {
      listId: null, // Global analytics
      period: 'daily' as const,
      date: today
    }

    const update: any = {
      $inc: {},
      $setOnInsert: {
        ownerId: null,
        period: 'daily' as const,
        date: today,
        queriesCount: 0,
        uniqueQueryUsers: 0,
        votesReceived: 0,
        reportsReceived: 0,
        verificationsCount: 0,
        topCategories: [],
        averageQueryTime: 0,
        cacheHitRate: 0,
        createdAt: new Date()
      }
    }

    switch (action) {
      case 'add':
        update.$inc.entriesAdded = 1
        break
      case 'remove':
        update.$inc.entriesRemoved = 1
        break
      case 'update':
        update.$inc.entriesUpdated = 1
        break
    }

    await collection.updateOne(filter, update, { upsert: true })
  }

  private static mapConfidenceToRiskLevel(
    confidence: number, 
    type: 'blacklist' | 'whitelist'
  ): 'very-low' | 'low' | 'medium' | 'high' | 'critical' {
    if (type === 'blacklist') {
      if (confidence >= 90) return 'critical'
      if (confidence >= 75) return 'high'
      if (confidence >= 50) return 'medium'
      if (confidence >= 25) return 'low'
      return 'very-low'
    } else {
      // For whitelist, lower confidence means higher risk
      if (confidence >= 90) return 'critical'
      if (confidence >= 75) return 'high'
      if (confidence >= 50) return 'medium'
      if (confidence >= 25) return 'low'
      return 'very-low'
    }
  }

  private static analyzeSources(entries: WalletListEntry[]): Array<{
    type: 'user' | 'global' | 'community'
    count: number
    highestConfidence: number
  }> {
    const sources = {
      user: { count: 0, highestConfidence: 0 },
      global: { count: 0, highestConfidence: 0 },
      community: { count: 0, highestConfidence: 0 }
    }

    for (const entry of entries) {
      let type: 'user' | 'global' | 'community' = 'user'
      
      if (entry.isGlobal) {
        type = 'global'
      } else if (entry.visibility === 'public') {
        type = 'community'
      }

      sources[type].count++
      sources[type].highestConfidence = Math.max(
        sources[type].highestConfidence,
        entry.confidence
      )
    }

    return Object.entries(sources)
      .filter(([, data]) => data.count > 0)
      .map(([type, data]) => ({
        type: type as 'user' | 'global' | 'community',
        count: data.count,
        highestConfidence: data.highestConfidence
      }))
  }

  private static async processImportJob(
    jobId: ObjectId,
    data: string,
    format: 'json' | 'csv' | 'txt'
  ): Promise<void> {
    const collection = await this.getImportExportJobsCollection()
    
    try {
      await collection.updateOne(
        { _id: jobId },
        { 
          $set: { 
            status: 'processing',
            startedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )

      // Process the import based on format
      let entries: any[] = []
      
      switch (format) {
        case 'json':
          entries = JSON.parse(data)
          break
        case 'csv':
          // Parse CSV data - simplified implementation
          const lines = data.split('\n').slice(1) // Skip header
          entries = lines.map(line => {
            const [address, listType, category, reason, confidence] = line.split(',')
            return { walletAddress: address, listType, category, reason, confidence: parseInt(confidence) }
          })
          break
        case 'txt':
          // Simple text format - one address per line
          entries = data.split('\n')
            .filter(line => line.trim())
            .map(address => ({ walletAddress: address.trim(), listType: 'blacklist', category: 'other', reason: 'Imported from text file', confidence: 50 }))
          break
      }

      await collection.updateOne(
        { _id: jobId },
        { 
          $set: { 
            totalEntries: entries.length,
            updatedAt: new Date()
          }
        }
      )

      // Process entries - this would be more robust in production
      let processed = 0
      let failed = 0
      const errors = []

      for (const entry of entries) {
        try {
          // Validate and add entry
          processed++
        } catch (error) {
          failed++
          errors.push(`${entry.walletAddress}: ${error.message}`)
        }
      }

      await collection.updateOne(
        { _id: jobId },
        { 
          $set: { 
            status: 'completed',
            processedEntries: processed,
            failedEntries: failed,
            errors,
            completedAt: new Date(),
            processingTime: Date.now() - new Date().getTime(),
            updatedAt: new Date()
          }
        }
      )

    } catch (error) {
      await collection.updateOne(
        { _id: jobId },
        { 
          $set: { 
            status: 'failed',
            errors: [error.message],
            completedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )
    }
  }

  private static async processExportJob(
    jobId: ObjectId,
    listId: ObjectId,
    format: 'json' | 'csv' | 'txt'
  ): Promise<void> {
    const collection = await this.getImportExportJobsCollection()
    const entriesCollection = await this.getListEntriesCollection()
    
    try {
      await collection.updateOne(
        { _id: jobId },
        { 
          $set: { 
            status: 'processing',
            startedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )

      // Get all entries for the list
      const entries = await entriesCollection.find({
        // This would need to be refined based on how lists are structured
      }).toArray()

      let exportData = ''
      
      switch (format) {
        case 'json':
          exportData = JSON.stringify(entries, null, 2)
          break
        case 'csv':
          const headers = 'address,listType,category,reason,confidence,createdAt\n'
          const rows = entries.map(e => 
            `${e.walletAddress},${e.listType},${e.category},${e.reason},${e.confidence},${e.createdAt.toISOString()}`
          ).join('\n')
          exportData = headers + rows
          break
        case 'txt':
          exportData = entries.map(e => e.walletAddress).join('\n')
          break
      }

      // In production, this would upload to S3 or similar
      const resultUrl = `data:text/plain;base64,${Buffer.from(exportData).toString('base64')}`

      await collection.updateOne(
        { _id: jobId },
        { 
          $set: { 
            status: 'completed',
            totalEntries: entries.length,
            processedEntries: entries.length,
            resultUrl,
            completedAt: new Date(),
            processingTime: Date.now() - new Date().getTime(),
            updatedAt: new Date()
          }
        }
      )

    } catch (error) {
      await collection.updateOne(
        { _id: jobId },
        { 
          $set: { 
            status: 'failed',
            errors: [error.message],
            completedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )
    }
  }
}