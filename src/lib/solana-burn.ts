import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { 
  getAssociatedTokenAddress, 
  createBurnInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'

// Known burn address for LYN tokens (dead address)
export const LYN_BURN_ADDRESS = '1111111111111111111111111111111111111111111'

// Token mint address
const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'

/**
 * Create a burn instruction for LYN tokens
 * @param walletPublicKey - The wallet burning tokens
 * @param amount - Amount to burn (in smallest units, with decimals)
 * @returns Transaction with burn instruction
 */
export async function createBurnTransaction(
  connection: Connection,
  walletPublicKey: PublicKey,
  amount: number
): Promise<Transaction> {
  const mintPublicKey = new PublicKey(TOKEN_MINT)
  
  // Get the associated token account for the wallet
  const associatedTokenAccount = await getAssociatedTokenAddress(
    mintPublicKey,
    walletPublicKey
  )
  
  // Create burn instruction
  const burnInstruction = createBurnInstruction(
    associatedTokenAccount, // token account to burn from
    mintPublicKey, // mint
    walletPublicKey, // owner of token account
    amount * Math.pow(10, 9), // amount in smallest units (9 decimals for LYN)
    [], // multi-signers (none)
    TOKEN_PROGRAM_ID
  )
  
  // Create and return transaction
  const transaction = new Transaction()
  transaction.add(burnInstruction)
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = walletPublicKey
  
  return transaction
}

/**
 * Verify a burn transaction
 * @param signature - Transaction signature to verify
 * @returns true if burn was successful
 */
export async function verifyBurnTransaction(
  connection: Connection,
  signature: string,
  expectedAmount: number
): Promise<boolean> {
  try {
    // Get transaction details
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    })
    
    if (!transaction || !transaction.meta) {
      return false
    }
    
    // Check if transaction was successful
    if (transaction.meta.err) {
      return false
    }
    
    // Parse instructions to verify burn
    const instructions = transaction.transaction.message.compiledInstructions || []
    
    for (const instruction of instructions) {
      // Check if this is a token program instruction
      const programId = transaction.transaction.message.staticAccountKeys?.[instruction.programIdIndex]
      
      if (programId?.toString() === TOKEN_PROGRAM_ID.toString()) {
        // Decode instruction data
        if (typeof instruction.data === 'string') {
          const decoded = Buffer.from(instruction.data, 'base64')
          const instructionType = decoded[0]
          
          // Check if this is a burn instruction (type 8 or 15)
          if (instructionType === 8 || instructionType === 15) {
            // Extract burn amount
            const burnAmount = decoded.readBigUInt64LE(1)
            const expectedAmountWithDecimals = BigInt(expectedAmount * Math.pow(10, 9))
            
            // Verify amount matches
            if (burnAmount === expectedAmountWithDecimals) {
              return true
            }
          }
        }
      }
    }
    
    return false
  } catch (error) {
    console.error('Error verifying burn transaction:', error)
    return false
  }
}

/**
 * Get burn statistics for a wallet
 */
export async function getWalletBurnStats(
  connection: Connection,
  walletAddress: string
): Promise<{
  totalBurned: number
  burnCount: number
  lastBurnDate?: Date
}> {
  try {
    const walletPublicKey = new PublicKey(walletAddress)
    // Note: mintPublicKey not directly used but TOKEN_MINT is used in the loop below
    
    // Get transaction history
    const signatures = await connection.getSignaturesForAddress(walletPublicKey, {
      limit: 1000
    })
    
    let totalBurned = 0
    let burnCount = 0
    let lastBurnDate: Date | undefined
    
    // Check each transaction for burns
    for (const sig of signatures) {
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0
      })
      
      if (!tx || !tx.meta || tx.meta.err) continue
      
      // Parse instructions
      const instructions = tx.transaction.message.compiledInstructions || []
      
      for (const instruction of instructions) {
        const programId = tx.transaction.message.staticAccountKeys?.[instruction.programIdIndex]
        
        if (programId?.toString() === TOKEN_PROGRAM_ID.toString()) {
          if (typeof instruction.data === 'string') {
            const decoded = Buffer.from(instruction.data, 'base64')
            const instructionType = decoded[0]
            
            if (instructionType === 8 || instructionType === 15) {
              // Check if this burn is for our token
              const accounts = instruction.accountKeyIndexes || []
              if (accounts.length > 1) {
                const mintAccount = tx.transaction.message.staticAccountKeys?.[accounts[1]]
                
                if (mintAccount?.toString() === TOKEN_MINT) {
                  const burnAmount = Number(decoded.readBigUInt64LE(1)) / Math.pow(10, 9)
                  totalBurned += burnAmount
                  burnCount++
                  
                  if (!lastBurnDate && sig.blockTime) {
                    lastBurnDate = new Date(sig.blockTime * 1000)
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return {
      totalBurned,
      burnCount,
      lastBurnDate
    }
  } catch (error) {
    console.error('Error getting wallet burn stats:', error)
    return {
      totalBurned: 0,
      burnCount: 0
    }
  }
}