import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { config } from '@/lib/config'
import { ReferralServiceV2 } from '@/lib/services/referral-service-v2'

/**
 * Verify that a transaction burns the specified amount of tokens
 */
export async function verifyBurnTransaction(
  connection: Connection,
  signature: string,
  expectedBurnAmount: number,
  referralCode?: string
): Promise<boolean> {
  try {
    console.log(`[Burn Verification] Checking transaction: ${signature}`)
    
    // Get the transaction (retry to avoid race between client confirmation and RPC availability)
    let transaction: ParsedTransactionWithMeta | null = null
    for (let attempt = 0; attempt < 6; attempt++) {
      transaction = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      })
      if (transaction) break
      await new Promise(r => setTimeout(r, 1000))
    }
    
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
            if (parsed.type === 'burn' || parsed.type === 'burnChecked') {
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
        if (parsed.type === 'burn' || parsed.type === 'burnChecked') {
          const burnAmount = parseFloat(parsed.info.amount)
          totalBurned += burnAmount
          console.log(`[Burn Verification] Found main burn: ${burnAmount}`)
        }
      }
    }
    
    // Convert from raw amount to UI amount (accounting for decimals)
    const TOKEN_DECIMALS = config.token.decimals || 6
    const burnedUIAmount = totalBurned / Math.pow(10, TOKEN_DECIMALS)
    
    console.log(`[Burn Verification] Total burned: ${burnedUIAmount} tokens`)
    console.log(`[Burn Verification] Expected: ${expectedBurnAmount} tokens`)
    
    // Allow for small rounding differences
    const difference = Math.abs(burnedUIAmount - expectedBurnAmount)
    const isValidBurnOnly = difference < 0.01 // Allow 0.01 token difference for rounding
    
    console.log(`[Burn Verification] Difference: ${difference}, Valid: ${isValid}`)
    
    // If no referral distribution required, return burn-only validation
    if (!referralCode) {
      if (isValidBurnOnly) return true
      // Fallback: derive decrease from token balance delta
      try {
        const TOKEN_DECIMALS = config.token.decimals || 6
        const tokenMintStr = config.token.mintAddress
        const expectedRaw = expectedBurnAmount * Math.pow(10, TOKEN_DECIMALS)
        const pre = transaction.meta?.preTokenBalances || []
        const post = transaction.meta?.postTokenBalances || []
        const byIndex: Record<number, { pre: number; post: number; mint?: string }> = {}
        pre.forEach(b => { byIndex[b.accountIndex] = { pre: parseFloat(b.uiTokenAmount.amount), post: 0, mint: b.mint } })
        post.forEach(b => { const e = byIndex[b.accountIndex] || { pre: 0, post: 0, mint: b.mint }; e.post = parseFloat(b.uiTokenAmount.amount); e.mint = b.mint; byIndex[b.accountIndex] = e })
        const deltas = Object.values(byIndex).filter(e => e.mint === tokenMintStr).map(e => (e.pre - e.post))
        const withinRaw = (v: number, target: number) => Math.abs(v - target) <= Math.max(target * 0.01, 1)
        if (deltas.some(d => withinRaw(d, expectedRaw))) {
          return true
        }
      } catch {}
      return false
    }

    // Validate distribution amounts: tier1 30%, tier2 20%
    try {
      const chain = await ReferralServiceV2.getReferralChainByCode(referralCode)
      const tier1 = chain.tier1Wallet
      const tier2 = chain.tier2Wallet
      const tokenMint = new PublicKey(config.token.mintAddress)

      // Compute expected raw amounts
      const expectedRaw = expectedBurnAmount * Math.pow(10, TOKEN_DECIMALS)
      const expectedTier1 = Math.floor(expectedRaw * 0.30)
      const expectedTier2 = tier2 ? Math.floor(expectedRaw * 0.20) : 0

      // Inspect parsed instructions for transfers to the referrer ATAs
      let tier1Transferred = 0
      let tier2Transferred = 0

      const toAtaOf = async (wallet?: string) => wallet ? await getAssociatedTokenAddress(tokenMint, new PublicKey(wallet)) : null
      const tier1Ata = await toAtaOf(tier1)
      const tier2Ata = await toAtaOf(tier2 || undefined)

      const considerParsed = (parsed: any) => {
        if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
          const amount = parseFloat(parsed.info.amount)
          const dest = parsed.info.destination as string
          if (tier1Ata && dest === tier1Ata.toBase58()) tier1Transferred += amount
          if (tier2Ata && dest === tier2Ata.toBase58()) tier2Transferred += amount
        }
      }

      if (transaction.meta?.innerInstructions) {
        for (const innerInstruction of transaction.meta.innerInstructions) {
          for (const instruction of innerInstruction.instructions) {
            if ('parsed' in instruction && instruction.program === 'spl-token') {
              considerParsed(instruction.parsed)
            }
          }
        }
      }
      for (const instruction of transaction.transaction.message.instructions) {
        if ('parsed' in instruction && instruction.program === 'spl-token') {
          considerParsed(instruction.parsed)
        }
      }

      // Allow 1% tolerance
      const within = (v: number, target: number) => Math.abs(v - target) <= Math.max(target * 0.01, 1)

      // If wallet did a full burn with no transfers, accept burn-only as valid
      const noTransfers = tier1Transferred === 0 && tier2Transferred === 0
      if (isValidBurnOnly && noTransfers) {
        return true
      }

      // Otherwise, enforce split pattern
      const tier1Ok = !tier1Ata || within(tier1Transferred, expectedTier1)
      const tier2Ok = !tier2Ata || within(tier2Transferred, expectedTier2)
      const totalOutflow = totalBurned + tier1Transferred + tier2Transferred
      const outflowOk = within(totalOutflow, expectedRaw)

      if (outflowOk && tier1Ok && tier2Ok) return true

      // Final fallback: accept if user's token account decreased by expected amount (covers burn-only split edge cases)
      try {
        const pre = transaction.meta?.preTokenBalances || []
        const post = transaction.meta?.postTokenBalances || []
        const byIndex: Record<number, { pre: number; post: number; mint?: string }> = {}
        pre.forEach(b => { byIndex[b.accountIndex] = { pre: parseFloat(b.uiTokenAmount.amount), post: 0, mint: b.mint } })
        post.forEach(b => { const e = byIndex[b.accountIndex] || { pre: 0, post: 0, mint: b.mint }; e.post = parseFloat(b.uiTokenAmount.amount); e.mint = b.mint; byIndex[b.accountIndex] = e })
        const deltas = Object.values(byIndex).filter(e => e.mint === tokenMint.toBase58()).map(e => (e.pre - e.post))
        const withinRaw = (v: number, target: number) => Math.abs(v - target) <= Math.max(target * 0.01, 1)
        if (deltas.some(d => withinRaw(d, expectedRaw))) {
          return true
        }
      } catch {}

      return false
    } catch (e) {
      console.warn('[Burn Verification] Distribution check failed:', e)
      return isValidBurnOnly
    }
    
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