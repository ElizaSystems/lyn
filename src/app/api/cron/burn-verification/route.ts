import { NextRequest, NextResponse } from 'next/server'
import { BurnJobService } from '@/lib/services/burn-job-service'

export async function GET(request: NextRequest) {
  try {
    console.log('[CronBurnVerification] Starting burn verification cron job')
    
    // Verify this is a legitimate cron request (in production, you'd verify auth headers)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Simple auth check - in production use proper authentication
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CronBurnVerification] Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Initialize jobs if needed (idempotent)
    await BurnJobService.initializeJobs()
    
    // Process all due jobs
    const results = await BurnJobService.processDueJobs()
    
    console.log('[CronBurnVerification] Cron job completed:', results)
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} jobs`,
      results: {
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        details: results.results
      },
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error('[CronBurnVerification] Cron job failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Cron job failed',
      timestamp: new Date()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, jobName, config } = await request.json()
    
    console.log(`[CronBurnVerification] Manual execution: ${action}`)
    
    switch (action) {
      case 'init_jobs': {
        await BurnJobService.initializeJobs()
        
        return NextResponse.json({
          success: true,
          message: 'Jobs initialized successfully'
        })
      }
      
      case 'process_due': {
        const results = await BurnJobService.processDueJobs()
        
        return NextResponse.json({
          success: true,
          message: `Processed ${results.processed} jobs`,
          results
        })
      }
      
      case 'execute_job': {
        if (!jobName) {
          return NextResponse.json({
            success: false,
            error: 'Job name is required'
          }, { status: 400 })
        }
        
        const result = await BurnJobService.executeJob(jobName, config)
        
        return NextResponse.json({
          success: result.success,
          message: result.message,
          result
        })
      }
      
      case 'status': {
        const status = await BurnJobService.getJobStatus()
        
        return NextResponse.json({
          success: true,
          status
        })
      }
      
      case 'test_connection': {
        const connectionTest = await BurnJobService.testSolanaConnection()
        
        return NextResponse.json({
          success: connectionTest.success,
          message: connectionTest.message,
          result: connectionTest
        })
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported: init_jobs, process_due, execute_job, status, test_connection'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('[CronBurnVerification] Manual execution failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed'
    }, { status: 500 })
  }
}