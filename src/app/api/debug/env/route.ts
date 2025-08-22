import { NextResponse } from 'next/server'

export async function GET() {
  // Only show environment debug info in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ 
      error: 'Environment debug disabled in production',
      env: process.env.NODE_ENV,
      hasMongoUri: !!process.env.MONGODB_URI,
      hasMongoDbName: !!process.env.MONGODB_DB_NAME
    })
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    hasMongoDbName: !!process.env.MONGODB_DB_NAME,
    mongoUriPrefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'Not set',
    mongoDbName: process.env.MONGODB_DB_NAME || 'Not set'
  })
}