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
    
    const { questionIds } = await req.json()
    
    if (!questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { error: 'Question IDs required' },
        { status: 400 }
      )
    }
    
    const session = await securityQuizService.startQuizSession(
      authResult.userId,
      authResult.username || 'Anonymous',
      questionIds
    )
    
    if (!session) {
      return NextResponse.json(
        { error: 'Failed to start session' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      sessionId: session._id
    })
  } catch (error) {
    console.error('Error starting quiz session:', error)
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    )
  }
}