import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'
import { EnhancedSubscriptionService } from '@/lib/services/enhanced-subscription-service'
import { SubscriptionTier, PaymentToken } from '@/lib/models/subscription'
import { z } from 'zod'

// Validation schema
const initiatePaymentSchema = z.object({
  tier: z.enum(['basic', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']),
  token: z.enum(['SOL', 'USDC']),
  referralCode: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = initiatePaymentSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { tier, billingCycle, token, referralCode } = validation.data

    // Initialize services
    const subscriptionService = new EnhancedSubscriptionService(connection)

    // Check if user already has an active subscription
    const existingSubscription = await subscriptionService.getActiveSubscription(user.walletAddress)
    if (existingSubscription && existingSubscription.tier === tier) {
      return NextResponse.json(
        { error: `You already have an active ${tier} subscription` },
        { status: 400 }
      )
    }

    // Create payment request
    const paymentRequest = await subscriptionService.createSubscriptionPaymentRequest(
      user.walletAddress,
      tier as SubscriptionTier,
      billingCycle,
      token as PaymentToken,
      referralCode
    )

    // Get tier information for response
    const availableTiers = subscriptionService.getAvailableTiers()
    const tierInfo = availableTiers.find(t => t.tier === tier)

    return NextResponse.json({
      success: true,
      paymentRequest: {
        paymentReference: paymentRequest.paymentReference,
        amount: paymentRequest.amount,
        token: paymentRequest.token,
        recipientAddress: paymentRequest.recipientAddress,
        description: paymentRequest.description,
        expiresAt: paymentRequest.expiresAt.toISOString()
      },
      subscription: {
        tier,
        billingCycle,
        tierInfo: tierInfo ? {
          name: tierInfo.name,
          description: tierInfo.description,
          features: tierInfo.features,
          limits: tierInfo.limits
        } : null
      },
      instructions: {
        steps: [
          `Send exactly ${paymentRequest.amount} ${paymentRequest.token} to the recipient address`,
          'Copy the transaction signature after the transaction confirms',
          'Submit the transaction signature using the confirmation endpoint',
          'Your subscription will be activated upon payment verification'
        ],
        important: [
          'Do not send less than the exact amount required',
          'Only send from the wallet address associated with your account',
          'Payment request expires in 30 minutes',
          'Transaction must be confirmed on the Solana blockchain'
        ]
      }
    })

  } catch (error) {
    console.error('Payment initiation error:', error)
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Price not available')) {
        return NextResponse.json(
          { error: 'Selected payment option not available' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('Invalid subscription tier')) {
        return NextResponse.json(
          { error: 'Invalid subscription tier selected' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    )
  }
}