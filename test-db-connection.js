const { MongoClient } = require('mongodb')
require('dotenv').config({ path: '.env.local' })

async function testConnection() {
  console.log('🔍 Testing MongoDB connection...')
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
  
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  
  if (!uri) {
    console.log('❌ MONGODB_URI is not set in environment')
    return false
  }
  
  if (!dbName) {
    console.log('❌ MONGODB_DB_NAME is not set in environment')
    return false
  }
  
  console.log(`📡 URI: ${uri.substring(0, 20)}...`)
  console.log(`📁 Database: ${dbName}`)
  
  let client
  try {
    console.log('🔌 Connecting to MongoDB...')
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    
    await client.connect()
    console.log('✅ Connected successfully')
    
    const db = client.db(dbName)
    console.log('🏗️  Database object created')
    
    // Test ping
    await db.admin().ping()
    console.log('🏓 Ping successful')
    
    // List collections
    const collections = await db.listCollections().toArray()
    console.log(`📚 Collections found: ${collections.length}`)
    collections.forEach(col => console.log(`  - ${col.name}`))
    
    // Test referral_codes_v2 collection
    const referralCodes = db.collection('referral_codes_v2')
    const referralCount = await referralCodes.countDocuments()
    console.log(`🔗 Referral codes count: ${referralCount}`)
    
    // Test users collection  
    const users = db.collection('users')
    const userCount = await users.countDocuments()
    console.log(`👥 Users count: ${userCount}`)
    
    return true
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    return false
  } finally {
    if (client) {
      await client.close()
      console.log('🔐 Connection closed')
    }
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1)
})