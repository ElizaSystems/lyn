import { NextRequest, NextResponse } from 'next/server'
import TelegramBot from 'node-telegram-bot-api'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence'

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

async function handleStart(chatId: number, username?: string) {
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

Try it now! Just send me a link to check.`

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🚀 Open Scanner App', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-hacker.vercel.app'}/telegram` } }
      ],
      [
        { text: '📊 My Stats', callback_data: 'stats' },
        { text: '❓ Help', callback_data: 'help' }
      ]
    ]
  }

  await bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  })
}

async function handleScan(chatId: number, url: string) {
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
  const data = query.data

  switch (data) {
    case 'stats':
      await bot.answerCallbackQuery(query.id)
      await bot.sendMessage(chatId, `📊 *Your Statistics*\n\nOpen the Mini App to view detailed statistics and scan history.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📱 View Stats', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lyn-hacker.vercel.app'}/telegram` } }
          ]]
        }
      })
      break

    case 'help':
      await bot.answerCallbackQuery(query.id)
      await bot.sendMessage(chatId, `❓ *How to use LYN Scanner*\n\n1. Send any URL directly to scan it\n2. Use /scan <url> command\n3. Open Mini App for advanced features\n\n*Commands:*\n/start - Welcome message\n/scan - Scan a URL\n/help - Show this help\n\n*Features:*\n• Real-time threat detection\n• Multiple security sources\n• Phishing & scam detection\n• Malware identification`, {
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

      // Check for commands
      if (text.startsWith('/start')) {
        await handleStart(chatId, username)
      } else if (text.startsWith('/help')) {
        await handleCallbackQuery({ 
          id: 'help', 
          data: 'help', 
          message: { chat: { id: chatId } } 
        })
      } else if (text.startsWith('/scan')) {
        const url = text.replace('/scan', '').trim()
        if (url) {
          await handleScan(chatId, url)
        } else {
          await bot.sendMessage(chatId, 'Please provide a URL to scan. Example: /scan https://example.com')
        }
      } else if (text.match(/https?:\/\/[^\s]+/)) {
        // Auto-detect URLs
        const urlMatch = text.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
          await handleScan(chatId, urlMatch[0])
        }
      } else {
        // Check if it might be a domain
        if (text.includes('.') && !text.includes(' ') && text.length < 100) {
          await handleScan(chatId, text)
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