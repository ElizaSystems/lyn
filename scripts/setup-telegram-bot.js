const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || 'https://lyn-scanner.vercel.app/api/telegram/webhook'
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://lyn-scanner.vercel.app/telegram'

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables')
  process.exit(1)
}

async function setupBot() {
  try {
    const bot = new TelegramBot(BOT_TOKEN, { polling: false })
    
    console.log('🤖 Setting up Telegram Bot...')
    
    // Get bot info
    const me = await bot.getMe()
    console.log(`✅ Bot connected: @${me.username} (${me.first_name})`)
    
    // Set webhook
    if (WEBHOOK_URL) {
      console.log(`🔗 Setting webhook to: ${WEBHOOK_URL}`)
      const result = await bot.setWebHook(WEBHOOK_URL, {
        allowed_updates: ['message', 'callback_query', 'inline_query']
      })
      console.log(`✅ Webhook set: ${result}`)
      
      // Verify webhook
      const webhookInfo = await bot.getWebHookInfo()
      console.log('📍 Webhook info:', {
        url: webhookInfo.url,
        has_custom_certificate: webhookInfo.has_custom_certificate,
        pending_update_count: webhookInfo.pending_update_count,
        last_error_message: webhookInfo.last_error_message
      })
    }
    
    // Set bot commands
    console.log('📝 Setting bot commands...')
    await bot.setMyCommands([
      { command: 'start', description: '🚀 Start the security scanner' },
      { command: 'scan', description: '🔍 Scan a link for threats' },
      { command: 'help', description: '❓ Get help using the scanner' }
    ])
    console.log('✅ Commands set successfully')
    
    // Set bot menu button for Mini App
    console.log('🎮 Setting Mini App menu button...')
    await bot.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Open Scanner',
        web_app: {
          url: MINI_APP_URL
        }
      }
    })
    console.log('✅ Mini App menu button set')
    
    // Set bot description
    await bot.setMyDescription('LYN Security Scanner - Check suspicious links for phishing, scams, and malicious content. Protect yourself from crypto scams and online threats.')
    await bot.setMyShortDescription('Check links for phishing & scams')
    
    console.log('\n✨ Bot setup complete!')
    console.log(`\n📱 Mini App URL: ${MINI_APP_URL}`)
    console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`)
    console.log(`🤖 Bot username: @${me.username}`)
    console.log('\n🎯 Next steps:')
    console.log('1. Deploy your app to production')
    console.log('2. Update TELEGRAM_WEBHOOK_URL in .env with your production URL')
    console.log('3. Run this script again to update the webhook')
    console.log(`4. Open https://t.me/${me.username} to test your bot`)
    
  } catch (error) {
    console.error('❌ Error setting up bot:', error.message)
    if (error.response) {
      console.error('Response:', error.response.body)
    }
    process.exit(1)
  }
}

// For local testing with ngrok
async function setupLocalWebhook(ngrokUrl) {
  try {
    const bot = new TelegramBot(BOT_TOKEN, { polling: false })
    const webhookUrl = `${ngrokUrl}/api/telegram/webhook`
    
    console.log(`🔗 Setting local webhook to: ${webhookUrl}`)
    const result = await bot.setWebHook(webhookUrl, {
      allowed_updates: ['message', 'callback_query', 'inline_query']
    })
    console.log(`✅ Local webhook set: ${result}`)
    
    const webhookInfo = await bot.getWebHookInfo()
    console.log('📍 Webhook info:', webhookInfo.url)
    
  } catch (error) {
    console.error('❌ Error setting local webhook:', error.message)
  }
}

// Check command line arguments
const args = process.argv.slice(2)
if (args[0] === '--local' && args[1]) {
  // Setup local webhook with ngrok URL
  setupLocalWebhook(args[1])
} else {
  // Normal setup
  setupBot()
}