import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { connection } from '@/lib/solana'
import { getCurrentUser } from '@/lib/auth'
import { SubscriptionTier, PaymentToken } from '@/lib/models/subscription'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const { transactionSignature, referralCode, tier, billingCycle, token, paymentReference } = await request.json()

    // Initialize enhanced service
    SubscriptionService.initializeEnhancedService(connection)
    
    if (!transactionSignature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      )
    }
    
    // Check if using enhanced payment system
    if (paymentReference && tier) {
      // Use enhanced payment system
      const result = await SubscriptionService.createEnhancedSubscription(
        user.walletAddress,
        tier as SubscriptionTier,
        billingCycle || 'monthly',
        token as PaymentToken || PaymentToken.SOL,
        paymentReference,
        transactionSignature,
        referralCode
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create subscription' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        subscription: result.subscription,
        message: 'Subscription created successfully using enhanced payment system!',
        enhanced: true
      })
    }

    // Legacy payment system fallback
    if (!transactionSignature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      )
    }

    // Verify the SOL payment (legacy) with distribution check
    const isValidPayment = await SubscriptionService.verifyDistributedPayment(
      connection,
      transactionSignature,
      0.5,
      referralCode
    )
    
    if (!isValidPayment) {
      return NextResponse.json(
        { error: 'Invalid payment transaction. Please ensure you sent 0.5 SOL to the treasury wallet.' },
        { status: 400 }
      )
    }
    
    // Check if user already has an active subscription
    const statusCheck = await SubscriptionService.getEnhancedSubscriptionStatus(user.walletAddress)
    
    if (statusCheck.hasActiveSubscription) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      )
    }
    
    // Create the subscription (legacy)
    const subscription = await SubscriptionService.createSubscription(
      user.walletAddress,
      transactionSignature,
      referralCode
    )
    
    return NextResponse.json({
      success: true,
      subscription,
      message: 'Subscription activated successfully! (Legacy System)',
      enhanced: false,
      migration: {
        available: true,
        message: 'Consider migrating to the enhanced payment system for better features'
      }
    })
  } catch (error) {
    console.error('Subscription creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}