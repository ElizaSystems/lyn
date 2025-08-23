import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }

    const db = await getDatabase()
    const user = await db.collection('users').findOne({ walletAddress })
    
    console.log(`[User By Wallet] Looking up ${walletAddress}`)
    console.log(`[User By Wallet] Found user: ${!!user}, username: ${user?.username}`)
    
    if (!user) {
      return NextResponse.json({ 
        exists: false,
        walletAddress 
      })
    }

    // Also get referral code
    const referralCode = await db.collection('referral_codes_v2').findOne({ walletAddress })
    console.log(`[User By Wallet] Referral code: ${referralCode?.code}, isVanity: ${referralCode?.isVanity}`)
    
    return NextResponse.json({
      exists: true,
      walletAddress: user.walletAddress,
      username: user.username || user.profile?.username || null,
      profile: {
        username: user.username || user.profile?.username || null,
        bio: user.profile?.bio || '',
        avatar: user.profile?.avatar || null
      },
      referralCode: referralCode?.code || null,
      isVanity: referralCode?.isVanity || false,
      createdAt: user.createdAt,
      registrationDate: user.registrationDate
    })

  } catch (error) {
    console.error('User lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup user' },
      { status: 500 }
    )
  }
}
