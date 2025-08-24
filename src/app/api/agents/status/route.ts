import { NextRequest, NextResponse } from 'next/server'
import { getAgentStatus } from '@/lib/agent-framework'

export async function GET(request: NextRequest) {
  try {
    const status = await getAgentStatus()
    
    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to get agent status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve agent status' },
      { status: 500 }
    )
  }
}