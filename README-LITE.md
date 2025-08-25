# LYN AI Lite - Free Link Security Checker

A lightweight, free version of LYN AI focused on link security checking and threat analysis. No blockchain or token requirements.

## Features

- 🔍 **Real-time URL Analysis** - Check links against multiple threat databases
- 🛡️ **Multi-Source Verification** - VirusTotal, Google Safe Browsing, IPQualityScore, and more
- 💬 **AI Security Assistant** - Chat with Lyn AI for security advice
- 📊 **Threat Intelligence** - Detailed analysis with confidence scores
- 🆓 **Completely Free** - Uses free tiers of security APIs

## Quick Start

### 1. Prerequisites

- Node.js 18+ and npm
- MongoDB database (local or cloud)
- Free API keys (see below)

### 2. Clone and Install

```bash
git clone -b lite https://github.com/ElizaSystems/lyn.git
cd lyn
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.lite .env.local
```

Edit `.env.local` and add your API keys:

- **MongoDB**: Get free at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Venice AI**: Sign up at [venice.ai](https://venice.ai)
- **VirusTotal**: Get key at [VirusTotal](https://www.virustotal.com/gui/my-apikey)
- **Google Safe Browsing**: [Get Started](https://developers.google.com/safe-browsing/v4/get-started)
- **IPQualityScore**: Free at [IPQualityScore](https://www.ipqualityscore.com)
- **AbuseIPDB**: Register at [AbuseIPDB](https://www.abuseipdb.com/api)

### 4. Run Development Server

```bash
npm run dev:next
```

Visit http://localhost:3005

## API Limits (Free Tiers)

| Service | Daily Limit | Use Case |
|---------|------------|----------|
| VirusTotal | 500 requests | Malware/phishing detection |
| Google Safe Browsing | 10,000 requests | URL reputation |
| IPQualityScore | 166/day (5k/month) | Fraud detection |
| AbuseIPDB | 1,000 requests | IP reputation |

Total capacity: ~500-1000 URL scans per day

## Key Differences from Main Branch

| Feature | Main Branch | Lite Branch |
|---------|------------|-------------|
| Token Requirements | ✅ LYN tokens | ❌ None |
| Blockchain Integration | ✅ Solana | ❌ None |
| URL Analysis | ✅ Full | ✅ Full |
| File Scanning | ✅ Yes | ✅ Yes |
| AI Chat | ✅ Advanced | ✅ Basic |
| User Accounts | ✅ Wallet-based | ⚠️ Session-based |
| Cost | 💰 Token burns | 🆓 Free |

## Production Deployment

### Vercel (Recommended)

1. Fork the repository
2. Import to Vercel
3. Select `lite` branch
4. Add environment variables
5. Deploy

### Self-Hosted

```bash
npm run build
npm run start:next
```

## Security Notes

- Never commit `.env.local` or API keys
- Use environment variables in production
- Monitor API usage to stay within free tiers
- Consider rate limiting for public deployments

## Support

- Issues: [GitHub Issues](https://github.com/ElizaSystems/lyn/issues)
- Documentation: This README
- Main Project: [LYN AI Platform](https://github.com/ElizaSystems/lyn)

## License

MIT - Free to use and modify

---

Built with ❤️ by the LYN AI team