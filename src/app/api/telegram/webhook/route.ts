import { NextRequest, NextResponse } from 'next/server'
import TelegramBot from 'node-telegram-bot-api'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence'
import { TelegramWalletService } from '@/lib/services/telegram-wallet'
import { TelegramPaymentService } from '@/lib/services/telegram-payments'
import { TelegramUser } from '@/lib/models/telegram-user'
import { connectDB } from '@/lib/mongodb'

// Disable polling as we're using webhooks
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || '', { polling: false })

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
      is_premium?: boolean
    }
    chat: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      type: string
    }
    date: number
    text?: string
    entities?: Array<{
      offset: number
      length: number
      type: string
    }>
    successful_payment?: {
      currency: string
      total_amount: number
      invoice_payload: string
      telegram_payment_charge_id: string
    }
  }
  callback_query?: {
    id: string
    from: {
      id: number
      is_premium?: boolean
      first_name: string
      username?: string
    }
    message?: any
    data?: string
  }
  pre_checkout_query?: {
    id: string
    from: {
      id: number
      is_premium?: boolean
    }
    currency: string
    total_amount: number
    invoice_payload: string
  }
}

async function handleStart(chatId: number, username?: string, userId?: number, isPremium?: boolean) {
  // Create or update user in database
  if (userId) {
    await connectDB()
    await TelegramUser.findOneAndUpdate(
      { telegramId: userId },
      {
        username,
        telegramId: userId,
        isPremium: isPremium || false,
        updatedAt: new Date()
      },
      { upsert: true }
    )
  }

  const stats = await TelegramPaymentService.getUserScanStats(userId || 0, isPremium)
  
  const welcomeMessage = `👋 Welcome to LYN Security Scanner!

I help you check suspicious links for:
• 🎣 Phishing attempts
• 💰 Scam websites  
• 🦠 Malicious content
• 🪙 Fake crypto sites

${isPremium ? '⭐ *Premium User Benefits:*\n• 20 daily scans (vs 5 for free users)\n• Priority processing\n• Advanced threat analysis\n\n' : ''}💎 Link your Solana wallet for +3 bonus daily scans!

📊 *Your Scan Balance:*
• Daily: ${stats.dailyScansLimit - stats.dailyScansUsed}/${stats.dailyScansLimit} remaining
• Purchased: ${stats.purchasedScans} scans
${stats.walletLinked ? '• Wallet bonus: +3 daily scans ✅' : ''}

To scan a link:
1️⃣ Send me any URL directly
2️⃣ Use /scan command followed by URL
3️⃣ Open the Mini App for advanced features`

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🚀 Open Scanner App', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-hacker.vercel.app'}/telegram` } }
      ],
      [
        { text: '💎 Link Wallet', callback_data: 'link_wallet' },
        { text: '⭐ Buy Scans', callback_data: 'buy_scans' }
      ],
      [
        { text: '📊 My Stats', callback_data: 'stats' },
        { text: '🏆 Leaderboard', callback_data: 'leaderboard' }
      ],
      [
        { text: '❓ Help', callback_data: 'help' }
      ]
    ]
  }

  await bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  })
}

async function handleScan(chatId: number, url: string, userId?: number, isPremium?: boolean) {
  // Check if user can scan
  const canScan = await TelegramPaymentService.canUserScan(userId || 0, isPremium)
  
  if (!canScan.canScan) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '⭐ Buy More Scans', callback_data: 'buy_scans' }],
        !isPremium ? [{ text: '👑 Get Telegram Premium', url: 'https://t.me/premium' }] : []
      ].filter(row => row.length > 0)
    }

    await bot.sendMessage(
      chatId, 
      `⚠️ *Scan Limit Reached*\n\n${canScan.reason}\n\nYou have ${canScan.remainingScans} scans remaining.\n\nGet more scans with:\n• ⭐ Purchase scan packages\n${!isPremium ? '• 👑 Telegram Premium (20 daily scans)\n' : ''}• 💎 Link wallet (+3 daily bonus)`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    )
    return
  }

  // Send typing indicator
  await bot.sendChatAction(chatId, 'typing')

  // Validate and fix URL
  let validUrl = url.trim()
  if (!validUrl.match(/^https?:\/\//i)) {
    validUrl = `https://${validUrl}`
  }

  try {
    const parsedUrl = new URL(validUrl)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      await bot.sendMessage(chatId, '❌ Please provide a valid HTTP or HTTPS URL')
      return
    }
  } catch {
    await bot.sendMessage(chatId, '❌ Invalid URL format. Please check and try again.')
    return
  }

  // Send scanning message
  const scanningMsg = await bot.sendMessage(chatId, `🔍 Scanning URL for threats...\n\n📊 Remaining scans: ${canScan.remainingScans - 1}`)

  try {
    // Perform threat analysis
    const threatResults = await ThreatIntelligenceService.checkURL(validUrl)
    const aggregated = ThreatIntelligenceService.aggregateResults(threatResults)

    // Record the scan
    if (userId) {
      await TelegramPaymentService.recordScan(userId, isPremium)
      await TelegramWalletService.updateScanStats(userId, aggregated.overallSafe)
    }

    // Build result message
    let resultMessage = ''
    let emoji = ''

    if (aggregated.overallSafe) {
      emoji = '✅'
      resultMessage = `✅ *URL appears to be SAFE*\n\n`
      resultMessage += `🔗 ${validUrl}\n\n`
      resultMessage += `📊 Confidence: ${aggregated.overallScore}%\n`
      resultMessage += `✔️ Checked by ${aggregated.sourceCount} security services\n\n`
      resultMessage += `_This URL appears to be safe, but always exercise caution with sensitive information._`
    } else if (aggregated.consensus === 'suspicious') {
      emoji = '⚠️'
      resultMessage = `⚠️ *SUSPICIOUS URL DETECTED*\n\n`
      resultMessage += `🔗 ${validUrl}\n\n`
      resultMessage += `📊 Risk Score: ${100 - aggregated.overallScore}%\n`
      resultMessage += `🚨 Threats found: ${aggregated.totalThreats.join(', ')}\n\n`
      resultMessage += `*Recommendations:*\n`
      resultMessage += `• Do NOT enter personal information\n`
      resultMessage += `• Avoid downloading files\n`
      resultMessage += `• Use a VPN if you must visit\n`
      resultMessage += `• Consider using a sandbox browser`
    } else {
      emoji = '🚫'
      resultMessage = `🚫 *DANGEROUS URL - DO NOT VISIT!*\n\n`
      resultMessage += `🔗 ${validUrl}\n\n`
      resultMessage += `📊 Danger Level: CRITICAL\n`
      resultMessage += `🚨 Threats detected: ${aggregated.totalThreats.join(', ')}\n\n`
      resultMessage += `*⚠️ WARNING:*\n`
      resultMessage += `This URL has been flagged as extremely dangerous!\n\n`
      resultMessage += `• DO NOT visit this link\n`
      resultMessage += `• DO NOT enter any information\n`
      resultMessage += `• If visited, scan your device immediately\n`
      resultMessage += `• Change passwords if you entered credentials`
    }

    // Add source details
    if (threatResults.length > 0) {
      resultMessage += `\n\n*Security Check Details:*\n`
      threatResults.forEach(r => {
        resultMessage += `${r.source}: ${r.safe ? '✅' : '❌'} (${r.score}/100)\n`
      })
    }

    // Get updated stats
    const updatedStats = await TelegramPaymentService.getUserScanStats(userId || 0, isPremium)
    resultMessage += `\n\n📊 *Remaining Scans:* ${updatedStats.dailyScansLimit - updatedStats.dailyScansUsed}/${updatedStats.dailyScansLimit} daily`
    if (updatedStats.purchasedScans > 0) {
      resultMessage += ` + ${updatedStats.purchasedScans} purchased`
    }

    // Delete scanning message and send result
    await bot.deleteMessage(chatId, scanningMsg.message_id)
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Full Analysis', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-hacker.vercel.app'}/telegram?url=${encodeURIComponent(validUrl)}` } }
        ],
        [
          { text: '🔄 Scan Another', callback_data: 'scan_new' },
          { text: '📤 Share', switch_inline_query: `Check this link: ${validUrl} - Result: ${emoji}` }
        ],
        updatedStats.dailyScansUsed >= updatedStats.dailyScansLimit && updatedStats.purchasedScans === 0 ? 
          [{ text: '⭐ Buy More Scans', callback_data: 'buy_scans' }] : []
      ].filter(row => row.length > 0)
    }

    await bot.sendMessage(chatId, resultMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
      disable_web_page_preview: true
    })

  } catch (error) {
    console.error('Scan error:', error)
    await bot.deleteMessage(chatId, scanningMsg.message_id)
    await bot.sendMessage(chatId, '❌ Failed to scan URL. Please try again later.')
  }
}

async function handleCallbackQuery(query: any) {
  const chatId = query.message.chat.id
  const userId = query.from.id
  const isPremium = query.from.is_premium || false
  const data = query.data

  // Handle buy scan packages
  if (data.startsWith('buy_')) {
    const packageId = data.replace('buy_', '')
    await bot.answerCallbackQuery(query.id)
    
    try {
      await TelegramPaymentService.createInvoice(chatId, packageId)
    } catch (error) {
      console.error('Invoice creation error:', error)
      await bot.sendMessage(chatId, '❌ Failed to create invoice. Please try again.')
    }
    return
  }

  switch (data) {
    case 'buy_scans':
      await bot.answerCallbackQuery(query.id)
      await TelegramPaymentService.sendPackagesMenu(chatId, userId)
      break

    case 'link_wallet':
      await bot.answerCallbackQuery(query.id)
      const linkingCode = TelegramWalletService.generateLinkingCode(userId)
      
      await bot.sendMessage(chatId, `💎 *Link Your Solana Wallet*

