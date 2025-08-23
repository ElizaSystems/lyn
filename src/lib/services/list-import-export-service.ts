import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { WalletListService } from './wallet-list-service'
import { 
  WalletListEntry, 
  ListImportExportJob,
  ListCategory,
  ListType
} from '@/lib/models/wallet-lists'

export interface ImportSource {
  name: string
  url: string
  format: 'json' | 'csv' | 'txt'
  category: ListCategory
  listType: ListType
  updateFrequency: 'hourly' | 'daily' | 'weekly'
  lastUpdated?: Date
  isActive: boolean
}

export interface ImportResult {
  jobId: ObjectId
  processed: number
  successful: number
  failed: number
  errors: string[]
  warnings: string[]
  duplicates: number
  newEntries: WalletListEntry[]
}

export class ListImportExportService {
  private static async getJobsCollection() {
    const db = await getDatabase()
    return db.collection<ListImportExportJob>('list_import_export_jobs')
  }

  private static async getSourcesCollection() {
    const db = await getDatabase()
    return db.collection<ImportSource>('list_import_sources')
  }

  /**
   * Import from various known sources
   */
  static async importFromKnownSources(): Promise<ImportResult[]> {
    const sources = await this.getKnownSources()
    const results: ImportResult[] = []

    for (const source of sources.filter(s => s.isActive)) {
      try {
        console.log(`[Import] Processing source: ${source.name}`)
        
        const data = await fetch(source.url).then(r => r.text())
        const result = await this.processImportData(
          data,
          source.format,
          source.category,
          source.listType,
          `import_${source.name}`,
          new ObjectId() // System user ID
        )
        
        results.push(result)

        // Update last updated timestamp
        await this.updateSourceTimestamp(source.name)
        
      } catch (error) {
        console.error(`[Import] Failed to import from ${source.name}:`, error)
        results.push({
          jobId: new ObjectId(),
          processed: 0,
          successful: 0,
          failed: 1,
          errors: [`Failed to import from ${source.name}: ${error.message}`],
          warnings: [],
          duplicates: 0,
          newEntries: []
        })
      }
    }

    return results
  }

