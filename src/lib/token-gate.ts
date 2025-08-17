import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token'

// Token configuration from environment variables
const REQUIRED_TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'
const REQUIRED_TOKEN_AMOUNT = Number(process.env.NEXT_PUBLIC_REQUIRED_TOKEN_AMOUNT) || 10000
const FREE_QUESTIONS_LIMIT = Number(process.env.NEXT_PUBLIC_FREE_QUESTIONS_LIMIT) || 2
const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS) || 6
const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || 'LYN'
const TOKEN_NAME = process.env.NEXT_PUBLIC_TOKEN_NAME || 'LYN Token'

// RPC endpoint - using public mainnet, can be replaced with custom RPC
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'

export interface UsageData {
  questionsAsked: number
  lastReset: Date
  walletAddress?: string
  hasTokenAccess: boolean
}

// In-memory storage for usage tracking (in production, use a database)
const usageStore = new Map<string, UsageData>()

export class TokenGateService {
  private connection: Connection

  constructor() {
    this.connection = new Connection(RPC_ENDPOINT, 'confirmed')
  }

  /**
   * Check if a wallet has the required token balance
   */
  async checkTokenBalance(walletAddress: string): Promise<{ 
    hasAccess: boolean
    balance: number
    required: number
  }> {
    try {
      const walletPubkey = new PublicKey(walletAddress)
      const mintPubkey = new PublicKey(REQUIRED_TOKEN_MINT)
      
      // Get the associated token account for this wallet and mint
      const tokenAccountAddress = await getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey
      )
      
      try {
        // Get the token account info
        const tokenAccount = await getAccount(
          this.connection,
          tokenAccountAddress
        )
        
        // Token balance is stored as a BigInt, convert to number
        // Using TOKEN_DECIMALS from environment variable
        const balance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_DECIMALS)
        
        return {
          hasAccess: balance >= REQUIRED_TOKEN_AMOUNT,
          balance: Math.floor(balance),
          required: REQUIRED_TOKEN_AMOUNT
        }
      } catch {
        // Token account doesn't exist = 0 balance
        return {
          hasAccess: false,
          balance: 0,
          required: REQUIRED_TOKEN_AMOUNT
        }
      }
    } catch (error) {
      console.error('Error checking token balance:', error)
      throw new Error('Failed to check token balance')
    }
  }

  /**
   * Track usage for a session/wallet
   */
  trackUsage(sessionId: string, walletAddress?: string): UsageData {
    const existing = usageStore.get(sessionId) || {
      questionsAsked: 0,
      lastReset: new Date(),
      walletAddress,
      hasTokenAccess: false
    }
    
    // Update wallet address if provided
    if (walletAddress) {
      existing.walletAddress = walletAddress
    }
    
    // Increment question count
    existing.questionsAsked++
    
    usageStore.set(sessionId, existing)
    return existing
  }

  /**
   * Get current usage for a session
   */
  getUsage(sessionId: string): UsageData {
    return usageStore.get(sessionId) || {
      questionsAsked: 0,
      lastReset: new Date(),
      hasTokenAccess: false
    }
  }

  /**
   * Update token access status for a session
   */
  updateTokenAccess(sessionId: string, hasAccess: boolean, walletAddress?: string): void {
    const usage = this.getUsage(sessionId)
    usage.hasTokenAccess = hasAccess
    if (walletAddress) {
      usage.walletAddress = walletAddress
    }
    usageStore.set(sessionId, usage)
  }

  /**
   * Check if user can ask more questions
   */
  canAskQuestion(sessionId: string): { 
    allowed: boolean
    reason?: string
    questionsRemaining?: number
    requiresTokens?: boolean
  } {
    const usage = this.getUsage(sessionId)
    
    // If user has token access, always allow
    if (usage.hasTokenAccess) {
      return { allowed: true }
    }
    
    // Check free tier limit
    if (usage.questionsAsked < FREE_QUESTIONS_LIMIT) {
      return { 
        allowed: true,
        questionsRemaining: FREE_QUESTIONS_LIMIT - usage.questionsAsked
      }
    }
    
    // Exceeded free tier
    return {
      allowed: false,
      reason: `You've used your ${FREE_QUESTIONS_LIMIT} free questions. Connect your wallet and hold at least ${REQUIRED_TOKEN_AMOUNT} $${TOKEN_SYMBOL} tokens for unlimited access.`,
      requiresTokens: true
    }
  }

  /**
   * Reset usage for a session (admin function)
   */
  resetUsage(sessionId: string): void {
    usageStore.delete(sessionId)
  }

  /**
   * Get token info for display
   */
  getTokenInfo() {
    return {
      mintAddress: REQUIRED_TOKEN_MINT,
      requiredAmount: REQUIRED_TOKEN_AMOUNT,
      freeQuestionsLimit: FREE_QUESTIONS_LIMIT,
      tokenSymbol: TOKEN_SYMBOL,
      tokenName: TOKEN_NAME,
      tokenDecimals: TOKEN_DECIMALS
    }
  }
}

// Singleton instance
export const tokenGateService = new TokenGateService()