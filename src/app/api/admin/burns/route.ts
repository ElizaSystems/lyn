import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error.message },
        { status: authResult.error.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type') || ''
    const skip = (page - 1) * limit

    const db = await getDatabase()
    const burnsCollection = db.collection('burns')
    
    // Build filter
    const filter = type ? { type } : {}

    // Get burns with pagination
    const [burns, totalCount] = await Promise.all([
      burnsCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      burnsCollection.countDocuments(filter)
    ])

    // Get user info for each burn
    const userWallets = [...new Set(burns.map(burn => burn.walletAddress))]
    const users = await db.collection('users')
      .find({ walletAddress: { $in: userWallets } })
      .toArray()
    
    const userMap = new Map(users.map(u => [u.walletAddress, u]))

    const enrichedBurns = burns.map(burn => ({
      id: burn._id?.toString(),
      walletAddress: burn.walletAddress,
      username: burn.username || userMap.get(burn.walletAddress)?.username,
      amount: burn.amount,
      type: burn.type,
      description: burn.description,
      transactionSignature: burn.transactionSignature,
      timestamp: burn.timestamp,
      verified: burn.verified,
      metadata: burn.metadata
    }))

    return NextResponse.json({
      success: true,
      burns: enrichedBurns,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Admin burns error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch burns' },
      { status: 500 }
    )
  }
}