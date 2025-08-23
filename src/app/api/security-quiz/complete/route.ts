import { NextRequest, NextResponse } from 'next/server'
import { securityQuizService } from '@/lib/services/security-quiz-service'
import { verifyAuth } from '@/lib/auth-helper'

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { sessionId } = await req.json()
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      )
    }
    
    const results = await securityQuizService.completeQuizSession(sessionId)
    
    if (!results) {
      return NextResponse.json(
        { error: 'Failed to complete session' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error completing quiz session:', error)
    return NextResponse.json(
      { error: 'Failed to complete session' },
      { status: 500 }
    )
  }
}