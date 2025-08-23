import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint,
  getAccount
} from '@solana/spl-token'
import { validateReferrerTokenAccount } from './solana-token-account'
// Note: referral chain is resolved via public API to stay client-safe

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
export async function burnTokensWithWallet(amount: number, referralCode?: string | null): Promise<string> {
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

    // Build a multi-instruction transaction if a referral chain exists: transfer portions to referrers, then burn the rest
    const transaction = new Transaction()

    let remainingToBurn = amountToBurn

    if (referralCode) {
      try {
        const chainResp = await fetch(`/api/referral/v2/chain?code=${encodeURIComponent(referralCode)}`)
        if (chainResp.ok) {
          const chain = await chainResp.json() as { tier1Wallet?: string; tier2Wallet?: string }
          const tier1 = chain.tier1Wallet
          const tier2 = chain.tier2Wallet

          const tier1Amount = Math.floor(amountToBurn * 0.30)
          const tier2Amount = tier2 ? Math.floor(amountToBurn * 0.20) : 0
          const burnPortion = amountToBurn - tier1Amount - tier2Amount
          remainingToBurn = burnPortion

          const ensureAtaAndTransfer = async (toWallet: string, lamportsRaw: number) => {
            const toPub = new PublicKey(toWallet)
            const toAta = await getAssociatedTokenAddress(mintPublicKey, toPub)
            let needsCreate = false
            try {
              await getAccount(connection, toAta)
            } catch {
              needsCreate = true
            }
            if (needsCreate) {
              transaction.add(
                createAssociatedTokenAccountInstruction(
                  walletPublicKey,
                  toAta,
                  toPub,
                  mintPublicKey,
                  TOKEN_PROGRAM_ID,
                  ASSOCIATED_TOKEN_PROGRAM_ID
                )
              )
            }
            transaction.add(
              createTransferInstruction(
                associatedTokenAccount,
                toAta,
                walletPublicKey,
                lamportsRaw,
                [],
                TOKEN_PROGRAM_ID
              )
            )
          }

          if (tier1 && tier1Amount > 0) {
            await ensureAtaAndTransfer(tier1, tier1Amount)
          }
          if (tier2 && tier2Amount > 0) {
            await ensureAtaAndTransfer(tier2, tier2Amount)
          }
        }
      } catch (e) {
        console.warn('[Burn] Failed to resolve referral chain; proceeding with full burn.', e)
      }
    }

    // Add burn for the remaining portion
    transaction.add(
      createBurnInstruction(
        associatedTokenAccount,
        mintPublicKey,
        walletPublicKey,
        remainingToBurn,
        [],
        TOKEN_PROGRAM_ID
      )
    )

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

/**
 * Burns tokens with referrer validation
 * @param amount Amount of tokens to burn (without decimals)
 * @param referrerWallet Optional referrer wallet to validate
 * @returns Transaction signature
 */
export async function burnTokensWithReferrerCheck(
  amount: number, 
  referrerWallet?: string | null,
  referralCode?: string | null
): Promise<string> {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed')
  
  // Validate referrer token account if provided
  if (referrerWallet) {
    console.log(`[Burn] Validating referrer token account: ${referrerWallet}`)
    const validation = await validateReferrerTokenAccount(
      connection,
      referrerWallet,
      TOKEN_MINT
    )
    
    if (!validation.isValid) {
      throw new Error(
        validation.error || 
        'Referrer does not have a LYN token account. They need to create one before you can burn tokens.'
      )
    }
    
    console.log(`[Burn] Referrer validation successful`)
  }
  
  // If we only burned (no token distribution needed), perform burn
  // Keep referralCode to allow future analytics if needed
  return burnTokensWithWallet(amount, referralCode)
}