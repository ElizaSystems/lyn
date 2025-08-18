# LYN AI Security Features - Setup Guide

## Overview

LYN AI now includes **REAL security scanning capabilities** using professional threat intelligence APIs and services. This is not a simulation - the app actually checks URLs and files against the same databases used by major security companies.

## Features

### 🔍 URL/Link Analysis
- **VirusTotal**: Checks URLs against 90+ security vendors
- **Google Safe Browsing**: Google's phishing and malware database
- **URLVoid**: Reputation checking across 30+ blacklist engines
- **IPQualityScore**: Advanced fraud and risk scoring
- **PhishTank**: Community-driven phishing database
- **AbuseIPDB**: IP address reputation checking

### 📄 Document/File Scanning
- **VirusTotal File Scanning**: Scans files with 70+ antivirus engines
- **Real malware detection**: Not pattern matching, actual AV scanning
- **Support for all file types** up to 32MB
- **Hash checking** against known malware databases

### 🤖 AI-Powered Chat
- **OpenAI GPT-4**: Real AI responses, not scripted templates
- **Context-aware conversations** with memory
- **Intent recognition** for automatic threat analysis
- **Security education** and best practices

## Setup Instructions

### 1. Get API Keys (All Free Tiers Available)

#### VirusTotal (Required for file/URL scanning)
1. Go to https://www.virustotal.com/gui/join-us
2. Create a free account
3. Go to your profile → API Key
4. Copy your API key

#### Google Safe Browsing (Recommended)
1. Go to https://developers.google.com/safe-browsing/v4/get-started
2. Create a Google Cloud Project
3. Enable Safe Browsing API
4. Create credentials (API Key)
5. Copy your API key

#### OpenAI (Required for AI chat)
1. Go to https://platform.openai.com/signup
2. Create an account
3. Go to https://platform.openai.com/api-keys
4. Create a new API key
5. Copy your API key

#### IPQualityScore (Optional)
1. Go to https://www.ipqualityscore.com/create-account
2. Sign up for free account
3. Go to Account Settings → API Settings
4. Copy your API key

#### URLVoid (Optional)
1. Go to https://www.urlvoid.com/api/
2. Register for API access
3. Copy your API key

#### AbuseIPDB (Optional)
1. Go to https://www.abuseipdb.com/register
2. Create free account
3. Go to https://www.abuseipdb.com/account/api
4. Generate API key
5. Copy your API key

### 2. Configure Environment Variables

Add your API keys to `.env.local`:

```env
# Required for core functionality
VIRUSTOTAL_API_KEY=your_virustotal_key_here
OPENAI_API_KEY=your_openai_key_here

# Highly recommended
GOOGLE_SAFE_BROWSING_API_KEY=your_google_key_here

# Optional but enhance detection
IPQUALITYSCORE_API_KEY=your_ipqs_key_here
URLVOID_API_KEY=your_urlvoid_key_here
ABUSEIPDB_API_KEY=your_abuseipdb_key_here
```

### 3. Test the Features

1. **Test URL Scanning**: 
   - Go to the Security Assistant (/security)
   - Paste this known safe URL: `https://www.google.com`
   - Paste this test phishing URL: `http://phishing.example.com` (safe test URL)

2. **Test File Scanning**:
   - Upload any PDF or document
   - The system will scan it with VirusTotal

3. **Test AI Chat**:
   - Ask "How do I identify phishing emails?"
   - The AI will provide real, contextual responses

## API Limits (Free Tiers)

- **VirusTotal**: 500 requests/day, 4 requests/minute
- **Google Safe Browsing**: 10,000 requests/day
- **OpenAI**: $5 free credits (thousands of messages)
- **IPQualityScore**: 5,000 requests/month
- **URLVoid**: 1,000 requests/day
- **AbuseIPDB**: 1,000 requests/day

## How It Works

### URL Analysis Flow
1. User submits URL
2. System validates URL format
3. Checks cache for recent results (1 hour TTL)
4. Queries all configured threat intelligence APIs in parallel
5. Aggregates results from all sources
6. Calculates consensus (safe/suspicious/dangerous)
7. Returns detailed analysis with confidence scores

### File Scanning Flow
1. User uploads file (max 32MB)
2. System calculates file hash (SHA256)
3. Checks VirusTotal for existing reports
4. If not found, uploads file to VirusTotal
5. Waits for scan completion
6. Returns detailed results from 70+ AV engines

### AI Chat Flow
1. User sends message
2. System analyzes intent using GPT-4
3. Detects URLs or file upload requests
4. Maintains conversation context
5. Generates contextual security advice
6. Triggers automatic scans when URLs detected

## Security & Privacy

- **No file storage**: Files are only held in memory during scanning
- **Encrypted transmission**: All API calls use HTTPS
- **Result caching**: Reduces API calls and improves performance
- **No PII logging**: System doesn't log personal information
- **API key protection**: Keys stored in environment variables only

## Fallback Behavior

If API keys are not configured:
- URL analysis falls back to pattern-based detection
- File scanning uses heuristic analysis
- AI chat uses intelligent template responses
- System remains functional but with reduced accuracy

## Monitoring & Logs

Check the browser console and server logs for:
- `[ThreatIntel]` - Threat intelligence service activity
- `[OpenAI]` - AI service interactions
- API response times and cache hits
- Rate limit warnings

## Troubleshooting

### "API key not configured" warnings
- Ensure keys are in `.env.local`
- Restart the development server after adding keys
- Check for typos in environment variable names

### Slow response times
- First requests may be slower (cold start)
- VirusTotal file uploads take 5-15 seconds
- Cache warms up after initial requests

### Rate limit errors
- Free tiers have request limits
- System automatically handles failures gracefully
- Consider upgrading to paid tiers for production

## Production Considerations

For production deployment:
1. Use paid API tiers for higher limits
2. Implement Redis for distributed caching
3. Add request queuing for rate limit management
4. Set up monitoring and alerting
5. Consider adding more threat intelligence sources
6. Implement webhook callbacks for async scanning

## Support

For issues or questions:
- Check API provider documentation
- Review server logs for detailed errors
- Ensure all dependencies are installed: `npm install`
- Verify Node.js version 18+ is used

## License & Credits

This implementation integrates with:
- VirusTotal (Google)
- Google Safe Browsing
- OpenAI GPT-4
- Various threat intelligence providers

Each service has its own terms of service and usage policies.