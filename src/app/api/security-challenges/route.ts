import { NextRequest, NextResponse } from 'next/server'
import { securityChallengeService } from '@/lib/services/security-challenge-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')
    const simulationType = searchParams.get('simulationType')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    // Initialize default challenges if needed
    await securityChallengeService.initializeDefaultChallenges()
    
    const challenges = await securityChallengeService.getChallenges(
      {
        category: category || undefined,
        difficulty: difficulty || undefined,
        simulationType: simulationType || undefined
      },
      limit
    )
    
    return NextResponse.json({
      success: true,
      challenges
    })
  } catch (error) {
    console.error('Error getting challenges:', error)
    return NextResponse.json(
      { error: 'Failed to get challenges' },
      { status: 500 }
    )
  }
}