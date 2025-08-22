import { NextRequest, NextResponse } from 'next/server'
import { ReferralServiceV2 } from '@/lib/services/referral-service-v2'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      )
    }
    
    const referrerInfo = await ReferralServiceV2.getReferrerInfo(code)
    
    if (!referrerInfo) {
      return NextResponse.json(
        { error: 'Invalid or inactive referral code' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      code: code.toUpperCase(),
      walletAddress: referrerInfo.walletAddress,
      username: referrerInfo.username,
      isActive: true
    })
    
  } catch (error) {
    console.error('[Referral Info V2] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get referral information' },
      { status: 500 }
    )
  }
}