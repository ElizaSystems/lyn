import { NextRequest, NextResponse } from 'next/server'
import { ReferralServiceV2 } from '@/lib/services/referral-service-v2'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const wallet = searchParams.get('wallet')

    if (!code && !wallet) {
      return NextResponse.json(
        { error: 'Provide either code or wallet' },
        { status: 400 }
      )
    }

    let result: { tier1Wallet?: string; tier2Wallet?: string } = {}
    if (code) {
      result = await ReferralServiceV2.getReferralChainByCode(code)
    } else if (wallet) {
      result = await ReferralServiceV2.getReferralChainByTier1Wallet(wallet)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Referral Chain V2] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get referral chain' },
      { status: 500 }
    )
  }
}


