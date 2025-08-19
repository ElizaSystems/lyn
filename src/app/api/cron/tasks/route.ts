import { NextRequest, NextResponse } from 'next/server'
import { TaskExecutor } from '@/lib/services/task-executor'

/**
 * Cron job endpoint for automated task execution
 * 
 * This endpoint is designed to be called by cron job services like:
 * - Vercel Cron Jobs (configured in vercel.json)
 * - Railway Cron
 * - GitHub Actions
 * - External cron services (cron-job.org, EasyCron, etc.)
 * 
 * Example Vercel cron configuration in vercel.json:
 * - Set path to "/api/cron/tasks"
 * - Set schedule to run every 5 minutes
 * 
 * Security: In production, this endpoint should verify a secret key
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // In production, require secret
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }
    
    console.log('[CRON] Starting task execution at', new Date().toISOString())
    
    // Execute all due tasks
    const result = await TaskExecutor.executeAllDueTasks()
    
    console.log('[CRON] Task execution completed:', result)
    
    // Return execution summary
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executed: result.executed,
      successful: result.successful,
      failed: result.failed,
      message: `Executed ${result.executed} tasks: ${result.successful} successful, ${result.failed} failed`
    })
  } catch (error) {
    console.error('[CRON] Task execution error:', error)
    
    // Return error but with 200 status to prevent cron job from retrying immediately
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Task execution failed but cron job completed'
    })
  }
}

// POST method for manual triggering with specific options
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }
    
    const body = await req.json().catch(() => ({}))
    
    // Allow forcing execution of specific task types
    if (body.type) {
      console.log(`[CRON] Executing tasks of type: ${body.type}`)
      // This would require extending TaskExecutor to filter by type
    }
    
    // Execute all due tasks
    const result = await TaskExecutor.executeAllDueTasks()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executed: result.executed,
      successful: result.successful,
      failed: result.failed,
      forced: body.force || false
    })
  } catch (error) {
    console.error('[CRON] Manual execution error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      },
      { status: 500 }
    )
  }
}
