import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, Keypair } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token'
import { getDatabase } from '@/lib/mongodb'
import { 
  PaymentTransaction, 
  PaymentStatus, 
  PaymentToken, 
  PaymentMethod, 
  SubscriptionTier, 
  TierPricing, 
  PaymentConfig 
} from '@/lib/models/subscription'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'

export class CryptoPaymentService {
  private static instance: CryptoPaymentService
  private connection: Connection
  private config: PaymentConfig

  constructor(connection: Connection) {
    this.connection = connection
    this.config = this.getPaymentConfig()
  }

  static getInstance(connection: Connection): CryptoPaymentService {
    if (!this.instance) {
      this.instance = new CryptoPaymentService(connection)
    }
    return this.instance
  }

  /**
   * Get payment configuration with pricing tiers
   */
  private getPaymentConfig(): PaymentConfig {
    return {
      tiers: [
        {
          tier: SubscriptionTier.BASIC,
          name: 'Basic',
          description: 'Essential security features',
          features: [
            '10 wallet scans per month',
            'Basic threat detection',
            'Community support',
            'Mobile access'
          ],
          pricing: {
            monthly: {
              [PaymentToken.SOL]: 0.25,
              [PaymentToken.USDC]: 15
            },
            yearly: {
              [PaymentToken.SOL]: 2.5,
              [PaymentToken.USDC]: 150,
              discountPercent: 17
            }
          },
          limits: {
            maxScans: 10,
            maxWallets: 3,
            maxTasks: 5,
            apiCallsPerMonth: 1000,
            prioritySupport: false,
            customIntegrations: false
          }
        },
        {
          tier: SubscriptionTier.PRO,
          name: 'Pro',
          description: 'Advanced features for power users',
          features: [
            '100 wallet scans per month',
            'Advanced threat intelligence',
            'Priority support',
            'API access',
            'Custom alerts',
            'Portfolio tracking'
          ],
          pricing: {
            monthly: {
              [PaymentToken.SOL]: 0.5,
              [PaymentToken.USDC]: 15
            },
            yearly: {
              [PaymentToken.SOL]: 5,
              [PaymentToken.USDC]: 150,
              discountPercent: 17
            }
          },
          limits: {
            maxScans: 100,
            maxWallets: 10,
            maxTasks: 20,
            apiCallsPerMonth: 10000,
            prioritySupport: true,
            customIntegrations: false
          }
        },
        {
          tier: SubscriptionTier.ENTERPRISE,
          name: 'Enterprise',
          description: 'Complete solution for organizations',
          features: [
            'Unlimited wallet scans',
            'Enterprise threat intelligence',
            'Dedicated support',
            'Full API access',
            'Custom integrations',
            'Multi-user teams',
            'White-label options',
            'SLA guarantees'
          ],
          pricing: {
            monthly: {
              [PaymentToken.SOL]: 2.5,
              [PaymentToken.USDC]: 150
            },
            yearly: {
              [PaymentToken.SOL]: 25,
              [PaymentToken.USDC]: 1500,
              discountPercent: 17
            }
          },
          limits: {
            maxScans: -1, // unlimited
            maxWallets: -1, // unlimited
            maxTasks: -1, // unlimited
            apiCallsPerMonth: -1, // unlimited
            prioritySupport: true,
            customIntegrations: true
          }
        }
      ],
      wallets: {
        treasury: process.env.NEXT_PUBLIC_TREASURY_WALLET || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq',
        agent: process.env.NEXT_PUBLIC_AGENT_WALLET || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq',
        fees: process.env.NEXT_PUBLIC_FEE_WALLET || '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq'
      },
      tokens: {
        [PaymentToken.SOL]: {
          decimals: 9,
          symbol: 'SOL',
          name: 'Solana'
        },
        [PaymentToken.USDC]: {
          mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint on mainnet
          decimals: 6,
          symbol: 'USDC',
          name: 'USD Coin'
        }
      },
      fees: {
        platformFeePercent: 5,
        referralTier1Percent: 20,
        referralTier2Percent: 10
      },
      limits: {
        maxRetries: 3,
        paymentTimeoutMinutes: 30,
        gracePeriodDays: 3
      }
    }
  }

  /**
   * Generate unique payment reference
   */
  generatePaymentReference(): string {
    const timestamp = Date.now().toString(36)
    const randomBytes = crypto.randomBytes(6).toString('hex')
    return `LYN-${timestamp}-${randomBytes}`.toUpperCase()
  }

  /**
   * Get pricing for a specific tier and billing cycle
   */
  getTierPricing(tier: SubscriptionTier, billingCycle: 'monthly' | 'yearly'): TierPricing['pricing']['monthly'] {
    const tierConfig = this.config.tiers.find(t => t.tier === tier)
    if (!tierConfig) {
      throw new Error(`Invalid subscription tier: ${tier}`)
    }
    return tierConfig.pricing[billingCycle]
  }

