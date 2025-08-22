import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Get subscription details
    const subscription = await SubscriptionService.getSubscription(user.walletAddress)
    const hasActive = await SubscriptionService.hasActiveSubscription(user.walletAddress)
    
    return NextResponse.json({
      hasActiveSubscription: hasActive,
      subscription,
      user: {
        walletAddress: user.walletAddress,
        username: user.username
      }
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}