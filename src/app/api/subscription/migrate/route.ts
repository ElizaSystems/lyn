import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'
import { SubscriptionService } from '@/lib/services/subscription-service'

export async function POST(request: NextRequest) {
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

    // Check current subscription status
    const statusResult = await SubscriptionService.getEnhancedSubscriptionStatus(user.walletAddress)
    
    if (!statusResult.hasActiveSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found to migrate' },
        { status: 404 }
      )
    }

    if (!statusResult.isLegacy) {
      return NextResponse.json(
        { error: 'Subscription is already using the enhanced system' },
        { status: 400 }
      )
    }

    // Perform migration
    const migrationResult = await SubscriptionService.migrateLegacySubscription(
      user.walletAddress,
      connection
    )

    if (!migrationResult.success) {
      return NextResponse.json(
        { 
          error: migrationResult.error || 'Migration failed',
          details: 'Please contact support if this issue persists'
        },
        { status: 400 }
      )
    }

    const newSubscription = migrationResult.newSubscription!

    return NextResponse.json({
      success: true,
      message: 'Subscription successfully migrated to enhanced system!',
      migration: {
        completedAt: new Date().toISOString(),
        from: 'Legacy System',
        to: 'Enhanced Payment System'
      },
      subscription: {
        id: newSubscription._id.toString(),
        tier: newSubscription.tier,
        status: newSubscription.status,
        startDate: newSubscription.startDate.toISOString(),
        endDate: newSubscription.endDate.toISOString(),
        billingCycle: newSubscription.billingCycle,
        paymentToken: newSubscription.paymentToken,
        autoRenewal: newSubscription.autoRenewal,
        gracePeriodEnd: newSubscription.gracePeriodEnd?.toISOString(),
        migrated: true
      },
      benefits: {
        enabled: [
          'Multi-tier subscription options',
          'USDC payment support',
          'Enhanced usage tracking',
          'Grace period protection',
          'Detailed payment history',
          'Advanced refund mechanisms',
          'Webhook notifications'
        ],
        features: {
          usageTracking: 'Track scans, API calls, and other resource usage',
          gracePeriod: '3-day grace period after subscription expires',
          multiToken: 'Pay with SOL or USDC',
          invoicing: 'Automatic invoice generation',
          webhooks: 'Real-time payment and subscription notifications'
        }
      },
      nextSteps: {
        recommendations: [
          'Review your new tier benefits and limits',
          'Set up auto-renewal preferences',
          'Configure webhook endpoints if needed',
          'Explore upgrade options for additional features'
        ],
        endpoints: {
          status: '/api/subscription/status',
          upgrade: '/api/subscription/upgrade',
          history: '/api/subscription/payment/history',
          tiers: '/api/subscription/tiers'
        }
      }
    })

  } catch (error) {
    console.error('Subscription migration error:', error)
    
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: 'An unexpected error occurred during migration. Please try again or contact support.'
      },
      { status: 500 }
    )
  }
}