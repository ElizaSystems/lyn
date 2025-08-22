import { NextRequest, NextResponse } from 'next/server'
import { ReferralService } from '@/lib/services/referral-service'

// GET: Get user's referral code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const walletAddress = searchParams.get('walletAddress')
    
    if (!userId || !walletAddress) {
      return NextResponse.json(
        { error: 'userId and walletAddress are required' },
        { status: 400 }
      )
    }
    
    const referralCode = await ReferralService.getOrCreateReferralCode(
      userId,
      walletAddress
    )
    
    return NextResponse.json({
      code: referralCode.code,
      link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${referralCode.code}`,
      stats: {
        totalReferrals: referralCode.totalReferrals,
        totalBurned: referralCode.totalBurned,
        totalRewards: referralCode.totalRewards
      }
    })
  } catch (error) {
    console.error('Error getting referral code:', error)
    return NextResponse.json(
      { error: 'Failed to get referral code' },
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