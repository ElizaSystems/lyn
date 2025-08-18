import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getLYNTokenPrice } from '@/lib/services/price-service'

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'

export const connection = new Connection(RPC_ENDPOINT, 'confirmed')

export async function getWalletBalance(walletAddress: string) {
  try {
    const publicKey = new PublicKey(walletAddress)
    const balance = await connection.getBalance(publicKey)
    return balance / LAMPORTS_PER_SOL
  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    return 0
  }
}

export async function getTokenBalance(walletAddress: string, tokenMint: string) {
  try {
    const walletPublicKey = new PublicKey(walletAddress)
    const mintPublicKey = new PublicKey(tokenMint)
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { mint: mintPublicKey }
    )
    
    if (tokenAccounts.value.length === 0) {
      return 0
    }
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
    return balance || 0
  } catch (error) {
    console.error('Error fetching token balance:', error)
    return 0
  }
}

export async function getTokenPrice(): Promise<number> {
  return getLYNTokenPrice()
}

export async function getTokenSupply() {
  try {
    if (!TOKEN_MINT) return { total: 0, circulating: 0, burned: 0 }
    
    const mintPublicKey = new PublicKey(TOKEN_MINT)
    const supply = await connection.getTokenSupply(mintPublicKey)
    
    const total = supply.value.uiAmount || 1000000000 // 1 billion default
    const burned = total * 0.01 // Mock 1% burned
    const circulating = total - burned
    
    return {
      total,
      circulating,
      burned,
      burnPercentage: (burned / total) * 100
    }
  } catch (error) {
    console.error('Error fetching token supply:', error)
    return {
      total: 1000000000,
      circulating: 990000000,
      burned: 10000000,
      burnPercentage: 1
    }
  }
}

export async function getRecentTransactions(walletAddress: string, limit: number = 10) {
  try {
    const publicKey = new PublicKey(walletAddress)
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit })
    
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        const tx = await connection.getParsedTransaction(sig.signature)
        return {
          signature: sig.signature,
          blockTime: sig.blockTime,
          slot: sig.slot,
          err: sig.err,
          memo: sig.memo,
          transaction: tx
        }
      })
    )
    
    return transactions
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export async function validateSolanaAddress(address: string): Promise<boolean> {
  try {
    const publicKey = new PublicKey(address)
    const valid = PublicKey.isOnCurve(publicKey.toBuffer())
    return valid
  } catch {
    return false
  }
}