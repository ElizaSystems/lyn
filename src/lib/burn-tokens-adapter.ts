/**
 * Enhanced burn tokens helper for wallet adapter integration
 * Works with @solana/wallet-adapter-react
 */

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
import { WalletContextState } from '@solana/wallet-adapter-react'

// Token configuration
const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
const DEFAULT_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS) || 6

/**
 * Burns tokens using the wallet adapter
 * @param wallet Wallet adapter context
 * @param connection Solana connection
 * @param amount Amount of tokens to burn (without decimals)
 * @param referralCode Optional referral code for distribution
 * @returns Transaction signature
 */
export async function burnTokensWithAdapter(
  wallet: WalletContextState,
  connection: Connection,
  amount: number,
  referralCode?: string | null
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected')
  }

  if (!wallet.signTransaction) {
    throw new Error('Wallet does not support transaction signing')
  }

  const mintPublicKey = new PublicKey(TOKEN_MINT)
  const walletPublicKey = wallet.publicKey

  console.log(`[BurnAdapter] Preparing to burn ${amount} LYN tokens`)
  console.log(`[BurnAdapter] Wallet: ${walletPublicKey.toString()}`)
  console.log(`[BurnAdapter] Token Mint: ${mintPublicKey.toString()}`)

  try {
    // Get mint info to determine correct decimals
    let decimals = DEFAULT_DECIMALS
    try {
      const mintInfo = await getMint(connection, mintPublicKey)
      decimals = mintInfo.decimals
      console.log(`[BurnAdapter] Token decimals: ${decimals}`)
    } catch (e) {
      console.log(`[BurnAdapter] Using default decimals: ${decimals}`)
    }

    // Get the associated token account
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      walletPublicKey
    )

    console.log(`[BurnAdapter] Token Account: ${associatedTokenAccount.toString()}`)
    
    // Check balance
    try {
      const tokenAccountInfo = await getAccount(connection, associatedTokenAccount)
      const currentBalance = Number(tokenAccountInfo.amount) / Math.pow(10, decimals)
      console.log(`[BurnAdapter] Current balance: ${currentBalance} LYN`)
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. You have ${currentBalance.toFixed(2)} LYN but need ${amount} LYN`)
      }
    } catch (e) {
      if ((e as Error).message.includes('Insufficient balance')) {
        throw e
      }
      throw new Error('Token account not found. Make sure you have LYN tokens.')
    }
    
    // Calculate amount with decimals
    const amountToBurn = amount * Math.pow(10, decimals)
    console.log(`[BurnAdapter] Amount to burn (raw): ${amountToBurn}`)
    
    // Build transaction
    const transaction = new Transaction()
    let remainingToBurn = amountToBurn

    // Handle referral distribution if applicable
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

          // Helper to add transfer instructions
          const ensureAtaAndTransfer = async (toWallet: string, lamportsRaw: number) => {
            const toPub = new PublicKey(toWallet)
            const toAta = await getAssociatedTokenAddress(mintPublicKey, toPub)
            
            // Check if ATA exists
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
            console.log(`[BurnAdapter] Added transfer to tier1: ${tier1Amount}`)
          }
          if (tier2 && tier2Amount > 0) {
            await ensureAtaAndTransfer(tier2, tier2Amount)
            console.log(`[BurnAdapter] Added transfer to tier2: ${tier2Amount}`)
          }
        }
      } catch (e) {
        console.warn('[BurnAdapter] Failed to resolve referral chain, burning full amount', e)
      }
    }

    // Add burn instruction for remaining amount
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

    // Set transaction properties
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = walletPublicKey
    transaction.lastValidBlockHeight = lastValidBlockHeight

    console.log(`[BurnAdapter] Transaction created, requesting signature...`)

    // Sign transaction
    const signedTransaction = await wallet.signTransaction(transaction)
    
    console.log(`[BurnAdapter] Transaction signed, sending to network...`)
    
    // Send transaction
    const signature = await connection.sendRawTransaction(
      signedTransaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      }
    )

    console.log(`[BurnAdapter] Transaction sent: ${signature}`)
    console.log(`[BurnAdapter] Waiting for confirmation...`)

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed')

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
    }

    console.log(`[BurnAdapter] Transaction confirmed successfully!`)
    console.log(`[BurnAdapter] Explorer: https://solscan.io/tx/${signature}`)

    return signature
  } catch (error) {
    console.error('[BurnAdapter] Error burning tokens:', error)
    throw error
  }
}

/**
 * Alternative method using sendTransaction (simpler)
 */
export async function burnTokensSimple(
  wallet: WalletContextState,
  connection: Connection,
  amount: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not properly connected')
  }

  const mintPublicKey = new PublicKey(TOKEN_MINT)
  const walletPublicKey = wallet.publicKey

  try {
    // Get decimals
    const mintInfo = await getMint(connection, mintPublicKey)
    const decimals = mintInfo.decimals

    // Get token account
    const tokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      walletPublicKey
    )

    // Check balance
    const accountInfo = await getAccount(connection, tokenAccount)
    const balance = Number(accountInfo.amount) / Math.pow(10, decimals)
    
    if (balance < amount) {
      throw new Error(`Insufficient balance: ${balance} < ${amount}`)
    }

    // Create burn transaction
    const transaction = new Transaction().add(
      createBurnInstruction(
        tokenAccount,
        mintPublicKey,
        walletPublicKey,
        amount * Math.pow(10, decimals)
      )
    )

    // Send transaction using wallet adapter
    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    })

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed')

    console.log(`[BurnSimple] Success: ${signature}`)
    return signature
    
  } catch (error) {
    console.error('[BurnSimple] Error:', error)
    throw error
  }
}