import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('wallet')
    const listType = searchParams.get('type') as 'whitelist' | 'blacklist' | null
    const includePublic = searchParams.get('includePublic') !== 'false'
    const includeGlobal = searchParams.get('includeGlobal') !== 'false'
    const includeShared = searchParams.get('includeShared') !== 'false'
    const minConfidence = searchParams.get('minConfidence') ? parseInt(searchParams.get('minConfidence')!) : undefined

    if (walletAddress) {
      // Check specific wallet across lists
      const result = await WalletListService.checkWalletInLists(
        walletAddress,
        new ObjectId(authResult.user.userId),
        {
          includePublic,
          includeGlobal,
          includeShared,
          listType: listType || undefined,
          minConfidence
        }
      )

      return NextResponse.json(result)
    } else {
      // Get user's lists
      const lists = await WalletListService.getUserLists(
        new ObjectId(authResult.user.userId),
        {
          listType: listType || undefined,
          includeShared: includeShared
        }
      )

      return NextResponse.json({ lists })
    }
  } catch (error) {
    console.error('[WalletLists API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallet lists' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'add_wallet': {
        const {
          walletAddress,
          listType,
          category,
          reason,
          evidence,
          confidence,
          severity,
          tags,
          visibility,
          allowContributions,
          expiresAt
        } = data

        if (!walletAddress || !listType || !category || !reason) {
          return NextResponse.json(
            { error: 'Missing required fields: walletAddress, listType, category, reason' },
            { status: 400 }
          )
        }

        const entry = await WalletListService.addWalletToList({
          walletAddress,
          listType,
          category,
          reason,
          evidence: evidence || undefined,
          confidence: confidence || 75,
          severity: severity || 'medium',
          tags: tags || [],
          ownerId: new ObjectId(authResult.user.userId),
          ownerAddress: authResult.user.walletAddress,
          visibility: visibility || 'private',
          sharedWith: [],
          allowContributions: allowContributions || false,
          isGlobal: false,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          source: 'user_submission'
        })

        return NextResponse.json({ entry })
      }

      case 'create_list': {
        const {
          name,
          description,
          listType,
          category,
          visibility,
          allowVoting,
          requireVerification,
          tags
        } = data

        if (!name || !listType || !category) {
          return NextResponse.json(
            { error: 'Missing required fields: name, listType, category' },
            { status: 400 }
          )
        }

        const list = await WalletListService.createWalletList({
          name,
          description: description || '',
          listType,
          category: Array.isArray(category) ? category : [category],
          ownerId: new ObjectId(authResult.user.userId),
          ownerAddress: authResult.user.walletAddress,
          visibility: visibility || 'private',
          isActive: true,
          allowVoting: allowVoting || false,
          requireVerification: requireVerification || false,
          sharedWith: [],
          collaborators: [],
          tags: tags || [],
          source: 'user_created'
        })

        return NextResponse.json({ list })
      }

      case 'bulk_operation': {
        const { operation, entries, options } = data

        if (!operation || !entries || !Array.isArray(entries)) {
          return NextResponse.json(
            { error: 'Invalid bulk operation data' },
            { status: 400 }
          )
        }

        const result = await WalletListService.bulkListOperation(
          { operation, entries, options },
          new ObjectId(authResult.user.userId)
        )

        return NextResponse.json(result)
      }

      case 'subscribe': {
        const { listId, settings } = data

        if (!listId) {
          return NextResponse.json(
            { error: 'Missing listId' },
            { status: 400 }
          )
        }

        const subscription = await WalletListService.subscribeToList(
          new ObjectId(authResult.user.userId),
          authResult.user.walletAddress,
          new ObjectId(listId),
          settings
        )

        return NextResponse.json({ subscription })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[WalletLists API] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('wallet')
    const listType = searchParams.get('type') as 'whitelist' | 'blacklist'

    if (!walletAddress || !listType) {
      return NextResponse.json(
        { error: 'Missing wallet address or list type' },
        { status: 400 }
      )
    }

    const success = await WalletListService.removeWalletFromList(
      walletAddress,
      listType,
      new ObjectId(authResult.user.userId)
    )

    return NextResponse.json({ success })
  } catch (error) {
    console.error('[WalletLists API] DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove wallet from list' },
      { status: 500 }
    )
  }
}