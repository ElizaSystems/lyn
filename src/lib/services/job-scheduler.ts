import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export interface ScheduledJob {
  _id?: ObjectId
  name: string
  type: 'burn_monitor' | 'burn_verification' | 'cleanup'
  schedule: string // cron expression
  enabled: boolean
  lastRun?: Date
  nextRun: Date
  runCount: number
  failureCount: number
  lastError?: string
  config?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface JobResult {
  success: boolean
  message: string
  duration: number
  data?: any
  error?: string
}

export class JobSchedulerService {
  private static readonly JOBS_COLLECTION = 'scheduled_jobs'
  private static readonly JOB_LOGS_COLLECTION = 'job_execution_logs'
  
  /**
   * Register a new scheduled job
   */
  static async registerJob(job: Omit<ScheduledJob, '_id' | 'runCount' | 'failureCount' | 'createdAt' | 'updatedAt' | 'nextRun'>): Promise<ScheduledJob> {
    const db = await getDatabase()
    const jobsCollection = db.collection<ScheduledJob>(this.JOBS_COLLECTION)
    
    const now = new Date()
    const nextRun = this.calculateNextRun(job.schedule, now)
    
    const newJob: ScheduledJob = {
      ...job,
      runCount: 0,
      failureCount: 0,
      nextRun,
      createdAt: now,
      updatedAt: now
    }
    
    // Check if job already exists
    const existingJob = await jobsCollection.findOne({ name: job.name })
    
    if (existingJob) {
      // Update existing job
      await jobsCollection.updateOne(
        { name: job.name },
        {
          $set: {
            ...newJob,
            _id: existingJob._id,
            runCount: existingJob.runCount,
            failureCount: existingJob.failureCount,
            createdAt: existingJob.createdAt
          }
        }
      )
      
      return { ...newJob, _id: existingJob._id }
    } else {
      // Create new job
      const result = await jobsCollection.insertOne(newJob)
      return { ...newJob, _id: result.insertedId }
    }
  }
  
  /**
   * Get all scheduled jobs
   */
  static async getJobs(type?: ScheduledJob['type']): Promise<ScheduledJob[]> {
    const db = await getDatabase()
    const jobsCollection = db.collection<ScheduledJob>(this.JOBS_COLLECTION)
    
    const query = type ? { type } : {}
    return await jobsCollection.find(query).sort({ nextRun: 1 }).toArray()
  }
  
  /**
   * Get jobs that are due to run
   */
  static async getDueJobs(): Promise<ScheduledJob[]> {
    const db = await getDatabase()
    const jobsCollection = db.collection<ScheduledJob>(this.JOBS_COLLECTION)
    
    return await jobsCollection.find({
      enabled: true,
      nextRun: { $lte: new Date() }
    }).toArray()
  }
  
  /**
   * Update job after execution
   */
  static async updateJobAfterExecution(
    jobId: ObjectId,
    result: JobResult
  ): Promise<void> {
    const db = await getDatabase()
    const jobsCollection = db.collection<ScheduledJob>(this.JOBS_COLLECTION)
    
    const job = await jobsCollection.findOne({ _id: jobId })
    if (!job) return
    
    const now = new Date()
    const nextRun = this.calculateNextRun(job.schedule, now)
    
    await jobsCollection.updateOne(
      { _id: jobId },
      {
        $set: {
          lastRun: now,
          nextRun,
          lastError: result.error,
          updatedAt: now
        },
        $inc: {
          runCount: 1,
          failureCount: result.success ? 0 : 1
        }
      }
    )
    
    // Log execution
    await this.logJobExecution(jobId, job.name, result)
  }
  
  /**
   * Enable/disable a job
   */
  static async toggleJob(name: string, enabled: boolean): Promise<boolean> {
    const db = await getDatabase()
    const jobsCollection = db.collection<ScheduledJob>(this.JOBS_COLLECTION)
    
    const result = await jobsCollection.updateOne(
      { name },
      { 
        $set: { 
          enabled, 
          updatedAt: new Date() 
        } 
      }
    )
    
    return result.modifiedCount > 0
  }
  
  /**
   * Delete a job
   */
  static async deleteJob(name: string): Promise<boolean> {
    const db = await getDatabase()
    const jobsCollection = db.collection<ScheduledJob>(this.JOBS_COLLECTION)
    
    const result = await jobsCollection.deleteOne({ name })
    return result.deletedCount > 0
  }
  
  /**
   * Get job execution logs
   */
  static async getJobLogs(
    jobName?: string,
    limit = 50
  ): Promise<Array<{
    _id: ObjectId
    jobId: ObjectId
    jobName: string
    result: JobResult
    executedAt: Date
  }>> {
    const db = await getDatabase()
    const logsCollection = db.collection(this.JOB_LOGS_COLLECTION)
    
    const query = jobName ? { jobName } : {}
    return await logsCollection
      .find(query)
      .sort({ executedAt: -1 })
      .limit(limit)
      .toArray()
  }
  
  /**
   * Clean up old job logs
   */
  static async cleanupLogs(olderThanDays = 30): Promise<number> {
    const db = await getDatabase()
    const logsCollection = db.collection(this.JOB_LOGS_COLLECTION)
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    
    const result = await logsCollection.deleteMany({
      executedAt: { $lt: cutoffDate }
    })
    
    return result.deletedCount
  }
  
  /**
   * Calculate next run time from cron expression
   */
  private static calculateNextRun(schedule: string, from: Date): Date {
    // Simple cron parser for basic intervals
    // Format: "*/5 * * * *" (every 5 minutes)
    // For now, we'll support simple minute intervals
    
    const parts = schedule.split(' ')
    if (parts.length !== 5) {
      // Default to every 5 minutes if invalid cron
      return new Date(from.getTime() + 5 * 60 * 1000)
    }
    
    const minutes = parts[0]
    
    if (minutes.startsWith('*/')) {
      // Every N minutes
      const interval = parseInt(minutes.substring(2))
      return new Date(from.getTime() + interval * 60 * 1000)
    } else if (minutes === '*') {
      // Every minute
      return new Date(from.getTime() + 60 * 1000)
    } else {
      // Specific minute - for simplicity, treat as interval
      const minute = parseInt(minutes) || 5
      return new Date(from.getTime() + minute * 60 * 1000)
    }
  }
  
  /**
   * Log job execution
   */
  private static async logJobExecution(
    jobId: ObjectId,
    jobName: string,
    result: JobResult
  ): Promise<void> {
    const db = await getDatabase()
    const logsCollection = db.collection(this.JOB_LOGS_COLLECTION)
    
    await logsCollection.insertOne({
      jobId,
      jobName,
      result,
      executedAt: new Date()
    })
  }
  
  /**
   * Get job statistics
   */
  static async getJobStats(): Promise<{
    totalJobs: number
    enabledJobs: number
    totalRuns: number
    totalFailures: number
    upcomingJobs: ScheduledJob[]
  }> {
    const db = await getDatabase()
    const jobsCollection = db.collection<ScheduledJob>(this.JOBS_COLLECTION)
    
    const [stats, upcomingJobs] = await Promise.all([
      jobsCollection.aggregate([
        {
          $group: {
            _id: null,
            totalJobs: { $sum: 1 },
            enabledJobs: {
              $sum: { $cond: [{ $eq: ['$enabled', true] }, 1, 0] }
            },
            totalRuns: { $sum: '$runCount' },
            totalFailures: { $sum: '$failureCount' }
          }
        }
      ]).toArray(),
      jobsCollection.find({ enabled: true })
        .sort({ nextRun: 1 })
        .limit(10)
        .toArray()
    ])
    
    const result = stats[0] || {
      totalJobs: 0,
      enabledJobs: 0,
      totalRuns: 0,
      totalFailures: 0
    }
    
    return {
      ...result,
      upcomingJobs
    }
  }
}