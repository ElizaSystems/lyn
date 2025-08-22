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
    console.log(`[Solana] Fetching token balance for wallet: ${walletAddress}`)
    console.log(`[Solana] Token mint: ${tokenMint}`)
    
    const walletPublicKey = new PublicKey(walletAddress)
    const mintPublicKey = new PublicKey(tokenMint)
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { mint: mintPublicKey }
    )
    
    console.log(`[Solana] Found ${tokenAccounts.value.length} token accounts`)
    
    if (tokenAccounts.value.length === 0) {
      console.log(`[Solana] No token accounts found for mint ${tokenMint}`)
      
      // Try to get all token accounts to see what tokens the wallet has
      try {
        const allTokenAccounts = await connection.getParsedTokenAccountsByOwner(
          walletPublicKey,
          { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        )
        console.log(`[Solana] Wallet has ${allTokenAccounts.value.length} total token accounts`)
        
        // Log the first few token mints to help debug
        allTokenAccounts.value.slice(0, 5).forEach((account, i) => {
          const mint = account.account.data.parsed.info.mint
          const balance = account.account.data.parsed.info.tokenAmount.uiAmount
          console.log(`[Solana] Token ${i + 1}: ${mint} = ${balance}`)
        })
      } catch (debugError) {
        console.error('[Solana] Failed to get debug token info:', debugError)
      }
      
      return 0
    }
    
    // Get the balance from the first token account
    const tokenAccount = tokenAccounts.value[0]
    const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount
    
    console.log(`[Solana] Token balance found: ${balance}`)
    
    return balance || 0
  } catch (error) {
    console.error('Error fetching token balance:', error)
    console.error('Wallet address:', walletAddress)
    console.error('Token mint:', tokenMint)
    return 0
  }
}

export async function getTokenPrice(): Promise<number> {
  return getLYNTokenPrice()
}

export async function getTokenSupply() {
  try {
    if (!TOKEN_MINT) return { total: 0, circulating: 0, burned: 0, burnPercentage: 0 }
    
    const mintPublicKey = new PublicKey(TOKEN_MINT)
    const supply = await connection.getTokenSupply(mintPublicKey)
    
    // Get the initial total supply (max supply)
    const maxSupply = 1000000000 // 1 billion total minted
    
    // Current supply from blockchain
    const currentSupply = supply.value.uiAmount || maxSupply
    
    // Calculate burned amount (difference between max and current)
    // If tokens are burned, current supply will be less than max supply
    const burned = maxSupply - currentSupply
    
    const circulating = currentSupply
    
    return {
      total: maxSupply,
      circulating,
      burned,
      burnPercentage: maxSupply > 0 ? (burned / maxSupply) * 100 : 0
    }
  } catch (error) {
    console.error('Error fetching token supply:', error)
    return {
      total: 1000000000,
      circulating: 1000000000,
      burned: 0,
      burnPercentage: 0
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