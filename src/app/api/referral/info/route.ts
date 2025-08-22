import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 })
    }
    
    const db = await getDatabase()
    const referralCodesCollection = db.collection('referral_codes')
    
    // Find the referral code
    const referralCode = await referralCodesCollection.findOne({ 
      code: code.toUpperCase(), // Codes are stored in uppercase
      isActive: true 
    })
    
    if (!referralCode) {
      return NextResponse.json({ error: 'Invalid or inactive referral code' }, { status: 404 })
    }
    
    // Get the referrer's user info if needed
    const usersCollection = db.collection('users')
    const referrer = await usersCollection.findOne({ _id: referralCode.userId })
    
    return NextResponse.json({
      code: referralCode.code,
      walletAddress: referralCode.walletAddress,
      username: referrer?.username,
      isActive: referralCode.isActive
    })
    
  } catch (error) {
    console.error('Referral info error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referral information' },
      { status: 500 }
    )
  }
}