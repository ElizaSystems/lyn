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
    
    const { attemptId, hintIndex } = await req.json()
    
    if (!attemptId || hintIndex === undefined) {
      return NextResponse.json(
        { error: 'Attempt ID and hint index required' },
        { status: 400 }
      )
    }
    
    const hint = await securityChallengeService.getHint(attemptId, hintIndex)
    
    if (!hint) {
      return NextResponse.json(
        { error: 'Hint not available' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      ...hint
    })
  } catch (error) {
    console.error('Error getting hint:', error)
    return NextResponse.json(
      { error: 'Failed to get hint' },
      { status: 500 }
    )
  }
}