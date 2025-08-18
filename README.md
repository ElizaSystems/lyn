# LYN AI - Crypto Security Defense Platform

A professional cybersecurity platform with **REAL threat detection capabilities** using actual security APIs and AI.

## 🚀 Features

### Real Security Scanning (Not Simulated!)
- **URL/Link Analysis**: Checks against VirusTotal, Google Safe Browsing, URLVoid, IPQualityScore, PhishTank, and AbuseIPDB
- **Malware Scanning**: Real antivirus scanning using 70+ engines via VirusTotal API
- **AI-Powered Chat**: OpenAI GPT-4 integration for intelligent security assistance
- **Real-time Threat Intelligence**: Live API calls to professional security databases

### Platform Features
- Solana wallet integration with token gating
- Mobile-responsive design
- Real-time security analytics
- Automated task system
- Burn tracker and metrics

## ⚠️ IMPORTANT: Setting Up Real Security Features

**The security features require API keys to function properly.** See [SECURITY_SETUP.md](./SECURITY_SETUP.md) for detailed instructions on:
- Getting free API keys from security providers
- Configuring environment variables
- Testing the real scanning capabilities

Without API keys, the app will use fallback pattern matching (less accurate).

## Getting Started

### Installation

#### Download the template

```shell
pnpm create solana-dapp@latest -t gh:solana-foundation/templates/gill/lyn-hacker
```

#### Install Dependencies

```shell
pnpm install
```

#### Start the web app

```shell
pnpm dev
```
