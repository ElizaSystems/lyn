import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({
      message: 'API is working',
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasSessionSecret: !!process.env.SESSION_SECRET
    })
  } catch (error) {
    return NextResponse.json({
      error: 'API test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 })
  }
}