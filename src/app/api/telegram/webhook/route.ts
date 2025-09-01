import { NextRequest, NextResponse } from 'next/server'
import TelegramBot from 'node-telegram-bot-api'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence'
import { TelegramWalletService } from '@/lib/services/telegram-wallet'
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
  }
  callback_query?: {
    id: string
    from: any
    message?: any
    data?: string
  }
}

async function handleStart(chatId: number, username?: string, userId?: number) {
  // Create or update user in database
  if (userId) {
    await connectDB()
    await TelegramUser.findOneAndUpdate(
      { telegramId: userId },
      {
        username,
        telegramId: userId,
        updatedAt: new Date()
      },
      { upsert: true }
    )
  }

  const welcomeMessage = `👋 Welcome to LYN Security Scanner!

I help you check suspicious links for:
• 🎣 Phishing attempts
• 💰 Scam websites  
• 🦠 Malicious content
• 🪙 Fake crypto sites

To scan a link, you can:
1️⃣ Send me any URL directly
2️⃣ Use /scan command followed by URL
3️⃣ Open the Mini App for advanced features

💎 Link your Solana wallet to:
• Track scans on leaderboard
• Earn rewards for finding threats
• Sync with LYN ecosystem

Try it now! Just send me a link to check.`

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🚀 Open Scanner App', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-scanner.vercel.app'}/telegram` } }
      ],
      [
        { text: '💎 Link Wallet', callback_data: 'link_wallet' },
        { text: '📊 My Stats', callback_data: 'stats' }
      ],
      [
        { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
        { text: '❓ Help', callback_data: 'help' }
      ]
    ]
  }

  await bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  })
}

async function handleScan(chatId: number, url: string, userId?: number) {
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
  const scanningMsg = await bot.sendMessage(chatId, '🔍 Scanning URL for threats...')

  try {
    // Perform threat analysis
    const threatResults = await ThreatIntelligenceService.checkURL(validUrl)
    const aggregated = ThreatIntelligenceService.aggregateResults(threatResults)

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

    // Update user scan statistics if user ID is provided
    if (userId) {
      await TelegramWalletService.updateScanStats(userId, aggregated.overallSafe)
    }

    // Delete scanning message and send result
    await bot.deleteMessage(chatId, scanningMsg.message_id)
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Full Analysis', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-scanner.vercel.app'}/telegram?url=${encodeURIComponent(validUrl)}` } }
        ],
        [
          { text: '🔄 Scan Another', callback_data: 'scan_new' },
          { text: '📤 Share', switch_inline_query: `Check this link: ${validUrl} - Result: ${emoji}` }
        ]
      ]
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
  const data = query.data

  switch (data) {
    case 'link_wallet':
      await bot.answerCallbackQuery(query.id)
      const linkingCode = TelegramWalletService.generateLinkingCode(userId)
      
      await bot.sendMessage(chatId, `💎 *Link Your Solana Wallet*

To link your wallet, follow these steps:

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
            { text: '🔗 Link via Web App', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-scanner.vercel.app'}/telegram?action=link_wallet&code=${linkingCode}` } }
          ]]
        }
      })
      break

    case 'stats':
      await bot.answerCallbackQuery(query.id)
      const stats = await TelegramWalletService.getUserStats(userId)
      
      if (stats) {
        let statsMessage = `📊 *Your Statistics*\n\n`
        if (stats.walletLinked) {
          statsMessage += `💎 Wallet: \`${stats.walletAddress?.slice(0, 4)}...${stats.walletAddress?.slice(-4)}\`\n`
          statsMessage += `🏆 Rank: #${stats.rank || 'N/A'}\n\n`
        }
        statsMessage += `🔍 Total Scans: ${stats.totalScans}\n`
        statsMessage += `✅ Safe Links: ${stats.safeScans}\n`
        statsMessage += `⚠️ Threats Detected: ${stats.threatsDetected}\n`
        statsMessage += `🎯 Accuracy: ${stats.totalScans > 0 ? Math.round((stats.safeScans / stats.totalScans) * 100) : 0}%`
        
        if (!stats.walletLinked) {
          statsMessage += `\n\n💡 Link your wallet to track stats on the leaderboard!`
        }
        
        await bot.sendMessage(chatId, statsMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              !stats.walletLinked ? [{ text: '💎 Link Wallet', callback_data: 'link_wallet' }] : [],
              [{ text: '📱 View Full Stats', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-scanner.vercel.app'}/telegram` } }]
            ].filter(row => row.length > 0)
          }
        })
      } else {
        await bot.sendMessage(chatId, `📊 *Your Statistics*\n\nNo stats yet! Start scanning links to build your profile.`, {
          parse_mode: 'Markdown'
        })
      }
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
/help - Show this help

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
      await bot.sendMessage(chatId, 'Send me a URL to scan:')
      break

    default:
      await bot.answerCallbackQuery(query.id, { text: 'Unknown action' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()
    
    // Handle message
    if (update.message) {
      const chatId = update.message.chat.id
      const text = update.message.text || ''
      const username = update.message.from.username
      const userId = update.message.from.id
      const firstName = update.message.from.first_name
      const lastName = update.message.from.last_name

      // Create or update user record
      await connectDB()
      await TelegramUser.findOneAndUpdate(
        { telegramId: userId },
        {
          username,
          firstName,
          lastName,
          updatedAt: new Date()
        },
        { upsert: true }
      )

      // Check for commands
      if (text.startsWith('/start')) {
        await handleStart(chatId, username, userId)
      } else if (text.startsWith('/wallet')) {
        await handleCallbackQuery({ 
          id: 'link_wallet', 
          data: 'link_wallet',
          from: { id: userId },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/stats')) {
        await handleCallbackQuery({ 
          id: 'stats', 
          data: 'stats',
          from: { id: userId },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/leaderboard')) {
        await handleCallbackQuery({ 
          id: 'leaderboard', 
          data: 'leaderboard',
          from: { id: userId },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/help')) {
        await handleCallbackQuery({ 
          id: 'help', 
          data: 'help',
          from: { id: userId },
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/scan')) {
        const url = text.replace('/scan', '').trim()
        if (url) {
          await handleScan(chatId, url, userId)
        } else {
          await bot.sendMessage(chatId, 'Please provide a URL to scan. Example: /scan https://example.com')
        }
      } else if (text.match(/https?:\/\/[^\s]+/)) {
        // Auto-detect URLs
        const urlMatch = text.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
          await handleScan(chatId, urlMatch[0], userId)
        }
      } else {
        // Check if it might be a domain
        if (text.includes('.') && !text.includes(' ') && text.length < 100) {
          await handleScan(chatId, text, userId)
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
    commands: ['/start', '/scan', '/help']
  })
}