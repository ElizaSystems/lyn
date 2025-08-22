import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { 
  getAssociatedTokenAddress, 
  createBurnInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'

// Token mint address
const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'

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

  try {
    // Get the associated token account
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      walletPublicKey
    )

    console.log(`[Burn] Token Account: ${associatedTokenAccount.toString()}`)

    // Create burn instruction
    // LYN has 6 decimals based on the token info
    const decimals = 6
    const amountToBurn = amount * Math.pow(10, decimals)
    
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