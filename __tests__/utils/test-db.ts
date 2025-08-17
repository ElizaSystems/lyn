import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, Db } from 'mongodb'

let mongod: MongoMemoryServer
let client: MongoClient
let db: Db

export async function setupTestDb(): Promise<{ client: MongoClient; db: Db }> {
  // Start in-memory MongoDB instance
  mongod = await MongoMemoryServer.create({
    binary: {
      version: '7.0.0'
    }
  })
  
  const uri = mongod.getUri()
  client = new MongoClient(uri)
  
  await client.connect()
  db = client.db('test')
  
  return { client, db }
}

export async function teardownTestDb(): Promise<void> {
  if (client) {
    await client.close()
  }
  if (mongod) {
    await mongod.stop()
  }
}

export async function clearTestDb(): Promise<void> {
  if (db) {
    const collections = await db.listCollections().toArray()
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({})
    }
  }
}

export function getTestDb(): Db {
  if (!db) {
    throw new Error('Test database not initialized. Call setupTestDb() first.')
  }
  return db
}