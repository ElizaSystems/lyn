import TelegramBot from 'node-telegram-bot-api'
import { TelegramUser } from '@/lib/models/telegram-user'
import { connectDB } from '@/lib/mongodb'

export interface ScanPackage {
  id: string
  name: string
  scans: number
  stars: number
  description: string
  popular?: boolean
}

export class TelegramPaymentService {
  private static bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || '', { polling: false })

  // Scan packages available for purchase
  static readonly SCAN_PACKAGES: ScanPackage[] = [
    {
      id: 'pack_10',
      name: '10 Scans',
      scans: 10,
      stars: 50,
      description: 'Perfect for occasional use'
    },
    {
      id: 'pack_50',
      name: '50 Scans',
      scans: 50,
      stars: 200,
      description: 'Great value for regular users',
      popular: true
    },
    {
      id: 'pack_100',
      name: '100 Scans',
      scans: 100,
      stars: 350,
      description: 'Best deal for power users'
    },
    {
      id: 'pack_500',
      name: '500 Scans',
      scans: 500,
      stars: 1500,
      description: 'Enterprise package'
    }
  ]

  // Daily scan limits
  static readonly SCAN_LIMITS = {
    FREE: 5,
    PREMIUM: 20,
    WALLET_LINKED_BONUS: 3
  }

  /**
   * Check if user can perform a scan
   */
  static async canUserScan(telegramId: number, isPremium: boolean = false): Promise<{
    canScan: boolean
    reason?: string
    remainingScans: number
    nextResetTime?: Date
  }> {
    try {
      await connectDB()

      const user = await TelegramUser.findOne({ telegramId })
      if (!user) {
        // New user
        return {
          canScan: true,
          remainingScans: isPremium ? this.SCAN_LIMITS.PREMIUM : this.SCAN_LIMITS.FREE
        }
      }

      // Check if daily limit needs reset
      const now = new Date()
      const resetTime = new Date(user.dailyScansResetAt)
      if (now.toDateString() !== resetTime.toDateString()) {
        // Reset daily scans
        user.dailyScans = 0
        user.dailyScansResetAt = now
        user.isPremium = isPremium
        await user.save()
      }

      // Calculate limits
      let dailyLimit = isPremium ? this.SCAN_LIMITS.PREMIUM : this.SCAN_LIMITS.FREE
      
      // Add bonus for wallet-linked users
      if (user.walletAddress) {
        dailyLimit += this.SCAN_LIMITS.WALLET_LINKED_BONUS
      }

      // Check purchased scans first
      if (user.purchasedScans > 0) {
        return {
          canScan: true,
          remainingScans: user.purchasedScans + (dailyLimit - user.dailyScans)
        }
      }

      // Check daily limit
      if (user.dailyScans >= dailyLimit) {
        const tomorrow = new Date(resetTime)
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)

        return {
          canScan: false,
          reason: `Daily limit reached. Resets in ${this.getTimeUntil(tomorrow)}`,
          remainingScans: 0,
          nextResetTime: tomorrow
        }
      }

      return {
        canScan: true,
        remainingScans: dailyLimit - user.dailyScans + user.purchasedScans
      }
    } catch (error) {
      console.error('Error checking scan permission:', error)
      return {
        canScan: true,
        remainingScans: this.SCAN_LIMITS.FREE
      }
    }
  }

  /**
   * Record a scan and deduct from user's balance
   */
  static async recordScan(telegramId: number, isPremium: boolean = false): Promise<void> {
    try {
      await connectDB()

      const user = await TelegramUser.findOneAndUpdate(
        { telegramId },
        {
          $setOnInsert: {
            firstName: 'User',
            isPremium,
            dailyScansResetAt: new Date()
          }
        },
        { upsert: true, new: true }
      )

      // Check if using purchased scans
      if (user.purchasedScans > 0) {
        await TelegramUser.findOneAndUpdate(
          { telegramId },
          {
            $inc: { purchasedScans: -1, totalScans: 1 },
            lastScanAt: new Date()
          }
        )
      } else {
        // Use daily scans
        await TelegramUser.findOneAndUpdate(
          { telegramId },
          {
            $inc: { dailyScans: 1, totalScans: 1 },
            lastScanAt: new Date()
          }
        )
      }
    } catch (error) {
      console.error('Error recording scan:', error)
    }
  }

  /**
   * Create a Stars invoice for scan package
   * Following official Telegram Stars documentation
   */
  static async createInvoice(
    chatId: number,
    packageId: string
  ): Promise<void> {
    const scanPackage = this.SCAN_PACKAGES.find(p => p.id === packageId)
    if (!scanPackage) {
      throw new Error('Invalid package ID')
    }

    // Create invoice following official documentation
    // For digital goods, provider_token must be empty
    await this.bot.sendInvoice(
      chatId,
      `${scanPackage.name} - LYN Security Scanner`, // title
      scanPackage.description, // description
      JSON.stringify({ packageId, chatId, timestamp: Date.now() }), // payload
      '', // provider_token - MUST be empty for Stars
      'XTR', // currency - XTR for Telegram Stars
      [{
        label: scanPackage.name,
        amount: scanPackage.stars // amount in Stars
      }], // prices
      {
        photo_url: 'https://lyn-hacker.vercel.app/logo.jpg',
        photo_width: 512,
        photo_height: 512,
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false,
        send_phone_number_to_provider: false,
        send_email_to_provider: false,
        // Optional: Add suggested tip amounts in Stars
        suggested_tip_amounts: [1, 5, 10, 20],
        max_tip_amount: 100,
        // Optional: Start parameter for deep linking
        start_parameter: `buy_${packageId}`
      }
    )
  }

  /**
   * Handle successful payment
   * Must verify payment before delivering goods
   */
  static async handleSuccessfulPayment(
    telegramId: number,
    packageId: string,
    totalAmount: number,
    telegramPaymentChargeId: string,
    providerPaymentChargeId?: string
  ): Promise<{
    success: boolean
    message: string
    scansAdded: number
    chargeId: string
  }> {
    try {
      await connectDB()

      // Verify the package exists and amount matches
      const scanPackage = this.SCAN_PACKAGES.find(p => p.id === packageId)
      if (!scanPackage) {
        throw new Error('Invalid package ID')
      }

      // Verify the amount paid matches expected (Stars amount)
      if (totalAmount !== scanPackage.stars) {
        console.error(`Payment amount mismatch: expected ${scanPackage.stars}, got ${totalAmount}`)
        // Consider refunding here if amount doesn't match
        throw new Error('Payment amount mismatch')
      }

      // Update user's purchased scans
      const user = await TelegramUser.findOneAndUpdate(
        { telegramId },
        {
          $inc: {
            purchasedScans: scanPackage.scans,
            totalStarsSpent: totalAmount
          },
          $push: {
            payments: {
              packageId,
              stars: totalAmount,
              scansAdded: scanPackage.scans,
              telegramPaymentChargeId,
              providerPaymentChargeId,
              timestamp: new Date()
            }
          },
          updatedAt: new Date()
        },
        { new: true, upsert: true }
      )

      // Log successful payment for audit
      console.log(`✅ Payment successful: User ${telegramId} purchased ${scanPackage.name} for ${totalAmount} stars (Charge ID: ${telegramPaymentChargeId})`)

      return {
        success: true,
        message: `✅ Payment successful!\n\nYou've added **${scanPackage.scans} scans** to your account.\n\nThank you for your purchase! Your scans are ready to use immediately.`,
        scansAdded: scanPackage.scans,
        chargeId: telegramPaymentChargeId
      }
    } catch (error) {
      console.error('Error handling payment:', error)
      return {
        success: false,
        message: '❌ Failed to process payment. Your Stars have been refunded. Please contact @LYNGalacticBot support.',
        scansAdded: 0,
        chargeId: telegramPaymentChargeId
      }
    }
  }

  /**
   * Refund Stars payment
   * Can only refund payments made with Telegram Stars
   */
  static async refundStarsPayment(
    userId: number,
    telegramPaymentChargeId: string
  ): Promise<{
    success: boolean
    message: string
  }> {
    try {
      // Call Telegram's refundStarPayment method
      const result = await this.bot.refundStarPayment(
        userId,
        telegramPaymentChargeId
      )

      if (result) {
        // Update database to reflect refund
        await connectDB()
        const user = await TelegramUser.findOne({ telegramId: userId })
        
        if (user) {
          // Find the payment record
          const payment = user.payments?.find(
            (p: any) => p.telegramPaymentChargeId === telegramPaymentChargeId
          )
          
          if (payment) {
            // Deduct the refunded scans
            await TelegramUser.findOneAndUpdate(
              { telegramId: userId },
              {
                $inc: {
                  purchasedScans: -payment.scansAdded,
                  totalStarsSpent: -payment.stars
                },
                $set: {
                  'payments.$[elem].refunded': true,
                  'payments.$[elem].refundedAt': new Date()
                }
              },
              {
                arrayFilters: [{ 'elem.telegramPaymentChargeId': telegramPaymentChargeId }]
              }
            )
          }
        }

        console.log(`✅ Refund successful: User ${userId}, Charge ID: ${telegramPaymentChargeId}`)
        
        return {
          success: true,
          message: '✅ Refund processed successfully. Stars have been returned to your account.'
        }
      } else {
        throw new Error('Refund failed')
      }
    } catch (error) {
      console.error('Refund error:', error)
      return {
        success: false,
        message: '❌ Failed to process refund. Please contact support.'
      }
    }
  }

  /**
   * Get user's scan statistics
   */
  static async getUserScanStats(telegramId: number, isPremium: boolean = false) {
    try {
      await connectDB()

      const user = await TelegramUser.findOne({ telegramId })
      
      // Calculate daily limit
      let dailyLimit = isPremium ? this.SCAN_LIMITS.PREMIUM : this.SCAN_LIMITS.FREE
      if (user?.walletAddress) {
        dailyLimit += this.SCAN_LIMITS.WALLET_LINKED_BONUS
      }

      if (!user) {
        return {
          dailyScansUsed: 0,
          dailyScansLimit: dailyLimit,
          purchasedScans: 0,
          totalScans: 0,
          isPremium
        }
      }

      // Check if needs reset
      const now = new Date()
      const resetTime = new Date(user.dailyScansResetAt)
      let dailyScansUsed = user.dailyScans

      if (now.toDateString() !== resetTime.toDateString()) {
        dailyScansUsed = 0
      }

      return {
        dailyScansUsed,
        dailyScansLimit: dailyLimit,
        purchasedScans: user.purchasedScans,
        totalScans: user.totalScans,
        isPremium: user.isPremium || isPremium,
        walletLinked: !!user.walletAddress,
        totalStarsSpent: user.totalStarsSpent
      }
    } catch (error) {
      console.error('Error getting scan stats:', error)
      return {
        dailyScansUsed: 0,
        dailyScansLimit: this.SCAN_LIMITS.FREE,
        purchasedScans: 0,
        totalScans: 0,
        isPremium: false
      }
    }
  }

  /**
   * Format time until reset
   */
  private static getTimeUntil(date: Date): string {
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  /**
   * Send scan packages menu
   */
  static async sendPackagesMenu(chatId: number, telegramId: number) {
    const stats = await this.getUserScanStats(telegramId)
    
    let message = `💎 *Purchase Additional Scans*\n\n`
    message += `Your current balance:\n`
    message += `• Daily scans: ${stats.dailyScansLimit - stats.dailyScansUsed}/${stats.dailyScansLimit}\n`
    message += `• Purchased scans: ${stats.purchasedScans}\n\n`
    message += `Choose a package:`

    const keyboard = {
      inline_keyboard: this.SCAN_PACKAGES.map(pkg => [{
        text: `${pkg.name} - ⭐ ${pkg.stars} Stars ${pkg.popular ? '🔥' : ''}`,
        callback_data: `buy_${pkg.id}`
      }])
    }

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  }
}