import { JobSchedulerService, JobResult } from './job-scheduler'
import { BurnMonitorService } from './burn-monitor'
import { BurnService } from './burn-service'
import { SolanaVerificationService } from './solana-verification'

export class BurnJobService {
  private static readonly JOBS = {
    BURN_MONITOR: 'burn_monitor',
    BURN_VERIFICATION: 'burn_verification', 
    BURN_CLEANUP: 'burn_cleanup'
  } as const
  
  /**
   * Initialize all burn-related scheduled jobs
   */
  static async initializeJobs(): Promise<void> {
    console.log('[BurnJobService] Initializing burn verification jobs')
    
    try {
      // Register burn monitoring job (every 5 minutes)
      await JobSchedulerService.registerJob({
        name: this.JOBS.BURN_MONITOR,
        type: 'burn_monitor',
        schedule: '*/5 * * * *', // Every 5 minutes
        enabled: true,
        config: {
          scanForNewBurns: true,
          verifyPendingBurns: true
        }
      })
      
      // Register burn verification job (every 10 minutes)
      await JobSchedulerService.registerJob({
        name: this.JOBS.BURN_VERIFICATION,
        type: 'burn_verification',
        schedule: '*/10 * * * *', // Every 10 minutes
        enabled: true,
        config: {
          batchSize: 20,
          maxRetries: 3
        }
      })
      
      // Register cleanup job (every day at 2 AM - simplified to every hour for now)
      await JobSchedulerService.registerJob({
        name: this.JOBS.BURN_CLEANUP,
        type: 'cleanup',
        schedule: '0 * * * *', // Every hour (simplified)
        enabled: true,
        config: {
          cleanupPendingDays: 7,
          cleanupLogsDays: 30
        }
      })
      
      console.log('[BurnJobService] Burn jobs initialized successfully')
      
    } catch (error) {
      console.error('[BurnJobService] Failed to initialize jobs:', error)
      throw error
    }
  }
  
