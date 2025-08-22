import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { connection } from '@/lib/solana'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const { transactionSignature, referralCode } = await request.json()
    
    if (!transactionSignature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      )
    }
    
    // Verify the SOL payment
    const isValidPayment = await SubscriptionService.verifyPayment(
      connection,
      transactionSignature
    )
    
    if (!isValidPayment) {
      return NextResponse.json(
        { error: 'Invalid payment transaction. Please ensure you sent 0.5 SOL to the treasury wallet.' },
        { status: 400 }
      )
    }
    
    // Check if user already has an active subscription
    const hasActive = await SubscriptionService.hasActiveSubscription(user.walletAddress)
    
    if (hasActive) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      )
    }
    
    // Create the subscription
    const subscription = await SubscriptionService.createSubscription(
      user.walletAddress,
      transactionSignature,
      referralCode
    )
    
    return NextResponse.json({
      success: true,
      subscription,
      message: 'Subscription activated successfully!'
    })
  } catch (error) {
    console.error('Subscription creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}