  /**
   * Calculate payment amounts including fees
   */
  calculatePaymentAmounts(
    baseAmount: number,
    token: PaymentToken,
    hasReferral: boolean = false
  ): {
    baseAmount: number
    platformFee: number
    referralFee: number
    totalAmount: number
    agentAmount: number
  } {
    const platformFee = baseAmount * (this.config.fees.platformFeePercent / 100)
    const referralFee = hasReferral ? baseAmount * (this.config.fees.referralTier1Percent / 100) : 0
    const totalAmount = baseAmount
    const agentAmount = totalAmount - platformFee - referralFee

    return {
      baseAmount,
      platformFee,
      referralFee,
      totalAmount,
      agentAmount
    }
  }

  /**
   * Create payment transaction record
   */
  async createPaymentTransaction(
    walletAddress: string,
    amount: number,
    token: PaymentToken,
    paymentMethod: PaymentMethod = PaymentMethod.CRYPTO_TRANSFER,
    description: string = 'Subscription payment',
    subscriptionId?: ObjectId
  ): Promise<PaymentTransaction> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    const paymentTransaction: PaymentTransaction = {
      paymentReference: this.generatePaymentReference(),
      subscriptionId,
      walletAddress,
      amount,
      token,
      transactionSignature: '', // Will be updated when transaction is submitted
      status: PaymentStatus.PENDING,
      paymentMethod,
      description,
      retryCount: 0,
      initiatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await paymentsCollection.insertOne(paymentTransaction)
    return { ...paymentTransaction, _id: result.insertedId }
  }

  /**
   * Update payment transaction
   */
  async updatePaymentTransaction(
    paymentReference: string,
    updates: Partial<PaymentTransaction>
  ): Promise<boolean> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    const result = await paymentsCollection.updateOne(
      { paymentReference },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    )

