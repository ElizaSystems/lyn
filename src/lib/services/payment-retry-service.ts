import { getDatabase } from '@/lib/mongodb'
import { Connection } from '@solana/web3.js'
import { ObjectId } from 'mongodb'
import { 
  PaymentTransaction, 
  PaymentStatus, 
  PaymentToken 
} from '@/lib/models/subscription'
import { CryptoPaymentService } from './crypto-payment-service'
import { PaymentVerificationService } from './payment-verification-service'
import { WebhookService } from './webhook-service'
import { NotificationService } from './notification-service'

export interface RetryPolicy {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export interface PaymentFailureHandler {
  type: 'notification' | 'refund' | 'webhook' | 'escalation'
  config: any
}

export class PaymentRetryService {
  private connection: Connection
  private paymentService: CryptoPaymentService
  private verificationService: PaymentVerificationService

  private static readonly DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxRetries: 5,
    baseDelayMs: 5000, // 5 seconds
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2,
    retryableErrors: [
      'network_error',
      'rpc_error',
      'temporary_failure',
      'timeout',
      'rate_limit'
    ]
  }

  private static readonly FAILURE_HANDLERS: PaymentFailureHandler[] = [
    {
      type: 'notification',
      config: { 
        notifyUser: true,
        notifyAdmin: true,
        severity: 'high'
      }
    },
    {
      type: 'webhook',
      config: {
        eventType: 'payment.failed',
        includeRetryInfo: true
      }
    }
  ]

  constructor(connection: Connection) {
    this.connection = connection
    this.paymentService = CryptoPaymentService.getInstance(connection)
    this.verificationService = new PaymentVerificationService(connection)
  }

  /**
   * Process failed payments with retry logic
   */
  async processFailedPayments(
    limit: number = 20,
    customRetryPolicy?: Partial<RetryPolicy>
  ): Promise<{
    processed: number
    retried: number
    recovered: number
    permanentlyFailed: number
    errors: string[]
  }> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    let processed = 0
    let retried = 0
    let recovered = 0
    let permanentlyFailed = 0
    const errors: string[] = []

    const retryPolicy = { ...PaymentRetryService.DEFAULT_RETRY_POLICY, ...customRetryPolicy }

