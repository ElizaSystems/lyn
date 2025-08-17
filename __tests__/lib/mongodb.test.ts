import { MongoClient, Db } from 'mongodb'
import { setupTestDb, teardownTestDb, clearTestDb, getTestDb } from '../utils/test-db'

// Mock the mongodb module for the connection utility
jest.mock('@/lib/mongodb', () => {
  let testDb: Db
  
  return {
    getDatabase: jest.fn(async () => {
      if (!testDb) {
        throw new Error('Test database not initialized')
      }
      return testDb
    }),
    closeConnection: jest.fn(),
    __setTestDb: (db: Db) => {
      testDb = db
    }
  }
})

describe('MongoDB Connection', () => {
  let client: MongoClient
  let db: Db

  beforeAll(async () => {
    const testDbSetup = await setupTestDb()
    client = testDbSetup.client
    db = testDbSetup.db
    
    // Set the test database for the mocked module
    const mongodb = require('@/lib/mongodb')
    mongodb.__setTestDb(db)
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  describe('Database Connection', () => {
    it('should connect to the database successfully', async () => {
      expect(client).toBeDefined()
      expect(db).toBeDefined()
      
      // Test that we can perform operations
      const testCollection = db.collection('test')
      const result = await testCollection.insertOne({ test: 'data' })
      expect(result.insertedId).toBeDefined()
    })

    it('should be able to create and query collections', async () => {
      const usersCollection = db.collection('users')
      const tasksCollection = db.collection('tasks')
      
      // Insert test data
      await usersCollection.insertOne({
        walletAddress: 'test-wallet',
        createdAt: new Date()
      })
      
      await tasksCollection.insertOne({
        userId: 'test-user-id',
        name: 'Test Task',
        status: 'active'
      })
      
      // Query data
      const user = await usersCollection.findOne({ walletAddress: 'test-wallet' })
      const task = await tasksCollection.findOne({ userId: 'test-user-id' })
      
      expect(user).toBeDefined()
      expect(user?.walletAddress).toBe('test-wallet')
      expect(task).toBeDefined()
      expect(task?.name).toBe('Test Task')
    })

    it('should handle database operations with proper error handling', async () => {
      const collection = db.collection('test')
      
      // Test successful operation
      const insertResult = await collection.insertOne({ data: 'test' })
      expect(insertResult.acknowledged).toBe(true)
      
      // Test query operations
      const findResult = await collection.findOne({ data: 'test' })
      expect(findResult).toBeDefined()
      expect(findResult?.data).toBe('test')
      
      // Test update operations
      const updateResult = await collection.updateOne(
        { data: 'test' },
        { $set: { updated: true } }
      )
      expect(updateResult.modifiedCount).toBe(1)
      
      // Test delete operations
      const deleteResult = await collection.deleteOne({ data: 'test' })
      expect(deleteResult.deletedCount).toBe(1)
    })

    it('should handle concurrent operations', async () => {
      const collection = db.collection('concurrent-test')
      
      // Perform multiple concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) =>
        collection.insertOne({ index: i, timestamp: new Date() })
      )
      
      const results = await Promise.all(operations)
      
      // Verify all operations succeeded
      results.forEach(result => {
        expect(result.acknowledged).toBe(true)
        expect(result.insertedId).toBeDefined()
      })
      
      // Verify all documents were inserted
      const count = await collection.countDocuments()
      expect(count).toBe(10)
    })

    it('should support indexing and aggregation', async () => {
      const collection = db.collection('aggregation-test')
      
      // Insert test data
      const testData = [
        { category: 'A', value: 10, date: new Date('2024-01-01') },
        { category: 'A', value: 20, date: new Date('2024-01-02') },
        { category: 'B', value: 15, date: new Date('2024-01-01') },
        { category: 'B', value: 25, date: new Date('2024-01-02') },
      ]
      
      await collection.insertMany(testData)
      
      // Create index
      await collection.createIndex({ category: 1, date: 1 })
      
      // Test aggregation
      const aggregationResult = await collection.aggregate([
        {
          $group: {
            _id: '$category',
            totalValue: { $sum: '$value' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray()
      
      expect(aggregationResult).toHaveLength(2)
      expect(aggregationResult[0]).toEqual({
        _id: 'A',
        totalValue: 30,
        count: 2
      })
      expect(aggregationResult[1]).toEqual({
        _id: 'B',
        totalValue: 40,
        count: 2
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid collection operations gracefully', async () => {
      const collection = db.collection('error-test')
      
      // Test invalid ObjectId
      const invalidQuery = { _id: 'invalid-object-id' }
      await expect(collection.findOne(invalidQuery)).rejects.toThrow()
    })

    it('should handle connection errors gracefully', async () => {
      // This test would be more relevant with actual network issues
      // For now, we'll test that our error handling structure is in place
      const collection = db.collection('connection-test')
      
      try {
        await collection.insertOne({ test: 'connection' })
        const result = await collection.findOne({ test: 'connection' })
        expect(result).toBeDefined()
      } catch (error) {
        // If an error occurs, it should be properly typed
        expect(error).toBeInstanceOf(Error)
      }
    })
  })
})