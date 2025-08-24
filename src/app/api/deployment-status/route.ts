import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'deployed',
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    fixes: {
      usernameRegistration: true,
      sessionPersistence: true,
      authStateMaintenance: true,
      deployedAt: '2025-08-24T06:15:00Z'
    },
    message: 'Username registration fixes are deployed'
  })
}