    try {
      // Get failed payments that might be retryable
      const failedPayments = await paymentsCollection
        .find({
          status: PaymentStatus.FAILED,
          retryCount: { $lt: retryPolicy.maxRetries },
          $or: [
            { lastRetryAt: { $exists: false } },
            { 
              lastRetryAt: { 
                $lt: new Date(Date.now() - this.calculateRetryDelay(0, retryPolicy))
              }
            }
          ]
        })
        .limit(limit)
        .sort({ failedAt: 1 }) // Process oldest failures first
        .toArray()

      console.log(`[Payment Retry] Found ${failedPayments.length} payments eligible for retry`)

      for (const payment of failedPayments) {
        processed++

        try {
          const shouldRetry = await this.shouldRetryPayment(payment, retryPolicy)
          
          if (!shouldRetry.retry) {
            // Mark as permanently failed
            await this.markPaymentAsPermanentlyFailed(
              payment.paymentReference, 
              shouldRetry.reason || 'Maximum retries exceeded'
            )
            permanentlyFailed++
            continue
          }

          // Attempt retry
          const retryResult = await this.retryPayment(payment, retryPolicy)
          retried++

          if (retryResult.success) {
            recovered++
            console.log(`[Payment Retry] Successfully recovered payment ${payment.paymentReference}`)
            
            // Trigger success webhook
            await WebhookService.createWebhookEvent('payment.recovered', {
              paymentReference: payment.paymentReference,
              walletAddress: payment.walletAddress,
              amount: payment.amount,
              token: payment.token,
              retryAttempt: payment.retryCount + 1
            })

          } else {
            console.warn(`[Payment Retry] Retry failed for payment ${payment.paymentReference}: ${retryResult.error}`)
            
            // Check if this was the final attempt
            if (payment.retryCount + 1 >= retryPolicy.maxRetries) {
              await this.markPaymentAsPermanentlyFailed(
                payment.paymentReference,
                retryResult.error || 'All retry attempts exhausted'
              )
              permanentlyFailed++
            }
          }

        } catch (error) {
          const errorMsg = `Error processing retry for payment ${payment.paymentReference}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.error(`[Payment Retry] ${errorMsg}`)
        }

        // Small delay between retries to avoid overwhelming services
        await this.delay(1000)
      }

      console.log(`[Payment Retry] Processing complete: ${processed} processed, ${retried} retried, ${recovered} recovered, ${permanentlyFailed} permanently failed`)

      return { processed, retried, recovered, permanentlyFailed, errors }

    } catch (error) {
      const errorMsg = `Error in payment retry processing: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      console.error(`[Payment Retry] ${errorMsg}`)
      
      return { processed, retried, recovered, permanentlyFailed, errors }
    }
  }

  /**
   * Determine if a payment should be retried
   */
  private async shouldRetryPayment(
    payment: any,
    retryPolicy: RetryPolicy
  ): Promise<{
    retry: boolean
    reason?: string
  }> {
    // Check retry count
    if (payment.retryCount >= retryPolicy.maxRetries) {
      return { 
        retry: false, 
        reason: `Maximum retries (${retryPolicy.maxRetries}) exceeded` 
      }
    }

    // Check if failure reason is retryable
    const failureReason = payment.failureReason?.toLowerCase() || ''
    const isRetryableError = retryPolicy.retryableErrors.some(error => 
      failureReason.includes(error.toLowerCase())
    )

    if (!isRetryableError && payment.failureReason) {
      return { 
        retry: false, 
        reason: `Non-retryable error: ${payment.failureReason}` 
      }
    }

    // Check if enough time has passed since last retry
    if (payment.lastRetryAt) {
      const timeSinceLastRetry = Date.now() - new Date(payment.lastRetryAt).getTime()
      const requiredDelay = this.calculateRetryDelay(payment.retryCount, retryPolicy)
      
      if (timeSinceLastRetry < requiredDelay) {
        return { 
          retry: false, 
          reason: `Retry delay not met (${Math.round(requiredDelay / 1000)}s remaining)` 
        }
      }
    }

    // Check payment age - don't retry payments older than 24 hours
    const paymentAge = Date.now() - new Date(payment.createdAt).getTime()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    if (paymentAge > maxAge) {
      return { 
        retry: false, 
        reason: 'Payment too old (>24h)' 
      }
    }

    return { retry: true }
  }

  /**
   * Retry a failed payment
   */
  private async retryPayment(
    payment: any,
    retryPolicy: RetryPolicy
  ): Promise<{
    success: boolean
    error?: string
  }> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    try {
      // Update retry information
      const newRetryCount = payment.retryCount + 1
      await paymentsCollection.updateOne(
        { paymentReference: payment.paymentReference },
        {
          $set: {
            status: PaymentStatus.PENDING,
            retryCount: newRetryCount,
            lastRetryAt: new Date(),
            updatedAt: new Date()
          },
          $unset: {
            failedAt: "",
            failureReason: ""
          }
        }
      )

      // If we have a transaction signature, try to verify it again
      if (payment.transactionSignature) {
        const verificationResult = await this.verificationService.verifyPayment(
          payment.transactionSignature,
          payment.token as PaymentToken,
          payment.amount,
          process.env.NEXT_PUBLIC_AGENT_WALLET || 'LYNAIagent1111111111111111111111111111111111'
        )

        if (verificationResult.isValid) {
          // Payment is actually valid, mark as confirmed
          await paymentsCollection.updateOne(
            { paymentReference: payment.paymentReference },
            {
              $set: {
                status: PaymentStatus.CONFIRMED,
                confirmedAt: new Date(),
                updatedAt: new Date()
              }
            }
          )

          return { success: true }
        } else {
          // Verification still fails, update with new error
          await paymentsCollection.updateOne(
            { paymentReference: payment.paymentReference },
            {
              $set: {
                status: PaymentStatus.FAILED,
                failedAt: new Date(),
                failureReason: verificationResult.errorMessage || 'Transaction verification failed on retry',
                updatedAt: new Date()
              }
            }
          )

          return { 
            success: false, 
            error: verificationResult.errorMessage || 'Transaction verification failed on retry' 
          }
        }
      } else {
        // No transaction signature available, can't retry verification
        await paymentsCollection.updateOne(
          { paymentReference: payment.paymentReference },
          {
            $set: {
              status: PaymentStatus.FAILED,
              failedAt: new Date(),
              failureReason: 'No transaction signature available for verification',
              updatedAt: new Date()
            }
          }
        )

        return { 
          success: false, 
          error: 'No transaction signature available for verification' 
        }
      }

    } catch (error) {
      // Update payment with retry failure
      await paymentsCollection.updateOne(
        { paymentReference: payment.paymentReference },
        {
          $set: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: `Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            updatedAt: new Date()
          }
        }
      )

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown retry error' 
      }
    }
  }

  /**
   * Mark payment as permanently failed
   */
  private async markPaymentAsPermanentlyFailed(
    paymentReference: string,
    reason: string
  ): Promise<void> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    await paymentsCollection.updateOne(
      { paymentReference },
      {
        $set: {
          status: PaymentStatus.FAILED,
          failureReason: reason,
          permanentlyFailed: true,
          updatedAt: new Date()
        }
      }
    )

    // Get payment details for notifications
    const payment = await paymentsCollection.findOne({ paymentReference })
    if (payment) {
      // Trigger failure handlers
      await this.handlePaymentFailure(payment, reason)
    }

    console.log(`[Payment Retry] Marked payment ${paymentReference} as permanently failed: ${reason}`)
  }

  /**
   * Handle payment failure with various strategies
   */
  private async handlePaymentFailure(payment: any, reason: string): Promise<void> {
    const handlers = PaymentRetryService.FAILURE_HANDLERS

    for (const handler of handlers) {
      try {
        switch (handler.type) {
          case 'notification':
            await this.sendFailureNotification(payment, reason, handler.config)
            break
          case 'webhook':
            await this.triggerFailureWebhook(payment, reason, handler.config)
            break
          case 'escalation':
            await this.escalateFailure(payment, reason, handler.config)
            break
        }
      } catch (error) {
        console.error(`[Payment Retry] Error in failure handler ${handler.type}:`, error)
      }
    }
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(
    payment: any,
    reason: string,
    config: any
  ): Promise<void> {
    if (config.notifyUser && NotificationService) {
      await NotificationService.createNotification(
        payment.walletAddress,
        'Payment Failed',
        `Your payment of ${payment.amount} ${payment.token} could not be processed. Reason: ${reason}. Please contact support if you need assistance.`,
        'payment_failure',
        {
          paymentReference: payment.paymentReference,
          amount: payment.amount,
          token: payment.token,
          reason
        }
      )
    }

    if (config.notifyAdmin) {
      console.error(`[Payment Retry] ADMIN ALERT: Payment ${payment.paymentReference} permanently failed - ${reason}`)
      // In production, this would send an alert to admin channels
    }
  }

  /**
   * Trigger failure webhook
   */
  private async triggerFailureWebhook(
    payment: any,
    reason: string,
    config: any
  ): Promise<void> {
    const webhookData: any = {
      paymentReference: payment.paymentReference,
      walletAddress: payment.walletAddress,
      amount: payment.amount,
      token: payment.token,
      failureReason: reason,
      finalFailure: true
    }

    if (config.includeRetryInfo) {
      webhookData.retryInfo = {
        retryCount: payment.retryCount,
        lastRetryAt: payment.lastRetryAt,
        maxRetriesReached: true
      }
    }

    await WebhookService.createWebhookEvent(config.eventType, webhookData)
  }

  /**
   * Escalate failure to support systems
   */
  private async escalateFailure(
    payment: any,
    reason: string,
    config: any
  ): Promise<void> {
    // In production, this would create support tickets, alert systems, etc.
    console.warn(`[Payment Retry] ESCALATION: Payment ${payment.paymentReference} requires manual intervention - ${reason}`)
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, policy: RetryPolicy): number {
    const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, retryCount)
    return Math.min(delay, policy.maxDelayMs)
  }

  /**
   * Get payment retry statistics
   */
  async getRetryStatistics(): Promise<{
    totalFailedPayments: number
    retriedPayments: number
    recoveredPayments: number
    permanentlyFailedPayments: number
    averageRetryCount: number
    recoveryRate: number
    topFailureReasons: Array<{ reason: string; count: number }>
    retryEffectiveness: { [retryCount: number]: number }
  }> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    // Get basic statistics
    const [totalFailed, retried, recovered, permanentlyFailed] = await Promise.all([
      paymentsCollection.countDocuments({ status: PaymentStatus.FAILED }),
      paymentsCollection.countDocuments({ retryCount: { $gt: 0 } }),
      paymentsCollection.countDocuments({ 
        status: PaymentStatus.CONFIRMED, 
        retryCount: { $gt: 0 } 
      }),
      paymentsCollection.countDocuments({ permanentlyFailed: true })
    ])

    // Calculate average retry count
    const retryAggregation = await paymentsCollection.aggregate([
      { $match: { retryCount: { $gt: 0 } } },
      { $group: { _id: null, avgRetryCount: { $avg: '$retryCount' } } }
    ]).toArray()

    const averageRetryCount = retryAggregation.length > 0 ? retryAggregation[0].avgRetryCount : 0

    // Calculate recovery rate
    const recoveryRate = retried > 0 ? (recovered / retried) * 100 : 0

    // Get top failure reasons
    const failureReasonAggregation = await paymentsCollection.aggregate([
      { $match: { status: PaymentStatus.FAILED, failureReason: { $exists: true } } },
      { $group: { _id: '$failureReason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    const topFailureReasons = failureReasonAggregation.map(item => ({
      reason: item._id,
      count: item.count
    }))

    // Get retry effectiveness by attempt number
    const retryEffectivenessAggregation = await paymentsCollection.aggregate([
      { 
        $match: { 
          status: PaymentStatus.CONFIRMED, 
          retryCount: { $gt: 0 } 
        } 
      },
      { $group: { _id: '$retryCount', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray()

    const retryEffectiveness: { [retryCount: number]: number } = {}
    retryEffectivenessAggregation.forEach(item => {
      retryEffectiveness[item._id] = item.count
    })

    return {
      totalFailedPayments: totalFailed,
      retriedPayments: retried,
      recoveredPayments: recovered,
      permanentlyFailedPayments: permanentlyFailed,
      averageRetryCount: Math.round(averageRetryCount * 100) / 100,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      topFailureReasons,
      retryEffectiveness
    }
  }

  /**
   * Manually retry a specific payment
   */
  async manualRetry(paymentReference: string): Promise<{
    success: boolean
    error?: string
  }> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    try {
      const payment = await paymentsCollection.findOne({ paymentReference })
      if (!payment) {
        return { success: false, error: 'Payment not found' }
      }

      if (payment.status === PaymentStatus.CONFIRMED) {
        return { success: false, error: 'Payment is already confirmed' }
      }

      // Force retry regardless of retry policy
      const retryResult = await this.retryPayment(payment, PaymentRetryService.DEFAULT_RETRY_POLICY)
      
      console.log(`[Payment Retry] Manual retry for ${paymentReference}: ${retryResult.success ? 'SUCCESS' : 'FAILED'} - ${retryResult.error || 'No error'}`)
      
      return retryResult

    } catch (error) {
      console.error(`[Payment Retry] Error in manual retry for ${paymentReference}:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}