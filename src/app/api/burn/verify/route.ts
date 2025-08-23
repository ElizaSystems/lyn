import { NextRequest, NextResponse } from 'next/server'
import { BurnService } from '@/lib/services/burn-service'
import { BurnVerificationRequest, BurnVerificationResponse } from '@/lib/models/burn'

export async function POST(request: NextRequest) {
  try {
    const body: BurnVerificationRequest = await request.json()
    const { transactionSignature, walletAddress, expectedAmount, type, description } = body
    
    console.log(`[BurnVerify] Verifying burn: ${transactionSignature}`)
    
    // Validate input
    if (!transactionSignature || !walletAddress) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Transaction signature and wallet address are required'
      } as BurnVerificationResponse, { status: 400 })
    }
    
    // Validate transaction signature format
    if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{87,88}$/.test(transactionSignature)) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Invalid transaction signature format'
      } as BurnVerificationResponse, { status: 400 })
    }
    
    // Submit for verification
    const result = await BurnService.submitForVerification(
      transactionSignature, 
      walletAddress, 
      expectedAmount
    )
    
    if (result.success && result.burnRecord) {
      const response: BurnVerificationResponse = {
        success: true,
        verified: result.burnRecord.verified,
        burnRecord: result.burnRecord,
        onChainAmount: result.burnRecord.onChainAmount || result.burnRecord.amount,
        confirmations: result.burnRecord.metadata?.confirmations
      }
      
      return NextResponse.json(response)
    } else {
      const response: BurnVerificationResponse = {
        success: result.success,
        verified: false,
        error: result.message,
        retryAfter: result.success ? 60 : undefined // Retry after 60 seconds if pending
      }
      
      return NextResponse.json(response, { 
        status: result.success ? 202 : 400 
      })
    }
    
  } catch (error) {
    console.error('[BurnVerify] Error:', error)
    
    const response: BurnVerificationResponse = {
      success: false,
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const signature = searchParams.get('signature')
    
    if (!signature) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Transaction signature is required'
      } as BurnVerificationResponse, { status: 400 })
    }
    
    console.log(`[BurnVerify] Checking verification status: ${signature}`)
    
    // Check if burn exists and its verification status
    const burns = await BurnService['getBurnsCollection']()
    const burnRecord = await burns.findOne({ transactionSignature: signature })
    
    if (!burnRecord) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Burn record not found'
      } as BurnVerificationResponse, { status: 404 })
    }
    
    const response: BurnVerificationResponse = {
      success: true,
      verified: burnRecord.verified,
      burnRecord,
      onChainAmount: burnRecord.onChainAmount || burnRecord.amount,
      confirmations: burnRecord.metadata?.confirmations
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('[BurnVerify] Get error:', error)
    
    const response: BurnVerificationResponse = {
      success: false,
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}