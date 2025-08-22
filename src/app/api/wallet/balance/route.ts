import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance, getTokenBalance } from '@/lib/solana'

const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const walletAddress = searchParams.get('address')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }
    
    console.log(`[Balance API] Fetching balance for wallet: ${walletAddress}`)
    console.log(`[Balance API] Using token mint: ${TOKEN_MINT}`)
    
    const [solBalance, tokenBalance] = await Promise.all([
      getWalletBalance(walletAddress),
      getTokenBalance(walletAddress, TOKEN_MINT)
    ])
    
    console.log(`[Balance API] Results - SOL: ${solBalance}, LYN: ${tokenBalance}`)
    
    return NextResponse.json({
      sol: solBalance,
      balance: tokenBalance, // Add 'balance' field for compatibility
      token: tokenBalance,
      tokenSymbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL || 'LYN'
    })
  } catch (error) {
    console.error('Balance API GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json()
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }
    
    const [solBalance, tokenBalance] = await Promise.all([
      getWalletBalance(walletAddress),
      getTokenBalance(walletAddress, TOKEN_MINT)
    ])
    
    return NextResponse.json({
      sol: solBalance,
      token: tokenBalance,
      tokenSymbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL || 'LYN'
    })
  } catch (error) {
    console.error('Balance API error:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}