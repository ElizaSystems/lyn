import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

interface MongoTask {
  _id?: ObjectId
  userId: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  type: 'security-scan' | 'wallet-monitor' | 'price-alert' | 'auto-trade'
  frequency: string
  lastRun?: Date
  nextRun?: Date | null
  successRate: number
  config?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error.message },
      { status: authResult.error.status }
    )
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
      const newTask: MongoTask = {
        userId: authResult.user.id,
        name: body.name,
        description: body.description,
        status: 'active',
        type: body.type,
        frequency: body.frequency,
        lastRun: new Date(),
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
        successRate: 100,
        config: body.config,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const result = await tasksCollection.insertOne(newTask)
      const insertedTask = { ...newTask, _id: result.insertedId }
      
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
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return NextResponse.json({ error: 'Failed to process task action' }, { status: 500 })
  }
}