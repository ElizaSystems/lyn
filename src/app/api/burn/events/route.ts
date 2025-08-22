import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

// LYN token mint address
const LYN_MINT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'
// Known burn addresses on Solana
const BURN_ADDRESSES = [
  '1111111111111111111111111111111111111111111', // System null address
  '11111111111111111111111111111111', // Common burn address
  'deaddeaddeaddeaddeaddeaddeaddeaddeaddead1111', // Dead address
  'burnburnburnburnburnburnburnburnburnburn1111' // Burn address
]

interface BurnEvent {
  signature: string
  date: string
  amount: string
  amountRaw: number
  txHash: string
  percentage: number
  blockTime: number
  slot: number
  type?: 'manual' | 'username_registration' | 'feature_unlock' | 'community'
  description?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'all'
    
    // Connect to Solana using the same RPC as the frontend
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    )
    
    if (!LYN_MINT_ADDRESS) {
      return NextResponse.json({
        events: [],
        totalBurned: 0,
        message: 'LYN mint address not configured'
      })
    }
    
    const mintPubkey = new PublicKey(LYN_MINT_ADDRESS)
    
    // Get burn transactions (transfers to null/zero address or burns)
    const burnEvents: BurnEvent[] = []
    
    // Also check for manual burns that may not show in mint transactions
    // These would be transfers to known burn addresses
    
    try {
      // Get signatures for the mint account
      const signatures = await connection.getSignaturesForAddress(
        mintPubkey,
        { limit: 1000 }
      )
      
      // Filter by time range
      const now = Date.now()
      let cutoffTime = 0
      
      switch (range) {
        case '24h':
          cutoffTime = now - (24 * 60 * 60 * 1000)
          break
        case '7d':
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          cutoffTime = now - (30 * 24 * 60 * 60 * 1000)
          break
        default:
          cutoffTime = 0
      }
      
      // Process transactions to find burns
      for (const sig of signatures.slice(0, 50)) { // Limit to recent 50 for performance
        if (sig.blockTime && sig.blockTime * 1000 < cutoffTime) continue
        
        try {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          })
          
          if (!tx || !tx.meta) continue
          
          // Check for burn instructions in the transaction
          // SPL Token burn instruction has specific program ID and instruction type
          const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          
          // Check if this transaction contains token program instructions
          const staticAccountKeys = tx.transaction?.message.staticAccountKeys || []
          const hasTokenProgram = staticAccountKeys.some(
            key => key.toString() === SPL_TOKEN_PROGRAM
          )
          
          if (!hasTokenProgram) continue
          
          // Parse instructions to find burn operations
          const compiledInstructions = tx.transaction?.message.compiledInstructions || []
          
          for (const instruction of compiledInstructions) {
            // SPL Token Burn instruction type is 8
            // SPL Token BurnChecked instruction type is 15
            if (instruction.programIdIndex !== undefined) {
              const programId = tx.transaction?.message.staticAccountKeys?.[instruction.programIdIndex]
              
              if (programId?.toString() === SPL_TOKEN_PROGRAM) {
                const instructionData = instruction.data
                
                // Check if this is a burn instruction (type 8 or 15)
                // The first byte indicates the instruction type
                if (typeof instructionData === 'string') {
                  const decoded = Buffer.from(instructionData, 'base64')
                  const instructionType = decoded[0]
                  
                  if (instructionType === 8 || instructionType === 15) {
                    // This is a burn instruction!
                    // Extract burn amount from instruction data
                    let burnAmount = 0n
                    
                    try {
                      if (instructionType === 8) {
                        // Regular burn: amount is at bytes 1-8 (u64 little-endian)
                        burnAmount = decoded.readBigUInt64LE(1)
                      } else if (instructionType === 15) {
                        // BurnChecked: amount is at bytes 1-8 (u64 little-endian)
                        burnAmount = decoded.readBigUInt64LE(1)
                      }
                    } catch (e) {
                      console.log('Could not read burn amount from instruction')
                      continue
                    }
                    
                    // Only add if this burn is for our token mint
                    const accounts = instruction.accountKeyIndexes || []
                    // The mint account is usually the second account in burn instructions
                    if (accounts.length > 1) {
                      const mintAccount = tx.transaction?.message.staticAccountKeys?.[accounts[1]]
                      
                      if (mintAccount?.toString() === LYN_MINT_ADDRESS) {
                        // Get token decimals (usually 9 for SPL tokens)
                        const decimals = 9
                        const uiAmount = Number(burnAmount) / Math.pow(10, decimals)
                        
                        // Try to identify burn type based on amount or other factors
                        let burnType: BurnEvent['type'] = 'manual'
                        let description = 'Token burn'
                        
                        // Check if this is a username registration burn (10,000 LYN)
                        if (uiAmount === 10000) {
                          burnType = 'username_registration'
                          description = 'Username registration'
                        }
                        
                        burnEvents.push({
                          signature: sig.signature,
                          date: new Date((sig.blockTime || 0) * 1000).toLocaleDateString(),
                          amount: uiAmount.toLocaleString() + ' LYN',
                          amountRaw: Number(burnAmount),
                          txHash: sig.signature,
                          percentage: 0, // Will calculate later
                          blockTime: sig.blockTime || 0,
                          slot: sig.slot,
                          type: burnType,
                          description
                        })
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (txError) {
          console.error(`Error processing transaction ${sig.signature}:`, txError)
          continue
        }
      }
      
      // Sort by date (newest first)
      burnEvents.sort((a, b) => b.blockTime - a.blockTime)
      
      // Calculate total burned
      const totalBurned = burnEvents.reduce((sum, event) => sum + event.amountRaw, 0)
      
      // Get actual mint supply info for accurate percentages
      let totalSupply = 1000000000 * Math.pow(10, 9) // 1B tokens with 9 decimals
      try {
        const mintInfo = await connection.getTokenSupply(mintPubkey)
        if (mintInfo?.value?.amount) {
          // Use the initial supply (1B) not current supply for percentage
          totalSupply = 1000000000 * Math.pow(10, mintInfo.value.decimals)
        }
      } catch (e) {
        console.log('Could not fetch mint info, using default supply')
      }
      
      burnEvents.forEach(event => {
        event.percentage = (event.amountRaw / totalSupply) * 100
      })
      
      return NextResponse.json({
        events: burnEvents,
        totalBurned,
        range,
        timestamp: new Date().toISOString()
      })
      
    } catch (solanaError) {
      console.error('Solana API error:', solanaError)
      return NextResponse.json({
        events: [],
        totalBurned: 0,
        error: 'Unable to fetch burn data from Solana',
        message: 'Burn tracking temporarily unavailable'
      })
    }
    
  } catch (error) {
    console.error('Burn events API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch burn events',
        events: [],
        totalBurned: 0
      },
      { status: 500 }
    )
  }
}