  /**
   * Execute burn monitoring job
   */
  static async executeBurnMonitorJob(config?: any): Promise<JobResult> {
    const startTime = Date.now()
    
    try {
      console.log('[BurnJobService] Executing burn monitor job')
      
      const monitorService = new BurnMonitorService()
      const results = {
        scanResults: null,
        pendingVerified: 0
      }
      
      // Scan for new burns
      if (config?.scanForNewBurns !== false) {
        console.log('[BurnJobService] Scanning for new burns')
        results.scanResults = await monitorService.scanForNewBurns()
      }
      
      // Verify pending burns
      if (config?.verifyPendingBurns !== false) {
        console.log('[BurnJobService] Verifying pending burns')
        await monitorService.verifyPendingBurns()
      }
      
      const duration = Date.now() - startTime
      
      return {
        success: true,
        message: `Monitor job completed. Found ${results.scanResults?.newBurnsFound || 0} new burns.`,
        duration,
        data: results
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error('[BurnJobService] Burn monitor job failed:', error)
      
      return {
        success: false,
        message: 'Burn monitor job failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Execute burn verification job
   */
  static async executeBurnVerificationJob(config?: any): Promise<JobResult> {
    const startTime = Date.now()
    
    try {
      console.log('[BurnJobService] Executing burn verification job')
      
      const batchSize = config?.batchSize || 20
      const pendingBurns = await BurnService.getPendingVerificationBurns(batchSize)
      
      if (pendingBurns.length === 0) {
        const duration = Date.now() - startTime
        return {
          success: true,
          message: 'No burns need verification',
          duration,
          data: { processed: 0, verified: 0, failed: 0 }
        }
      }
      
      console.log(`[BurnJobService] Verifying ${pendingBurns.length} pending burns`)
      
      const signatures = pendingBurns.map(burn => burn.transactionSignature)
      const results = await BurnService.batchVerify(signatures)
      
      const duration = Date.now() - startTime
      
      return {
        success: true,
        message: `Verified ${results.verified} burns, ${results.failed} failed`,
        duration,
        data: {
          processed: signatures.length,
          verified: results.verified,
          failed: results.failed,
          errors: results.errors
        }
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error('[BurnJobService] Burn verification job failed:', error)
      
      return {
        success: false,
        message: 'Burn verification job failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Execute cleanup job
   */
  static async executeCleanupJob(config?: any): Promise<JobResult> {
    const startTime = Date.now()
    
    try {
      console.log('[BurnJobService] Executing cleanup job')
      
      const monitorService = new BurnMonitorService()
      const results = {
        pendingBurnsCleanedUp: 0,
        jobLogsCleanedUp: 0
      }
      
      // Cleanup old pending burns
      const pendingDays = config?.cleanupPendingDays || 7
      results.pendingBurnsCleanedUp = await monitorService.cleanupPendingBurns(pendingDays)
      
      // Cleanup job logs
      const logsDays = config?.cleanupLogsDays || 30
      results.jobLogsCleanedUp = await JobSchedulerService.cleanupLogs(logsDays)
      
      const duration = Date.now() - startTime
      
      return {
        success: true,
        message: `Cleanup completed. Removed ${results.pendingBurnsCleanedUp} pending burns and ${results.jobLogsCleanedUp} job logs`,
        duration,
        data: results
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error('[BurnJobService] Cleanup job failed:', error)
      
      return {
        success: false,
        message: 'Cleanup job failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Execute a job by name
   */
  static async executeJob(jobName: string, config?: any): Promise<JobResult> {
    switch (jobName) {
      case this.JOBS.BURN_MONITOR:
        return await this.executeBurnMonitorJob(config)
        
      case this.JOBS.BURN_VERIFICATION:
        return await this.executeBurnVerificationJob(config)
        
      case this.JOBS.BURN_CLEANUP:
        return await this.executeCleanupJob(config)
        
      default:
        return {
          success: false,
          message: `Unknown job: ${jobName}`,
          duration: 0,
          error: 'Invalid job name'
        }
    }
  }
  
  /**
   * Process all due jobs
   */
  static async processDueJobs(): Promise<{
    processed: number
    successful: number
    failed: number
    results: Array<{ jobName: string; result: JobResult }>
  }> {
    console.log('[BurnJobService] Processing due jobs')
    
    const dueJobs = await JobSchedulerService.getDueJobs()
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      results: [] as Array<{ jobName: string; result: JobResult }>
    }
    
    for (const job of dueJobs) {
      if (!job._id) continue
      
      try {
        console.log(`[BurnJobService] Executing job: ${job.name}`)
        
        const result = await this.executeJob(job.name, job.config)
        
        // Update job after execution
        await JobSchedulerService.updateJobAfterExecution(job._id, result)
        
        results.processed++
        if (result.success) {
          results.successful++
        } else {
          results.failed++
        }
        
        results.results.push({
          jobName: job.name,
          result
        })
        
      } catch (error) {
        console.error(`[BurnJobService] Job ${job.name} execution failed:`, error)
        
        const failedResult: JobResult = {
          success: false,
          message: 'Job execution failed',
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        
        await JobSchedulerService.updateJobAfterExecution(job._id, failedResult)
        
        results.processed++
        results.failed++
        results.results.push({
          jobName: job.name,
          result: failedResult
        })
      }
    }
    
    if (results.processed > 0) {
      console.log(`[BurnJobService] Processed ${results.processed} jobs: ${results.successful} successful, ${results.failed} failed`)
    }
    
    return results
  }
  
  /**
   * Get job status and statistics
   */
  static async getJobStatus(): Promise<{
    jobs: any[]
    stats: any
    recentLogs: any[]
  }> {
    const [jobs, stats, recentLogs] = await Promise.all([
      JobSchedulerService.getJobs(),
      JobSchedulerService.getJobStats(),
      JobSchedulerService.getJobLogs(undefined, 20)
    ])
    
    return {
      jobs,
      stats,
      recentLogs
    }
  }
  
  /**
   * Test Solana connection
   */
  static async testSolanaConnection(): Promise<JobResult> {
    const startTime = Date.now()
    
    try {
      console.log('[BurnJobService] Testing Solana connection')
      
      const verificationService = new SolanaVerificationService()
      const isHealthy = await verificationService.checkConnection()
      
      const duration = Date.now() - startTime
      
      if (isHealthy) {
        return {
          success: true,
          message: 'Solana connection is healthy',
          duration
        }
      } else {
        return {
          success: false,
          message: 'Solana connection failed',
          duration,
          error: 'RPC connection unhealthy'
        }
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      return {
        success: false,
        message: 'Solana connection test failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}