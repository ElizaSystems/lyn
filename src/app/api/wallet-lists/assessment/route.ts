import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    // Optional authentication - public assessment available but limited
    let userId: ObjectId | undefined
    const authResult = await authMiddleware(request)
    if (authResult.success) {
      userId = new ObjectId(authResult.user.userId)
    }

    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('wallet')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      )
    }

    // Validate wallet address format
    if (walletAddress.length < 32 || walletAddress.length > 44) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }

    const assessment = await WalletListService.getWalletAssessment(
      walletAddress,
      userId
    )

    // If not authenticated, limit the information provided
    if (!userId) {
      return NextResponse.json({
        overallStatus: assessment.overallStatus,
        confidence: assessment.confidence > 75 ? 'high' : assessment.confidence > 50 ? 'medium' : 'low',
        riskLevel: assessment.riskLevel,
        recommendations: assessment.recommendations.slice(0, 3), // Limit recommendations
        sources: assessment.sources.map(s => ({ type: s.type, count: s.count })), // Remove confidence details
        entryCount: assessment.entries.length,
        message: 'Sign in for detailed assessment and full entry information'
      })
    }

    return NextResponse.json(assessment)
  } catch (error) {
    console.error('[WalletLists Assessment API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to assess wallet' },
      { status: 500 }
    )
  }
}