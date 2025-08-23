import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/services/subscription-service'
import { SubscriptionManagementService } from '@/lib/services/subscription-management-service'
import { PaymentVerificationService } from '@/lib/services/payment-verification-service'
import { PaymentRetryService } from '@/lib/services/payment-retry-service'
import { WebhookService } from '@/lib/services/webhook-service'
import { InvoiceService } from '@/lib/services/invoice-service'
import { connection } from '@/lib/solana'

export async function GET(request: NextRequest) {
  try {
    // Verify this is from a cron job or admin
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const startTime = Date.now()
    const results: any = {
      timestamp: new Date().toISOString(),
      tasks: {}
    }

    // Initialize services
    SubscriptionService.initializeEnhancedService(connection)
    const managementService = new SubscriptionManagementService(connection)
    const verificationService = new PaymentVerificationService(connection)
    const retryService = new PaymentRetryService(connection)

    try {
      // 1. Process subscription renewals and notifications
      console.log('[Cron] Processing subscription renewals...')
      const renewalResults = await managementService.processSubscriptionRenewals()
      results.tasks.renewals = {
        success: true,
        ...renewalResults
      }
    } catch (error) {
      console.error('[Cron] Error processing renewals:', error)
      results.tasks.renewals = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      // 2. Update expired subscriptions (legacy system)
      console.log('[Cron] Updating expired legacy subscriptions...')
      const legacyUpdatedCount = await SubscriptionService.updateExpiredSubscriptions()
      results.tasks.legacyExpiration = {
        success: true,
        updatedSubscriptions: legacyUpdatedCount
      }
    } catch (error) {
      console.error('[Cron] Error updating legacy subscriptions:', error)
      results.tasks.legacyExpiration = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      // 3. Verify pending payments
      console.log('[Cron] Verifying pending payments...')
      const verificationResults = await verificationService.verifyPendingPayments(100)
      results.tasks.paymentVerification = {
        success: true,
        ...verificationResults
      }
    } catch (error) {
      console.error('[Cron] Error verifying payments:', error)
      results.tasks.paymentVerification = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      // 4. Process failed payment retries
      console.log('[Cron] Processing payment retries...')
      const retryResults = await retryService.processFailedPayments(50)
      results.tasks.paymentRetries = {
        success: true,
        ...retryResults
      }
    } catch (error) {
      console.error('[Cron] Error processing payment retries:', error)
      results.tasks.paymentRetries = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      // 5. Process webhook deliveries
      console.log('[Cron] Processing webhook deliveries...')
      const webhookResults = await WebhookService.processWebhookDeliveries()
      results.tasks.webhookDeliveries = {
        success: true,
        ...webhookResults
      }
    } catch (error) {
      console.error('[Cron] Error processing webhooks:', error)
      results.tasks.webhookDeliveries = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      // 6. Reset monthly usage counters (run on the 1st of each month)
      const now = new Date()
      if (now.getDate() === 1) {
        console.log('[Cron] Resetting monthly usage counters...')
        const usageResetResults = await managementService.resetMonthlyUsage()
        results.tasks.usageReset = {
          success: true,
          ...usageResetResults
        }
      } else {
        results.tasks.usageReset = {
          success: true,
          skipped: true,
          reason: 'Not first day of month'
        }
      }
    } catch (error) {
      console.error('[Cron] Error resetting usage:', error)
      results.tasks.usageReset = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      // 7. Mark overdue invoices
      console.log('[Cron] Marking overdue invoices...')
      const overdueCount = await InvoiceService.markOverdueInvoices()
      results.tasks.overdueInvoices = {
        success: true,
        markedOverdue: overdueCount
      }
    } catch (error) {
      console.error('[Cron] Error marking overdue invoices:', error)
      results.tasks.overdueInvoices = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      // 8. Cleanup old webhook events (weekly)
      if (now.getDay() === 0) { // Sunday
        console.log('[Cron] Cleaning up old webhook events...')
        const cleanupCount = await WebhookService.cleanupOldEvents(30)
        results.tasks.webhookCleanup = {
          success: true,
          cleanedUp: cleanupCount
        }
      } else {
        results.tasks.webhookCleanup = {
          success: true,
          skipped: true,
          reason: 'Not Sunday (weekly cleanup day)'
        }
      }
    } catch (error) {
      console.error('[Cron] Error cleaning up webhook events:', error)
      results.tasks.webhookCleanup = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Calculate execution time
    const executionTime = Date.now() - startTime
    results.executionTimeMs = executionTime
    results.success = true

    // Count successful vs failed tasks
    const taskKeys = Object.keys(results.tasks)
    const successfulTasks = taskKeys.filter(key => results.tasks[key].success).length
    const failedTasks = taskKeys.length - successfulTasks

    results.summary = {
      totalTasks: taskKeys.length,
      successful: successfulTasks,
      failed: failedTasks,
      executionTimeSeconds: Math.round(executionTime / 1000)
    }

    console.log(`[Cron] Completed subscription maintenance: ${successfulTasks}/${taskKeys.length} tasks successful in ${Math.round(executionTime / 1000)}s`)
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Subscription cron error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to complete subscription maintenance',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}