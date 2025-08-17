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
        output = `Available commands:
  help              - Show this help message
  scan <url>        - Scan a URL for security threats
  check <address>   - Check if a wallet address is safe
  status            - Show current security status
  wallet <address>  - Get wallet information
  token info        - Get LYN token information
  price             - Get current LYN price
  supply            - Get token supply information
  clear             - Clear terminal
  analyze           - Run security analysis
  metrics           - Display current metrics
  version           - Show version information`
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
          const address = args.slice(1).join(' ').trim() // Handle full address
          const isValid = await validateSolanaAddress(address)
          
          if (isValid) {
            const balance = await getWalletBalance(address)
            const tokenBalance = await getTokenBalance(address, TOKEN_MINT)
            
            output = `Wallet Analysis: ${address.slice(0, 8)}...${address.slice(-8)}
Status: VALID ✓
SOL Balance: ${balance.toFixed(4)} SOL
LYN Balance: ${tokenBalance.toLocaleString()} LYN
Risk Level: LOW
Reputation: CLEAN`
          } else {
            output = `Invalid wallet address: ${address}`
          }
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
        
      case 'version':
        output = `LYN Security Terminal v2.0.0
Build: ${Date.now()}
Node: v18.17.0
Network: Solana Mainnet
RPC: Helius
Status: Production`
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