Linking your wallet gives you:
• +3 bonus daily scans
• Appear on global leaderboard
• Track your security contributions
• Future: LYN token rewards

To link your wallet:
1️⃣ Open your Solana wallet (Phantom, Solflare, etc.)
2️⃣ Sign this message:
\`\`\`
Link LYN wallet to Telegram
Code: ${linkingCode}
\`\`\`
3️⃣ Send me your wallet address and signature

Or use the web app for easier linking:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔗 Link via Web App', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-hacker.vercel.app'}/telegram?action=link_wallet&code=${linkingCode}` } }
          ]]
        }
      })
      break

    case 'stats':
      await bot.answerCallbackQuery(query.id)
      const stats = await TelegramWalletService.getUserStats(userId)
      const scanStats = await TelegramPaymentService.getUserScanStats(userId, isPremium)
      
      let statsMessage = `📊 *Your Statistics*\n\n`
      
      // Scan limits
      statsMessage += `*Scan Balance:*\n`
      statsMessage += `• Daily: ${scanStats.dailyScansLimit - scanStats.dailyScansUsed}/${scanStats.dailyScansLimit}\n`
      statsMessage += `• Purchased: ${scanStats.purchasedScans}\n`
      if (scanStats.totalStarsSpent > 0) {
        statsMessage += `• Total stars spent: ⭐ ${scanStats.totalStarsSpent}\n`
      }
      statsMessage += `\n`
      
      // Wallet info
      if (stats && stats.walletLinked) {
        statsMessage += `💎 Wallet: \`${stats.walletAddress?.slice(0, 4)}...${stats.walletAddress?.slice(-4)}\`\n`
        statsMessage += `🏆 Rank: #${stats.rank || 'N/A'}\n\n`
      }
      
      // Scan statistics
      if (stats) {
        statsMessage += `*Scan History:*\n`
        statsMessage += `🔍 Total Scans: ${stats.totalScans}\n`
        statsMessage += `✅ Safe Links: ${stats.safeScans}\n`
        statsMessage += `⚠️ Threats Detected: ${stats.threatsDetected}\n`
        statsMessage += `🎯 Accuracy: ${stats.totalScans > 0 ? Math.round((stats.safeScans / stats.totalScans) * 100) : 0}%`
      }
      
      // Premium status
      statsMessage += `\n\n${isPremium ? '⭐ Premium User' : '👤 Free User'}`
      
      if (!stats?.walletLinked) {
        statsMessage += `\n\n💡 Link your wallet for +3 bonus daily scans!`
      }
      
      await bot.sendMessage(chatId, statsMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            !stats?.walletLinked ? [{ text: '💎 Link Wallet', callback_data: 'link_wallet' }] : [],
            [{ text: '⭐ Buy More Scans', callback_data: 'buy_scans' }],
            [{ text: '📱 View Full Stats', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-hacker.vercel.app'}/telegram` } }]
          ].filter(row => row.length > 0)
        }
      })
      break

    case 'leaderboard':
      await bot.answerCallbackQuery(query.id)
      const leaderboard = await TelegramWalletService.getLeaderboard(10)
      
      let leaderboardMessage = `🏆 *LYN Scanner Leaderboard*\n\n`
      
      if (leaderboard.length > 0) {
        leaderboard.forEach(user => {
          const medal = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '🏅'
          leaderboardMessage += `${medal} #${user.rank} - @${user.username || 'Anonymous'}\n`
          leaderboardMessage += `   💎 \`${user.walletAddress?.slice(0, 4)}...${user.walletAddress?.slice(-4)}\`\n`
          leaderboardMessage += `   📊 ${user.totalScans} scans | ${user.accuracy}% accuracy\n\n`
        })
      } else {
        leaderboardMessage += `No users on the leaderboard yet. Be the first!`
      }
      
      await bot.sendMessage(chatId, leaderboardMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '💎 Link Your Wallet', callback_data: 'link_wallet' }
          ]]
        }
      })
      break

    case 'help':
      await bot.answerCallbackQuery(query.id)
      await bot.sendMessage(chatId, `❓ *How to use LYN Scanner*

*Basic Commands:*
/start - Welcome message
/scan <url> - Scan a URL
/wallet - Manage wallet link
/stats - View your statistics
/leaderboard - View top scanners
/buy - Purchase scan packages
/help - Show this help

*Scan Limits:*
• Free users: 5 daily scans
• Premium users: 20 daily scans
• Wallet linked: +3 bonus daily scans
• Purchase packages: ⭐ 50-1500 stars

*Wallet Features:*
• Link Solana wallet for tracking
• Appear on global leaderboard
• Sync with LYN ecosystem
• Earn rewards (coming soon)

*Scanning:*
• Send any URL directly
• Real-time threat detection
• Multiple security sources
• Share results with friends`, {
        parse_mode: 'Markdown'
      })
      break

    case 'scan_new':
      await bot.answerCallbackQuery(query.id)
      const canScan = await TelegramPaymentService.canUserScan(userId, isPremium)
      if (canScan.canScan) {
        await bot.sendMessage(chatId, `Send me a URL to scan:\n\n📊 Remaining scans: ${canScan.remainingScans}`)
      } else {
        await bot.sendMessage(chatId, `⚠️ ${canScan.reason}\n\nPurchase more scans to continue.`, {
          reply_markup: {
            inline_keyboard: [[
              { text: '⭐ Buy Scans', callback_data: 'buy_scans' }
            ]]
          }
        })
      }
      break

    default:
      await bot.answerCallbackQuery(query.id, { text: 'Unknown action' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()
    
    // Handle pre-checkout query - MUST respond within 10 seconds
    if (update.pre_checkout_query) {
      try {
        const query = update.pre_checkout_query
        const payload = JSON.parse(query.invoice_payload)
        
        // Validate the payment
        const scanPackage = TelegramPaymentService.SCAN_PACKAGES.find(
          p => p.id === payload.packageId
        )
        
        if (!scanPackage) {
          // Reject invalid package
          await bot.answerPreCheckoutQuery(
            query.id, 
            false,
            { error_message: 'Invalid package selected. Please try again.' }
          )
          return NextResponse.json({ ok: true })
        }
        
        // Verify amount matches (Telegram sends amount in smallest units)
        if (query.total_amount !== scanPackage.stars) {
          await bot.answerPreCheckoutQuery(
            query.id,
            false,
            { error_message: 'Price mismatch. Please try again.' }
          )
          return NextResponse.json({ ok: true })
        }
        
        // Approve the payment
        await bot.answerPreCheckoutQuery(query.id, true)
        console.log(`✅ Pre-checkout approved for user ${query.from.id}, package: ${payload.packageId}`)
        
      } catch (error) {
        console.error('Pre-checkout error:', error)
        // Reject on any error
        await bot.answerPreCheckoutQuery(
          update.pre_checkout_query.id,
          false,
          { error_message: 'Payment validation failed. Please try again.' }
        )
      }
      
      return NextResponse.json({ ok: true })
    }

    // Handle successful payment - deliver the goods
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment
      const userId = update.message.from.id
      const chatId = update.message.chat.id
      
      try {
        const payload = JSON.parse(payment.invoice_payload)
        
        // Process the successful payment
        const result = await TelegramPaymentService.handleSuccessfulPayment(
          userId,
          payload.packageId,
          payment.total_amount,
          payment.telegram_payment_charge_id,
          payment.provider_payment_charge_id
        )
        
        // Send confirmation message with updated balance
        if (result.success) {
          const stats = await TelegramPaymentService.getUserScanStats(userId)
          
          await bot.sendMessage(chatId, 
            `${result.message}\n\n📊 *Your New Balance:*\n• Daily: ${stats.dailyScansLimit - stats.dailyScansUsed}/${stats.dailyScansLimit}\n• Purchased: ${stats.purchasedScans} scans\n• Total Stars spent: ⭐ ${stats.totalStarsSpent}\n\nReady to scan! Send me any URL to check.`, 
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '🔍 Start Scanning', callback_data: 'scan_new' },
                  { text: '📊 View Stats', callback_data: 'stats' }
                ]]
              }
            }
          )
        } else {
          // Payment processing failed - notify user
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown'
          })
        }
        
      } catch (error) {
        console.error('Payment processing error:', error)
        await bot.sendMessage(chatId, 
          '❌ An error occurred processing your payment. If Stars were deducted, they will be refunded. Please contact support.',
          { parse_mode: 'Markdown' }
        )
      }
      
      return NextResponse.json({ ok: true })
    }
    
    // Handle message
    if (update.message) {
      const chatId = update.message.chat.id
      const text = update.message.text || ''
      const username = update.message.from.username
      const userId = update.message.from.id
      const firstName = update.message.from.first_name
      const lastName = update.message.from.last_name
      const isPremium = update.message.from.is_premium || false

      // Create or update user record
      await connectDB()
      await TelegramUser.findOneAndUpdate(
        { telegramId: userId },
        {
          username,
          firstName,
          lastName,
          isPremium,
          updatedAt: new Date()
        },
        { upsert: true }
      )

      // Check for commands
      if (text.startsWith('/start')) {
        await handleStart(chatId, username, userId, isPremium)
      } else if (text.startsWith('/buy')) {
        await TelegramPaymentService.sendPackagesMenu(chatId, userId)
      } else if (text.startsWith('/wallet')) {
        await handleCallbackQuery({ 
          id: 'link_wallet', 
          data: 'link_wallet',
          from: { id: userId, is_premium: isPremium },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/stats')) {
        await handleCallbackQuery({ 
          id: 'stats', 
          data: 'stats',
          from: { id: userId, is_premium: isPremium },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/leaderboard')) {
        await handleCallbackQuery({ 
          id: 'leaderboard', 
          data: 'leaderboard',
          from: { id: userId, is_premium: isPremium },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/help')) {
        await handleCallbackQuery({ 
          id: 'help', 
          data: 'help',
          from: { id: userId, is_premium: isPremium },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/scan')) {
        const url = text.replace('/scan', '').trim()
        if (url) {
          await handleScan(chatId, url, userId, isPremium)
        } else {
          await bot.sendMessage(chatId, 'Please provide a URL to scan. Example: /scan https://example.com')
        }
      } else if (text.match(/https?:\/\/[^\s]+/)) {
        // Auto-detect URLs
        const urlMatch = text.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
          await handleScan(chatId, urlMatch[0], userId, isPremium)
        }
      } else {
        // Check if it might be a domain
        if (text.includes('.') && !text.includes(' ') && text.length < 100) {
          await handleScan(chatId, text, userId, isPremium)
        } else {
          await bot.sendMessage(chatId, 'Please send me a URL to scan, or use /help for more information.')
        }
      }
    }

    // Handle callback queries
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Webhook setup endpoint
export async function GET() {
  return NextResponse.json({
    status: 'Webhook endpoint ready',
    bot: 'LYN Security Scanner',
    commands: ['/start', '/scan', '/wallet', '/stats', '/leaderboard', '/buy', '/help'],
    features: ['Premium support', 'Stars payments', 'Wallet linking']
  })
}