    return result.modifiedCount > 0
  }

  /**
   * Get payment transaction by reference
   */
  async getPaymentTransaction(paymentReference: string): Promise<PaymentTransaction | null> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    const payment = await paymentsCollection.findOne({ paymentReference })
    return payment as PaymentTransaction | null
  }

  /**
   * Verify SOL payment transaction
   */
  async verifySOLPayment(
    signature: string,
    expectedAmount: number,
    recipientAddress?: string
  ): Promise<{
    isValid: boolean
    actualAmount?: number
    recipient?: string
    sender?: string
    blockTime?: number
  }> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      if (!transaction || !transaction.meta) {
        return { isValid: false }
      }

      // Check if transaction was successful
      if (transaction.meta.err !== null) {
        return { isValid: false }
      }

      const accountKeys = transaction.transaction.message.getAccountKeys()
      
      // Find the recipient (agent wallet by default)
      const targetRecipient = recipientAddress || this.config.wallets.agent
      const recipientPubkey = new PublicKey(targetRecipient)
      
      const recipientIndex = accountKeys.staticAccountKeys.findIndex(
        key => key.equals(recipientPubkey)
      )

      if (recipientIndex === -1) {
        return { isValid: false }
      }

      // Calculate the amount received
      const preBalance = transaction.meta.preBalances[recipientIndex]
      const postBalance = transaction.meta.postBalances[recipientIndex]
      const actualAmount = (postBalance - preBalance) / LAMPORTS_PER_SOL

      // Get sender (first account that's not the recipient)
      const senderIndex = accountKeys.staticAccountKeys.findIndex(
        (key, index) => index !== recipientIndex && transaction.meta!.preBalances[index] > transaction.meta!.postBalances[index]
      )
      
      const sender = senderIndex !== -1 ? accountKeys.staticAccountKeys[senderIndex].toBase58() : undefined

      return {
        isValid: actualAmount >= expectedAmount * 0.99, // Allow 1% tolerance for fees
        actualAmount,
        recipient: targetRecipient,
        sender,
        blockTime: transaction.blockTime || undefined
      }
    } catch (error) {
      console.error('Error verifying SOL payment:', error)
      return { isValid: false }
    }
  }

  /**
   * Verify USDC payment transaction
   */
  async verifyUSDCPayment(
    signature: string,
    expectedAmount: number,
    recipientAddress?: string
  ): Promise<{
    isValid: boolean
    actualAmount?: number
    recipient?: string
    sender?: string
    blockTime?: number
  }> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      if (!transaction || !transaction.meta) {
        return { isValid: false }
      }

      // Check if transaction was successful
      if (transaction.meta.err !== null) {
        return { isValid: false }
      }

      // For USDC transfers, we need to check token account balance changes
      const usdcMint = new PublicKey(this.config.tokens.USDC.mintAddress!)
      const targetRecipient = recipientAddress || this.config.wallets.agent
      const recipientPubkey = new PublicKey(targetRecipient)
      
      // Get recipient's USDC token account
      const recipientTokenAccount = await getAssociatedTokenAddress(usdcMint, recipientPubkey)
      
      const accountKeys = transaction.transaction.message.getAccountKeys()
      const tokenAccountIndex = accountKeys.staticAccountKeys.findIndex(
        key => key.equals(recipientTokenAccount)
      )

      if (tokenAccountIndex === -1) {
        return { isValid: false }
      }

      // Check token balance changes
      const preTokenBalance = transaction.meta.preTokenBalances?.find(
        balance => balance.accountIndex === tokenAccountIndex
      )
      const postTokenBalance = transaction.meta.postTokenBalances?.find(
        balance => balance.accountIndex === tokenAccountIndex
      )

      if (!preTokenBalance || !postTokenBalance) {
        return { isValid: false }
      }

      const actualAmount = (
        parseInt(postTokenBalance.uiTokenAmount.amount) - 
        parseInt(preTokenBalance.uiTokenAmount.amount)
      ) / Math.pow(10, this.config.tokens.USDC.decimals)

      // Find sender from token balance changes
      const senderTokenBalance = transaction.meta.preTokenBalances?.find(
        balance => balance.accountIndex !== tokenAccountIndex &&
        parseInt(balance.uiTokenAmount.amount) > 0
      )
      
      const sender = senderTokenBalance ? 
        accountKeys.staticAccountKeys[senderTokenBalance.accountIndex].toBase58() : 
        undefined

      return {
        isValid: actualAmount >= expectedAmount * 0.99, // Allow 1% tolerance
        actualAmount,
        recipient: targetRecipient,
        sender,
        blockTime: transaction.blockTime || undefined
      }
    } catch (error) {
      console.error('Error verifying USDC payment:', error)
      return { isValid: false }
    }
  }

  /**
   * Verify payment based on token type
   */
  async verifyPayment(
    signature: string,
    token: PaymentToken,
    expectedAmount: number,
    recipientAddress?: string
  ): Promise<{
    isValid: boolean
    actualAmount?: number
    recipient?: string
    sender?: string
    blockTime?: number
  }> {
    switch (token) {
      case PaymentToken.SOL:
        return this.verifySOLPayment(signature, expectedAmount, recipientAddress)
      case PaymentToken.USDC:
        return this.verifyUSDCPayment(signature, expectedAmount, recipientAddress)
      default:
        throw new Error(`Unsupported payment token: ${token}`)
    }
  }

  /**
   * Process payment confirmation
   */
  async confirmPayment(
    paymentReference: string,
    transactionSignature: string
  ): Promise<{
    success: boolean
    payment?: PaymentTransaction
    error?: string
  }> {
    try {
      const payment = await this.getPaymentTransaction(paymentReference)
      
      if (!payment) {
        return { success: false, error: 'Payment not found' }
      }

      if (payment.status === PaymentStatus.CONFIRMED) {
        return { success: true, payment, error: 'Payment already confirmed' }
      }

      // Verify the transaction on-chain
      const verification = await this.verifyPayment(
        transactionSignature,
        payment.token,
        payment.amount
      )

      if (!verification.isValid) {
        await this.updatePaymentTransaction(paymentReference, {
          status: PaymentStatus.FAILED,
          failureReason: 'Transaction verification failed',
          failedAt: new Date()
        })
        return { success: false, error: 'Payment verification failed' }
      }

      // Update payment transaction
      await this.updatePaymentTransaction(paymentReference, {
        transactionSignature,
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date(),
        blockTimestamp: verification.blockTime ? new Date(verification.blockTime * 1000) : undefined
      })

      const updatedPayment = await this.getPaymentTransaction(paymentReference)
      return { success: true, payment: updatedPayment! }

    } catch (error) {
      console.error('Error confirming payment:', error)
      return { success: false, error: 'Failed to confirm payment' }
    }
  }

  /**
   * Get payment history for a wallet
   */
  async getPaymentHistory(
    walletAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaymentTransaction[]> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    const payments = await paymentsCollection
      .find({ walletAddress })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    return payments as unknown as PaymentTransaction[]
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    totalPayments: number
    totalVolume: { [key in PaymentToken]: number }
    successRate: number
    averagePaymentValue: { [key in PaymentToken]: number }
  }> {
    const db = await getDatabase()
    const paymentsCollection = db.collection('payment_transactions')

    const [totalPayments, confirmedPayments] = await Promise.all([
      paymentsCollection.countDocuments({}),
      paymentsCollection.countDocuments({ status: PaymentStatus.CONFIRMED })
    ])

    const successRate = totalPayments > 0 ? (confirmedPayments / totalPayments) * 100 : 0

    // Calculate volume by token
    const volumeAggregation = await paymentsCollection.aggregate([
      { $match: { status: PaymentStatus.CONFIRMED } },
      {
        $group: {
          _id: '$token',
          totalVolume: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]).toArray()

    const totalVolume = { [PaymentToken.SOL]: 0, [PaymentToken.USDC]: 0 }
    const averagePaymentValue = { [PaymentToken.SOL]: 0, [PaymentToken.USDC]: 0 }

    volumeAggregation.forEach(item => {
      totalVolume[item._id as PaymentToken] = item.totalVolume
      averagePaymentValue[item._id as PaymentToken] = item.avgAmount
    })

    return {
      totalPayments,
      totalVolume,
      successRate,
      averagePaymentValue
    }
  }
}