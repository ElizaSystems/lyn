import { NextRequest, NextResponse } from 'next/server'
import { ReferralService } from '@/lib/services/referral-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }
    
    const dashboard = await ReferralService.getReferralDashboard(userId)
    
    if (!dashboard) {
      return NextResponse.json(
        { error: 'No referral code found for user' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(dashboard)
  } catch (error) {
    console.error('Error getting referral dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to get referral dashboard' },
      { status: 500 }
    )
  }
}