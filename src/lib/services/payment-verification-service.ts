import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { getDatabase } from '@/lib/mongodb'
import { PaymentToken, PaymentTransaction, PaymentStatus } from '@/lib/models/subscription'

export interface VerificationResult {
  isValid: boolean
  actualAmount?: number
  expectedAmount: number
  recipient?: string
  sender?: string
  blockTime?: number
  confirmations?: number
  errorMessage?: string
}

export interface PaymentValidationConfig {
  tolerancePercent: number // Allowed difference from expected amount
  minConfirmations: number
  maxRetries: number
  retryDelayMs: number
}

export class PaymentVerificationService {
  private connection: Connection
  private config: PaymentValidationConfig

  // Token mint addresses
  private static readonly USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  private static readonly USDC_DECIMALS = 6

  constructor(connection: Connection, config?: Partial<PaymentValidationConfig>) {
    this.connection = connection
    this.config = {
      tolerancePercent: 1, // 1% tolerance for fees
      minConfirmations: 1,
      maxRetries: 5,
      retryDelayMs: 2000,
      ...config
    }
  }

  /**
   * Main verification method that handles both SOL and token payments
   */
  async verifyPayment(
    signature: string,
    token: PaymentToken,
    expectedAmount: number,
    recipientAddress: string,
    retryCount: number = 0
  ): Promise<VerificationResult> {
    try {
      // Wait for transaction confirmation
      await this.waitForConfirmation(signature, this.config.minConfirmations)

      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0
      })

      if (!transaction) {
        if (retryCount < this.config.maxRetries) {
          console.log(`Transaction not found, retrying... (${retryCount + 1}/${this.config.maxRetries})`)
          await this.delay(this.config.retryDelayMs)
          return this.verifyPayment(signature, token, expectedAmount, recipientAddress, retryCount + 1)
        }
        return {
          isValid: false,
          expectedAmount,
          errorMessage: 'Transaction not found after maximum retries'
        }
      }

      if (!transaction.meta) {
        return {
          isValid: false,
          expectedAmount,
          errorMessage: 'Transaction metadata not available'
        }
      }

      // Check if transaction failed
      if (transaction.meta.err !== null) {
        return {
          isValid: false,
          expectedAmount,
          errorMessage: `Transaction failed: ${JSON.stringify(transaction.meta.err)}`
        }
      }

