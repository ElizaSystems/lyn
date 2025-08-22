import { NextRequest, NextResponse } from 'next/server'
import { ReferralServiceV2 } from '@/lib/services/referral-service-v2'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get('walletAddress')
  const username = searchParams.get('username')
  
  console.log(`[Referral API V2] Request - wallet: ${walletAddress}, username: ${username}`)
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    )
  }
  
  // Validate wallet address format (Solana addresses are 32-44 chars)
  if (walletAddress.length < 32 || walletAddress.length > 44) {
    return NextResponse.json(
      { error: 'Invalid wallet address' },
      { status: 400 }
    )
  }
  
  // Try to get/create referral code with database
  let result
  try {
    result = await ReferralServiceV2.getOrCreateReferralCode(
      walletAddress,
      username || undefined
    )
  } catch (dbError) {
    console.error('[Referral API V2] Database error:', dbError)
    result = { success: false, error: 'Database unavailable' }
  }
    
  if (!result.success || !result.code) {
    console.error('[Referral API V2] Failed to get/create code:', result.error)
    
    // Return a fallback response
    const fallbackCode = username || `LYN${walletAddress.slice(-6).toUpperCase()}`
    return NextResponse.json({
      code: fallbackCode,
      link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${fallbackCode}`,
      stats: {
        totalReferrals: 0,
        totalBurned: 0,
        totalRewards: 0
      },
      isVanity: !!username,
      fallback: true,
      message: 'Using temporary code (database issue)'
    })
  }
  
  // Get stats
  const stats = await ReferralServiceV2.getReferralStats(walletAddress)
  
  return NextResponse.json({
    code: result.code,
    link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${result.code}`,
    stats,
    isVanity: result.isVanity || false,
    success: true
  })
}