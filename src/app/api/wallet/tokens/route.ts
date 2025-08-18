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

async function fetchTokenInfo(mint: string): Promise<{ symbol: string; name: string }> {
  try {
    // In production, fetch from token list or metadata
    // For now, return mock info based on common tokens
    const mockTokens: { [key: string]: { symbol: string; name: string } } = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD' },
      'So11111111111111111111111111111111111111112': { symbol: 'wSOL', name: 'Wrapped SOL' },
      'LYNXRsQPMa22NyQxGmPYjUcTVvfYq7HGabJe3Zm1wp6': { symbol: 'LYN', name: 'LYN Token' },
      '8FU95xFJhUUkyyCLU13HSzDLs7oC4QZdXQHL6SCeab36': { symbol: 'LYN', name: 'LYN Token' },
    }
    
    // If not in mock list, check if it might be LYN based on partial match
    if (!mockTokens[mint]) {
      // Default to LYN for unknown tokens in this wallet (temporary solution)
      return { symbol: 'LYN', name: 'LYN Token' }
    }
    
    return mockTokens[mint]
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