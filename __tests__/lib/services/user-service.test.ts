import { MongoClient, Db, ObjectId } from 'mongodb'
import { UserService } from '@/lib/services/user-service'
import { setupTestDb, teardownTestDb, clearTestDb } from '../../utils/test-db'
import { generateTestWallet, signMessage, createTestUser, createTestTask } from '../../utils/test-helpers'

// Mock the mongodb connection
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

describe('UserService', () => {
  let client: MongoClient
  let db: Db
  let testWallet: { publicKey: string; secretKey: Uint8Array }

  beforeAll(async () => {
    const testDbSetup = await setupTestDb()
    client = testDbSetup.client
    db = testDbSetup.db
    
    // Set the test database for the mocked module
    const mongodb = require('@/lib/mongodb')
    mongodb.__setTestDb(db)
    
    testWallet = generateTestWallet()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  describe('User Authentication', () => {
    it('should create a new user when authenticating for the first time', async () => {
      const nonce = 'Sign this message to authenticate: test123'
      const signature = signMessage(nonce, testWallet.secretKey)
      
      const result = await UserService.authenticateWithWallet(
        testWallet.publicKey,
        signature,
        nonce
      )
      
      expect(result).toBeDefined()
      expect(result?.user.walletAddress).toBe(testWallet.publicKey)
      expect(result?.token).toBeDefined()
      expect(typeof result?.token).toBe('string')
      
      // Verify user was created in database
      const usersCollection = db.collection('users')
      const user = await usersCollection.findOne({ walletAddress: testWallet.publicKey })
      expect(user).toBeDefined()
      expect(user?.walletAddress).toBe(testWallet.publicKey)
    })

    it('should authenticate existing user', async () => {
      // Create user first
      const user = await UserService.createUser(testWallet.publicKey)
      
      const nonce = 'Sign this message to authenticate: test456'
      const signature = signMessage(nonce, testWallet.secretKey)
      
      const result = await UserService.authenticateWithWallet(
        testWallet.publicKey,
        signature,
        nonce
      )
      
      expect(result).toBeDefined()
      expect(result?.user.walletAddress).toBe(testWallet.publicKey)
      expect(result?.user._id?.toString()).toBe(user._id?.toString())
    })

    it('should reject invalid signature', async () => {
      const nonce = 'Sign this message to authenticate: test789'
      const invalidSignature = 'invalid-signature'
      
      const result = await UserService.authenticateWithWallet(
        testWallet.publicKey,
        invalidSignature,
        nonce
      )
      
      expect(result).toBeNull()
    })

    it('should validate JWT tokens correctly', async () => {
      // Create and authenticate user
      const nonce = 'Sign this message to authenticate: token-test'
      const signature = signMessage(nonce, testWallet.secretKey)
      
      const authResult = await UserService.authenticateWithWallet(
        testWallet.publicKey,
        signature,
        nonce
      )
      
      expect(authResult).toBeDefined()
      const token = authResult!.token
      
      // Validate token
      const validation = await UserService.validateToken(token)
      expect(validation).toBeDefined()
      expect(validation?.walletAddress).toBe(testWallet.publicKey)
    })

    it('should reject expired or invalid tokens', async () => {
      const invalidToken = 'invalid.jwt.token'
      const validation = await UserService.validateToken(invalidToken)
      expect(validation).toBeNull()
    })
  })

  describe('User Management', () => {
    it('should create user with default preferences', async () => {
      const user = await UserService.createUser(testWallet.publicKey)
      
      expect(user._id).toBeDefined()
      expect(user.walletAddress).toBe(testWallet.publicKey)
      expect(user.preferences).toEqual({
        theme: 'system',
        notifications: true,
        autoRefresh: true
      })
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should find user by ID', async () => {
      const createdUser = await UserService.createUser(testWallet.publicKey)
      const foundUser = await UserService.getUserById(createdUser._id!.toString())
      
      expect(foundUser).toBeDefined()
      expect(foundUser?.walletAddress).toBe(testWallet.publicKey)
      expect(foundUser?._id?.toString()).toBe(createdUser._id?.toString())
    })

    it('should find user by wallet address', async () => {
      const createdUser = await UserService.createUser(testWallet.publicKey)
      const foundUser = await UserService.getUserByWallet(testWallet.publicKey)
      
      expect(foundUser).toBeDefined()
      expect(foundUser?.walletAddress).toBe(testWallet.publicKey)
      expect(foundUser?._id?.toString()).toBe(createdUser._id?.toString())
    })

    it('should update user preferences', async () => {
      const user = await UserService.createUser(testWallet.publicKey)
      
      const updates = {
        preferences: {
          theme: 'dark' as const,
          notifications: false,
          autoRefresh: false
        }
      }
      
      const updatedUser = await UserService.updateUser(user._id!.toString(), updates)
      
      expect(updatedUser).toBeDefined()
      expect(updatedUser?.preferences?.theme).toBe('dark')
      expect(updatedUser?.preferences?.notifications).toBe(false)
      expect(updatedUser?.preferences?.autoRefresh).toBe(false)
      expect(updatedUser?.updatedAt).not.toEqual(user.updatedAt)
    })

    it('should return null for non-existent user', async () => {
      const nonExistentId = new ObjectId().toString()
      const user = await UserService.getUserById(nonExistentId)
      expect(user).toBeNull()
    })
  })

  describe('Task Management', () => {
    let userId: string

    beforeEach(async () => {
      const user = await UserService.createUser(testWallet.publicKey)
      userId = user._id!.toString()
    })

    it('should create task for user', async () => {
      const taskData = {
        name: 'Security Scan',
        description: 'Daily security scan',
        status: 'active' as const,
        type: 'security-scan' as const,
        frequency: 'Every 24 hours',
        lastRun: new Date(),
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
        successRate: 100
      }
      
      const task = await UserService.createTask(userId, taskData)
      
      expect(task._id).toBeDefined()
      expect(task.userId.toString()).toBe(userId)
      expect(task.name).toBe(taskData.name)
      expect(task.status).toBe('active')
      expect(task.createdAt).toBeInstanceOf(Date)
    })

    it('should get user tasks', async () => {
      // Create multiple tasks
      const task1 = await UserService.createTask(userId, createTestTask(userId, { name: 'Task 1' }))
      const task2 = await UserService.createTask(userId, createTestTask(userId, { name: 'Task 2' }))
      
      const tasks = await UserService.getUserTasks(userId)
      
      expect(tasks).toHaveLength(2)
      expect(tasks.some(t => t.name === 'Task 1')).toBe(true)
      expect(tasks.some(t => t.name === 'Task 2')).toBe(true)
    })

    it('should update task', async () => {
      const task = await UserService.createTask(userId, createTestTask(userId))
      
      const updates = {
        status: 'paused' as const,
        successRate: 95
      }
      
      const updatedTask = await UserService.updateTask(userId, task._id!.toString(), updates)
      
      expect(updatedTask).toBeDefined()
      expect(updatedTask?.status).toBe('paused')
      expect(updatedTask?.successRate).toBe(95)
      expect(updatedTask?.updatedAt).not.toEqual(task.updatedAt)
    })

    it('should delete task', async () => {
      const task = await UserService.createTask(userId, createTestTask(userId))
      
      const deleted = await UserService.deleteTask(userId, task._id!.toString())
      expect(deleted).toBe(true)
      
      const tasks = await UserService.getUserTasks(userId)
      expect(tasks).toHaveLength(0)
    })

    it('should not allow users to access other users tasks', async () => {
      // Create another user
      const otherWallet = generateTestWallet()
      const otherUser = await UserService.createUser(otherWallet.publicKey)
      const otherUserId = otherUser._id!.toString()
      
      // Create task for first user
      const task = await UserService.createTask(userId, createTestTask(userId))
      
      // Try to update task with other user ID
      const updatedTask = await UserService.updateTask(otherUserId, task._id!.toString(), { status: 'paused' })
      expect(updatedTask).toBeNull()
      
      // Try to delete task with other user ID
      const deleted = await UserService.deleteTask(otherUserId, task._id!.toString())
      expect(deleted).toBe(false)
    })
  })

  describe('Wallet Management', () => {
    let userId: string

    beforeEach(async () => {
      const user = await UserService.createUser(testWallet.publicKey)
      userId = user._id!.toString()
    })

    it('should add wallet for user', async () => {
      const walletAddress = generateTestWallet().publicKey
      const wallet = await UserService.addWallet(userId, walletAddress, 'My Wallet')
      
      expect(wallet._id).toBeDefined()
      expect(wallet.userId.toString()).toBe(userId)
      expect(wallet.address).toBe(walletAddress)
      expect(wallet.name).toBe('My Wallet')
      expect(wallet.isDefault).toBe(false) // Since user already has primary wallet
    })

    it('should get user wallets', async () => {
      const wallet1 = await UserService.addWallet(userId, generateTestWallet().publicKey, 'Wallet 1')
      const wallet2 = await UserService.addWallet(userId, generateTestWallet().publicKey, 'Wallet 2')
      
      const wallets = await UserService.getUserWallets(userId)
      
      expect(wallets).toHaveLength(2)
      expect(wallets.some(w => w.name === 'Wallet 1')).toBe(true)
      expect(wallets.some(w => w.name === 'Wallet 2')).toBe(true)
    })

    it('should set first wallet as default', async () => {
      // Create new user without any wallets
      const newWallet = generateTestWallet()
      const newUser = await UserService.createUser(newWallet.publicKey)
      
      // Clear wallets collection to simulate fresh user
      await db.collection('wallets').deleteMany({ userId: newUser._id })
      
      const firstWallet = await UserService.addWallet(newUser._id!.toString(), newWallet.publicKey, 'First Wallet')
      expect(firstWallet.isDefault).toBe(true)
      
      const secondWallet = await UserService.addWallet(newUser._id!.toString(), generateTestWallet().publicKey, 'Second Wallet')
      expect(secondWallet.isDefault).toBe(false)
    })
  })

  describe('Session Management', () => {
    it('should logout user by clearing sessions', async () => {
      const user = await UserService.createUser(testWallet.publicKey)
      const userId = user._id!.toString()
      
      // Logout should complete without error
      await expect(UserService.logout(userId)).resolves.not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid wallet addresses gracefully', async () => {
      const invalidAddress = 'invalid-wallet-address'
      const nonce = 'Sign this message to authenticate: error-test'
      const signature = 'invalid-signature'
      
      const result = await UserService.authenticateWithWallet(invalidAddress, signature, nonce)
      expect(result).toBeNull()
    })

    it('should handle database connection errors', async () => {
      // Mock database error
      const originalGetDatabase = require('@/lib/mongodb').getDatabase
      require('@/lib/mongodb').getDatabase = jest.fn().mockRejectedValue(new Error('Database connection failed'))
      
      await expect(UserService.createUser(testWallet.publicKey)).rejects.toThrow()
      
      // Restore original function
      require('@/lib/mongodb').getDatabase = originalGetDatabase
    })
  })
})