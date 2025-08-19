import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { fetchSolanaPrice as fetchRealSolPrice, fetchTokenPrice as fetchRealTokenPrice, fetchPriceChange as fetchRealPriceChange } from '@/lib/services/price-service'

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(RPC_ENDPOINT, 'confirmed')

interface TokenInfo {
  symbol: string
  name: string
  balance: string
  value: string
  change: string
  mint: string
  decimals: number
  uiAmount: number
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json()
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }
    
    const publicKey = new PublicKey(walletAddress)
    
    // Get SOL balance
    const solBalance = await connection.getBalance(publicKey)
    const solAmount = solBalance / LAMPORTS_PER_SOL
    const solPrice = await fetchSolanaPrice()
    const solValue = solAmount * solPrice
    
    // Get all token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    )
    
    // Get Token-2022 accounts
    const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_2022_PROGRAM_ID }
    )
    
    const allTokenAccounts = [...tokenAccounts.value, ...token2022Accounts.value]
    
    // Process token accounts
    const tokens: TokenInfo[] = []
    let totalValue = solValue
    
    // Add SOL as first token
    if (solAmount > 0) {
      tokens.push({
        symbol: 'SOL',
        name: 'Solana',
        balance: formatNumber(solAmount, 4),
        value: `$${formatNumber(solValue)}`,
        change: await fetchPriceChange('SOL'),
        mint: '11111111111111111111111111111111',
        decimals: 9,
        uiAmount: solAmount
      })
    }
    
    // Process SPL tokens
    for (const account of allTokenAccounts) {
      const tokenData = account.account.data.parsed.info
      const tokenAmount = tokenData.tokenAmount
      
      if (tokenAmount.uiAmount > 0) {
        const tokenInfo = await fetchTokenInfo(tokenData.mint)
        const tokenPrice = await fetchTokenPrice(tokenData.mint)
        const tokenValue = tokenAmount.uiAmount * tokenPrice
        
        tokens.push({
          symbol: tokenInfo.symbol || 'Unknown',
          name: tokenInfo.name || 'Unknown Token',
          balance: formatNumber(tokenAmount.uiAmount, 2),
          value: `$${formatNumber(tokenValue)}`,
          change: await fetchPriceChange(tokenInfo.symbol),
          mint: tokenData.mint,
          decimals: tokenAmount.decimals,
          uiAmount: tokenAmount.uiAmount
        })
        
        totalValue += tokenValue
      }
    }
    
    // Sort tokens by value (highest first)
    tokens.sort((a, b) => {
      const aValue = parseFloat(a.value.replace('$', '').replace(',', ''))
      const bValue = parseFloat(b.value.replace('$', '').replace(',', ''))
      return bValue - aValue
    })
    
    return NextResponse.json({
      tokens,
      totalValue,
      walletAddress
    })
  } catch (error) {
    console.error('Tokens API error:', error)
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
  }
}

async function fetchSolanaPrice(): Promise<number> {
  return fetchRealSolPrice()
}

async function fetchTokenPrice(mint: string): Promise<number> {
  return fetchRealTokenPrice(mint)
}

// Cache token info to avoid repeated fetches
const tokenInfoCache: { [mint: string]: { symbol: string; name: string; timestamp: number } } = {}
const CACHE_DURATION = 3600000 // 1 hour

async function fetchTokenInfo(mint: string): Promise<{ symbol: string; name: string }> {
  try {
    // Check cache first
    const cached = tokenInfoCache[mint]
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return { symbol: cached.symbol, name: cached.name }
    }
    
    // Common known tokens - these are reliable
    const knownTokens: { [key: string]: { symbol: string; name: string } } = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD' },
      'So11111111111111111111111111111111111111112': { symbol: 'wSOL', name: 'Wrapped SOL' },
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade Staked SOL' },
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk' },
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter' },
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium' },
    }
    
    // Check if it's a known token
    if (knownTokens[mint]) {
      const info = knownTokens[mint]
      tokenInfoCache[mint] = { ...info, timestamp: Date.now() }
      return info
    }
    
    // Check if it's the LYN token
    const lynMint = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS
    if (mint === lynMint || mint.toLowerCase().includes('lyn')) {
      const info = { symbol: 'LYN', name: 'LYN Token' }
      tokenInfoCache[mint] = { ...info, timestamp: Date.now() }
      return info
    }
    
    // Try to fetch from token metadata on-chain
    try {
      const mintPubkey = new PublicKey(mint)
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey)
      
      if (mintInfo.value && 'parsed' in mintInfo.value.data) {
        const parsedData = mintInfo.value.data.parsed
        if (parsedData.type === 'mint' && parsedData.info) {
          // Some tokens store metadata in extensions
          const symbol = parsedData.info.symbol || 'TOKEN'
          const name = parsedData.info.name || 'Unknown Token'
          const info = { symbol, name }
          tokenInfoCache[mint] = { ...info, timestamp: Date.now() }
          return info
        }
      }
    } catch (onChainError) {
      console.error('Failed to fetch on-chain metadata:', onChainError)
    }
    
    // Try Jupiter Token List API (public endpoint)
    try {
      const response = await fetch(`https://token.jup.ag/strict`)
      if (response.ok) {
        const tokens = await response.json()
        const token = tokens.find((t: { address: string; symbol: string; name: string }) => t.address === mint)
        if (token) {
          const info = { symbol: token.symbol, name: token.name }
          tokenInfoCache[mint] = { ...info, timestamp: Date.now() }
          return info
        }
      }
    } catch (jupiterError) {
      console.error('Failed to fetch from Jupiter token list:', jupiterError)
    }
    
    // Default fallback - use first 4 chars of mint as symbol
    const shortMint = mint.substring(0, 4).toUpperCase()
    const info = { symbol: shortMint, name: 'Unknown Token' }
    tokenInfoCache[mint] = { ...info, timestamp: Date.now() }
    return info
  } catch (error) {
    console.error('Error fetching token info:', error)
    return { symbol: 'TOKEN', name: 'Unknown Token' }
  }
}

async function fetchPriceChange(symbol: string): Promise<string> {
  return fetchRealPriceChange(symbol)
}

function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}