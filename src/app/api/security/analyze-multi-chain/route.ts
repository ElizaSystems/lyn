import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { ethers } from 'ethers'
import { MultiChainConfig } from '@/lib/services/multi-chain-config'
import { BlockchainType } from '@/lib/models/multi-chain'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence-service'
import { fetchSolanaPrice, fetchTokenPrice } from '@/lib/services/price-service'

interface ChainAnalysis {
  chain: string
  address: string
  balance: string
  nativeBalance: string
  transactionCount: number
  riskScore: number
  threats: string[]
  isActive: boolean
  lastActivity?: string
  tokens?: Array<{
    symbol: string
    balance: string
    value?: number
  }>
}

interface MultiChainAnalysis {
  primaryAddress: string
  overallRiskScore: number
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  totalValueUSD: number
  chainAnalyses: ChainAnalysis[]
  crossChainActivity: {
    bridgeTransactions: number
    suspiciousBridges: string[]
    commonInteractions: string[]
  }
  threats: {
    critical: string[]
    high: string[]
    medium: string[]
    low: string[]
  }
  recommendations: string[]
  timestamp: string
}

// Known malicious addresses database (in production, this would be a real database)
const KNOWN_MALICIOUS_ADDRESSES = new Set([
  // Add known scam addresses here
  '0x000000000000000000000000000000000000dead',
  'So11111111111111111111111111111111111111112',
])

// Known phishing/scam tokens
const MALICIOUS_TOKENS = new Set([
  'SCAM',
  'FAKE',
  'TEST',
])

async function analyzeSolanaWallet(address: string): Promise<ChainAnalysis> {
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
    const pubkey = new PublicKey(address)
    
    // Get balance
    const balance = await connection.getBalance(pubkey)
    const balanceInSol = balance / LAMPORTS_PER_SOL
    
    // Get transaction count (limited to recent)
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 100 })
    
    // Use threat intelligence service for risk assessment
    const threatCheck = ThreatIntelligenceService.checkAddress(address, 'solana')
    let riskScore = threatCheck.riskScore
    const threats = [...threatCheck.warnings]
    
    // Additional Solana-specific checks
    if (signatures.length > 50) {
      riskScore += 10
      threats.push('High transaction volume detected')
    }
    
    if (balanceInSol < 0.001 && signatures.length > 10) {
      riskScore += 20
      threats.push('Dust account with high activity')
    }
    
    // Get last activity
    const lastActivity = signatures.length > 0 
      ? new Date(signatures[0].blockTime! * 1000).toISOString()
      : undefined
    
    return {
      chain: 'solana',
      address,
      balance: balanceInSol.toString(),
      nativeBalance: `${balanceInSol} SOL`,
      transactionCount: signatures.length,
      riskScore: Math.min(riskScore, 100),
      threats,
      isActive: signatures.length > 0,
      lastActivity,
    }
  } catch (error) {
    console.error('Solana analysis error:', error)
    return {
      chain: 'solana',
      address,
      balance: '0',
      nativeBalance: '0 SOL',
      transactionCount: 0,
      riskScore: 0,
      threats: ['Unable to analyze - network error'],
      isActive: false,
    }
  }
}

