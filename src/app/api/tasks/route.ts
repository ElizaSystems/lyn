import { NextRequest, NextResponse } from 'next/server'

interface Task {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  type: 'security-scan' | 'wallet-monitor' | 'price-alert' | 'auto-trade'
  frequency: string
  lastRun: Date
  nextRun: Date | null
  successRate: number
  config?: Record<string, unknown>
}

// In-memory task storage (in production, use a database)
let tasks: Task[] = []

// Task execution queue
const taskQueue: Array<{ taskId: string; executeAt: Date }> = []

// Simple task scheduler (runs every minute)
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = new Date()
    taskQueue.forEach((queueItem, index) => {
      if (queueItem.executeAt <= now) {
        executeTask(queueItem.taskId)
        taskQueue.splice(index, 1)
      }
    })
  }, 60000) // Check every minute
}

async function executeTask(taskId: string) {
  const task = tasks.find(t => t.id === taskId)
  if (!task || task.status !== 'active') return
  
  try {
    // Simulate task execution
    console.log(`Executing task: ${task.name}`)
    
    // Update task status
    task.lastRun = new Date()
    
    // Schedule next run based on frequency
    if (task.frequency.includes('hour')) {
      const hours = parseInt(task.frequency.match(/\d+/)?.[0] || '24')
      task.nextRun = new Date(Date.now() + hours * 60 * 60 * 1000)
      taskQueue.push({ taskId: task.id, executeAt: task.nextRun })
    } else if (task.frequency.includes('day')) {
      const days = parseInt(task.frequency.match(/\d+/)?.[0] || '1')
      task.nextRun = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      taskQueue.push({ taskId: task.id, executeAt: task.nextRun })
    }
    
    // Update success rate (simulate 95-100% success)
    task.successRate = 95 + Math.random() * 5
    
  } catch (error) {
    console.error(`Task execution failed: ${task.name}`, error)
    task.status = 'failed'
  }
}

export async function GET() {
  try {
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    if (body.action === 'create') {
      const newTask: Task = {
        id: Date.now().toString(),
        name: body.name,
        description: body.description,
        status: 'active',
        type: body.type,
        frequency: body.frequency,
        lastRun: new Date(),
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
        successRate: 100,
        config: body.config
      }
      
      tasks.push(newTask)
      
      // Schedule the task
      if (newTask.nextRun) {
        taskQueue.push({ taskId: newTask.id, executeAt: newTask.nextRun })
      }
      
      return NextResponse.json(newTask)
    }
    
    if (body.action === 'update') {
      const taskIndex = tasks.findIndex(t => t.id === body.id)
      if (taskIndex === -1) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      
      tasks[taskIndex] = { ...tasks[taskIndex], ...body.updates }
      return NextResponse.json(tasks[taskIndex])
    }
    
    if (body.action === 'delete') {
      tasks = tasks.filter(t => t.id !== body.id)
      return NextResponse.json({ success: true })
    }
    
    if (body.action === 'toggle') {
      const task = tasks.find(t => t.id === body.id)
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      
      task.status = task.status === 'active' ? 'paused' : 'active'
      
      if (task.status === 'active' && task.nextRun) {
        taskQueue.push({ taskId: task.id, executeAt: task.nextRun })
      }
      
      return NextResponse.json(task)
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return NextResponse.json({ error: 'Failed to process task action' }, { status: 500 })
  }
}