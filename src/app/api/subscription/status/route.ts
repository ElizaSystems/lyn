import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Initialize enhanced service
    SubscriptionService.initializeEnhancedService(connection)
    
    // Get subscription details with enhanced system fallback
    const statusResult = await SubscriptionService.getEnhancedSubscriptionStatus(user.walletAddress)
    
    const response: any = {
      hasActiveSubscription: statusResult.hasActiveSubscription,
      subscription: statusResult.subscription,
      isLegacy: statusResult.isLegacy,
      user: {
        walletAddress: user.walletAddress,
        username: user.username
      }
    }

    // Add migration info if using legacy system
    if (statusResult.isLegacy && statusResult.hasActiveSubscription) {
      response.migration = {
        available: true,
        benefits: [
          'Multi-tier subscription options (Basic, Pro, Enterprise)',
          'USDC payment support in addition to SOL',
          'Enhanced usage tracking and limits',
          'Automatic renewal reminders',
          'Grace period protection',
          'Detailed payment history and invoicing',
          'Advanced refund mechanisms'
        ],
        endpoint: '/api/subscription/migrate'
      }
    }

    // Add available tiers information
    response.availableTiers = SubscriptionService.getSubscriptionTiers()

    return NextResponse.json(response)
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}