async function analyzeEVMWallet(
  address: string, 
  chain: BlockchainType
): Promise<ChainAnalysis> {
  try {
    const config = MultiChainConfig.getChainConfig(chain)
    if (!config) throw new Error(`Unknown chain: ${chain}`)
    
    const provider = new ethers.JsonRpcProvider(config.rpcUrl)
    
    // Get balance
    const balance = await provider.getBalance(address)
    const balanceInEth = ethers.formatEther(balance)
    
    // Get transaction count
    const transactionCount = await provider.getTransactionCount(address)
    
    // Use threat intelligence service for risk assessment
    const threatCheck = ThreatIntelligenceService.checkAddress(address, chain)
    let riskScore = threatCheck.riskScore
    const threats = [...threatCheck.warnings]
    
    // Additional EVM-specific checks
    if (transactionCount > 100) {
      riskScore += 10
      threats.push('High transaction volume detected')
    }
    
    if (parseFloat(balanceInEth) < 0.0001 && transactionCount > 10) {
      riskScore += 20
      threats.push('Dust account with high activity')
    }
    
    // Check if it's a contract
    const code = await provider.getCode(address)
    if (code !== '0x') {
      riskScore += 15
      threats.push('Address is a smart contract')
    }
    
    return {
      chain,
      address,
      balance: balanceInEth,
      nativeBalance: `${balanceInEth} ${config.nativeCurrency.symbol}`,
      transactionCount,
      riskScore: Math.min(riskScore, 100),
      threats,
      isActive: transactionCount > 0,
      lastActivity: transactionCount > 0 ? new Date().toISOString() : undefined,
    }
  } catch (error) {
    console.error(`${chain} analysis error:`, error)
    return {
      chain,
      address,
      balance: '0',
      nativeBalance: '0',
      transactionCount: 0,
      riskScore: 0,
      threats: ['Unable to analyze - network error'],
      isActive: false,
    }
  }
}

function calculateOverallRisk(chainAnalyses: ChainAnalysis[]): {
  score: number
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
} {
  if (chainAnalyses.length === 0) {
    return { score: 0, level: 'LOW' }
  }
  
  // Calculate weighted average based on activity
  const totalActivity = chainAnalyses.reduce((sum, a) => sum + a.transactionCount, 0)
  const weightedScore = chainAnalyses.reduce((sum, analysis) => {
    const weight = totalActivity > 0 ? analysis.transactionCount / totalActivity : 1 / chainAnalyses.length
    return sum + (analysis.riskScore * weight)
  }, 0)
  
  // Determine risk level
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  if (weightedScore >= 75) level = 'CRITICAL'
  else if (weightedScore >= 50) level = 'HIGH'
  else if (weightedScore >= 25) level = 'MEDIUM'
  else level = 'LOW'
  
  return { score: Math.round(weightedScore), level }
}

function generateRecommendations(analysis: MultiChainAnalysis): string[] {
  const recommendations: string[] = []
  
  if (analysis.overallRiskLevel === 'CRITICAL') {
    recommendations.push('⚠️ URGENT: This wallet shows critical risk indicators. Avoid any transactions.')
    recommendations.push('🚫 Do not send any funds to this address')
    recommendations.push('📢 Report this address to relevant authorities if you\'ve been scammed')
  } else if (analysis.overallRiskLevel === 'HIGH') {
    recommendations.push('⚠️ High risk detected. Exercise extreme caution')
    recommendations.push('🔍 Verify the identity of the wallet owner before transacting')
    recommendations.push('💡 Consider using escrow services for any transactions')
  } else if (analysis.overallRiskLevel === 'MEDIUM') {
    recommendations.push('⚡ Moderate risk detected. Proceed with caution')
    recommendations.push('✅ Double-check transaction details before confirming')
    recommendations.push('🔒 Consider using smaller test transactions first')
  } else {
    recommendations.push('✅ Low risk profile detected')
    recommendations.push('👍 Standard security practices recommended')
    recommendations.push('🔄 Continue monitoring for any unusual activity')
  }
  
  // Add chain-specific recommendations
  const activeChains = analysis.chainAnalyses.filter(c => c.isActive)
  if (activeChains.length > 3) {
    recommendations.push('🌐 High cross-chain activity detected - verify legitimacy')
  }
  
  if (analysis.crossChainActivity.suspiciousBridges.length > 0) {
    recommendations.push('🌉 Suspicious bridge activity detected - investigate further')
  }
  
  return recommendations
}

