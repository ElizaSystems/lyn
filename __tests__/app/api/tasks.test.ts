import { NextRequest } from 'next/server'
import { MongoClient, Db, ObjectId } from 'mongodb'
import { GET, POST } from '@/app/api/tasks/route'
import { setupTestDb, teardownTestDb, clearTestDb } from '../../utils/test-db'
import { generateTestWallet, signMessage, mockRequest, createTestTask } from '../../utils/test-helpers'

// Mock the mongodb connection and auth
jest.mock('@/lib/mongodb', () => {
  let testDb: Db
  
  return {
    getDatabase: jest.fn(async () => {
      if (!testDb) {
        throw new Error('Test database not initialized')
      }
      return testDb
    }),
    __setTestDb: (db: Db) => {
      testDb = db
    }
  }
})

// Mock authentication
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn()
}))

describe('/api/tasks', () => {
  let client: MongoClient
  let db: Db
  let testWallet: { publicKey: string; secretKey: Uint8Array }
  let testUserId: string

  beforeAll(async () => {
    const testDbSetup = await setupTestDb()
    client = testDbSetup.client
    db = testDbSetup.db
    
    // Set the test database for the mocked module
    const mongodb = require('@/lib/mongodb')
    mongodb.__setTestDb(db)
    
    testWallet = generateTestWallet()
    testUserId = new ObjectId().toString()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
    
    // Reset auth mock
    const { requireAuth } = require('@/lib/auth')
    requireAuth.mockResolvedValue({
      user: {
        id: testUserId,
        walletAddress: testWallet.publicKey,
        tokenBalance: 1000,
        hasTokenAccess: true
      }
    })
  })

  describe('GET /api/tasks', () => {
    it('should return empty array when user has no tasks', async () => {
      const req = mockRequest() as NextRequest
      
      const response = await GET(req)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toEqual([])
    })

    it('should return user tasks', async () => {
      // Create test tasks in database
      const tasksCollection = db.collection('tasks')
      const task1 = createTestTask(testUserId, { name: 'Task 1' })
      const task2 = createTestTask(testUserId, { name: 'Task 2' })
      
      await tasksCollection.insertMany([task1, task2])
      
      const req = mockRequest() as NextRequest
      const response = await GET(req)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data.some((t: any) => t.name === 'Task 1')).toBe(true)
      expect(data.some((t: any) => t.name === 'Task 2')).toBe(true)
    })

    it('should only return tasks for authenticated user', async () => {
      // Create tasks for different users
      const tasksCollection = db.collection('tasks')
      const otherUserId = new ObjectId().toString()
      
      const userTask = createTestTask(testUserId, { name: 'User Task' })
      const otherTask = createTestTask(otherUserId, { name: 'Other Task' })
      
      await tasksCollection.insertMany([userTask, otherTask])
      
      const req = mockRequest() as NextRequest
      const response = await GET(req)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('User Task')
    })

    it('should return 401 when authentication fails', async () => {
      const { requireAuth } = require('@/lib/auth')
      requireAuth.mockResolvedValue({
        error: { message: 'Authentication required', status: 401 }
      })
      
      const req = mockRequest() as NextRequest
      const response = await GET(req)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mongodb = require('@/lib/mongodb')
      mongodb.getDatabase.mockRejectedValueOnce(new Error('Database error'))
      
      const req = mockRequest() as NextRequest
      const response = await GET(req)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch tasks')
    })
  })

  describe('POST /api/tasks', () => {
    describe('create action', () => {
      it('should create a new task', async () => {
        const taskData = {
          action: 'create',
          name: 'New Task',
          description: 'A new security scan task',
          type: 'security-scan',
          frequency: 'Every 24 hours',
          config: { scanType: 'full' }
        }
        
        const req = mockRequest({
          method: 'POST',
          body: taskData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(200)
        expect(data._id).toBeDefined()
        expect(data.name).toBe('New Task')
        expect(data.userId).toBe(testUserId)
        expect(data.status).toBe('active')
        expect(data.createdAt).toBeDefined()
        
        // Verify task was saved to database
        const tasksCollection = db.collection('tasks')
        const savedTask = await tasksCollection.findOne({ _id: new ObjectId(data._id) })
        expect(savedTask).toBeDefined()
        expect(savedTask?.name).toBe('New Task')
      })

      it('should set default values for new task', async () => {
        const taskData = {
          action: 'create',
          name: 'Test Task',
          description: 'Test description',
          type: 'wallet-monitor',
          frequency: 'Real-time'
        }
        
        const req = mockRequest({
          method: 'POST',
          body: taskData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(data.status).toBe('active')
        expect(data.successRate).toBe(100)
        expect(data.lastRun).toBeDefined()
        expect(data.nextRun).toBeDefined()
      })
    })

    describe('update action', () => {
      it('should update existing task', async () => {
        // Create a task first
        const tasksCollection = db.collection('tasks')
        const task = createTestTask(testUserId, { name: 'Original Task' })
        const result = await tasksCollection.insertOne(task)
        const taskId = result.insertedId.toString()
        
        const updateData = {
          action: 'update',
          id: taskId,
          updates: {
            name: 'Updated Task',
            status: 'paused',
            successRate: 95
          }
        }
        
        const req = mockRequest({
          method: 'POST',
          body: updateData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(200)
        expect(data.name).toBe('Updated Task')
        expect(data.status).toBe('paused')
        expect(data.successRate).toBe(95)
        expect(data.updatedAt).toBeDefined()
      })

      it('should return 404 for non-existent task', async () => {
        const nonExistentId = new ObjectId().toString()
        
        const updateData = {
          action: 'update',
          id: nonExistentId,
          updates: { name: 'Updated' }
        }
        
        const req = mockRequest({
          method: 'POST',
          body: updateData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(404)
        expect(data.error).toBe('Task not found')
      })

      it('should not allow updating other users tasks', async () => {
        // Create task for different user
        const tasksCollection = db.collection('tasks')
        const otherUserId = new ObjectId().toString()
        const task = createTestTask(otherUserId, { name: 'Other User Task' })
        const result = await tasksCollection.insertOne(task)
        const taskId = result.insertedId.toString()
        
        const updateData = {
          action: 'update',
          id: taskId,
          updates: { name: 'Hacked Task' }
        }
        
        const req = mockRequest({
          method: 'POST',
          body: updateData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(404)
        expect(data.error).toBe('Task not found')
      })
    })

    describe('delete action', () => {
      it('should delete existing task', async () => {
        // Create a task first
        const tasksCollection = db.collection('tasks')
        const task = createTestTask(testUserId)
        const result = await tasksCollection.insertOne(task)
        const taskId = result.insertedId.toString()
        
        const deleteData = {
          action: 'delete',
          id: taskId
        }
        
        const req = mockRequest({
          method: 'POST',
          body: deleteData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        
        // Verify task was deleted from database
        const deletedTask = await tasksCollection.findOne({ _id: new ObjectId(taskId) })
        expect(deletedTask).toBeNull()
      })

      it('should return 404 when deleting non-existent task', async () => {
        const nonExistentId = new ObjectId().toString()
        
        const deleteData = {
          action: 'delete',
          id: nonExistentId
        }
        
        const req = mockRequest({
          method: 'POST',
          body: deleteData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(404)
        expect(data.error).toBe('Task not found')
      })
    })

    describe('toggle action', () => {
      it('should toggle task status from active to paused', async () => {
        // Create an active task
        const tasksCollection = db.collection('tasks')
        const task = createTestTask(testUserId, { status: 'active' })
        const result = await tasksCollection.insertOne(task)
        const taskId = result.insertedId.toString()
        
        const toggleData = {
          action: 'toggle',
          id: taskId
        }
        
        const req = mockRequest({
          method: 'POST',
          body: toggleData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(200)
        expect(data.status).toBe('paused')
        expect(data.updatedAt).toBeDefined()
      })

      it('should toggle task status from paused to active', async () => {
        // Create a paused task
        const tasksCollection = db.collection('tasks')
        const task = createTestTask(testUserId, { status: 'paused' })
        const result = await tasksCollection.insertOne(task)
        const taskId = result.insertedId.toString()
        
        const toggleData = {
          action: 'toggle',
          id: taskId
        }
        
        const req = mockRequest({
          method: 'POST',
          body: toggleData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(200)
        expect(data.status).toBe('active')
      })

      it('should return 404 when toggling non-existent task', async () => {
        const nonExistentId = new ObjectId().toString()
        
        const toggleData = {
          action: 'toggle',
          id: nonExistentId
        }
        
        const req = mockRequest({
          method: 'POST',
          body: toggleData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(404)
        expect(data.error).toBe('Task not found')
      })
    })

    describe('error handling', () => {
      it('should return 400 for invalid action', async () => {
        const invalidData = {
          action: 'invalid-action'
        }
        
        const req = mockRequest({
          method: 'POST',
          body: invalidData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid action')
      })

      it('should return 401 when authentication fails', async () => {
        const { requireAuth } = require('@/lib/auth')
        requireAuth.mockResolvedValue({
          error: { message: 'Authentication required', status: 401 }
        })
        
        const req = mockRequest({
          method: 'POST',
          body: { action: 'create' }
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(401)
        expect(data.error).toBe('Authentication required')
      })

      it('should handle database errors gracefully', async () => {
        // Mock database error
        const mongodb = require('@/lib/mongodb')
        mongodb.getDatabase.mockRejectedValueOnce(new Error('Database error'))
        
        const req = mockRequest({
          method: 'POST',
          body: { action: 'create', name: 'Test' }
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to process task action')
      })

      it('should handle malformed request body', async () => {
        const req = mockRequest({
          method: 'POST'
        }) as NextRequest
        
        // Mock JSON parsing error
        req.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'))
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to process task action')
      })
    })

    describe('data validation', () => {
      it('should handle ObjectId validation', async () => {
        const invalidId = 'invalid-object-id'
        
        const updateData = {
          action: 'update',
          id: invalidId,
          updates: { name: 'Updated' }
        }
        
        const req = mockRequest({
          method: 'POST',
          body: updateData
        }) as NextRequest
        
        const response = await POST(req)
        
        // Should handle invalid ObjectId gracefully
        expect(response.status).toBeGreaterThanOrEqual(400)
      })

      it('should preserve task data types', async () => {
        const taskData = {
          action: 'create',
          name: 'Type Test Task',
          description: 'Testing data types',
          type: 'price-alert',
          frequency: 'Every 5 minutes',
          config: {
            threshold: 0.05,
            enabled: true,
            tokens: ['SOL', 'USDC']
          }
        }
        
        const req = mockRequest({
          method: 'POST',
          body: taskData
        }) as NextRequest
        
        const response = await POST(req)
        const data = await response.json()
        
        expect(response.status).toBe(200)
        expect(typeof data.config.threshold).toBe('number')
        expect(typeof data.config.enabled).toBe('boolean')
        expect(Array.isArray(data.config.tokens)).toBe(true)
        expect(data.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      })
    })
  })
})