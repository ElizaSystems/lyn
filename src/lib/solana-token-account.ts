import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token'

/**
 * Check if a wallet has an initialized token account for a specific mint
 * Returns true if the account exists and is initialized, false otherwise
 */
export async function hasTokenAccount(
  connection: Connection,
  walletAddress: string,
  mintAddress: string
): Promise<boolean> {
  try {
    const walletPubkey = new PublicKey(walletAddress)
    const mintPubkey = new PublicKey(mintAddress)
    
    // Get the associated token account address
    const tokenAccountAddress = await getAssociatedTokenAddress(
      mintPubkey,
      walletPubkey
    )
    
    // Try to get the account info
    const tokenAccount = await getAccount(connection, tokenAccountAddress)
    
    // If we get here, the account exists and is initialized
    return tokenAccount !== null && tokenAccount !== undefined
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      // Account doesn't exist
      return false
    }
    
    // For any other error, log it but return false to be safe
    console.error('[Token Account Check] Error checking token account:', error)
    return false
  }
}

/**
 * Get token account info if it exists
 * Returns account info or null if doesn't exist
 */
export async function getTokenAccountInfo(
  connection: Connection,
  walletAddress: string,
  mintAddress: string
) {
  try {
    const walletPubkey = new PublicKey(walletAddress)
    const mintPubkey = new PublicKey(mintAddress)
    
    const tokenAccountAddress = await getAssociatedTokenAddress(
      mintPubkey,
      walletPubkey
    )
    
    const tokenAccount = await getAccount(connection, tokenAccountAddress)
    
    return {
      address: tokenAccountAddress.toString(),
      balance: Number(tokenAccount.amount),
      isInitialized: true,
      owner: tokenAccount.owner.toString(),
      mint: tokenAccount.mint.toString()
    }
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      return null
    }
    
    console.error('[Token Account Info] Error getting token account info:', error)
    return null
  }
}

/**
 * Validate referrer's token account before performing burns
 * This ensures the referrer can receive rewards
 */
export async function validateReferrerTokenAccount(
  connection: Connection,
  referrerWalletAddress: string | null | undefined,
  mintAddress: string
): Promise<{
  isValid: boolean
  hasTokenAccount: boolean
  error?: string
}> {
  // If no referrer, it's valid (no rewards to distribute)
  if (!referrerWalletAddress) {
    return {
      isValid: true,
      hasTokenAccount: false
    }
  }
  
  try {
    const accountExists = await hasTokenAccount(
      connection,
      referrerWalletAddress,
      mintAddress
    )
    
    if (!accountExists) {
      return {
        isValid: false,
        hasTokenAccount: false,
        error: 'Referrer does not have a LYN token account. They need to create one to receive rewards.'
      }
    }
    
    return {
      isValid: true,
      hasTokenAccount: true
    }
  } catch (error) {
    console.error('[Referrer Validation] Error validating referrer token account:', error)
    return {
      isValid: false,
      hasTokenAccount: false,
      error: 'Failed to validate referrer token account'
    }
  }
}