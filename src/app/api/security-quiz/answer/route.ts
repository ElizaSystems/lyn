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
    
    const { sessionId, questionId, answer, timeSpent, hintsUsed } = await req.json()
    
    if (!sessionId || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const result = await securityQuizService.submitAnswer(
      sessionId,
      questionId,
      answer,
      timeSpent || 0,
      hintsUsed || 0
    )
    
    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error submitting answer:', error)
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    )
  }
}