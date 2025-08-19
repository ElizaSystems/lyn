import { NextRequest, NextResponse } from 'next/server'
import { TaskExecutor } from '@/lib/services/task-executor'

// This endpoint can be called by a cron job or scheduler to execute due tasks
export async function POST(req: NextRequest) {
  try {
    // Check for API key in production
    const apiKey = req.headers.get('x-api-key')
    const expectedKey = process.env.TASK_EXECUTOR_API_KEY
    
    // In production, require API key for security
    if (process.env.NODE_ENV === 'production' && expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))
    
    // Execute a specific task if taskId is provided
    if (body.taskId) {
      try {
        const execution = await TaskExecutor.executeTask(body.taskId)
        return NextResponse.json({
          success: true,
          execution
        })
      } catch (error) {
        return NextResponse.json(
          { 
            success: false,
            error: error instanceof Error ? error.message : 'Task execution failed' 
          },
          { status: 500 }
        )
      }
    }
    
    // Otherwise, execute all due tasks
    const result = await TaskExecutor.executeAllDueTasks()
    
    return NextResponse.json({
      success: true,
      result,
      message: `Executed ${result.executed} tasks: ${result.successful} successful, ${result.failed} failed`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Task execution error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to execute tasks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check execution status and history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    const userId = searchParams.get('userId')
    
    if (taskId) {
      // Get execution history for a specific task
      const history = await TaskExecutor.getTaskExecutionHistory(taskId, 20)
      return NextResponse.json({
        taskId,
        executions: history,
        count: history.length
      })
    }
    
    if (userId) {
      // Get user's task statistics
      const stats = await TaskExecutor.getUserTaskStatistics(userId)
      return NextResponse.json(stats)
    }
    
    // Get tasks due for execution
    const dueTasks = await TaskExecutor.getTasksDueForExecution()
    return NextResponse.json({
      dueTasks: dueTasks.length,
      tasks: dueTasks.map(t => ({
        id: t._id?.toString(),
        name: t.name,
        type: t.type,
        frequency: t.frequency,
        lastRun: t.lastRun,
        nextRun: t.nextRun,
        status: t.status
      }))
    })
  } catch (error) {
    console.error('Task status error:', error)
    return NextResponse.json(
      { error: 'Failed to get task status' },
      { status: 500 }
    )
  }
}
