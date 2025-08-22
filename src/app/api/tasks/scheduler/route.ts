import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { TaskExecutor } from '@/lib/services/task-executor'
import { ObjectId } from 'mongodb'

/**
 * Task Scheduler - Handles automatic execution of scheduled tasks
 * This endpoint should be called by a cron job or similar scheduler
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Task Scheduler] Starting scheduled task execution cycle')
    
    const db = await getDatabase()
    const tasksCollection = db.collection('tasks')
    
    // Find tasks that are due for execution
    const now = new Date()
    const dueTasks = await tasksCollection.find({
      status: 'active',
      $or: [
        { nextRun: { $lte: now } },
        { nextRun: null, frequency: 'Real-time' }
      ]
    }).toArray()
    
    console.log(`[Task Scheduler] Found ${dueTasks.length} tasks due for execution`)
    
    const results = {
      totalTasks: dueTasks.length,
      successful: 0,
      failed: 0,
      executions: [] as Array<{
        taskId: string
        taskName: string
        success: boolean
        duration: number
        error?: string
      }>
    }
    
    // Execute tasks in parallel (with concurrency limit)
    const CONCURRENCY_LIMIT = 5
    const taskBatches = []
    
    for (let i = 0; i < dueTasks.length; i += CONCURRENCY_LIMIT) {
      taskBatches.push(dueTasks.slice(i, i + CONCURRENCY_LIMIT))
    }
    
    for (const batch of taskBatches) {
      const batchPromises = batch.map(async (task) => {
        const startTime = Date.now()
        
        try {
          console.log(`[Task Scheduler] Executing task: ${task.name} (${task._id})`)
          
          const execution = await TaskExecutor.executeTask(task._id!.toString())
          const duration = Date.now() - startTime
          
          results.successful++
          results.executions.push({
            taskId: task._id!.toString(),
            taskName: task.name,
            success: true,
            duration
          })
          
          console.log(`[Task Scheduler] Task ${task.name} completed successfully in ${duration}ms`)
          
        } catch (error) {
          const duration = Date.now() - startTime
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          results.failed++
          results.executions.push({
            taskId: task._id!.toString(),
            taskName: task.name,
            success: false,
            duration,
            error: errorMessage
          })
          
          console.error(`[Task Scheduler] Task ${task.name} failed:`, errorMessage)
        }
      })
      
      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises)
    }
    
    console.log(`[Task Scheduler] Execution cycle completed: ${results.successful} successful, ${results.failed} failed`)
    
    return NextResponse.json({
      success: true,
      message: `Executed ${results.totalTasks} tasks`,
      results
    })
    
  } catch (error) {
    console.error('[Task Scheduler] Scheduler error:', error)
    return NextResponse.json({
      error: 'Task scheduler failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Get scheduler status and next execution times
 */
export async function GET() {
  try {
    const db = await getDatabase()
    const tasksCollection = db.collection('tasks')
    
    const now = new Date()
    const activeTasks = await tasksCollection.find({ status: 'active' }).toArray()
    
    const dueTasks = activeTasks.filter(task => 
      task.nextRun && new Date(task.nextRun) <= now
    )
    
    const upcomingTasks = activeTasks
      .filter(task => task.nextRun && new Date(task.nextRun) > now)
      .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())
      .slice(0, 10)
    
    return NextResponse.json({
      status: 'operational',
      activeTasks: activeTasks.length,
      dueTasks: dueTasks.length,
      nextExecution: upcomingTasks[0]?.nextRun || null,
      upcomingTasks: upcomingTasks.map(task => ({
        id: task._id?.toString(),
        name: task.name,
        type: task.type,
        nextRun: task.nextRun,
        frequency: task.frequency
      }))
    })
    
  } catch (error) {
    console.error('[Task Scheduler] Status check error:', error)
    return NextResponse.json({
      error: 'Failed to get scheduler status'
    }, { status: 500 })
  }
}
