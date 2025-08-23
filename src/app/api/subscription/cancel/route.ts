import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'
import { EnhancedSubscriptionService } from '@/lib/services/enhanced-subscription-service'
import { RefundService } from '@/lib/services/refund-service'
import { z } from 'zod'

// Validation schema
const cancelSubscriptionSchema = z.object({
  reason: z.enum(['user_request', 'service_failure', 'other']).optional(),
  feedback: z.string().max(500).optional(),
  requestRefund: z.boolean().optional().default(false)
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
    const validation = cancelSubscriptionSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { reason = 'user_request', feedback, requestRefund } = validation.data

    // Initialize services
    const subscriptionService = new EnhancedSubscriptionService(connection)
    const refundService = new RefundService(connection)

    // Get current subscription
    const subscription = await subscriptionService.getActiveSubscription(user.walletAddress)
    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    // Calculate refund eligibility
    const subscriptionAge = Date.now() - new Date(subscription.startDate).getTime()
    const subscriptionAgeDays = Math.floor(subscriptionAge / (1000 * 60 * 60 * 24))
    const isRefundEligible = subscriptionAgeDays <= 7 // 7-day refund policy
    
    // Cancel the subscription
    const cancelResult = await subscriptionService.cancelSubscription(
      user.walletAddress,
      feedback || `User requested cancellation. Reason: ${reason}`
    )

    if (!cancelResult.success) {
      return NextResponse.json(
        { error: cancelResult.error || 'Failed to cancel subscription' },
        { status: 400 }
      )
    }

    const cancelledSubscription = cancelResult.subscription!
    
    // Handle refund request if eligible and requested
    let refundInfo = null
    if (requestRefund && isRefundEligible) {
      try {
        const refundResult = await refundService.createRefundRequest(
          subscription.paymentReference,
          reason as any,
          feedback || 'User requested refund upon cancellation',
          user.walletAddress
        )

        if (refundResult.success) {
          refundInfo = {
            refundReference: refundResult.refundRequest?.refundReference,
            refundAmount: refundResult.refundRequest?.refundAmount,
            refundToken: refundResult.refundRequest?.refundToken,
            status: 'pending_review',
            expectedProcessingDays: '3-5 business days'
          }
        }
      } catch (refundError) {
        console.error('Error creating refund request:', refundError)
        // Don't fail cancellation if refund creation fails
      }
    }

    // Calculate remaining subscription value
    const endDate = new Date(subscription.endDate)
    const now = new Date()
    const remainingDays = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const totalDays = subscription.billingCycle === 'yearly' ? 365 : 30
    const remainingValue = remainingDays > 0 ? (subscription.amount * remainingDays) / totalDays : 0

    // Prepare response
    const response = {
      success: true,
      cancellation: {
        subscriptionId: subscription._id?.toString(),
        tier: subscription.tier,
        cancelledAt: new Date().toISOString(),
        effectiveDate: new Date().toISOString(), // Immediate cancellation
        remainingDays,
        remainingValue: Math.round(remainingValue * 1000000) / 1000000, // Round to 6 decimal places
        reason,
        feedback
      },
      refund: refundInfo,
      refundEligibility: {
        eligible: isRefundEligible,
        reason: isRefundEligible 
          ? 'Within 7-day refund policy window'
          : `Subscription is ${subscriptionAgeDays} days old (refund policy: 7 days)`,
        subscriptionAge: {
          days: subscriptionAgeDays,
          startDate: subscription.startDate.toISOString()
        }
      },
      message: refundInfo 
        ? 'Subscription cancelled successfully. Your refund request has been submitted and will be processed within 3-5 business days.'
        : 'Subscription cancelled successfully. You will continue to have access until the end of your billing period.',
      support: {
        email: 'support@lyn.ai',
        note: 'If you need assistance or want to reactivate your subscription, please contact our support team.'
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Subscription cancellation error:', error)
    
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}