import { NextRequest, NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

export async function GET(request: NextRequest) {
  try {
    console.log(`[Username Check] Starting request`)
    
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    
    console.log(`[Username Check] Checking: ${username}`)
    console.log(`[Username Check] Environment: ${process.env.NODE_ENV}`)
    console.log(`[Username Check] Has MongoDB URI: ${!!process.env.MONGODB_URI}`)
    
    if (!username) {
      return NextResponse.json({ 
        error: 'Username parameter required',
        available: false 
      }, { status: 400 })
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ 
        available: false,
        username,
        error: 'Invalid username format'
      })
    }

    // Try to check database
    if (!process.env.MONGODB_URI) {
      console.log(`[Username Check] No MongoDB URI, returning available=true`)
      return NextResponse.json({
        available: true,
        username,
        fallback: true,
        message: 'Database not available, cannot verify'
      })
    }

    try {
      const client = new MongoClient(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })
      
      await client.connect()
      console.log(`[Username Check] Connected to MongoDB`)
      
      const db = client.db(process.env.MONGODB_DB_NAME || 'lyn')
      const usersCollection = db.collection('users')
      
      const user = await usersCollection.findOne({ username })
      console.log(`[Username Check] User found: ${!!user}`)
      
      await client.close()
      
      return NextResponse.json({
        available: !user,
        username
      })
      
    } catch (dbError) {
      console.error(`[Username Check] Database error:`, dbError)
      return NextResponse.json({
        available: true,
        username,
        fallback: true,
        error: 'Database temporarily unavailable'
      })
    }

  } catch (error) {
    console.error(`[Username Check] Unexpected error:`, error)
    
    const username = new URL(request.url).searchParams.get('username')
    return NextResponse.json({
      available: true,
      username,
      fallback: true,
      error: 'Service temporarily unavailable'
    })
  }
}