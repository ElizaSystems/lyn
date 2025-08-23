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
    
    const { challengeId } = await req.json()
    
    if (!challengeId) {
      return NextResponse.json(
        { error: 'Challenge ID required' },
        { status: 400 }
      )
    }
    
    const attempt = await securityChallengeService.startChallenge(
      challengeId,
      authResult.userId,
      authResult.username || 'Anonymous'
    )
    
    if (!attempt) {
      return NextResponse.json(
        { error: 'Failed to start challenge' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      attemptId: attempt._id
    })
  } catch (error) {
    console.error('Error starting challenge:', error)
    return NextResponse.json(
      { error: 'Failed to start challenge' },
      { status: 500 }
    )
  }
}