import { getDatabase } from '@/lib/mongodb'
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js'
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import { ObjectId } from 'mongodb'
import { 
  RefundRequest, 
  PaymentTransaction, 
  PaymentToken, 
  Subscription,
  PaymentStatus,
  SubscriptionStatus 
} from '@/lib/models/subscription'
import crypto from 'crypto'

export class RefundService {
  private connection: Connection
  
  // Treasury wallet keypair (would be loaded from secure storage in production)
  private treasuryKeypair: Keypair | null = null

  constructor(connection: Connection) {
    this.connection = connection
    this.loadTreasuryKeypair()
  }

  /**
   * Load treasury keypair from environment (in production, use secure key management)
   */
  private loadTreasuryKeypair(): void {
    try {
      const privateKeyString = process.env.TREASURY_PRIVATE_KEY
      if (privateKeyString) {
        const privateKeyBytes = JSON.parse(privateKeyString)
        this.treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyBytes))
      } else {
        console.warn('[Refund Service] Treasury private key not configured - refund processing will be manual')
      }
    } catch (error) {
      console.error('[Refund Service] Error loading treasury keypair:', error)
    }
  }

  /**
   * Generate unique refund reference
   */
  private generateRefundReference(): string {
    const timestamp = Date.now().toString(36)
    const randomBytes = crypto.randomBytes(4).toString('hex')
    return `REF-${timestamp}-${randomBytes}`.toUpperCase()
  }

  /**
   * Create refund request
   */
  async createRefundRequest(
    originalPaymentReference: string,
    reason: RefundRequest['reason'],
    description: string,
    requestedBy?: string
  ): Promise<{
    success: boolean
    refundRequest?: RefundRequest
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const refundsCollection = db.collection('refund_requests')
      const paymentsCollection = db.collection('payment_transactions')
      const subscriptionsCollection = db.collection('subscriptions')

      // Get original payment
      const payment = await paymentsCollection.findOne({ paymentReference: originalPaymentReference })
      if (!payment) {
        return { success: false, error: 'Original payment not found' }
      }

      // Get subscription
      const subscription = await subscriptionsCollection.findOne({ paymentReference: originalPaymentReference })
      if (!subscription) {
        return { success: false, error: 'Associated subscription not found' }
      }

      // Check if refund already exists
      const existingRefund = await refundsCollection.findOne({ originalPaymentReference })
      if (existingRefund) {
        return { success: false, error: 'Refund request already exists for this payment' }
      }

      // Calculate refund amount (full amount for now, could be prorated)
      const refundAmount = payment.amount

      const refundRequest: RefundRequest = {
        refundReference: this.generateRefundReference(),
        originalPaymentReference,
        subscriptionId: subscription._id,
        transactionId: payment._id,
        walletAddress: payment.walletAddress,
        reason,
        description,
        refundAmount,
        refundToken: payment.token,
        status: 'pending',
        requestedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await refundsCollection.insertOne(refundRequest)
      const createdRefund = { ...refundRequest, _id: result.insertedId }

      console.log(`[Refund Service] Created refund request ${createdRefund.refundReference} for ${refundAmount} ${payment.token}`)
      
      return { success: true, refundRequest: createdRefund }

    } catch (error) {
      console.error('Error creating refund request:', error)
      return { 
        success: false, 
        error: `Failed to create refund request: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Review refund request (approve or reject)
   */
  async reviewRefundRequest(
    refundReference: string,
    action: 'approve' | 'reject',
    reviewedBy: string,
    reviewNote?: string
  ): Promise<{
    success: boolean
    refundRequest?: RefundRequest
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const refundsCollection = db.collection('refund_requests')

      const refundRequest = await refundsCollection.findOne({ refundReference })
      if (!refundRequest) {
        return { success: false, error: 'Refund request not found' }
      }

      if (refundRequest.status !== 'pending') {
        return { success: false, error: 'Refund request has already been reviewed' }
      }

      const updateData: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedAt: new Date(),
        updatedAt: new Date()
      }

      if (reviewedBy) {
        updateData.approvedBy = reviewedBy
      }

      if (reviewNote) {
        updateData.reviewNote = reviewNote
      }

      const result = await refundsCollection.updateOne(
        { refundReference },
        { $set: updateData }
      )

      if (result.modifiedCount === 0) {
        return { success: false, error: 'Failed to update refund request' }
      }

      const updatedRefund = await refundsCollection.findOne({ refundReference })
      
      console.log(`[Refund Service] Refund request ${refundReference} ${action}d by ${reviewedBy}`)
      
      return { success: true, refundRequest: updatedRefund as RefundRequest }

    } catch (error) {
      console.error('Error reviewing refund request:', error)
      return { 
        success: false, 
        error: `Failed to review refund request: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Process approved refunds (execute the actual blockchain transactions)
   */
  async processApprovedRefunds(limit: number = 10): Promise<{
    processed: number
    successful: number
    failed: number
    errors: string[]
  }> {
    const db = await getDatabase()
    const refundsCollection = db.collection('refund_requests')

    let processed = 0
    let successful = 0
    let failed = 0
    const errors: string[] = []

    try {
      // Get approved refunds that haven't been processed
      const approvedRefunds = await refundsCollection
        .find({ 
          status: 'approved',
          refundTransactionSignature: { $exists: false }
        })
        .limit(limit)
        .toArray()

      for (const refund of approvedRefunds) {
        processed++
        
        try {
          const result = await this.executeRefund(refund as RefundRequest)
          
          if (result.success && result.transactionSignature) {
            // Update refund status
            await refundsCollection.updateOne(
              { _id: refund._id },
              {
                $set: {
                  status: 'processed',
                  refundTransactionSignature: result.transactionSignature,
                  refundProcessedAt: new Date(),
                  processedAt: new Date(),
                  updatedAt: new Date()
                }
              }
            )
            
            // Update subscription status if needed
            await this.handleSubscriptionRefund(refund.subscriptionId, refund.originalPaymentReference)
            
            successful++
            console.log(`[Refund Service] Successfully processed refund ${refund.refundReference}`)
          } else {
            throw new Error(result.error || 'Unknown refund processing error')
          }
          
        } catch (error) {
          // Mark refund as failed
          await refundsCollection.updateOne(
            { _id: refund._id },
            {
              $set: {
                status: 'failed',
                failureReason: error instanceof Error ? error.message : 'Unknown error',
                updatedAt: new Date()
              }
            }
          )
          
          failed++
          const errorMsg = `Failed to process refund ${refund.refundReference}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.error(`[Refund Service] ${errorMsg}`)
        }

        // Small delay between transactions
        await this.delay(1000)
      }

      console.log(`[Refund Service] Batch processing complete: ${processed} processed, ${successful} successful, ${failed} failed`)
      
      return { processed, successful, failed, errors }

    } catch (error) {
      console.error('Error processing approved refunds:', error)
      return { 
        processed, 
        successful, 
        failed, 
        errors: [...errors, `Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      }
    }
  }

  /**
   * Execute actual refund transaction on blockchain
   */
  private async executeRefund(refund: RefundRequest): Promise<{
    success: boolean
    transactionSignature?: string
    error?: string
  }> {
    if (!this.treasuryKeypair) {
      return { success: false, error: 'Treasury keypair not configured - manual processing required' }
    }

    try {
      const recipientPublicKey = new PublicKey(refund.walletAddress)

      if (refund.refundToken === PaymentToken.SOL) {
        return await this.executeSOLRefund(refund, recipientPublicKey)
      } else if (refund.refundToken === PaymentToken.USDC) {
        return await this.executeUSDCRefund(refund, recipientPublicKey)
      } else {
        return { success: false, error: `Unsupported refund token: ${refund.refundToken}` }
      }

    } catch (error) {
      console.error('Error executing refund transaction:', error)
      return { 
        success: false, 
        error: `Transaction execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Execute SOL refund
   */
  private async executeSOLRefund(
    refund: RefundRequest,
    recipientPublicKey: PublicKey
  ): Promise<{
    success: boolean
    transactionSignature?: string
    error?: string
  }> {
    try {
      const lamports = Math.floor(refund.refundAmount * 1_000_000_000) // Convert SOL to lamports

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.treasuryKeypair!.publicKey,
          toPubkey: recipientPublicKey,
          lamports
        })
      )

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.treasuryKeypair!],
        { commitment: 'confirmed' }
      )

      return { success: true, transactionSignature: signature }

    } catch (error) {
      return { 
        success: false, 
        error: `SOL refund failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Execute USDC refund
   */
  private async executeUSDCRefund(
    refund: RefundRequest,
    recipientPublicKey: PublicKey
  ): Promise<{
    success: boolean
    transactionSignature?: string
    error?: string
  }> {
    try {
      const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      const amount = Math.floor(refund.refundAmount * 1_000_000) // Convert USDC to smallest unit

      // Get source token account (treasury USDC account)
      const sourceTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        this.treasuryKeypair!.publicKey
      )

      // Get destination token account
      const destinationTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        recipientPublicKey
      )

      const transaction = new Transaction()

      // Check if destination token account exists, create if it doesn't
      try {
        await this.connection.getAccountInfo(destinationTokenAccount)
      } catch (error) {
        // Account doesn't exist, create it
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.treasuryKeypair!.publicKey, // payer
            destinationTokenAccount, // associated token account
            recipientPublicKey, // owner
            USDC_MINT // mint
          )
        )
      }

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          sourceTokenAccount, // source
          destinationTokenAccount, // destination
          this.treasuryKeypair!.publicKey, // owner
          amount // amount
        )
      )

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.treasuryKeypair!],
        { commitment: 'confirmed' }
      )

      return { success: true, transactionSignature: signature }

    } catch (error) {
      return { 
        success: false, 
        error: `USDC refund failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Handle subscription status after refund
   */
  private async handleSubscriptionRefund(
    subscriptionId: ObjectId,
    originalPaymentReference: string
  ): Promise<void> {
    try {
      const db = await getDatabase()
      const subscriptionsCollection = db.collection('subscriptions')
      const usersCollection = db.collection('users')

      const subscription = await subscriptionsCollection.findOne({ _id: subscriptionId })
      if (!subscription) {
        console.warn(`[Refund Service] Subscription ${subscriptionId} not found for refund handling`)
        return
      }

      // Cancel the subscription
      await subscriptionsCollection.updateOne(
        { _id: subscriptionId },
        {
          $set: {
            status: SubscriptionStatus.CANCELLED,
            cancelledAt: new Date(),
            updatedAt: new Date()
          }
        }
      )

      // Update user status
      await usersCollection.updateOne(
        { walletAddress: subscription.walletAddress },
        {
          $set: {
            subscriptionStatus: SubscriptionStatus.CANCELLED,
            updatedAt: new Date()
          }
        }
      )

      console.log(`[Refund Service] Cancelled subscription ${subscriptionId} due to refund`)

    } catch (error) {
      console.error('Error handling subscription refund:', error)
    }
  }

  /**
   * Get refund request by reference
   */
  async getRefundRequest(refundReference: string): Promise<RefundRequest | null> {
    const db = await getDatabase()
    const refundsCollection = db.collection('refund_requests')

    const refund = await refundsCollection.findOne({ refundReference })
    return refund as RefundRequest | null
  }

  /**
   * Get refund requests for a wallet
   */
  async getRefundRequestsForWallet(
    walletAddress: string,
    limit: number = 20
  ): Promise<RefundRequest[]> {
    const db = await getDatabase()
    const refundsCollection = db.collection('refund_requests')

    const refunds = await refundsCollection
      .find({ walletAddress })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return refunds as unknown as RefundRequest[]
  }

  /**
   * Get refund statistics
   */
  async getRefundStatistics(): Promise<{
    totalRequests: number
    pendingRequests: number
    approvedRequests: number
    rejectedRequests: number
    processedRequests: number
    failedRequests: number
    totalRefundAmount: { [key in PaymentToken]: number }
    averageProcessingTime: number // in hours
    topReasons: Array<{ reason: string; count: number }>
  }> {
    const db = await getDatabase()
    const refundsCollection = db.collection('refund_requests')

    // Get basic counts
    const [total, pending, approved, rejected, processed, failed] = await Promise.all([
      refundsCollection.countDocuments({}),
      refundsCollection.countDocuments({ status: 'pending' }),
      refundsCollection.countDocuments({ status: 'approved' }),
      refundsCollection.countDocuments({ status: 'rejected' }),
      refundsCollection.countDocuments({ status: 'processed' }),
      refundsCollection.countDocuments({ status: 'failed' })
    ])

    // Get total refund amounts by token
    const refundAmounts = await refundsCollection.aggregate([
      { $match: { status: 'processed' } },
      {
        $group: {
          _id: '$refundToken',
          total: { $sum: '$refundAmount' }
        }
      }
    ]).toArray()

    const totalRefundAmount = { [PaymentToken.SOL]: 0, [PaymentToken.USDC]: 0 }
    refundAmounts.forEach(item => {
      totalRefundAmount[item._id as PaymentToken] = item.total
    })

    // Calculate average processing time
    const processedRefunds = await refundsCollection.find({
      status: 'processed',
      requestedAt: { $exists: true },
      processedAt: { $exists: true }
    }).toArray()

    let averageProcessingTime = 0
    if (processedRefunds.length > 0) {
      const totalProcessingTime = processedRefunds.reduce((sum, refund) => {
        const requestedAt = new Date(refund.requestedAt).getTime()
        const processedAt = new Date(refund.processedAt).getTime()
        return sum + (processedAt - requestedAt)
      }, 0)
      
      averageProcessingTime = totalProcessingTime / processedRefunds.length / (1000 * 60 * 60) // Convert to hours
    }

    // Get top reasons
    const reasonAggregation = await refundsCollection.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray()

    const topReasons = reasonAggregation.map(item => ({
      reason: item._id,
      count: item.count
    }))

    return {
      totalRequests: total,
      pendingRequests: pending,
      approvedRequests: approved,
      rejectedRequests: rejected,
      processedRequests: processed,
      failedRequests: failed,
      totalRefundAmount,
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
      topReasons
    }
  }

  /**
   * Auto-create refund requests for service failures
   */
  async autoCreateRefundForServiceFailure(
    paymentReference: string,
    failureDescription: string
  ): Promise<{
    success: boolean
    refundRequest?: RefundRequest
    error?: string
  }> {
    return this.createRefundRequest(
      paymentReference,
      'service_failure',
      `Automatic refund due to service failure: ${failureDescription}`,
      'system'
    )
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}