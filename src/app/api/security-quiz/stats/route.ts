import { NextRequest, NextResponse } from 'next/server'
import { securityQuizService } from '@/lib/services/security-quiz-service'
import { verifyAuth } from '@/lib/auth-helper'

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const stats = await securityQuizService.getUserQuizStats(authResult.userId)
    
    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error getting quiz stats:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}