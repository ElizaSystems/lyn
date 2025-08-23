import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const entryId = new ObjectId(params.id)
    
    // This would get a specific list entry - implementation depends on needs
    return NextResponse.json({ message: 'Get specific entry functionality to be implemented' })
  } catch (error) {
    console.error('[WalletLists Entry API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch list entry' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const entryId = new ObjectId(params.id)
    const updates = await request.json()

    // Remove fields that shouldn't be updated directly
    const { _id, createdAt, votes, timesQueried, reportCount, ownerId, ...allowedUpdates } = updates

    const updatedEntry = await WalletListService.updateWalletListEntry(
      entryId,
      allowedUpdates,
      new ObjectId(authResult.user.userId)
    )

    if (!updatedEntry) {
      return NextResponse.json(
        { error: 'Entry not found or permission denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({ entry: updatedEntry })
  } catch (error) {
    console.error('[WalletLists Entry API] PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update list entry' },
      { status: 500 }
    )
  }
}