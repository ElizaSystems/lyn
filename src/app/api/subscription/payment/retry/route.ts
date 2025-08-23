import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connection } from '@/lib/solana'
import { PaymentRetryService } from '@/lib/services/payment-retry-service'
import { CryptoPaymentService } from '@/lib/services/crypto-payment-service'
import { z } from 'zod'

// Validation schema for manual retry
const manualRetrySchema = z.object({
  paymentReference: z.string().min(1, 'Payment reference is required')
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
    const validation = manualRetrySchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { paymentReference } = validation.data

    // Initialize services
    const retryService = new PaymentRetryService(connection)
    const paymentService = CryptoPaymentService.getInstance(connection)

    // Get payment to verify ownership
    const payment = await paymentService.getPaymentTransaction(paymentReference)
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    // Verify payment belongs to authenticated user
    if (payment.walletAddress !== user.walletAddress) {
      return NextResponse.json(
        { error: 'Payment reference does not belong to authenticated user' },
        { status: 403 }
      )
    }

    // Check if payment is in a retryable state
    if (payment.status === 'confirmed') {
      return NextResponse.json(
        { error: 'Payment is already confirmed' },
        { status: 400 }
      )
    }

    if (payment.status === 'pending') {
      return NextResponse.json(
        { error: 'Payment is currently being processed' },
        { status: 400 }
      )
    }

    // Attempt manual retry
    const retryResult = await retryService.manualRetry(paymentReference)

    if (retryResult.success) {
      // Get updated payment status
      const updatedPayment = await paymentService.getPaymentTransaction(paymentReference)
      
      return NextResponse.json({
        success: true,
        message: 'Payment retry successful! Your payment has been confirmed.',
        payment: {
          reference: paymentReference,
          status: updatedPayment?.status || 'confirmed',
          amount: payment.amount,
          token: payment.token,
          confirmedAt: updatedPayment?.confirmedAt?.toISOString()
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: retryResult.error || 'Retry failed',
        message: 'Payment retry was unsuccessful. Please check your transaction or contact support.',
        payment: {
          reference: paymentReference,
          status: payment.status,
          amount: payment.amount,
          token: payment.token,
          retryCount: payment.retryCount + 1,
          failureReason: retryResult.error
        }
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Payment retry error:', error)
    
    return NextResponse.json(
      { error: 'Failed to retry payment' },
      { status: 500 }
    )
  }
}

// GET endpoint for retry statistics (admin only for now)
export async function GET(request: NextRequest) {
  try {
    // This would typically require admin authentication
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Initialize service
    const retryService = new PaymentRetryService(connection)

    // Get retry statistics
    const stats = await retryService.getRetryStatistics()

    return NextResponse.json({
      success: true,
      statistics: stats
    })

  } catch (error) {
    console.error('Error fetching retry statistics:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch retry statistics' },
      { status: 500 }
    )
  }
}