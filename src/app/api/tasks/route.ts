import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { TaskExecutor, Task } from '@/lib/services/task-executor'

// Use the Task type from TaskExecutor service
type MongoTask = Task

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  
  // If no auth, return sample tasks for demo
  if (authResult.error) {
    const sampleTasks: MongoTask[] = [
      {
        _id: new ObjectId(),
        userId: 'demo',
        name: 'Daily Security Scan',
        description: 'Automated daily scan of monitored URLs and wallets',
        status: 'active',
        type: 'security-scan',
        frequency: 'Every 24 hours',
        lastRun: new Date(Date.now() - 3600000),
        nextRun: new Date(Date.now() + 82800000),
        successRate: 98.5,
        config: {
          targets: ['https://mysite.com', '0x742d35Cc6634C0532925a3b844Bc9e7595f0b'],
          notifications: {
            email: 'user@example.com'
          }
        },
        createdAt: new Date(Date.now() - 86400000 * 7),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        userId: 'demo',
        name: 'LYN Price Monitor',
        description: 'Monitor LYN token price and alert on significant changes',
        status: 'active',
        type: 'price-alert',
        frequency: 'Every 5 minutes',
        lastRun: new Date(Date.now() - 180000),
        nextRun: new Date(Date.now() + 120000),
        successRate: 99.8,
        config: {
          token: 'LYN',
          thresholds: { increase: 10, decrease: 10 },
          alertChannels: ['email', 'discord']
        },
        createdAt: new Date(Date.now() - 86400000 * 14),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        userId: 'demo',
        name: 'Wallet Activity Tracker',
        description: 'Real-time monitoring of wallet transactions and balances',
        status: 'paused',
        type: 'wallet-monitor',
        frequency: 'Real-time',
        lastRun: new Date(Date.now() - 7200000),
        nextRun: null,
        successRate: 97.2,
        config: {
          wallets: ['EPCzpDDs4dNJvBEmJ1pvBN4tfCVNxZqJ7sTcHcepHdKT'],
          alertThreshold: 100,
          trackTokens: ['SOL', 'LYN']
        },
        createdAt: new Date(Date.now() - 86400000 * 30),
        updatedAt: new Date()
      }
    ]
    return NextResponse.json(sampleTasks)
  }

  try {
    const db = await getDatabase()
    const tasksCollection = db.collection<MongoTask>('tasks')
    
    const tasks = await tasksCollection
      .find({ userId: authResult.user.id })
      .sort({ createdAt: -1 })
      .toArray()
    
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error.message },
      { status: authResult.error.status }
    )
  }

  try {
    const body = await req.json()
    const db = await getDatabase()
    const tasksCollection = db.collection<MongoTask>('tasks')
    
    if (body.action === 'create') {
      // Calculate proper next run time based on frequency
      const nextRun = calculateNextRun(body.frequency)
      
      const newTask: MongoTask = {
        userId: authResult.user.id,
        name: body.name,
        description: body.description,
        status: 'active',
        type: body.type,
        frequency: body.frequency,
        lastRun: undefined, // Will be set on first execution
        nextRun,
        successRate: 100,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        config: body.config || {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const result = await tasksCollection.insertOne(newTask)
      const insertedTask = { ...newTask, _id: result.insertedId }
      
      // If task should run immediately, execute it
      if (body.executeNow) {
        try {
          await TaskExecutor.executeTask(result.insertedId.toString())
        } catch (error) {
          console.error('Failed to execute task immediately:', error)
        }
      }
      
      return NextResponse.json(insertedTask)
    }
    
    if (body.action === 'update') {
      const result = await tasksCollection.findOneAndUpdate(
        { 
          _id: new ObjectId(body.id), 
          userId: authResult.user.id 
        },
        { 
          $set: { 
            ...body.updates, 
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      )
      
      if (!result) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      
      return NextResponse.json(result)
    }
    
    if (body.action === 'delete') {
      const result = await tasksCollection.deleteOne({
        _id: new ObjectId(body.id),
        userId: authResult.user.id
      })
      
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      
      return NextResponse.json({ success: true })
    }
    
    if (body.action === 'toggle') {
      const task = await tasksCollection.findOne({
        _id: new ObjectId(body.id),
        userId: authResult.user.id
      })
      
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      
      const newStatus = task.status === 'active' ? 'paused' : 'active'
      const result = await tasksCollection.findOneAndUpdate(
        { 
          _id: new ObjectId(body.id), 
          userId: authResult.user.id 
        },
        { 
          $set: { 
            status: newStatus, 
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      )
      
      return NextResponse.json(result)
    }
    
    // New action: execute task immediately
    if (body.action === 'execute') {
      try {
        const execution = await TaskExecutor.executeTask(body.id)
        return NextResponse.json({ 
          success: true, 
          execution,
          message: execution.success ? 'Task executed successfully' : 'Task execution failed'
        })
      } catch (error) {
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Task execution failed' 
        }, { status: 500 })
      }
    }
    
    // New action: get execution history
    if (body.action === 'history') {
      const history = await TaskExecutor.getTaskExecutionHistory(body.id, body.limit || 10)
      return NextResponse.json({ history })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return NextResponse.json({ error: 'Failed to process task action' }, { status: 500 })
  }
}

// Helper function to calculate next run time
function calculateNextRun(frequency: string): Date | null {
  const now = new Date()
  
  switch (frequency.toLowerCase()) {
    case 'real-time':
    case 'continuous':
      return new Date(now.getTime() + 60 * 1000) // 1 minute
    case 'every 5 minutes':
      return new Date(now.getTime() + 5 * 60 * 1000)
    case 'every 30 minutes':
      return new Date(now.getTime() + 30 * 60 * 1000)
    case 'every hour':
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000)
    case 'every 6 hours':
      return new Date(now.getTime() + 6 * 60 * 60 * 1000)
    case 'every 12 hours':
      return new Date(now.getTime() + 12 * 60 * 60 * 1000)
    case 'every 24 hours':
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000) // Default to daily
  }
}