import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { User, UserTask, UserWallet, UserSession } from '@/lib/models/user'
import jwt from 'jsonwebtoken'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret'

export class UserService {
  private static async getUsersCollection() {
    const db = await getDatabase()
    return db.collection<User>('users')
  }

  private static async getTasksCollection() {
    const db = await getDatabase()
    return db.collection<UserTask>('tasks')
  }

  private static async getWalletsCollection() {
    const db = await getDatabase()
    return db.collection<UserWallet>('wallets')
  }

  private static async getSessionsCollection() {
    const db = await getDatabase()
    return db.collection<UserSession>('sessions')
  }

  // User Authentication Methods
  static async authenticateWithWallet(walletAddress: string, signature: string, nonce: string): Promise<{ user: User; token: string } | null> {
    try {
      // Verify the signature
      const message = `Sign this message to authenticate: ${nonce}`
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = bs58.decode(signature)
      const publicKeyBytes = new PublicKey(walletAddress).toBytes()

      const isValidSignature = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      )

      if (!isValidSignature) {
        return null
      }

      const users = await this.getUsersCollection()
      
      // Find or create user
      let user = await users.findOne({ walletAddress })
      
      if (!user) {
        user = await this.createUser(walletAddress) as User & { _id: ObjectId }
      }

      // Create session
      const sessions = await this.getSessionsCollection()
      const session: UserSession = {
        userId: user._id!,
        walletAddress,
        signature,
        nonce,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date()
      }
      
      await sessions.insertOne(session)

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, walletAddress },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return { user, token }
    } catch (error) {
      console.error('Authentication error:', error)
      return null
    }
  }

  static async createUser(walletAddress: string): Promise<User> {
    const users = await this.getUsersCollection()
    
    const user: User = {
      walletAddress,
      publicKey: walletAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'system',
        notifications: true,
        autoRefresh: true
      }
    }

    const result = await users.insertOne(user)
    return { ...user, _id: result.insertedId }
  }

  static async getUserById(userId: string): Promise<User | null> {
    const users = await this.getUsersCollection()
    return await users.findOne({ _id: new ObjectId(userId) })
  }

  static async getUserByWallet(walletAddress: string): Promise<User | null> {
    const users = await this.getUsersCollection()
    return await users.findOne({ walletAddress })
  }

  static async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const users = await this.getUsersCollection()
    
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    return result || null
  }

  // Task Management Methods
  static async getUserTasks(userId: string): Promise<UserTask[]> {
    const tasks = await this.getTasksCollection()
    return await tasks.find({ userId: new ObjectId(userId) }).toArray()
  }

  static async createTask(userId: string, taskData: Omit<UserTask, '_id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<UserTask> {
    const tasks = await this.getTasksCollection()
    
    const task: UserTask = {
      ...taskData,
      userId: new ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await tasks.insertOne(task)
    return { ...task, _id: result.insertedId }
  }

  static async updateTask(userId: string, taskId: string, updates: Partial<UserTask>): Promise<UserTask | null> {
    const tasks = await this.getTasksCollection()
    
    const result = await tasks.findOneAndUpdate(
      { _id: new ObjectId(taskId), userId: new ObjectId(userId) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    return result || null
  }

  static async deleteTask(userId: string, taskId: string): Promise<boolean> {
    const tasks = await this.getTasksCollection()
    
    const result = await tasks.deleteOne({
      _id: new ObjectId(taskId),
      userId: new ObjectId(userId)
    })

    return result.deletedCount > 0
  }

  // Wallet Management Methods
  static async getUserWallets(userId: string): Promise<UserWallet[]> {
    const wallets = await this.getWalletsCollection()
    return await wallets.find({ userId: new ObjectId(userId) }).toArray()
  }

  static async addWallet(userId: string, address: string, name?: string): Promise<UserWallet> {
    const wallets = await this.getWalletsCollection()
    
    // Check if this is the first wallet (make it default)
    const existingWallets = await this.getUserWallets(userId)
    const isDefault = existingWallets.length === 0

    const wallet: UserWallet = {
      userId: new ObjectId(userId),
      address,
      name,
      isDefault,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await wallets.insertOne(wallet)
    return { ...wallet, _id: result.insertedId }
  }

  // Session Management
  static async validateToken(token: string): Promise<{ userId: string; walletAddress: string } | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; walletAddress: string }
      
      // Check if session exists and is valid
      const sessions = await this.getSessionsCollection()
      const session = await sessions.findOne({
        userId: new ObjectId(decoded.userId),
        expiresAt: { $gt: new Date() }
      })

      if (!session) {
        return null
      }

      return {
        userId: decoded.userId,
        walletAddress: decoded.walletAddress
      }
    } catch {
      return null
    }
  }

  static async logout(userId: string): Promise<void> {
    const sessions = await this.getSessionsCollection()
    await sessions.deleteMany({ userId: new ObjectId(userId) })
  }
}