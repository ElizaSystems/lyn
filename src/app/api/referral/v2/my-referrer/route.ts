import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet is required' },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const users = db.collection('users')

    // First, try v2 relationships by wallet
    const relationshipsV2 = db.collection('referral_relationships_v2')
    const relV2 = await relationshipsV2.findOne({ referredWallet: wallet })
    if (relV2?.referrerWallet) {
      const refUser = await users.findOne({ walletAddress: relV2.referrerWallet })
      return NextResponse.json({
        walletAddress: relV2.referrerWallet,
        username: refUser?.username || null,
        referralCode: relV2.referralCode || null,
        tier: relV2.tier || 1
      })
    }

    // Fallback: legacy v1 relationships by user ObjectId
    const user = await users.findOne({ walletAddress: wallet })
    if (user) {
      const relationshipsV1 = db.collection('referral_relationships')
      const relV1 = await relationshipsV1.findOne({ referredId: user._id })
      if (relV1?.referrerId) {
        const refUser = await users.findOne({ _id: relV1.referrerId })
        if (refUser?.walletAddress) {
          return NextResponse.json({
            walletAddress: refUser.walletAddress,
            username: refUser.username || null,
            referralCode: relV1.referralCode || null,
            tier: 1
          })
        }
      }
    }

    return NextResponse.json(
      { error: 'No referrer found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('[Referral V2] my-referrer error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referrer' },
      { status: 500 }
    )
  }
}