  /**
   * Import from file data
   */
  static async importFromData(
    data: string,
    format: 'json' | 'csv' | 'txt',
    userId: ObjectId,
    walletAddress: string,
    options: {
      listType: ListType
      category: ListCategory
      defaultReason?: string
      skipDuplicates?: boolean
      updateExisting?: boolean
      visibility?: 'private' | 'public' | 'shared'
      confidence?: number
    }
  ): Promise<ImportResult> {
    const collection = await this.getJobsCollection()

    // Create import job
    const job: ListImportExportJob = {
      userId,
      walletAddress,
      type: 'import',
      format,
      status: 'processing',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(job)
    const jobId = result.insertedId

    try {
      const importResult = await this.processImportData(
        data,
        format,
        options.category,
        options.listType,
        options.defaultReason || 'Imported from file',
        userId,
        options
      )

      // Update job with results
      await collection.updateOne(
        { _id: jobId },
        {
          $set: {
            status: 'completed',
            totalEntries: importResult.processed,
            processedEntries: importResult.successful,
            failedEntries: importResult.failed,
            errors: importResult.errors,
            warnings: importResult.warnings,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )

      return { ...importResult, jobId }

    } catch (error) {
      // Update job with failure
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

      throw error
    }
  }

  /**
   * Export user lists to various formats
   */
  static async exportUserLists(
    userId: ObjectId,
    walletAddress: string,
    options: {
      format: 'json' | 'csv' | 'txt'
      listType?: ListType
      category?: ListCategory[]
      includeExpired?: boolean
      includePrivate?: boolean
      includeShared?: boolean
    }
  ): Promise<{
    data: string
    filename: string
    contentType: string
  }> {
    // Get user's lists
    const userLists = await WalletListService.getUserLists(userId, {
      listType: options.listType,
      includeShared: options.includeShared !== false
    })

    // Get all entries from user's lists
    const allEntries: WalletListEntry[] = []
    
    for (const list of userLists) {
      const listResult = await WalletListService.checkWalletInLists('', userId, {
        includePublic: false,
        includeGlobal: false,
        includeShared: true
      })
      
      // Filter entries based on options
      const filteredEntries = listResult.entries.filter(entry => {
        if (options.listType && entry.listType !== options.listType) return false
        if (options.category && !options.category.includes(entry.category)) return false
        if (!options.includePrivate && entry.visibility === 'private') return false
        if (!options.includeExpired && entry.expiresAt && entry.expiresAt < new Date()) return false
        
        return true
      })
      
      allEntries.push(...filteredEntries)
    }

    // Remove duplicates
    const uniqueEntries = allEntries.filter((entry, index, array) => 
      array.findIndex(e => e.walletAddress === entry.walletAddress && e.listType === entry.listType) === index
    )

    return this.formatExportData(uniqueEntries, options.format)
  }

  /**
   * Export global lists (admin only)
   */
  static async exportGlobalLists(
    options: {
      format: 'json' | 'csv' | 'txt'
      listType?: ListType
      category?: ListCategory[]
      includeExpired?: boolean
    }
  ): Promise<{
    data: string
    filename: string
    contentType: string
  }> {
    const globalResult = await WalletListService.checkWalletInLists('', undefined, {
      includeGlobal: true,
      includePublic: false,
      includeShared: false
    })

    const filteredEntries = globalResult.entries.filter(entry => {
      if (!entry.isGlobal) return false
      if (options.listType && entry.listType !== options.listType) return false
      if (options.category && !options.category.includes(entry.category)) return false
      if (!options.includeExpired && entry.expiresAt && entry.expiresAt < new Date()) return false
      
      return true
    })

    return this.formatExportData(filteredEntries, options.format)
  }

  /**
   * Sync with external threat intelligence feeds
   */
  static async syncThreatIntelFeeds(): Promise<{
    sources: string[]
    totalImported: number
    errors: string[]
  }> {
    const threatFeeds = [
      {
        name: 'abuse_ch_urlhaus',
        url: 'https://urlhaus-api.abuse.ch/v1/download/txt/',
        format: 'txt' as const,
        category: 'phishing' as ListCategory,
        parser: this.parseURLHausFeed
      },
      {
        name: 'phishing_army',
        url: 'https://phishing.army/download/phishing_army_blocklist.txt',
        format: 'txt' as const,
        category: 'phishing' as ListCategory,
        parser: this.parseGenericTextFeed
      }
      // Add more threat intelligence sources here
    ]

    const results = {
      sources: [] as string[],
      totalImported: 0,
      errors: [] as string[]
    }

    for (const feed of threatFeeds) {
      try {
        console.log(`[ThreatIntel] Syncing ${feed.name}...`)
        
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'LYN-Security-Platform/1.0'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.text()
        const addresses = feed.parser(data)

        if (addresses.length > 0) {
          const importResult = await this.processBulkThreatImport(
            addresses,
            feed.category,
            `Imported from ${feed.name}`,
            'admin_threat_intel'
          )

          results.sources.push(feed.name)
          results.totalImported += importResult.successful
        }

      } catch (error) {
        console.error(`[ThreatIntel] Failed to sync ${feed.name}:`, error)
        results.errors.push(`${feed.name}: ${error.message}`)
      }
    }

    return results
  }

  /**
   * Get import/export job status
   */
  static async getJobStatus(jobId: ObjectId): Promise<ListImportExportJob | null> {
    const collection = await this.getJobsCollection()
    return await collection.findOne({ _id: jobId })
  }

  // Private helper methods

  private static async processImportData(
    data: string,
    format: 'json' | 'csv' | 'txt',
    category: ListCategory,
    listType: ListType,
    defaultReason: string,
    userId: ObjectId,
    options?: any
  ): Promise<ImportResult> {
    const result: ImportResult = {
      jobId: new ObjectId(),
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      warnings: [],
      duplicates: 0,
      newEntries: []
    }

    let entries: any[] = []

    try {
      switch (format) {
        case 'json':
          entries = JSON.parse(data)
          if (!Array.isArray(entries)) {
            entries = [entries]
          }
          break

        case 'csv':
          entries = this.parseCSVData(data)
          break

        case 'txt':
          entries = data.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(address => ({
              walletAddress: address,
              listType,
              category,
              reason: defaultReason,
              confidence: options?.confidence || 75
            }))
          break
      }

      result.processed = entries.length

      // Process entries in batches
      const BATCH_SIZE = 100
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE)
        
        for (const entry of batch) {
          try {
            // Validate entry
            if (!entry.walletAddress) {
              result.failed++
              result.errors.push(`Entry ${i}: Missing wallet address`)
              continue
            }

            // Check if already exists
            const existing = await WalletListService.checkWalletInLists(
              entry.walletAddress,
              userId
            )

            if (existing.entries.some(e => e.listType === listType)) {
              if (options?.skipDuplicates) {
                result.duplicates++
                continue
              } else if (!options?.updateExisting) {
                result.warnings.push(`${entry.walletAddress}: Already exists`)
                result.duplicates++
                continue
              }
            }

            // Add to list
            const newEntry = await WalletListService.addWalletToList({
              walletAddress: entry.walletAddress,
              listType: entry.listType || listType,
              category: entry.category || category,
              reason: entry.reason || defaultReason,
              evidence: entry.evidence,
              confidence: entry.confidence || options?.confidence || 75,
              severity: entry.severity || 'medium',
              tags: entry.tags || ['imported'],
              ownerId: userId,
              ownerAddress: entry.ownerAddress || 'system',
              visibility: options?.visibility || 'private',
              sharedWith: [],
              allowContributions: false,
              isGlobal: false,
              expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : undefined,
              source: 'import'
            })

            result.successful++
            result.newEntries.push(newEntry)

          } catch (error) {
            result.failed++
            result.errors.push(`${entry.walletAddress || 'unknown'}: ${error.message}`)
          }
        }
      }

    } catch (error) {
      result.failed = result.processed
      result.errors.push(`Parse error: ${error.message}`)
    }

    return result
  }

  private static formatExportData(
    entries: WalletListEntry[],
    format: 'json' | 'csv' | 'txt'
  ): {
    data: string
    filename: string
    contentType: string
  } {
    const timestamp = new Date().toISOString().slice(0, 10)

    switch (format) {
      case 'json':
        return {
          data: JSON.stringify(entries, null, 2),
          filename: `wallet-lists-${timestamp}.json`,
          contentType: 'application/json'
        }

      case 'csv':
        const headers = 'address,listType,category,reason,confidence,severity,createdAt,expiresAt'
        const rows = entries.map(e => 
          `"${e.walletAddress}","${e.listType}","${e.category}","${e.reason?.replace(/"/g, '""')}",${e.confidence},"${e.severity}","${e.createdAt.toISOString()}","${e.expiresAt?.toISOString() || ''}"`
        )
        return {
          data: [headers, ...rows].join('\n'),
          filename: `wallet-lists-${timestamp}.csv`,
          contentType: 'text/csv'
        }

      case 'txt':
        return {
          data: entries.map(e => `${e.walletAddress} # ${e.listType} - ${e.reason}`).join('\n'),
          filename: `wallet-lists-${timestamp}.txt`,
          contentType: 'text/plain'
        }

      default:
        throw new Error('Unsupported export format')
    }
  }

  private static parseCSVData(csvData: string): any[] {
    const lines = csvData.split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const entry: any = {}
        
        headers.forEach((header, index) => {
          entry[header] = values[index]
        })
        
        return entry
      })
  }

  private static parseURLHausFeed(data: string): string[] {
    // Parse URLhaus format
    return data.split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        // Extract domain/URL and convert to wallet if applicable
        const parts = line.split(',')
        return parts[0]?.trim()
      })
      .filter(Boolean)
  }

  private static parseGenericTextFeed(data: string): string[] {
    return data.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))
  }

  private static async processBulkThreatImport(
    addresses: string[],
    category: ListCategory,
    reason: string,
    source: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      jobId: new ObjectId(),
      processed: addresses.length,
      successful: 0,
      failed: 0,
      errors: [],
      warnings: [],
      duplicates: 0,
      newEntries: []
    }

    const adminUserId = new ObjectId() // System admin ID

    for (const address of addresses) {
      try {
        const entry = await WalletListService.addWalletToList({
          walletAddress: address,
          listType: 'blacklist',
          category,
          reason,
          evidence: undefined,
          confidence: 85,
          severity: 'high',
          tags: ['threat_intel', source],
          ownerId: adminUserId,
          ownerAddress: 'system',
          visibility: 'public',
          sharedWith: [],
          allowContributions: false,
          isGlobal: true,
          source: 'threat_intelligence'
        })

        result.successful++
        result.newEntries.push(entry)

      } catch (error) {
        if (error.message.includes('already in')) {
          result.duplicates++
        } else {
          result.failed++
          result.errors.push(`${address}: ${error.message}`)
        }
      }
    }

    return result
  }

  private static async getKnownSources(): Promise<ImportSource[]> {
    const collection = await this.getSourcesCollection()
    return await collection.find({ isActive: true }).toArray()
  }

  private static async updateSourceTimestamp(sourceName: string): Promise<void> {
    const collection = await this.getSourcesCollection()
    await collection.updateOne(
      { name: sourceName },
      { $set: { lastUpdated: new Date() } }
    )
  }
}