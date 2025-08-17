import { MongoClient, Db } from 'mongodb'
import { NextRequest } from 'next/server'
import { GET as getTasksHandler, POST as postTasksHandler } from '@/app/api/tasks/route'
import { setupTestDb, teardownTestDb, clearTestDb } from '../utils/test-db'
import { generateTestWallet, signMessage, mockRequest } from '../utils/test-helpers'

// Mock all dependencies
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

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn()
}))

describe('Complete Workflow Integration Tests', () => {
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
    testUserId = 'test-user-id-123'
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
    
    // Setup auth mock
    const { requireAuth } = require('@/lib/auth')
    requireAuth.mockImplementation((handler: any) => {
      return async (req: NextRequest) => {
        const authResult = {
          user: {
            id: testUserId,
            walletAddress: testWallet.publicKey,
            tokenBalance: 1000,
            hasTokenAccess: true
          }
        }
        return handler(req, authResult.user)
      }
    })
  })

  describe('User Task Management Workflow', () => {
    it('should complete full task lifecycle: create -> read -> update -> delete', async () => {
      // Step 1: Create a new task
      const createRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'create',
          name: 'Integration Test Task',
          description: 'A task created during integration testing',
          type: 'security-scan',
          frequency: 'Every 6 hours',
          config: {
            scanType: 'comprehensive',
            alertThreshold: 'high'
          }
        }
      }) as NextRequest

      const createResponse = await postTasksHandler(createRequest)
      expect(createResponse.status).toBe(200)
      
      const createdTask = await createResponse.json()
      expect(createdTask._id).toBeDefined()
      expect(createdTask.name).toBe('Integration Test Task')
      expect(createdTask.userId).toBe(testUserId)
      expect(createdTask.status).toBe('active')

      const taskId = createdTask._id

      // Step 2: Read all tasks (should include the created task)
      const readRequest = mockRequest() as NextRequest
      const readResponse = await getTasksHandler(readRequest)
      expect(readResponse.status).toBe(200)
      
      const tasks = await readResponse.json()
      expect(tasks).toHaveLength(1)
      expect(tasks[0]._id).toBe(taskId)
      expect(tasks[0].name).toBe('Integration Test Task')

      // Step 3: Update the task
      const updateRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'update',
          id: taskId,
          updates: {
            name: 'Updated Integration Test Task',
            status: 'paused',
            successRate: 95,
            config: {
              scanType: 'comprehensive',
              alertThreshold: 'medium'
            }
          }
        }
      }) as NextRequest

      const updateResponse = await postTasksHandler(updateRequest)
      expect(updateResponse.status).toBe(200)
      
      const updatedTask = await updateResponse.json()
      expect(updatedTask.name).toBe('Updated Integration Test Task')
      expect(updatedTask.status).toBe('paused')
      expect(updatedTask.successRate).toBe(95)

      // Step 4: Toggle task status
      const toggleRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'toggle',
          id: taskId
        }
      }) as NextRequest

      const toggleResponse = await postTasksHandler(toggleRequest)
      expect(toggleResponse.status).toBe(200)
      
      const toggledTask = await toggleResponse.json()
      expect(toggledTask.status).toBe('active') // Should be toggled from 'paused' to 'active'

      // Step 5: Delete the task
      const deleteRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'delete',
          id: taskId
        }
      }) as NextRequest

      const deleteResponse = await postTasksHandler(deleteRequest)
      expect(deleteResponse.status).toBe(200)
      
      const deleteResult = await deleteResponse.json()
      expect(deleteResult.success).toBe(true)

      // Step 6: Verify task is deleted
      const finalReadRequest = mockRequest() as NextRequest
      const finalReadResponse = await getTasksHandler(finalReadRequest)
      expect(finalReadResponse.status).toBe(200)
      
      const finalTasks = await finalReadResponse.json()
      expect(finalTasks).toHaveLength(0)
    })

    it('should handle multiple tasks for the same user', async () => {
      // Create multiple tasks
      const taskTypes = ['security-scan', 'wallet-monitor', 'price-alert'] as const
      const createdTasks = []

      for (let i = 0; i < taskTypes.length; i++) {
        const createRequest = mockRequest({
          method: 'POST',
          body: {
            action: 'create',
            name: `Task ${i + 1}`,
            description: `Description for task ${i + 1}`,
            type: taskTypes[i],
            frequency: 'Every 24 hours'
          }
        }) as NextRequest

        const response = await postTasksHandler(createRequest)
        expect(response.status).toBe(200)
        
        const task = await response.json()
        createdTasks.push(task)
      }

      // Read all tasks
      const readRequest = mockRequest() as NextRequest
      const readResponse = await getTasksHandler(readRequest)
      expect(readResponse.status).toBe(200)
      
      const tasks = await readResponse.json()
      expect(tasks).toHaveLength(3)

      // Verify all tasks belong to the same user
      tasks.forEach((task: any) => {
        expect(task.userId).toBe(testUserId)
      })

      // Update multiple tasks
      for (const task of createdTasks) {
        const updateRequest = mockRequest({
          method: 'POST',
          body: {
            action: 'update',
            id: task._id,
            updates: {
              status: 'paused'
            }
          }
        }) as NextRequest

        const response = await postTasksHandler(updateRequest)
        expect(response.status).toBe(200)
      }

      // Verify all tasks are paused
      const verifyRequest = mockRequest() as NextRequest
      const verifyResponse = await getTasksHandler(verifyRequest)
      const updatedTasks = await verifyResponse.json()
      
      updatedTasks.forEach((task: any) => {
        expect(task.status).toBe('paused')
      })
    })

    it('should maintain data consistency during concurrent operations', async () => {
      // Create initial task
      const createRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'create',
          name: 'Concurrency Test Task',
          description: 'Testing concurrent operations',
          type: 'security-scan',
          frequency: 'Every hour'
        }
      }) as NextRequest

      const createResponse = await postTasksHandler(createRequest)
      const createdTask = await createResponse.json()
      const taskId = createdTask._id

      // Perform multiple concurrent operations
      const operations = [
        // Multiple read operations
        getTasksHandler(mockRequest() as NextRequest),
        getTasksHandler(mockRequest() as NextRequest),
        getTasksHandler(mockRequest() as NextRequest),
        
        // Multiple update operations
        postTasksHandler(mockRequest({
          method: 'POST',
          body: {
            action: 'update',
            id: taskId,
            updates: { successRate: 90 }
          }
        }) as NextRequest),
        
        postTasksHandler(mockRequest({
          method: 'POST',
          body: {
            action: 'update',
            id: taskId,
            updates: { successRate: 85 }
          }
        }) as NextRequest)
      ]

      const results = await Promise.all(operations)

      // Verify all operations completed successfully
      results.forEach((response, index) => {
        expect(response.status).toBe(200)
      })

      // Verify final state is consistent
      const finalReadRequest = mockRequest() as NextRequest
      const finalReadResponse = await getTasksHandler(finalReadRequest)
      const finalTasks = await finalReadResponse.json()
      
      expect(finalTasks).toHaveLength(1)
      expect(finalTasks[0]._id).toBe(taskId)
      expect([85, 90]).toContain(finalTasks[0].successRate) // Should be one of the update values
    })

    it('should handle error scenarios gracefully', async () => {
      // Test invalid task ID
      const invalidUpdateRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'update',
          id: 'invalid-object-id',
          updates: { name: 'Updated' }
        }
      }) as NextRequest

      const invalidUpdateResponse = await postTasksHandler(invalidUpdateRequest)
      expect(invalidUpdateResponse.status).toBeGreaterThanOrEqual(400)

      // Test non-existent task
      const nonExistentId = '507f1f77bcf86cd799439011' // Valid ObjectId format but doesn't exist
      const nonExistentRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'update',
          id: nonExistentId,
          updates: { name: 'Updated' }
        }
      }) as NextRequest

      const nonExistentResponse = await postTasksHandler(nonExistentRequest)
      expect(nonExistentResponse.status).toBe(404)

      // Test invalid action
      const invalidActionRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'invalid-action',
          id: nonExistentId
        }
      }) as NextRequest

      const invalidActionResponse = await postTasksHandler(invalidActionRequest)
      expect(invalidActionResponse.status).toBe(400)
    })
  })

  describe('Database State Verification', () => {
    it('should persist data correctly in MongoDB', async () => {
      // Create task via API
      const createRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'create',
          name: 'Database Persistence Test',
          description: 'Testing database persistence',
          type: 'wallet-monitor',
          frequency: 'Real-time',
          config: { monitorType: 'balance' }
        }
      }) as NextRequest

      const createResponse = await postTasksHandler(createRequest)
      const createdTask = await createResponse.json()

      // Verify data exists in MongoDB directly
      const tasksCollection = db.collection('tasks')
      const dbTask = await tasksCollection.findOne({ _id: createdTask._id })

      expect(dbTask).toBeDefined()
      expect(dbTask?.name).toBe('Database Persistence Test')
      expect(dbTask?.userId).toBe(testUserId)
      expect(dbTask?.config?.monitorType).toBe('balance')
      expect(dbTask?.createdAt).toBeInstanceOf(Date)
      expect(dbTask?.updatedAt).toBeInstanceOf(Date)

      // Update via API and verify in database
      const updateRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'update',
          id: createdTask._id,
          updates: {
            name: 'Updated Database Test',
            config: { monitorType: 'transactions' }
          }
        }
      }) as NextRequest

      await postTasksHandler(updateRequest)

      // Verify update in database
      const updatedDbTask = await tasksCollection.findOne({ _id: createdTask._id })
      expect(updatedDbTask?.name).toBe('Updated Database Test')
      expect(updatedDbTask?.config?.monitorType).toBe('transactions')
      expect(updatedDbTask?.updatedAt).not.toEqual(dbTask?.updatedAt)

      // Delete via API and verify in database
      const deleteRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'delete',
          id: createdTask._id
        }
      }) as NextRequest

      await postTasksHandler(deleteRequest)

      // Verify deletion in database
      const deletedDbTask = await tasksCollection.findOne({ _id: createdTask._id })
      expect(deletedDbTask).toBeNull()
    })

    it('should enforce user isolation at database level', async () => {
      const otherUserId = 'other-user-id-456'

      // Create task for first user
      const createRequest1 = mockRequest({
        method: 'POST',
        body: {
          action: 'create',
          name: 'User 1 Task',
          description: 'Task for user 1',
          type: 'security-scan',
          frequency: 'Daily'
        }
      }) as NextRequest

      const createResponse1 = await postTasksHandler(createRequest1)
      const task1 = await createResponse1.json()

      // Create task directly in database for second user
      const tasksCollection = db.collection('tasks')
      const task2 = {
        userId: otherUserId,
        name: 'User 2 Task',
        description: 'Task for user 2',
        status: 'active',
        type: 'price-alert',
        frequency: 'Hourly',
        successRate: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const insertResult = await tasksCollection.insertOne(task2)

      // Verify both tasks exist in database
      const allTasks = await tasksCollection.find({}).toArray()
      expect(allTasks).toHaveLength(2)

      // Verify API only returns tasks for authenticated user
      const readRequest = mockRequest() as NextRequest
      const readResponse = await getTasksHandler(readRequest)
      const userTasks = await readResponse.json()

      expect(userTasks).toHaveLength(1)
      expect(userTasks[0]._id).toBe(task1._id)
      expect(userTasks[0].name).toBe('User 1 Task')

      // Verify user cannot access other user's task
      const unauthorizedUpdateRequest = mockRequest({
        method: 'POST',
        body: {
          action: 'update',
          id: insertResult.insertedId.toString(),
          updates: { name: 'Hacked Task' }
        }
      }) as NextRequest

      const unauthorizedResponse = await postTasksHandler(unauthorizedUpdateRequest)
      expect(unauthorizedResponse.status).toBe(404) // Should not find the task

      // Verify other user's task was not modified
      const unchangedTask = await tasksCollection.findOne({ _id: insertResult.insertedId })
      expect(unchangedTask?.name).toBe('User 2 Task')
    })
  })
})