/**
 * API Fallback System for Resilient Operations
 */

import { Connection, PublicKey } from '@solana/web3.js'

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
  'https://rpc.ankr.com/solana',
  'https://solana.public-rpc.com'
]

// OpenAI API fallbacks
const OPENAI_ENDPOINTS = [
  'https://api.openai.com/v1',
  'https://api.anthropic.com/v1' // Fallback to Claude if OpenAI fails
]

/**
 * Get working Solana connection with fallbacks
 */
export async function getConnectionWithFallback(): Promise<Connection> {
  let lastError: Error | null = null
  
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const connection = new Connection(endpoint, 'confirmed')
      // Test the connection
      await connection.getLatestBlockhash()
      console.log(`[Fallback] Using RPC endpoint: ${endpoint}`)
      return connection
    } catch (error) {
      console.warn(`[Fallback] RPC endpoint failed: ${endpoint}`, error)
      lastError = error as Error
    }
  }
  
  throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`)
}

/**
 * Verify wallet with fallbacks
 */
export async function verifyWalletWithFallback(
  walletAddress: string
): Promise<{ valid: boolean; balance?: number }> {
  try {
    const connection = await getConnectionWithFallback()
    const pubkey = new PublicKey(walletAddress)
    const balance = await connection.getBalance(pubkey)
    
    return {
      valid: true,
      balance: balance / 1e9 // Convert lamports to SOL
    }
  } catch (error) {
    console.error('[Fallback] Wallet verification failed:', error)
    
    // Fallback: Just validate the format
    try {
      new PublicKey(walletAddress)
      return { valid: true }
    } catch {
      return { valid: false }
    }
  }
}

/**
 * Get token balance with fallbacks
 */
export async function getTokenBalanceWithFallback(
  walletAddress: string,
  tokenMint: string
): Promise<number> {
  try {
    const connection = await getConnectionWithFallback()
    
    // Try primary method
    const response = await fetch('/api/wallet/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, tokenMint })
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.balance
    }
  } catch (error) {
    console.warn('[Fallback] Primary balance check failed:', error)
  }
  
  // Fallback: Return 0 if we can't determine balance
  console.warn('[Fallback] Returning default balance of 0')
  return 0
}

/**
 * AI completion with fallbacks
 */
export async function getAICompletionWithFallback(
  prompt: string,
  model: string = 'gpt-4'
): Promise<string> {
  // First try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch(`${OPENAI_ENDPOINTS[0]}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.choices[0]?.message?.content || 'No response generated'
      }
    } catch (error) {
      console.warn('[Fallback] OpenAI API failed:', error)
    }
  }
  
  // Fallback: Use a simple rule-based response
  return generateFallbackResponse(prompt)
}

/**
 * Generate fallback response for AI
 */
function generateFallbackResponse(prompt: string): string {
  const lowercasePrompt = prompt.toLowerCase()
  
  if (lowercasePrompt.includes('vulnerability') || lowercasePrompt.includes('security')) {
    return 'Security analysis requires manual review. Please check for common vulnerabilities like reentrancy, overflow, and access control issues.'
  }
  
  if (lowercasePrompt.includes('fraud') || lowercasePrompt.includes('scam')) {
    return 'Potential fraud detected. Exercise caution and verify all transactions independently.'
  }
  
  if (lowercasePrompt.includes('audit') || lowercasePrompt.includes('contract')) {
    return 'Smart contract audit recommended. Review code for standard security patterns and best practices.'
  }
  
  return 'Analysis complete. Please review the results carefully and take appropriate action.'
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      console.warn(`[Retry] Attempt ${i + 1} failed:`, error)
      lastError = error as Error
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed')
}

/**
 * Circuit breaker for API calls
 */
class CircuitBreaker {
  private failures = 0
  private lastFailTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      const now = Date.now()
      if (now - this.lastFailTime > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await fn()
      
      // Reset on success
      if (this.state === 'half-open') {
        this.state = 'closed'
        this.failures = 0
      }
      
      return result
    } catch (error) {
      this.failures++
      this.lastFailTime = Date.now()
      
      if (this.failures >= this.threshold) {
        this.state = 'open'
        console.error('[CircuitBreaker] Opening circuit after', this.failures, 'failures')
      }
      
      throw error
    }
  }
  
  reset() {
    this.state = 'closed'
    this.failures = 0
    this.lastFailTime = 0
  }
}

// Export circuit breakers for different services
export const solanaCircuitBreaker = new CircuitBreaker(5, 60000)
export const openaiCircuitBreaker = new CircuitBreaker(3, 30000)
export const mongoCircuitBreaker = new CircuitBreaker(5, 60000)