      // Verify payment based on token type
      switch (token) {
        case PaymentToken.SOL:
          return this.verifySOLTransfer(transaction, expectedAmount, recipientAddress)
        case PaymentToken.USDC:
          return this.verifyTokenTransfer(transaction, expectedAmount, recipientAddress, PaymentToken.USDC)
        default:
          return {
            isValid: false,
            expectedAmount,
            errorMessage: `Unsupported token: ${token}`
          }
      }

    } catch (error) {
      console.error('Payment verification error:', error)
      return {
        isValid: false,
        expectedAmount,
        errorMessage: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Verify SOL transfer
   */
  private async verifySOLTransfer(
    transaction: any,
    expectedAmount: number,
    recipientAddress: string
  ): Promise<VerificationResult> {
    try {
      const recipientPubkey = new PublicKey(recipientAddress)
      const accountKeys = transaction.transaction.message.getAccountKeys()
      
      const recipientIndex = accountKeys.staticAccountKeys.findIndex(
        (key: PublicKey) => key.equals(recipientPubkey)
      )

      if (recipientIndex === -1) {
        return {
          isValid: false,
          expectedAmount,
          errorMessage: 'Recipient address not found in transaction'
        }
      }

      // Calculate received amount
      const preBalance = transaction.meta.preBalances[recipientIndex]
      const postBalance = transaction.meta.postBalances[recipientIndex]
      const actualAmount = (postBalance - preBalance) / LAMPORTS_PER_SOL

      // Find sender (account that lost SOL)
      const senderIndex = accountKeys.staticAccountKeys.findIndex(
        (key: PublicKey, index: number) => {
          if (index === recipientIndex) return false
          const balanceDiff = transaction.meta.preBalances[index] - transaction.meta.postBalances[index]
          return balanceDiff > 0 // Lost SOL (including fees)
        }
      )

      const sender = senderIndex !== -1 ? 
        accountKeys.staticAccountKeys[senderIndex].toBase58() : 
        undefined

      // Check if amount is within tolerance
      const tolerance = expectedAmount * (this.config.tolerancePercent / 100)
      const isValid = actualAmount >= (expectedAmount - tolerance)

      return {
        isValid,
        actualAmount,
        expectedAmount,
        recipient: recipientAddress,
        sender,
        blockTime: transaction.blockTime || undefined,
        confirmations: this.config.minConfirmations
      }

    } catch (error) {
      return {
        isValid: false,
        expectedAmount,
        errorMessage: `SOL verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Verify SPL token transfer (USDC)
   */
  private async verifyTokenTransfer(
    transaction: any,
    expectedAmount: number,
    recipientAddress: string,
    token: PaymentToken
  ): Promise<VerificationResult> {
    try {
      const recipientPubkey = new PublicKey(recipientAddress)
      const mintAddress = token === PaymentToken.USDC ? PaymentVerificationService.USDC_MINT : ''
      const decimals = token === PaymentToken.USDC ? PaymentVerificationService.USDC_DECIMALS : 0

      if (!mintAddress) {
        return {
          isValid: false,
          expectedAmount,
          errorMessage: `Unsupported token for verification: ${token}`
        }
      }

      const mint = new PublicKey(mintAddress)
      const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipientPubkey)
      
      const accountKeys = transaction.transaction.message.getAccountKeys()
      const tokenAccountIndex = accountKeys.staticAccountKeys.findIndex(
        (key: PublicKey) => key.equals(recipientTokenAccount)
      )

      if (tokenAccountIndex === -1) {
        return {
          isValid: false,
          expectedAmount,
          errorMessage: 'Recipient token account not found in transaction'
        }
      }

      // Check token balance changes
      const preTokenBalance = transaction.meta.preTokenBalances?.find(
        (balance: any) => balance.accountIndex === tokenAccountIndex
      )
      const postTokenBalance = transaction.meta.postTokenBalances?.find(
        (balance: any) => balance.accountIndex === tokenAccountIndex
      )

      if (!preTokenBalance || !postTokenBalance) {
        return {
          isValid: false,
          expectedAmount,
          errorMessage: 'Token balance information not found'
        }
      }

      // Calculate actual amount received
      const actualAmount = (
        parseInt(postTokenBalance.uiTokenAmount.amount) - 
        parseInt(preTokenBalance.uiTokenAmount.amount)
      ) / Math.pow(10, decimals)

      // Find sender token account
      const senderTokenBalance = transaction.meta.preTokenBalances?.find(
        (balance: any) => {
          if (balance.accountIndex === tokenAccountIndex) return false
          const postBalance = transaction.meta.postTokenBalances?.find(
            (post: any) => post.accountIndex === balance.accountIndex
          )
          if (!postBalance) return false
          
          return parseInt(balance.uiTokenAmount.amount) > parseInt(postBalance.uiTokenAmount.amount)
        }
      )

      const sender = senderTokenBalance ? 
        accountKeys.staticAccountKeys[senderTokenBalance.accountIndex].toBase58() : 
        undefined

      // Check if amount is within tolerance
      const tolerance = expectedAmount * (this.config.tolerancePercent / 100)
      const isValid = actualAmount >= (expectedAmount - tolerance)

      return {
        isValid,
        actualAmount,
        expectedAmount,
        recipient: recipientAddress,
        sender,
        blockTime: transaction.blockTime || undefined,
        confirmations: this.config.minConfirmations
      }

    } catch (error) {
      return {
        isValid: false,
        expectedAmount,
        errorMessage: `Token verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForConfirmation(
    signature: string,
    minConfirmations: number
  ): Promise<void> {
    const maxRetries = 30 // 30 * 2s = 60s timeout
    let retries = 0

    while (retries < maxRetries) {
      try {
        const status = await this.connection.getSignatureStatus(signature, {
          searchTransactionHistory: true
        })

        if (status.value?.confirmationStatus === 'finalized' ||
            (status.value?.confirmationStatus === 'confirmed' && minConfirmations <= 1)) {
          return
        }

        await this.delay(2000) // Wait 2 seconds
        retries++
      } catch (error) {
        console.warn(`Error checking signature status: ${error}`)
        await this.delay(2000)
        retries++
      }
    }

    throw new Error('Transaction confirmation timeout')
  }

  /**
   * Batch verify multiple payments
   */
  async batchVerifyPayments(
    payments: Array<{
      signature: string
      token: PaymentToken
      expectedAmount: number
      recipientAddress: string
      paymentReference: string
    }>
  ): Promise<Array<{
    paymentReference: string
    result: VerificationResult
  }>> {
    const results = []

    // Process in batches to avoid rate limiting
    const batchSize = 10
    for (let i = 0; i < payments.length; i += batchSize) {
      const batch = payments.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(
        batch.map(async (payment) => ({
          paymentReference: payment.paymentReference,
          result: await this.verifyPayment(
            payment.signature,
            payment.token,
            payment.expectedAmount,
            payment.recipientAddress
          )
        }))
      )

      results.push(...batchResults)
      
      // Small delay between batches
      if (i + batchSize < payments.length) {
        await this.delay(1000)
      }
    }

    return results
  }

  /**
   * Update payment status in database based on verification
   */
  async updatePaymentFromVerification(
    paymentReference: string,
    verificationResult: VerificationResult
  ): Promise<boolean> {
    try {
      const db = await getDatabase()
      const paymentsCollection = db.collection('payment_transactions')

      const updateData: Partial<PaymentTransaction> = {
        updatedAt: new Date()
      }

      if (verificationResult.isValid) {
        updateData.status = PaymentStatus.CONFIRMED
        updateData.confirmedAt = new Date()
        if (verificationResult.blockTime) {
          updateData.blockTimestamp = new Date(verificationResult.blockTime * 1000)
        }
      } else {
        updateData.status = PaymentStatus.FAILED
        updateData.failedAt = new Date()
        updateData.failureReason = verificationResult.errorMessage
      }

      const result = await paymentsCollection.updateOne(
        { paymentReference },
        { $set: updateData }
      )

      return result.modifiedCount > 0
    } catch (error) {
      console.error('Error updating payment from verification:', error)
      return false
    }
  }

  /**
   * Verify and update multiple pending payments
   */
  async verifyPendingPayments(limit: number = 50): Promise<{
    processed: number
    confirmed: number
    failed: number
  }> {
    try {
      const db = await getDatabase()
      const paymentsCollection = db.collection('payment_transactions')

      // Get pending payments
      const pendingPayments = await paymentsCollection
        .find({ 
          status: PaymentStatus.PENDING,
          transactionSignature: { $exists: true, $ne: '' }
        })
        .limit(limit)
        .toArray()

      let processed = 0
      let confirmed = 0
      let failed = 0

      for (const payment of pendingPayments) {
        const verificationResult = await this.verifyPayment(
          payment.transactionSignature,
          payment.token,
          payment.amount,
          process.env.NEXT_PUBLIC_AGENT_WALLET || 'LYNAIagent1111111111111111111111111111111111'
        )

        await this.updatePaymentFromVerification(
          payment.paymentReference,
          verificationResult
        )

        processed++
        if (verificationResult.isValid) {
          confirmed++
        } else {
          failed++
        }

        // Small delay to avoid overwhelming the RPC
        await this.delay(100)
      }

      console.log(`Payment verification batch complete: ${processed} processed, ${confirmed} confirmed, ${failed} failed`)

      return { processed, confirmed, failed }
    } catch (error) {
      console.error('Error in batch payment verification:', error)
      return { processed: 0, confirmed: 0, failed: 0 }
    }
  }

  /**
   * Get detailed transaction information
   */
  async getTransactionDetails(signature: string): Promise<{
    found: boolean
    confirmed: boolean
    blockTime?: number
    fee?: number
    accounts?: string[]
    errorMessage?: string
  }> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0
      })

      if (!transaction) {
        return { found: false, confirmed: false, errorMessage: 'Transaction not found' }
      }

      const accounts = transaction.transaction.message.getAccountKeys().staticAccountKeys.map(
        key => key.toBase58()
      )

      return {
        found: true,
        confirmed: transaction.meta?.err === null,
        blockTime: transaction.blockTime || undefined,
        fee: transaction.meta?.fee,
        accounts,
        errorMessage: transaction.meta?.err ? JSON.stringify(transaction.meta.err) : undefined
      }
    } catch (error) {
      return {
        found: false,
        confirmed: false,
        errorMessage: `Error fetching transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
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