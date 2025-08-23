import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'
import { EnhancedSubscriptionService } from '@/lib/services/enhanced-subscription-service'
import { CryptoPaymentService } from '@/lib/services/crypto-payment-service'
import { InvoiceService } from '@/lib/services/invoice-service'
import { SubscriptionTier } from '@/lib/models/subscription'
import { z } from 'zod'

// Validation schema
const confirmPaymentSchema = z.object({
  paymentReference: z.string().min(1, 'Payment reference is required'),
  transactionSignature: z.string().min(1, 'Transaction signature is required'),
  tier: z.enum(['basic', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']),
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
    const validation = confirmPaymentSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { paymentReference, transactionSignature, tier, billingCycle, referralCode } = validation.data

    // Initialize services
    const subscriptionService = new EnhancedSubscriptionService(connection)
    const paymentService = CryptoPaymentService.getInstance(connection)

    // Get the payment transaction to verify it belongs to this user
    const paymentTransaction = await paymentService.getPaymentTransaction(paymentReference)
    if (!paymentTransaction) {
      return NextResponse.json(
        { error: 'Payment reference not found' },
        { status: 404 }
      )
    }

    // Verify the payment belongs to the authenticated user
    if (paymentTransaction.walletAddress !== user.walletAddress) {
      return NextResponse.json(
        { error: 'Payment reference does not belong to authenticated user' },
        { status: 403 }
      )
    }

    // Check if payment is already confirmed
    if (paymentTransaction.status === 'confirmed') {
      // Get existing subscription
      const subscription = await subscriptionService.getActiveSubscription(user.walletAddress)
      if (subscription) {
        return NextResponse.json({
          success: true,
          subscription: {
            id: subscription._id?.toString(),
            tier: subscription.tier,
            status: subscription.status,
            startDate: subscription.startDate.toISOString(),
            endDate: subscription.endDate.toISOString(),
            autoRenewal: subscription.autoRenewal,
            amount: subscription.amount,
            token: subscription.paymentToken,
            paymentReference: subscription.paymentReference
          },
          message: 'Payment already confirmed and subscription is active'
        })
      }
    }

    // Confirm the payment and create subscription
    const confirmationResult = await subscriptionService.confirmSubscriptionPayment(
      paymentReference,
      transactionSignature,
      tier as SubscriptionTier,
      billingCycle,
      referralCode
    )

    if (!confirmationResult.success) {
      return NextResponse.json(
        { 
          error: confirmationResult.error || 'Payment confirmation failed',
          paymentReference
        },
        { status: 400 }
      )
    }

    const subscription = confirmationResult.subscription!

    // Generate invoice
    try {
      const invoice = await InvoiceService.createInvoice(
        paymentTransaction,
        subscription,
        {
          walletAddress: user.walletAddress,
          username: user.username
        }
      )

      console.log(`[Payment Confirmation] Generated invoice ${invoice.invoiceNumber} for subscription ${subscription._id}`)
    } catch (invoiceError) {
      console.error('Error generating invoice:', invoiceError)
      // Don't fail the confirmation if invoice generation fails
    }

    // Prepare response
    const response = {
      success: true,
      subscription: {
        id: subscription._id?.toString(),
        tier: subscription.tier,
        status: subscription.status,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate.toISOString(),
        billingCycle: subscription.billingCycle,
        autoRenewal: subscription.autoRenewal,
        amount: subscription.amount,
        token: subscription.paymentToken,
        paymentReference: subscription.paymentReference,
        transactionSignature: subscription.transactionSignature
      },
      payment: {
        reference: paymentTransaction.paymentReference,
        amount: paymentTransaction.amount,
        token: paymentTransaction.token,
        status: 'confirmed',
        confirmedAt: new Date().toISOString()
      },
      user: {
        walletAddress: user.walletAddress,
        username: user.username,
        subscriptionStatus: 'active'
      },
      message: 'Payment confirmed successfully! Your subscription is now active.'
    }

    // Add referral information if applicable
    if (subscription.referralCode && subscription.referrerWallet) {
      response.referral = {
        code: subscription.referralCode,
        referrerWallet: subscription.referrerWallet,
        rewardAmount: subscription.tier1RewardAmount || 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Payment confirmation error:', error)
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Transaction verification failed')) {
        return NextResponse.json(
          { error: 'Unable to verify transaction on blockchain. Please check the transaction signature and try again.' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('already has an active subscription')) {
        return NextResponse.json(
          { error: 'You already have an active subscription' },
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
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}