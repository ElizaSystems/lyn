import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

/**
 * Verify that a transaction burns the specified amount of tokens
 */
export async function verifyBurnTransaction(
  connection: Connection,
  signature: string,
  expectedBurnAmount: number
): Promise<boolean> {
  try {
    console.log(`[Burn Verification] Checking transaction: ${signature}`)
    
    // Get the transaction
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    })
    
    if (!transaction) {
      console.log('[Burn Verification] Transaction not found')
      return false
    }
    
    // Check if transaction was successful
    if (transaction.meta?.err) {
      console.log('[Burn Verification] Transaction failed:', transaction.meta.err)
      return false
    }
    
    // Look for burn instructions
    const burnInstructions = transaction.transaction.message.instructions.filter(
      (instruction) => {
        if ('programId' in instruction) {
          return instruction.programId.equals(TOKEN_PROGRAM_ID)
        }
        return false
      }
    )
    
    console.log(`[Burn Verification] Found ${burnInstructions.length} token instructions`)
    
    // Check parsed instructions for burn operations
    let totalBurned = 0
    
    if (transaction.meta?.innerInstructions) {
      for (const innerInstruction of transaction.meta.innerInstructions) {
        for (const instruction of innerInstruction.instructions) {
          if ('parsed' in instruction && instruction.program === 'spl-token') {
            const parsed = instruction.parsed
            if (parsed.type === 'burn') {
              const burnAmount = parseFloat(parsed.info.amount)
              totalBurned += burnAmount
              console.log(`[Burn Verification] Found burn: ${burnAmount}`)
            }
          }
        }
      }
    }
    
    // Also check main instructions
    for (const instruction of transaction.transaction.message.instructions) {
      if ('parsed' in instruction && instruction.program === 'spl-token') {
        const parsed = instruction.parsed
        if (parsed.type === 'burn') {
          const burnAmount = parseFloat(parsed.info.amount)
          totalBurned += burnAmount
          console.log(`[Burn Verification] Found main burn: ${burnAmount}`)
        }
      }
    }
    
    // Convert from raw amount to UI amount (accounting for decimals)
    const TOKEN_DECIMALS = 6
    const burnedUIAmount = totalBurned / Math.pow(10, TOKEN_DECIMALS)
    
    console.log(`[Burn Verification] Total burned: ${burnedUIAmount} tokens`)
    console.log(`[Burn Verification] Expected: ${expectedBurnAmount} tokens`)
    
    // Allow for small rounding differences
    const difference = Math.abs(burnedUIAmount - expectedBurnAmount)
    const isValid = difference < 0.01 // Allow 0.01 token difference for rounding
    
    console.log(`[Burn Verification] Difference: ${difference}, Valid: ${isValid}`)
    
    return isValid
    
  } catch (error) {
    console.error('[Burn Verification] Error verifying burn transaction:', error)
    return false
  }
}

/**
 * Get burn transaction details for display
 */
export async function getBurnTransactionDetails(
  connection: Connection,
  signature: string
): Promise<{
  success: boolean
  burnAmount?: number
  timestamp?: Date
  fee?: number
} | null> {
  try {
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    })
    
    if (!transaction) {
      return null
    }
    
    let totalBurned = 0
    
    // Check for burn instructions
    if (transaction.meta?.innerInstructions) {
      for (const innerInstruction of transaction.meta.innerInstructions) {
        for (const instruction of innerInstruction.instructions) {
          if ('parsed' in instruction && instruction.program === 'spl-token') {
            const parsed = instruction.parsed
            if (parsed.type === 'burn') {
              totalBurned += parseFloat(parsed.info.amount)
            }
          }
        }
      }
    }
    
    const TOKEN_DECIMALS = 6
    const burnedUIAmount = totalBurned / Math.pow(10, TOKEN_DECIMALS)
    
    return {
      success: !transaction.meta?.err,
      burnAmount: burnedUIAmount,
      timestamp: transaction.blockTime ? new Date(transaction.blockTime * 1000) : undefined,
      fee: transaction.meta?.fee ? transaction.meta.fee / 1e9 : undefined // Convert lamports to SOL
    }
    
  } catch (error) {
    console.error('Error getting burn transaction details:', error)
    return null
  }
}