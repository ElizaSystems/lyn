import { NextRequest, NextResponse } from 'next/server'
import { ReferralServiceV2 } from '@/lib/services/referral-service-v2'
import { verifyWalletSignature } from '@/lib/auth'
import bs58 from 'bs58'
import crypto from 'crypto'

/**
 * Lock a referral relationship immutably by verifying a signed message.
 * Body: { walletAddress, referralCode, message, signature | signatureBytes }
 * Message should include the phrase: 'Sign in to Lock in Your LYN Points with your Referrer'
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress, referralCode, message, signature, signatureBytes } = await request.json()

    if (!walletAddress || !referralCode || !message || (!signature && !signatureBytes)) {
      return NextResponse.json(
        { error: 'walletAddress, referralCode, message, and signature are required' },
        { status: 400 }
      )
    }

    // Basic message validation to prevent blind signing misuse
    const REQUIRED_PHRASE = 'Sign in to Lock in Your LYN Points with your Referrer'
    if (!message || typeof message !== 'string' || !message.includes(REQUIRED_PHRASE)) {
      return NextResponse.json(
        { error: 'Invalid message. Please sign the referral lock message.' },
        { status: 400 }
      )
    }

    // Normalize signature to base58 string
    let signatureBase58: string
    if (typeof signature === 'string') {
      // Try base58; if it fails, try base64 then re-encode as base58
      try {
        bs58.decode(signature)
        signatureBase58 = signature
      } catch {
        try {
          const b64 = Buffer.from(signature, 'base64')
          signatureBase58 = bs58.encode(b64)
        } catch {
          return NextResponse.json({ error: 'Invalid signature string' }, { status: 400 })
        }
      }
    } else if (Array.isArray(signatureBytes)) {
      try {
        const bytes = new Uint8Array(signatureBytes as number[])
        signatureBase58 = bs58.encode(bytes)
      } catch {
        return NextResponse.json({ error: 'Invalid signature bytes' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 })
    }

    // Verify wallet signature
    const isValid = verifyWalletSignature(message, signatureBase58, walletAddress)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Resolve referrer by code (supports vanity usernames)
    const info = await ReferralServiceV2.getReferrerInfo(referralCode)
    if (!info?.walletAddress) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
    }

    const db = await (await import('@/lib/mongodb')).getDatabase()
    const relationships = db.collection('referral_relationships_v2')

    // If already locked, return existing (immutable)
    const existing = await relationships.findOne({ referredWallet: walletAddress })
    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyLocked: true,
        referrerWallet: existing.referrerWallet,
        referralCode: existing.referralCode,
        tier: existing.tier || 1
      })
    }

    // Find tier2 referrer (who referred the tier1 wallet)
    let tier2ReferrerWallet: string | null = null
    const tier1Rel = await relationships.findOne({ referredWallet: info.walletAddress })
    if (tier1Rel?.referrerWallet) tier2ReferrerWallet = tier1Rel.referrerWallet

    // Compute immutable lock hash
    const lockHash = crypto
      .createHash('sha256')
      .update(`${walletAddress}:${info.walletAddress}:${referralCode}:${message}`)
      .digest('hex')

    // Insert immutable relationship
    await relationships.insertOne({
      referrerWallet: info.walletAddress,
      referredWallet: walletAddress,
      referralCode,
      tier: 1,
      tier2ReferrerWallet,
      rewardAmount: 0,
      tier2RewardAmount: tier2ReferrerWallet ? 0 : 0,
      lockHash,
      lockedAt: new Date(),
      createdAt: new Date()
    } as Record<string, unknown>)

    // Increment referrer stats
    const codes = db.collection('referral_codes_v2')
    await codes.updateOne(
      { walletAddress: info.walletAddress },
      { $inc: { totalReferrals: 1 }, $set: { updatedAt: new Date() } }
    )

    return NextResponse.json({
      success: true,
      alreadyLocked: false,
      referrerWallet: info.walletAddress,
      tier2ReferrerWallet,
      referralCode,
      lockHash
    })
  } catch (error) {
    console.error('[Referral V2] lock error:', error)
    return NextResponse.json(
      { error: 'Failed to lock referral' },
      { status: 500 }
    )
  }
}


