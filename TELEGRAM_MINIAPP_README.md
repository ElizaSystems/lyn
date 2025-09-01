# LYN Security Scanner - Telegram Mini App

## 🤖 Bot Information
- **Bot Username:** @LYNGalacticBot
- **Bot Link:** https://t.me/LYNGalacticBot
- **Mini App URL:** https://lyn-hacker.vercel.app/telegram
- **API Endpoint:** https://lyn-hacker.vercel.app/api/telegram/webhook

## 🚀 Features

### Bot Commands
- `/start` - Start the security scanner and open Mini App
- `/scan <url>` - Scan a link directly in chat
- `/wallet` - Link or manage your Solana wallet
- `/stats` - View your personal statistics
- `/leaderboard` - See top security scanners
- `/buy` - Purchase scan packages with Stars
- `/help` - Get help using the scanner

### Mini App Features
- 🔍 Real-time URL security scanning
- 📊 Multiple threat intelligence sources
- 🎣 Phishing detection
- 💰 Scam website identification
- 🦠 Malware detection
- 🪙 Fake crypto site detection
- 📱 Native Telegram UI integration
- 💾 Scan history with cloud storage
- 📤 Share scan results
- 🔔 Haptic feedback
- 💎 **Solana Wallet Linking** - Connect wallet to track scans
- 🏆 **Global Leaderboard** - Compete with other security scanners
- 📈 **Personal Statistics** - Track your security contributions

### Security Checks
- SSL certificate validation
- Domain reputation analysis
- Phishing pattern detection
- Known scam database lookup
- Malicious content identification
- Suspicious redirect detection

## 📱 How to Use

### Via Bot Chat
1. Open https://t.me/LYNGalacticBot
2. Send `/start` to begin
3. Send any URL to scan it instantly
4. Or use `/scan <url>` command
5. Use `/wallet` to link your Solana wallet
6. Check `/stats` to see your scanning history
7. View `/leaderboard` for top scanners

### Via Mini App
1. Click "Open Scanner" button in bot chat
2. Enter suspicious URL in the input field
3. Click scan button or press enter
4. View detailed security analysis
5. Link your Solana wallet for tracking
6. Check leaderboard rankings
7. Share results with friends

### Wallet Linking (Optional)
1. Use `/wallet` command or tap "Link Wallet" button
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Sign the verification message
4. Your scans will now be tracked on the leaderboard
5. Compete with other users globally

## 🎯 Usage Limits & Rewards

### Free Tier
- 5 daily scans
- Basic threat detection
- Standard response time
- Leaderboard participation

### Telegram Premium Users ⭐
- 20 daily scans (4x more!)
- Priority processing
- Advanced threat analysis
- Scan history sync
- Enhanced leaderboard rewards

### Wallet-Linked Benefits 💎
- +3 bonus daily scans
- Track all scans on blockchain
- Appear on global leaderboard
- Earn recognition for finding threats
- Future: LYN token rewards
- Sync with main LYN ecosystem

### Purchase Scan Packages with Stars ⭐
- 10 scans - 50 Stars
- 50 scans - 200 Stars (Popular!)
- 100 scans - 350 Stars
- 500 scans - 1500 Stars

### How Scan Limits Work
1. **Daily Limits Reset:** Every 24 hours at midnight
2. **Priority Order:** Purchased scans used last (daily scans first)
3. **Stackable Benefits:** Premium + Wallet = 23 daily scans
4. **No Expiration:** Purchased scans never expire

## 🔧 Technical Details

### API Endpoints
- **Webhook:** `/api/telegram/webhook` - Handles bot commands
- **Scanner:** `/api/telegram/scan` - Processes security scans
- **Main App:** `/telegram` - Mini App interface

### Security Features
- Telegram authentication verification
- HMAC signature validation
- Rate limiting per user
- Secure cloud storage for history

### Technologies Used
- Next.js 15.4.5
- TypeScript
- Telegram Web App SDK
- Node Telegram Bot API
- Threat Intelligence APIs

## 🛠️ Development

### Environment Variables
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
TELEGRAM_MINI_APP_URL=https://your-domain.com/telegram
```

### Local Testing
1. Install ngrok: `brew install ngrok`
2. Run local server: `npm run dev`
3. Expose with ngrok: `ngrok http 3000`
4. Update webhook: `node scripts/setup-telegram-bot.js --local <ngrok-url>`

### Deployment
1. Deploy to Vercel: `vercel --prod`
2. Update environment variables
3. Run setup script: `node scripts/setup-telegram-bot.js`
4. Test in Telegram

## 📊 Analytics

Track usage with built-in analytics:
- Total scans performed
- Threats detected
- User engagement
- Popular scan types

## 🔒 Privacy

- No personal data stored without consent
- Scan history stored locally in Telegram Cloud
- Anonymous usage statistics only
- GDPR compliant

## 🆘 Support

- Bot issues: Use `/help` command
- Technical support: Create GitHub issue
- Feature requests: Contact via Telegram

## 📄 License

This project is part of the LYN Security Platform.

---

**Stay Safe Online with LYN Security Scanner!** 🛡️