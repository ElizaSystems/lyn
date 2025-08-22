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
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    const db = await getDatabase()
    const usersCollection = db.collection('users')
    
    // Build search filter
    const searchFilter = search ? {
      $or: [
        { username: { $regex: search, $options: 'i' } },
        { walletAddress: { $regex: search, $options: 'i' } }
      ]
    } : {}

    // Get users with pagination
    const [users, totalCount] = await Promise.all([
      usersCollection
        .find(searchFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      usersCollection.countDocuments(searchFilter)
    ])

    // Get additional data for each user
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [burnCount, burnTotal, scanCount] = await Promise.all([
          db.collection('burns').countDocuments({ walletAddress: user.walletAddress }),
          db.collection('burns').aggregate([
            { $match: { walletAddress: user.walletAddress } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]).toArray().then(result => result[0]?.total || 0),
          db.collection('security_scans').countDocuments({ userId: user._id?.toString() })
        ])

        return {
          id: user._id?.toString(),
          walletAddress: user.walletAddress,
          username: user.username,
          tokenBalance: user.tokenBalance,
          hasTokenAccess: user.hasTokenAccess,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          usernameRegisteredAt: user.usernameRegisteredAt,
          stats: {
            burnCount,
            burnTotal,
            scanCount
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}