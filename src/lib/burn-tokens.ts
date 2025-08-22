import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { 
  getAssociatedTokenAddress, 
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
  getMint,
  getAccount
} from '@solana/spl-token'

// Token configuration
const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
const DEFAULT_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS) || 6

interface PhantomProvider {
  isPhantom?: boolean
  publicKey?: PublicKey
  isConnected?: boolean
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>
  connect: () => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
}

declare global {
  interface Window {
    solana?: PhantomProvider
  }
}

/**
 * Burns tokens using the connected wallet
 * @param amount Amount of tokens to burn (without decimals)
 * @returns Transaction signature
 */
export async function burnTokensWithWallet(amount: number): Promise<string> {
  if (!window.solana) {
    throw new Error('Phantom wallet not found. Please install Phantom wallet.')
  }

  const provider = window.solana
  
  // Connect if not connected
  if (!provider.isConnected || !provider.publicKey) {
    await provider.connect()
  }

  if (!provider.publicKey) {
    throw new Error('Wallet not connected')
  }

  const connection = new Connection(RPC_ENDPOINT, 'confirmed')
  const mintPublicKey = new PublicKey(TOKEN_MINT)
  const walletPublicKey = provider.publicKey

  console.log(`[Burn] Preparing to burn ${amount} LYN tokens`)
  console.log(`[Burn] Wallet: ${walletPublicKey.toString()}`)
  console.log(`[Burn] Token Mint: ${mintPublicKey.toString()}`)
  console.log(`[Burn] RPC Endpoint: ${RPC_ENDPOINT}`)

  try {
    // Get mint info to determine correct decimals FIRST
    let decimals = DEFAULT_DECIMALS
    try {
      const mintInfo = await getMint(connection, mintPublicKey)
      decimals = mintInfo.decimals
      console.log(`[Burn] Token decimals from chain: ${decimals}`)
      
      // Verify this is the right token
      const totalSupply = Number(mintInfo.supply) / Math.pow(10, decimals)
      console.log(`[Burn] Token total supply: ${totalSupply.toLocaleString()}`)
    } catch (e) {
      console.log(`[Burn] Could not fetch mint info, using configured decimals: ${decimals}`)
      console.log(`[Burn] Error: ${(e as Error).message}`)
    }

    // Get the associated token account
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      walletPublicKey
    )

    console.log(`[Burn] Token Account: ${associatedTokenAccount.toString()}`)
    
    // Check if token account exists and has sufficient balance
    try {
      const tokenAccountInfo = await getAccount(connection, associatedTokenAccount)
      const currentBalance = Number(tokenAccountInfo.amount) / Math.pow(10, decimals)
      console.log(`[Burn] Current token balance: ${currentBalance} LYN`)
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. You have ${currentBalance.toFixed(2)} LYN but need ${amount} LYN to burn.`)
      }
    } catch (e) {
      if ((e as Error).message.includes('Insufficient balance')) {
        throw e
      }
      console.error('[Burn] Could not fetch token account:', e)
      throw new Error('Token account not found. Make sure you have LYN tokens in your wallet.')
    }
    
    // Calculate amount with correct decimals
    const amountToBurn = amount * Math.pow(10, decimals)
    console.log(`[Burn] Amount to burn (raw): ${amountToBurn}`)
    
    const burnInstruction = createBurnInstruction(
      associatedTokenAccount, // token account to burn from
      mintPublicKey, // mint
      walletPublicKey, // owner of token account
      amountToBurn, // amount in smallest units
      [], // multi-signers (none)
      TOKEN_PROGRAM_ID
    )

    // Create transaction
    const transaction = new Transaction()
    transaction.add(burnInstruction)

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = walletPublicKey
    transaction.lastValidBlockHeight = lastValidBlockHeight

    console.log(`[Burn] Transaction created, requesting signature...`)

    // Sign and send transaction using Phantom
    const result = await provider.signAndSendTransaction(transaction)
    const signature = result.signature

    console.log(`[Burn] Transaction sent: ${signature}`)
    console.log(`[Burn] Waiting for confirmation...`)

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed')

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`)
    }

    console.log(`[Burn] Transaction confirmed successfully!`)
    console.log(`[Burn] View on explorer: https://solscan.io/tx/${signature}`)

    return signature
  } catch (error) {
    console.error('[Burn] Error burning tokens:', error)
    throw error
  }
}

/**
 * Check if wallet is connected and has Phantom
 */
export function isPhantomAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.solana?.isPhantom
}

/**
 * Get connected wallet address
 */
export function getConnectedWallet(): string | null {
  if (typeof window === 'undefined' || !window.solana?.publicKey) {
    return null
  }
  return window.solana.publicKey.toString()
}