import { NextRequest, NextResponse } from 'next/server'
import { ReferralService } from '@/lib/services/referral-service'

// GET: Get user's referral code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const walletAddress = searchParams.get('walletAddress')
    
    console.log(`[Referral Code API] GET request - userId: ${userId}, walletAddress: ${walletAddress}`)
    
    if (!userId || !walletAddress) {
      console.error('[Referral Code API] Missing required parameters')
      return NextResponse.json(
        { error: 'userId and walletAddress are required' },
        { status: 400 }
      )
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      console.error('[Referral Code API] Invalid wallet address format')
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }
    
    console.log('[Referral Code API] Calling ReferralService.getOrCreateReferralCode')
    const referralCode = await ReferralService.getOrCreateReferralCode(
      userId,
      walletAddress
    )
    
    console.log(`[Referral Code API] Successfully created/retrieved code: ${referralCode.code}`)
    
    return NextResponse.json({
      code: referralCode.code,
      link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${referralCode.code}`,
      stats: {
        totalReferrals: referralCode.totalReferrals || 0,
        totalBurned: referralCode.totalBurned || 0,
        totalRewards: referralCode.totalRewards || 0
      }
    })
  } catch (error) {
    console.error('[Referral Code API] Error getting referral code:', error)
    console.error('[Referral Code API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Provide fallback response if database is unavailable
    if (error instanceof Error && error.message.includes('Database connection failed')) {
      console.log('[Referral Code API] Database unavailable, providing fallback response')
      
      // Re-get parameters for fallback
      const { searchParams } = new URL(request.url)
      const fallbackWalletAddress = searchParams.get('walletAddress') || 'UNKNOWN'
      
      // Generate a temporary referral code based on wallet address
      const tempCode = `TEMP${fallbackWalletAddress.slice(-6).toUpperCase()}`
      
      return NextResponse.json({
        code: tempCode,
        link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${tempCode}`,
        stats: {
          totalReferrals: 0,
          totalBurned: 0,
          totalRewards: 0
        },
        temporary: true,
        message: 'Temporary referral code generated (database unavailable)'
      })
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get referral code',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST: Create or update referral code
export async function POST(request: NextRequest) {
  try {
    const { userId, walletAddress, username } = await request.json()
    
    if (!userId || !walletAddress) {
      return NextResponse.json(
        { error: 'userId and walletAddress are required' },
        { status: 400 }
      )
    }
    
    const referralCode = await ReferralService.getOrCreateReferralCode(
      userId,
      walletAddress,
      username
    )
    
    return NextResponse.json({
      success: true,
      code: referralCode.code,
      link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${referralCode.code}`,
      message: 'Referral code created successfully'
    })
  } catch (error) {
    console.error('Error creating referral code:', error)
    return NextResponse.json(
      { error: 'Failed to create referral code' },
      { status: 500 }
    )
  }
}