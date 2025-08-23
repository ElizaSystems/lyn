import { NextRequest, NextResponse } from 'next/server'
import { securityChallengeService } from '@/lib/services/security-challenge-service'
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
    
    const { attemptId, answers, timeSpent } = await req.json()
    
    if (!attemptId || !answers) {
      return NextResponse.json(
        { error: 'Attempt ID and answers required' },
        { status: 400 }
      )
    }
    
    const result = await securityChallengeService.submitChallengeSolution(
      attemptId,
      answers,
      timeSpent || 0
    )
    
    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error submitting challenge:', error)
    return NextResponse.json(
      { error: 'Failed to submit challenge' },
      { status: 500 }
    )
  }
}