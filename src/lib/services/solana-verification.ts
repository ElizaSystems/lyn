import { 
  Connection, 
  PublicKey, 
  Transaction,
  TransactionSignature,
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
  TokenBalance,
  ParsedInstruction,
  ParsedAccountData
} from '@solana/web3.js'
import { SolanaConfigService } from './solana-config'

export interface TransactionVerificationResult {
  isValid: boolean
  signature: string
  blockTime: number | null
  slot: number
  amount?: number
  fromAddress?: string
  toAddress?: string
  tokenMint?: string
  error?: string
  confirmations?: number
  fee?: number
}

export interface BurnTransactionDetails {
  signature: string
  isValid: boolean
  amount: number
  burnAddress: string
  fromAddress: string
  blockTime: Date
  slot: number
  confirmations: number
  fee: number
  tokenMint: string
}

export class SolanaVerificationService {
  private connection: Connection
  private config = SolanaConfigService.getConfig()
  
  constructor() {
    this.connection = SolanaConfigService.getConnection()
  }
  
  /**
   * Verify a transaction signature exists and get its details
   */
  async verifyTransaction(signature: string): Promise<TransactionVerificationResult> {
    try {
      console.log(`[SolanaVerification] Verifying transaction: ${signature}`)
      
      if (!this.isValidSignature(signature)) {
        return {
          isValid: false,
          signature,
          blockTime: null,
          slot: 0,
          error: 'Invalid transaction signature format'
        }
      }
      
      const transaction = await this.retryWithBackoff(async () => {
        return await this.connection.getParsedTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
      })
      
      if (!transaction) {
        return {
          isValid: false,
          signature,
          blockTime: null,
          slot: 0,
          error: 'Transaction not found'
        }
      }
      
      // Get transaction confirmation details
      const statuses = await this.retryWithBackoff(async () => {
        return await this.connection.getSignatureStatuses([signature])
      })
      
      const status = statuses.value[0]
      const confirmations = status?.confirmations || 0
      
      return {
        isValid: true,
        signature,
        blockTime: transaction.blockTime,
        slot: transaction.slot,
        confirmations,
        fee: transaction.meta?.fee || 0
      }
      
    } catch (error) {
      console.error(`[SolanaVerification] Error verifying transaction ${signature}:`, error)
      return {
        isValid: false,
        signature,
        blockTime: null,
        slot: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Verify if a transaction is a valid burn transaction
   */
  async verifyBurnTransaction(signature: string): Promise<BurnTransactionDetails | null> {
    try {
      console.log(`[SolanaVerification] Verifying burn transaction: ${signature}`)
      
      const transaction = await this.retryWithBackoff(async () => {
        return await this.connection.getParsedTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
      })
      
      if (!transaction || transaction.meta?.err) {
        console.log(`[SolanaVerification] Transaction not found or failed: ${signature}`)
        return null
      }
      
      const burnDetails = await this.extractBurnDetails(transaction, signature)
      if (!burnDetails) {
        console.log(`[SolanaVerification] No valid burn found in transaction: ${signature}`)
        return null
      }
      
      // Get confirmation count
      const statuses = await this.retryWithBackoff(async () => {
        return await this.connection.getSignatureStatuses([signature])
      })
      const confirmations = statuses.value[0]?.confirmations || 0
      
      return {
        ...burnDetails,
        confirmations,
        blockTime: new Date((transaction.blockTime || 0) * 1000),
        slot: transaction.slot,
        fee: transaction.meta?.fee || 0
      }
      
    } catch (error) {
      console.error(`[SolanaVerification] Error verifying burn transaction ${signature}:`, error)
      return null
    }
  }
  
  /**
   * Extract burn details from a parsed transaction
   */
  private async extractBurnDetails(
    transaction: ParsedTransactionWithMeta, 
    signature: string
  ): Promise<Omit<BurnTransactionDetails, 'confirmations' | 'blockTime' | 'slot' | 'fee'> | null> {
    const tokenMint = SolanaConfigService.getTokenMintPublicKey().toString()
    const burnAddress = SolanaConfigService.getBurnAddressPublicKey().toString()
    
    // Check token balance changes (most reliable method)
    const preTokenBalances = transaction.meta?.preTokenBalances || []
    const postTokenBalances = transaction.meta?.postTokenBalances || []
    
    // Look for token transfers to burn address
    for (const instruction of transaction.transaction.message.instructions) {
      if ('parsed' in instruction && instruction.parsed) {
        const parsed = instruction.parsed as ParsedInstruction
        
        // Check for SPL Token transfer or transferChecked instruction
        if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
          const info = parsed.info as any
          
          // Verify it's our token and going to burn address
          if (info.mint === tokenMint && info.destination === burnAddress) {
            const amount = info.tokenAmount?.uiAmount || info.amount
            return {
              signature,
              isValid: true,
              amount: typeof amount === 'string' ? parseFloat(amount) : amount,
              burnAddress,
              fromAddress: info.source || info.authority,
              tokenMint
            }
          }
        }
        
        // Check for burn instruction
        if (parsed.type === 'burn') {
          const info = parsed.info as any
          if (info.mint === tokenMint) {
            const amount = info.tokenAmount?.uiAmount || info.amount
            return {
              signature,
              isValid: true,
              amount: typeof amount === 'string' ? parseFloat(amount) : amount,
              burnAddress: info.account,
              fromAddress: info.authority,
              tokenMint
            }
          }
        }
      }
    }
    
    // Fallback: analyze token balance changes
    const burnAddressBalanceChanges = this.analyzeTokenBalanceChanges(
      preTokenBalances, 
      postTokenBalances, 
      tokenMint, 
      burnAddress
    )
    
    if (burnAddressBalanceChanges.increase > 0) {
      // Find the sender by looking at who lost tokens
      let fromAddress = ''
      for (const pre of preTokenBalances) {
        const post = postTokenBalances.find(p => 
          p.accountIndex === pre.accountIndex && 
          p.mint === tokenMint
        )
        
        if (post && pre.uiTokenAmount.uiAmount && post.uiTokenAmount.uiAmount) {
          const decrease = pre.uiTokenAmount.uiAmount - post.uiTokenAmount.uiAmount
          if (decrease > 0 && Math.abs(decrease - burnAddressBalanceChanges.increase) < 0.000001) {
            fromAddress = transaction.transaction.message.accountKeys[pre.accountIndex]?.pubkey?.toString() || ''
            break
          }
        }
      }
      
      return {
        signature,
        isValid: true,
        amount: burnAddressBalanceChanges.increase,
        burnAddress,
        fromAddress,
        tokenMint
      }
    }
    
    return null
  }
  
  /**
   * Analyze token balance changes to detect burns
   */
  private analyzeTokenBalanceChanges(
    preBalances: TokenBalance[],
    postBalances: TokenBalance[],
    tokenMint: string,
    burnAddress: string
  ): { increase: number; decrease: number } {
    let increase = 0
    let decrease = 0
    
    for (const pre of preBalances) {
      if (pre.mint !== tokenMint) continue
      
      const post = postBalances.find(p => 
        p.accountIndex === pre.accountIndex && 
        p.mint === tokenMint
      )
      
      if (post && pre.uiTokenAmount.uiAmount !== null && post.uiTokenAmount.uiAmount !== null) {
        const change = post.uiTokenAmount.uiAmount - pre.uiTokenAmount.uiAmount
        if (change > 0) {
          increase += change
        } else if (change < 0) {
          decrease += Math.abs(change)
        }
      }
    }
    
    return { increase, decrease }
  }
  
  /**
   * Get recent transactions for a given address
   */
  async getRecentTransactions(address: string, limit = 100): Promise<ConfirmedSignatureInfo[]> {
    try {
      const publicKey = new PublicKey(address)
      const signatures = await this.retryWithBackoff(async () => {
        return await this.connection.getSignaturesForAddress(publicKey, {
          limit,
          commitment: 'confirmed'
        })
      })
      
      return signatures
    } catch (error) {
      console.error(`[SolanaVerification] Error fetching transactions for ${address}:`, error)
      return []
    }
  }
  
  /**
   * Monitor burn address for new transactions
   */
  async getNewBurnTransactions(since?: number): Promise<BurnTransactionDetails[]> {
    try {
      const burnAddress = SolanaConfigService.getBurnAddressPublicKey().toString()
      console.log(`[SolanaVerification] Monitoring burn address: ${burnAddress}`)
      
      const signatures = await this.getRecentTransactions(burnAddress, 50)
      
      // Filter by timestamp if provided
      const filteredSignatures = since 
        ? signatures.filter(sig => (sig.blockTime || 0) > since)
        : signatures
      
      const burnTransactions: BurnTransactionDetails[] = []
      
      // Process signatures in batches to avoid rate limits
      for (let i = 0; i < filteredSignatures.length; i += 5) {
        const batch = filteredSignatures.slice(i, i + 5)
        const batchPromises = batch.map(sig => 
          this.verifyBurnTransaction(sig.signature)
        )
        
        const batchResults = await Promise.all(batchPromises)
        
        for (const result of batchResults) {
          if (result) {
            burnTransactions.push(result)
          }
        }
        
        // Add delay between batches
        if (i + 5 < filteredSignatures.length) {
          await this.delay(500)
        }
      }
      
      return burnTransactions
      
    } catch (error) {
      console.error('[SolanaVerification] Error monitoring burn transactions:', error)
      return []
    }
  }
  
  /**
   * Validate transaction signature format
   */
  private isValidSignature(signature: string): boolean {
    // Solana signatures are base58 encoded and 64 bytes long (87-88 characters in base58)
    return /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{87,88}$/.test(signature)
  }
  
  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          break
        }
        
        const delay = this.config.retryDelayMs * Math.pow(2, attempt)
        console.log(`[SolanaVerification] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
        await this.delay(delay)
      }
    }
    
    throw lastError!
  }
  
  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Check if connection is healthy
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.connection.getVersion()
      return true
    } catch (error) {
      console.error('[SolanaVerification] Connection check failed:', error)
      return false
    }
  }
}