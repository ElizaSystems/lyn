import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'
import { EnhancedSubscriptionService } from '@/lib/services/enhanced-subscription-service'
import { SubscriptionManagementService } from '@/lib/services/subscription-management-service'
import { SubscriptionTier, PaymentToken } from '@/lib/models/subscription'
import { z } from 'zod'

// Validation schema
const upgradeSubscriptionSchema = z.object({
  newTier: z.enum(['basic', 'pro', 'enterprise']),
  paymentReference: z.string().min(1, 'Payment reference is required'),
  transactionSignature: z.string().min(1, 'Transaction signature is required')
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
    const validation = upgradeSubscriptionSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { newTier, paymentReference, transactionSignature } = validation.data

    // Initialize services
    const subscriptionService = new EnhancedSubscriptionService(connection)
    const managementService = new SubscriptionManagementService(connection)

    // Check if user has an active subscription
    const currentSubscription = await subscriptionService.getActiveSubscription(user.walletAddress)
    if (!currentSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found. Please create a new subscription instead.' },
        { status: 400 }
      )
    }

    // Check if the new tier is different from current
    if (currentSubscription.tier === newTier) {
      return NextResponse.json(
        { error: `You already have the ${newTier} tier` },
        { status: 400 }
      )
    }

    // Get tier information for comparison
    const availableTiers = subscriptionService.getAvailableTiers()
    const currentTierInfo = availableTiers.find(t => t.tier === currentSubscription.tier)
    const newTierInfo = availableTiers.find(t => t.tier === newTier)
    
    if (!currentTierInfo || !newTierInfo) {
      return NextResponse.json(
        { error: 'Invalid tier configuration' },
        { status: 400 }
      )
    }

    // Determine if this is an upgrade or downgrade
    const tierOrder = { basic: 1, pro: 2, enterprise: 3 }
    const isUpgrade = tierOrder[newTier as keyof typeof tierOrder] > tierOrder[currentSubscription.tier as keyof typeof tierOrder]
    
    // Calculate proration if downgrading
    let prorationCredit = 0
    if (!isUpgrade) {
      // Calculate prorated refund for downgrade
      const currentTierPrice = currentTierInfo.pricing[currentSubscription.billingCycle][currentSubscription.paymentToken as PaymentToken]
      const newTierPrice = newTierInfo.pricing[currentSubscription.billingCycle][currentSubscription.paymentToken as PaymentToken]
      
      const remainingDays = Math.max(0, Math.floor((new Date(currentSubscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      const totalDays = currentSubscription.billingCycle === 'yearly' ? 365 : 30
      
      if (remainingDays > 0 && currentTierPrice > newTierPrice) {
        prorationCredit = ((currentTierPrice - newTierPrice) * remainingDays) / totalDays
      }
    }

    // Process the tier change
    const result = await managementService.processSubscriptionTierChange(
      user.walletAddress,
      newTier as SubscriptionTier,
      paymentReference,
      prorationCredit
    )

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Failed to change subscription tier',
          paymentReference
        },
        { status: 400 }
      )
    }

    const updatedSubscription = result.subscription!

    // Prepare response
    const response = {
      success: true,
      subscription: {
        id: updatedSubscription._id?.toString(),
        tier: updatedSubscription.tier,
        status: updatedSubscription.status,
        startDate: updatedSubscription.startDate.toISOString(),
        endDate: updatedSubscription.endDate.toISOString(),
        billingCycle: updatedSubscription.billingCycle,
        autoRenewal: updatedSubscription.autoRenewal,
        amount: updatedSubscription.amount,
        token: updatedSubscription.paymentToken
      },
      change: {
        from: currentSubscription.tier,
        to: newTier,
        type: isUpgrade ? 'upgrade' : 'downgrade',
        effectiveDate: new Date().toISOString(),
        prorationCredit: result.prorationAmount || 0
      },
      newFeatures: newTierInfo.features,
      newLimits: newTierInfo.limits,
      message: `Successfully ${isUpgrade ? 'upgraded' : 'downgraded'} to ${newTierInfo.name} tier!`
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Subscription upgrade error:', error)
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Transaction verification failed')) {
        return NextResponse.json(
          { error: 'Unable to verify payment transaction. Please check the transaction signature.' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('Payment reference not found')) {
        return NextResponse.json(
          { error: 'Invalid payment reference' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to change subscription tier' },
      { status: 500 }
    )
  }
}