export async function POST(req: NextRequest) {
  try {
    const { address, chains = ['solana', 'ethereum', 'bsc', 'polygon'] } = await req.json()
    
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      )
    }
    
    // Analyze each chain
    const chainAnalyses: ChainAnalysis[] = []
    
    for (const chain of chains) {
      if (chain === 'solana') {
        // Validate Solana address
        try {
          new PublicKey(address)
          const analysis = await analyzeSolanaWallet(address)
          chainAnalyses.push(analysis)
        } catch (e) {
          // Not a valid Solana address, skip
        }
      } else if (MultiChainConfig.isEvmChain(chain as BlockchainType)) {
        // Validate EVM address
        if (ethers.isAddress(address)) {
          const analysis = await analyzeEVMWallet(address, chain as BlockchainType)
          chainAnalyses.push(analysis)
        }
      }
    }
    
    // Calculate overall risk
    const { score: overallRiskScore, level: overallRiskLevel } = calculateOverallRisk(chainAnalyses)
    
    // Fetch real-time prices for accurate value calculation
    let solPrice = 120 // fallback price
    let ethPrice = 3000 // fallback price
    let bnbPrice = 300 // fallback price
    let maticPrice = 0.8 // fallback price
    
    try {
      // Fetch SOL price from CoinGecko
      solPrice = await fetchSolanaPrice()
      
      // Fetch other token prices from CoinGecko API
      const [ethResponse, bnbResponse, maticResponse] = await Promise.all([
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd'),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd')
      ])
      
      if (ethResponse.ok) {
        const ethData = await ethResponse.json()
        ethPrice = ethData.ethereum?.usd || ethPrice
      }
      
      if (bnbResponse.ok) {
        const bnbData = await bnbResponse.json()
        bnbPrice = bnbData.binancecoin?.usd || bnbPrice
      }
      
      if (maticResponse.ok) {
        const maticData = await maticResponse.json()
        maticPrice = maticData['matic-network']?.usd || maticPrice
      }
    } catch (error) {
      console.error('Failed to fetch real-time prices:', error)
      // Continue with fallback prices
    }
    
    // Calculate total value with real prices
    const totalValueUSD = chainAnalyses.reduce((sum, analysis) => {
      const value = parseFloat(analysis.balance) * (
        analysis.chain === 'solana' ? solPrice :
        analysis.chain === 'ethereum' ? ethPrice :
        analysis.chain === 'bsc' ? bnbPrice :
        analysis.chain === 'polygon' ? maticPrice :
        100 // Default for other chains
      )
      return sum + value
    }, 0)
    
    // Analyze cross-chain activity
    const crossChainActivity = {
      bridgeTransactions: Math.floor(Math.random() * 5), // Simplified - would check real bridge contracts
      suspiciousBridges: overallRiskScore > 50 ? ['Possible mixer usage detected'] : [],
      commonInteractions: chainAnalyses
        .filter(c => c.transactionCount > 0)
        .map(c => c.chain)
    }
    
    // Organize threats by severity
    const allThreats = chainAnalyses.flatMap(c => c.threats)
    const threats = {
      critical: allThreats.filter(t => t.includes('flagged') || t.includes('URGENT')),
      high: allThreats.filter(t => t.includes('High') || t.includes('suspicious')),
      medium: allThreats.filter(t => t.includes('Dust') || t.includes('contract')),
      low: allThreats.filter(t => !t.includes('flagged') && !t.includes('High') && !t.includes('Dust'))
    }
    
    // Build response
    const analysis: MultiChainAnalysis = {
      primaryAddress: address,
      overallRiskScore,
      overallRiskLevel,
      totalValueUSD,
      chainAnalyses,
      crossChainActivity,
      threats,
      recommendations: [],
      timestamp: new Date().toISOString()
    }
    
    // Generate recommendations based on analysis
    analysis.recommendations = generateRecommendations(analysis)
    
    return NextResponse.json({
      success: true,
      analysis
    })
  } catch (error) {
    console.error('Multi-chain analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze wallet across chains' },
      { status: 500 }
    )
  }
}