import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { entryId, vote } = await request.json()

    if (!entryId || !vote) {
      return NextResponse.json(
        { error: 'Missing entryId or vote' },
        { status: 400 }
      )
    }

    if (!['up', 'down'].includes(vote)) {
      return NextResponse.json(
        { error: 'Vote must be "up" or "down"' },
        { status: 400 }
      )
    }

    const updatedEntry = await WalletListService.voteOnEntry(
      new ObjectId(entryId),
      new ObjectId(authResult.user.userId),
      authResult.user.walletAddress,
      vote
    )

    if (!updatedEntry) {
      return NextResponse.json(
        { error: 'Entry not found, not public, or voting not allowed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      entry: updatedEntry,
      message: `Vote "${vote}" recorded successfully`
    })
  } catch (error) {
    console.error('[WalletLists Vote API] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record vote' },
      { status: 500 }
    )
  }
}