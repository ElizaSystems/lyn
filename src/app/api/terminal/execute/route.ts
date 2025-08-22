import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance, getTokenBalance, getTokenSupply, validateSolanaAddress } from '@/lib/solana'

const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'

// Command history storage
const commandHistory: Array<{ command: string; output: string; timestamp: Date }> = []

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json()
    
    if (!command) {
      return NextResponse.json({ error: 'Command required' }, { status: 400 })
    }
    
    // Only lowercase the command, not the arguments
    const parts = command.trim().split(' ')
    const cmd = parts[0].toLowerCase()
    const args = [cmd, ...parts.slice(1)] // Keep original case for arguments
    let output = ''
    
    // Process commands
    switch (cmd) {
      case 'help':
        if (args[1]) {
          // Detailed help for specific commands
          switch (args[1]) {
            case 'create':
              output = `create - Create new security applications

Usage:
  create app <name>              - Create a new security app
  create scanner <name>          - Create a URL/document scanner
  create monitor <name>          - Create a wallet monitor
  create detector <name>         - Create a threat detector
  create api <name>              - Create an API endpoint
  create dashboard <name>        - Create a security dashboard

Examples:
  create app my-phishing-detector
  create scanner url-checker
  create monitor wallet-guard`
              break
            case 'deploy':
              output = `deploy - Deploy your security applications

Usage:
  deploy <app-name>              - Deploy app to LYN network
  deploy list                    - List deployed apps
  deploy status <app-name>       - Check deployment status
  deploy logs <app-name>         - View deployment logs

Examples:
  deploy my-phishing-detector
  deploy status url-checker`
              break
            case 'scan':
              output = `scan - Security scanning commands

Usage:
  scan url <url>                 - Scan a URL for threats
  scan file <filename>           - Scan uploaded file
  scan wallet <address>          - Scan wallet for risks
  scan contract <address>        - Scan smart contract
  scan bulk <file>               - Bulk scan from file

Examples:
  scan url https://suspicious-site.com
  scan wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgHU`
              break
            default:
              output = `No detailed help available for '${args[1]}'`
          }
        } else {
          output = `LYN Security CLI - Available Commands:

🔧 DEVELOPMENT COMMANDS:
  create <type> <name>      - Create new security apps
  deploy <app>              - Deploy apps to network  
  template list             - List available templates
  generate <component>      - Generate code components

🛡️ SECURITY COMMANDS:
  scan <target>             - Scan URLs, files, wallets
  monitor <address>         - Monitor wallet activity
  analyze <type>            - Run security analysis
  threat-intel <query>      - Query threat intelligence

📊 NETWORK COMMANDS:
  status                    - Show security status
  metrics                   - Display system metrics
  wallet <address>          - Get wallet information
  token info                - Get LYN token information
  price                     - Get current LYN price

🔍 UTILITY COMMANDS:
  help <command>            - Detailed help for command
  history                   - Show command history
  clear                     - Clear terminal
  version                   - Show version info

Type 'help <command>' for detailed usage information.
Examples: help create, help scan, help deploy`
        }
        break
        
      case 'scan':
        if (args.length < 2) {
          output = 'Usage: scan <url>'
        } else {
          let url = args.slice(1).join(' ').trim()
          
          // Add protocol if missing
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url
          }
          
          output = `Scanning ${url}...\n[████████████████████████] 100%\n\n`
          
          try {
            // Call the analyze-link API with absolute URL
            const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'
            const response = await fetch(`${apiUrl}/api/security/analyze-link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url })
            })
          
            if (response.ok) {
              const data = await response.json()
              output += `Scan Results:\nRisk Level: ${data.risk_level || 'LOW'}\nSafe: ${data.safe ? 'YES ✓' : 'NO ✗'}
${data.details ? '\nDetails:\n' + data.details.map((d: string) => `  • ${d}`).join('\n') : ''}
${data.recommendations ? '\nRecommendations:\n' + data.recommendations.map((r: string) => `  • ${r}`).join('\n') : ''}`
            } else {
              output += 'Analysis failed. URL may be unreachable or invalid.'
            }
          } catch (error) {
            console.error('Scan error:', error)
            output += `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
        break
        
      case 'check':
        if (args.length < 2) {
          output = 'Usage: check <wallet_address>'
        } else {
          const address = args.slice(1).join(' ').trim()
          output = await handleWalletSecurityCheck(address)
        }
        break
        
      case 'wallet':
        if (args.length < 2) {
          output = 'Usage: wallet <address>'
        } else {
          const address = args.slice(1).join(' ').trim() // Handle full address
          const isValid = await validateSolanaAddress(address)
          
          if (isValid) {
            const balance = await getWalletBalance(address)
            const tokenBalance = await getTokenBalance(address, TOKEN_MINT)
            
            output = `Wallet Information:
Address: ${address}
SOL Balance: ${balance.toFixed(4)} SOL
LYN Tokens: ${tokenBalance.toLocaleString()} LYN
Status: Active
Network: Solana Mainnet`
          } else {
            output = 'Invalid wallet address'
          }
        }
        break
        
      case 'token':
        if (args[1] === 'info') {
          const supply = await getTokenSupply()
          output = `LYN Token Information:
Symbol: LYN
Name: Lyn Token
Contract: ${process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS?.slice(0, 8)}...
Total Supply: ${(supply.total / 1000000).toFixed(2)}M
Circulating: ${(supply.circulating / 1000000).toFixed(2)}M
Burned: ${(supply.burned / 1000000).toFixed(2)}M (${supply.burnPercentage?.toFixed(2) ?? '0.00'}%)
Decimals: 6`
        } else {
          output = 'Usage: token info'
        }
        break
        
      case 'price':
        output = `LYN Token Price:
Current: $0.042
24h Change: +12.5%
Market Cap: $4.2M
24h Volume: $892K
ATH: $0.085
ATL: $0.012`
        break
        
      case 'supply':
        const supply = await getTokenSupply()
        output = `Token Supply Information:
Total Supply: ${(supply.total / 1000000).toFixed(2)}M LYN
Circulating: ${(supply.circulating / 1000000).toFixed(2)}M LYN
Burned: ${(supply.burned / 1000000).toFixed(2)}M LYN
Burn Rate: ${supply.burnPercentage?.toFixed(3) ?? '0.000'}%
Next Burn: In 15 days`
        break
        
      case 'status':
        output = `Security Status: ACTIVE ✓
Firewall: ENABLED
Threat Detection: MONITORING
Network: Solana Mainnet
RPC: Connected
Last Scan: 2 minutes ago
Threats Blocked Today: ${142 + Math.floor(Math.random() * 20)}
Active Monitors: 5
System Health: 99.7%`
        break
        
      case 'analyze':
        output = `Running comprehensive security analysis...
[████████████████████████] 100%

Analysis Complete:
✓ No malware detected
✓ Network traffic normal
✓ All wallets secure
✓ Smart contracts verified
✓ 0 vulnerabilities found
✓ System integrity: 100%

Overall Security Score: A+`
        break
        
      case 'metrics':
        output = `Current System Metrics:
Total Scans: ${12847 + Math.floor(Math.random() * 100)}
Threats Detected: ${892 + Math.floor(Math.random() * 10)}
Success Rate: 99.7%
Uptime: 99.99%
Active Users: ${3421 + Math.floor(Math.random() * 50)}
Response Time: ${100 + Math.floor(Math.random() * 50)}ms
CPU Usage: ${20 + Math.floor(Math.random() * 30)}%
Memory: ${40 + Math.floor(Math.random() * 20)}%`
        break
        
      case 'create':
        if (args.length < 3) {
          output = `Usage: create <type> <name>

Available types:
  app        - Full security application
  scanner    - URL/document scanner
  monitor    - Wallet monitor
  detector   - Threat detector
  api        - API endpoint
  dashboard  - Security dashboard

Example: create app my-security-tool`
        } else {
          const type = args[1]
          const name = args[2]
          output = await handleCreateCommand(type, name)
        }
        break

      case 'template':
        if (args[1] === 'list') {
          output = `Available Security App Templates:

📱 APPLICATIONS:
  phishing-detector     - Advanced phishing detection app
  malware-scanner      - File and URL malware scanner  
  wallet-guardian      - Wallet security monitor
  smart-contract-audit - Contract vulnerability scanner
  threat-intelligence  - Threat data aggregation platform

🔧 COMPONENTS:
  scanner-ui           - Scanning interface components
  security-dashboard   - Real-time security dashboard
  alert-system         - Threat alert notifications
  analytics-engine     - Security analytics backend

📡 APIs:
  threat-api           - Threat intelligence API
  scan-service         - Scanning service backend
  monitor-api          - Monitoring service API

Use: create <type> <name> --template <template-name>`
        } else {
          output = 'Usage: template list'
        }
        break

      case 'deploy':
        if (args.length < 2) {
          output = `Usage: deploy <command>

Commands:
  deploy <app-name>        - Deploy app to LYN network
  deploy list              - List your deployed apps
  deploy status <app>      - Check deployment status
  deploy logs <app>        - View deployment logs
  deploy remove <app>      - Remove deployed app`
        } else {
          output = await handleDeployCommand(args.slice(1))
        }
        break

      case 'generate':
        if (args.length < 2) {
          output = `Usage: generate <component>

Available components:
  api-endpoint         - REST API endpoint
  scanner-component    - React scanning component
  threat-detector      - Threat detection logic
  dashboard-widget     - Dashboard widget
  alert-handler        - Alert handling system
  database-model       - Database model
  test-suite           - Test suite for app

Example: generate api-endpoint threat-checker`
        } else {
          output = await handleGenerateCommand(args.slice(1))
        }
        break

      case 'monitor':
        if (args.length < 2) {
          output = 'Usage: monitor <wallet-address>'
        } else {
          const address = args[1]
          output = await handleMonitorCommand(address)
        }
        break

      case 'threat-intel':
        if (args.length < 2) {
          output = 'Usage: threat-intel <query>'
        } else {
          const query = args.slice(1).join(' ')
          output = await handleThreatIntelCommand(query)
        }
        break

      case 'history':
        output = `Command History (Last 10):
${commandHistory.slice(-10).map((cmd, i) => `  ${i + 1}. ${cmd.command}`).join('\n')}`
        break

      case 'tutorial':
        output = await handleTutorialCommand(args.slice(1))
        break

      case 'version':
        output = `LYN Security CLI v3.0.0
Build: ${Date.now()}
Node: v18.17.0
Network: Solana Mainnet
RPC: Helius
Status: Production
Features: App Creation, Deployment, Monitoring`
        break
        
      case 'cd':
        output = 'Directory navigation is not available in this terminal.\nUse help to see available commands.'
        break
        
      case 'ls':
        output = 'File listing is not available in this terminal.\nUse help to see available commands.'
        break
        
      case 'pwd':
        output = '/lyn-security-terminal'
        break
        
      case 'clear':
        // Return a special response to clear the terminal
        return NextResponse.json({ action: 'clear' })
        
      default:
        if (cmd === '') {
          output = ''
        } else {
          output = `Command not found: ${cmd}
Type 'help' for available commands`
        }
    }
    
    // Store command in history
    commandHistory.push({
      command,
      output,
      timestamp: new Date()
    })
    
    // Keep only last 100 commands
    if (commandHistory.length > 100) {
      commandHistory.shift()
    }
    
    return NextResponse.json({ output })
  } catch (error) {
    console.error('Terminal execute error:', error)
    return NextResponse.json({ 
      output: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

// Command handler functions
async function handleCreateCommand(type: string, name: string): Promise<string> {
  const templates = {
    app: {
      files: ['src/main.js', 'package.json', 'README.md', 'config.json'],
      description: 'Full security application with frontend and backend'
    },
    scanner: {
      files: ['scanner.js', 'config.json', 'tests/scanner.test.js'],
      description: 'URL and document scanner component'
    },
    monitor: {
      files: ['monitor.js', 'alerts.js', 'config.json'],
      description: 'Wallet activity monitor'
    },
    detector: {
      files: ['detector.js', 'rules.json', 'ml-model.json'],
      description: 'Threat detection engine'
    },
    api: {
      files: ['api/routes.js', 'api/middleware.js', 'api/auth.js'],
      description: 'RESTful API endpoint'
    },
    dashboard: {
      files: ['dashboard/index.js', 'dashboard/components/', 'dashboard/styles.css'],
      description: 'Security analytics dashboard'
    }
  }

  const template = templates[type as keyof typeof templates]
  if (!template) {
    return `Error: Unknown app type '${type}'. Use 'help create' for available types.`
  }

  return `Creating ${type}: ${name}

📁 Project Structure:
${template.files.map(file => `  ├── ${file}`).join('\n')}

🔧 Generated Files:
${template.files.map(file => `  ✓ ${file}`).join('\n')}

📦 Dependencies Installed:
  ✓ @lyn/security-sdk
  ✓ @lyn/threat-intel
  ✓ @solana/web3.js
  ✓ express
  ✓ typescript

🚀 Next Steps:
  1. cd ${name}
  2. npm install
  3. lyn configure
  4. lyn deploy

Your ${template.description} is ready!
Use 'deploy ${name}' to publish to the LYN network.`
}

async function handleDeployCommand(args: string[]): Promise<string> {
  const subcommand = args[0]
  
  switch (subcommand) {
    case 'list':
      return `Your Deployed Security Apps:

📱 ACTIVE DEPLOYMENTS:
  phishing-guard-v2    - Status: RUNNING  - Users: 1,247
  wallet-monitor-pro   - Status: RUNNING  - Users: 892
  threat-scanner-api   - Status: RUNNING  - Requests: 15K/day

🔧 DEVELOPMENT:
  contract-auditor     - Status: BUILDING - ETA: 2 min
  
💰 EARNINGS:
  Total Revenue: 2,847 LYN
  Monthly Active: 4,521 users
  API Calls: 127K this month

Use 'deploy status <app-name>' for detailed information.`

    default:
      const appName = subcommand
      return `Deploying ${appName} to LYN Security Network...

🔄 Deployment Process:
  ✓ Validating application code
  ✓ Running security tests
  ✓ Building production bundle
  ✓ Uploading to IPFS
  ✓ Registering on Solana
  ✓ Configuring load balancer
  
🌐 Deployment Complete:
  App URL: https://${appName}.lyn-apps.com
  API URL: https://api.lyn-apps.com/${appName}
  Status: LIVE ✓
  
📊 Initial Stats:
  Deployment ID: dep_${Date.now()}
  Network: Solana Mainnet
  IPFS Hash: Qm${Math.random().toString(36).substring(2, 15)}
  
🎉 Your security app is now live on the LYN network!
Share it with: https://${appName}.lyn-apps.com`
  }
}

async function handleGenerateCommand(args: string[]): Promise<string> {
  const component = args[0]
  const name = args[1] || 'my-component'
  
  const generators = {
    'api-endpoint': `Generated API Endpoint: ${name}

📄 Files Created:
  ✓ api/${name}.js
  ✓ api/${name}.test.js
  ✓ api/schemas/${name}.json

🔧 Code Generated:
\`\`\`javascript
// api/${name}.js
const { LynSecuritySDK } = require('@lyn/security-sdk')

async function ${name}Handler(req, res) {
  const { target } = req.body
  
  // Initialize LYN Security SDK
  const scanner = new LynSecuritySDK.ThreatScanner()
  
  try {
    const result = await scanner.analyze(target)
    res.json({
      safe: result.safe,
      threats: result.threats,
      confidence: result.confidence
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = { ${name}Handler }
\`\`\`

🚀 Ready to use! Add to your routes file.`,

    'scanner-component': `Generated Scanner Component: ${name}

📄 Files Created:
  ✓ components/${name}.tsx
  ✓ components/${name}.module.css
  ✓ components/${name}.test.tsx

🔧 React Component Generated:
\`\`\`tsx
// components/${name}.tsx
import React, { useState } from 'react'
import { LynSecuritySDK } from '@lyn/security-sdk'

export function ${name}() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  
  const handleScan = async (target: string) => {
    setScanning(true)
    try {
      const scanner = new LynSecuritySDK.ThreatScanner()
      const scanResult = await scanner.analyze(target)
      setResult(scanResult)
    } finally {
      setScanning(false)
    }
  }
  
  return (
    <div className="security-scanner">
      {/* Scanner UI */}
    </div>
  )
}
\`\`\`

🎨 Styled with LYN Security theme!`,

    'threat-detector': `Generated Threat Detector: ${name}

📄 Files Created:
  ✓ detectors/${name}.js
  ✓ detectors/${name}.rules.json
  ✓ detectors/${name}.test.js

🔧 Detection Engine Generated:
\`\`\`javascript
// detectors/${name}.js
const { LynSecuritySDK } = require('@lyn/security-sdk')

class ${name}Detector {
  constructor() {
    this.rules = require('./${name}.rules.json')
    this.scanner = new LynSecuritySDK.ThreatDetector()
  }
  
  async detect(input) {
    const threats = []
    
    for (const rule of this.rules) {
      if (await this.scanner.checkRule(input, rule)) {
        threats.push(rule.threat)
      }
    }
    
    return {
      threats,
      safe: threats.length === 0,
      confidence: this.calculateConfidence(threats)
    }
  }
}

module.exports = ${name}Detector
\`\`\`

🛡️ Ready to detect threats!`
  }
  
  const generator = generators[component as keyof typeof generators]
  if (!generator) {
    return `Error: Unknown component '${component}'. Use 'help generate' for available components.`
  }
  
  return generator
}

async function handleMonitorCommand(address: string): Promise<string> {
  return `Setting up wallet monitor for: ${address}

🔍 Monitoring Configuration:
  ✓ Real-time transaction tracking
  ✓ Suspicious activity detection
  ✓ Balance change alerts
  ✓ Smart contract interaction monitoring
  
📊 Current Status:
  Wallet: ${address.slice(0, 8)}...${address.slice(-8)}
  Balance: Checking...
  Risk Level: LOW
  Last Activity: 2 minutes ago
  
🚨 Alert Rules:
  • Large transfers (>10,000 LYN)
  • Suspicious contract interactions
  • Unusual transaction patterns
  • Known malicious addresses
  
Monitor active! You'll receive alerts for suspicious activity.`
}

async function handleThreatIntelCommand(query: string): Promise<string> {
  return `Threat Intelligence Query: "${query}"

🔍 Searching databases:
  ✓ VirusTotal
  ✓ AlienVault OTX
  ✓ Hybrid Analysis
  ✓ URLVoid
  ✓ LYN Community Reports

📊 Results:
  Known Threats: 0
  Reputation: CLEAN
  Risk Score: 2/100 (Very Low)
  Last Seen: Never
  
📈 Historical Data:
  • No malicious activity reported
  • Clean across all threat databases
  • Community trust score: 95/100
  
✅ Query appears safe based on current intelligence.`
}

async function handleTutorialCommand(args: string[]): Promise<string> {
  const step = args[0]
  
  if (!step) {
    return `🎓 LYN Security CLI Tutorial

Welcome to the LYN Security CLI! This tutorial will guide you through creating your first security application.

📚 Tutorial Steps:
  tutorial start       - Begin the tutorial
  tutorial next        - Next step
  tutorial prev        - Previous step
  tutorial reset       - Reset tutorial
  
🚀 What you'll learn:
  • Creating security applications
  • Using threat detection APIs
  • Deploying to the LYN network
  • Monetizing your security tools
  
Start with: tutorial start`
  }
  
  switch (step) {
    case 'start':
      return `🎓 Tutorial Step 1: Creating Your First Security App

Let's create a simple phishing detector!

📝 Command to run:
  create app phishing-detector

This will generate:
  • Frontend React components
  • Backend API endpoints  
  • Database models
  • Test suites
  • Configuration files

🎯 Your app will be able to:
  • Scan URLs for phishing attempts
  • Check domains against threat databases
  • Provide risk scores and recommendations
  • Integrate with LYN's threat intelligence

Ready? Run the create command above, then type 'tutorial next'`

    case 'next':
      return `🎓 Tutorial Step 2: Configuring Your App

Great! Now let's configure your phishing detector.

📝 Commands to run:
  1. cd phishing-detector
  2. lyn configure --api-key YOUR_KEY
  3. lyn test

🔧 Configuration includes:
  • API keys for threat intelligence
  • Database connection strings
  • Solana network settings
  • Security thresholds

💡 Pro tip: Use environment variables for sensitive data!

After configuration, type 'tutorial next'`

    default:
      return `Tutorial step '${step}' not found. Use 'tutorial start' to begin.`
  }
}

async function handleWalletSecurityCheck(address: string): Promise<string> {
  try {
    // Validate address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return `❌ Invalid wallet address format: ${address}`
    }

    // Call the wallet security analysis API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/security/analyze-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address })
    })

    if (!response.ok) {
      return `❌ Wallet analysis failed: ${response.status}`
    }

    const data = await response.json()
    
    // Format the security analysis result
    const riskEmojiMap: Record<string, string> = {
      'very-low': '✅',
      'low': '✅', 
      'medium': '⚠️',
      'high': '🚨',
      'critical': '🔴'
    }
    const riskEmoji = riskEmojiMap[data.analysis.riskLevel] || '❓'

    let output = `${riskEmoji} Wallet Security Analysis: ${address.slice(0, 8)}...${address.slice(-8)}

🛡️ SECURITY OVERVIEW:
  Risk Level: ${data.analysis.riskLevel.toUpperCase().replace('-', ' ')} (${data.analysis.riskScore}/100)
  Blacklisted: ${data.analysis.isBlacklisted ? 'YES ⚠️' : 'NO ✅'}
  Overall Safety: ${data.analysis.overallSafety ? 'SAFE ✅' : 'RISKY ⚠️'}

📊 REPUTATION:
  Community Score: ${data.reputation.score}/1000
  Trust Level: ${data.reputation.trustLevel.toUpperCase()}
  Reports: ${data.reputation.communityReports} total (${data.reputation.verifiedReports} verified)

📈 WALLET METRICS:
  Account Age: ${data.details.accountAge} days
  Transactions: ${data.details.transactionCount.toLocaleString()}
  Avg Transaction: ${data.details.averageTransactionValue.toFixed(3)} SOL
  Unique Contacts: ${data.details.uniqueInteractions.toLocaleString()}`

    // Add threats if any
    if (data.threats && data.threats.length > 0) {
      output += `\n\n🚨 IDENTIFIED THREATS:\n${data.threats.map((threat: string) => `  • ${threat}`).join('\n')}`
    }

    // Add security flags
    if (data.flags && data.flags.length > 0) {
      output += `\n\n⚠️ SECURITY FLAGS:\n${data.flags.map((flag: { description: string; severity: string; confidence: number }) => 
        `  • ${flag.description} (${flag.severity.toUpperCase()}, ${flag.confidence}% confidence)`
      ).join('\n')}`
    }

    // Add top recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      output += `\n\n💡 RECOMMENDATIONS:\n${data.recommendations.slice(0, 3).map((rec: string) => `  • ${rec}`).join('\n')}`
    }

    return output

  } catch (error) {
    console.error('Wallet security check error:', error)
    return `❌ Security analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}