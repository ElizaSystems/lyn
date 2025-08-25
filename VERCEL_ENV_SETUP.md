# Vercel Environment Variables Setup for LYN AI Lite

## Required Environment Variables

You need to add these environment variables in your Vercel project settings for the link security checker to work properly.

### Step 1: Go to Vercel Dashboard
1. Visit https://vercel.com/dashboard
2. Select your `lyn-hacker` project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Variables

Add each of these environment variables:

#### 1. MongoDB Connection
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```
- Get free MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- Or use local: `mongodb://localhost:27017/lynai`

#### 2. NextAuth Configuration
```
NEXTAUTH_URL=https://your-deployment-url.vercel.app
NEXTAUTH_SECRET=generate-a-32-character-secret-here
```
- Generate secret: `openssl rand -base64 32`

#### 3. Venice AI (Chat Assistant)
```
VENICE_API_KEY=vn-your-venice-api-key
```
- Sign up at: https://venice.ai
- Get API key from dashboard

#### 4. VirusTotal (Threat Detection)
```
VIRUSTOTAL_API_KEY=your-virustotal-api-key
```
- Sign up at: https://www.virustotal.com/gui/my-apikey
- Free tier: 500 requests/day, 4 requests/minute

#### 5. Google Safe Browsing
```
GOOGLE_SAFE_BROWSING_API_KEY=your-google-api-key
```
- Get key at: https://developers.google.com/safe-browsing/v4/get-started
- Free tier: 10,000 requests/day

#### 6. IPQualityScore (Fraud Detection)
```
IPQUALITYSCORE_API_KEY=your-ipqualityscore-key
```
- Sign up at: https://www.ipqualityscore.com
- Free tier: 5,000 requests/month

#### 7. AbuseIPDB (IP Reputation)
```
ABUSEIPDB_API_KEY=your-abuseipdb-key
```
- Sign up at: https://www.abuseipdb.com/api
- Free tier: 1,000 requests/day

### Step 3: Apply to Branches

In the Environment Variables section:
1. Make sure each variable is set for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

2. Or specifically for the `lite` branch if you want different keys

### Step 4: Redeploy

After adding all environment variables:
1. Go to **Deployments** tab
2. Find your latest deployment
3. Click the three dots menu → **Redeploy**
4. Or push a small change to trigger new deployment

## Testing Your Setup

Once deployed with environment variables, test at:
```bash
curl -X POST https://your-deployment.vercel.app/api/security/analyze-link \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'
```

You should see multiple threat sources in the response:
```json
{
  "threat_sources": [
    {"name": "VirusTotal", "safe": true, "score": 100},
    {"name": "Google Safe Browsing", "safe": true, "score": 100},
    {"name": "IPQualityScore", "safe": true, "score": 100}
  ]
}
```

## Troubleshooting

### If APIs Still Don't Work:
1. Check deployment logs in Vercel dashboard
2. Verify API keys are correct (no extra spaces)
3. Make sure you're not hitting rate limits
4. Check if APIs are accessible from Vercel's region

### Fallback Behavior:
When API keys are missing, the system uses local analysis which:
- Checks for HTTPS
- Detects suspicious URL patterns
- Identifies known phishing indicators
- Provides basic score (usually 50-80)

## Important Notes

- **Never commit API keys to Git**
- Use Vercel's environment variables interface only
- Different API keys can be used for different branches
- Free tier limits are usually sufficient for personal use
- Monitor usage to avoid hitting limits

## Current Issue

Without these environment variables set in Vercel, the link checker will:
1. Try to call APIs (fail due to missing keys)
2. Fall back to basic local analysis
3. Return generic 50/100 scores
4. Show "Analysis service temporarily unavailable" messages

Setting these variables will enable full threat intelligence checking with real scores from multiple security services.