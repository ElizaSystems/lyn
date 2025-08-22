import { NextRequest, NextResponse } from 'next/server'
import { ReferralService } from '@/lib/services/referral-service'

// POST: Track a referral (called during registration)
export async function POST(request: NextRequest) {
  try {
    const { 
      referralCode, 
      referredUserId, 
      burnAmount, 
      burnTransaction 
    } = await request.json()
    
    if (!referralCode || !referredUserId) {
      return NextResponse.json(
        { error: 'referralCode and referredUserId are required' },
        { status: 400 }
      )
    }
    
    const relationship = await ReferralService.trackReferral(
      referralCode,
      referredUserId,
      burnAmount,
      burnTransaction
    )
    
    if (!relationship) {
      return NextResponse.json(
        { error: 'Invalid or inactive referral code' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Referral tracked successfully',
      relationship
    })
  } catch (error) {
    console.error('Error tracking referral:', error)
    return NextResponse.json(
      { error: 'Failed to track referral' },
      { status: 500 }
    )
  }
}