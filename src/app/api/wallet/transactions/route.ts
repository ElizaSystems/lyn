import { NextRequest, NextResponse } from 'next/server'
import { getRecentTransactions, shortenAddress } from '@/lib/solana'
import { PublicKey } from '@solana/web3.js'

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, limit = 10 } = await req.json()
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }
    
    const transactions = await getRecentTransactions(walletAddress, limit)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTransactions = transactions.map((tx: any) => {
      const txWithTime = { ...tx, blockTime: tx.blockTime ?? null }
      const type = detectTransactionType(txWithTime as Transaction, walletAddress)
      const amount = extractAmount(txWithTime as Transaction)
      const counterparty = extractCounterparty(txWithTime as Transaction, walletAddress, type)
      
      return {
        signature: tx.signature,
        type,
        amount,
        from: type === 'receive' ? counterparty : walletAddress,
        to: type === 'send' ? counterparty : walletAddress,
        time: formatTime(tx.blockTime ?? null),
        timestamp: tx.blockTime ?? null,
        status: tx.err ? 'failed' : 'success'
      }
    })
    
    return NextResponse.json({ transactions: formattedTransactions })
  } catch (error) {
    console.error('Transactions API error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

interface Transaction {
  signature: string
  blockTime: number | null
  slot: number
  err: unknown
  memo: string | null
  transaction: {
    message?: {
      accountKeys?: Array<{ pubkey: PublicKey }>
      instructions?: Array<{
        parsed?: {
          type: string
          info: Record<string, unknown>
        }
      }>
    }
    meta?: {
      preBalances?: number[]
      postBalances?: number[]
    }
  } | null
}

function detectTransactionType(tx: Transaction, walletAddress: string): 'send' | 'receive' {
  if (!tx.transaction?.message?.accountKeys) return 'receive'
  
  const walletPubkey = new PublicKey(walletAddress)
  const accountKeys = tx.transaction.message.accountKeys
  
  const walletIndex = accountKeys.findIndex((key) => 
    key.pubkey.equals(walletPubkey)
  )
  
  if (walletIndex === 0) return 'send'
  return 'receive'
}

function extractAmount(tx: Transaction): string {
  try {
    const instructions = tx.transaction?.message?.instructions || []
    
    for (const instruction of instructions) {
      if (instruction.parsed?.type === 'transfer') {
        const amount = instruction.parsed.info.lamports as number | undefined
        if (amount) {
          return (amount / 1e9).toFixed(4) + ' SOL'
        }
      }
      
      if (instruction.parsed?.type === 'transferChecked') {
        const tokenAmount = instruction.parsed.info.tokenAmount as { uiAmount?: number } | undefined
        const amount = tokenAmount?.uiAmount
        if (amount) {
          return amount.toFixed(2) + ' ' + (instruction.parsed.info.mint || 'Token')
        }
      }
    }
    
    const preBalance = tx.transaction?.meta?.preBalances?.[0] || 0
    const postBalance = tx.transaction?.meta?.postBalances?.[0] || 0
    const change = Math.abs(postBalance - preBalance) / 1e9
    
    if (change > 0) {
      return change.toFixed(4) + ' SOL'
    }
    
    return '0'
  } catch (error) {
    console.error('Error extracting amount:', error)
    return '0'
  }
}

function extractCounterparty(tx: Transaction, walletAddress: string, type: 'send' | 'receive'): string {
  try {
    const instructions = tx.transaction?.message?.instructions || []
    
    for (const instruction of instructions) {
      if (instruction.parsed?.type === 'transfer' || instruction.parsed?.type === 'transferChecked') {
        const source = instruction.parsed.info.source as string | undefined
        const destination = (instruction.parsed.info.destination || instruction.parsed.info.dest) as string | undefined
        
        if (type === 'send' && destination) {
          return shortenAddress(destination, 6)
        }
        if (type === 'receive' && source) {
          return shortenAddress(source, 6)
        }
      }
    }
    
    const accountKeys = tx.transaction?.message?.accountKeys || []
    if (accountKeys.length > 1) {
      const otherAccount = accountKeys.find((key) => 
        key.pubkey.toString() !== walletAddress
      )
      if (otherAccount) {
        return shortenAddress(otherAccount.pubkey.toString(), 6)
      }
    }
    
    return 'Unknown'
  } catch (error) {
    console.error('Error extracting counterparty:', error)
    return 'Unknown'
  }
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return 'Unknown'
  const now = Date.now() / 1000
  const diff = now - timestamp
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}