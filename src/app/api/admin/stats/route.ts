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

    const db = await getDatabase()
    
    // Get overall system stats
    const [
      totalUsers,
      totalUsersWithUsernames,
      totalBurns,
      totalBurnAmount,
      totalScans,
      totalReferrals,
      recentActivity
    ] = await Promise.all([
      // Total users
      db.collection('users').countDocuments(),
      
      // Users with registered usernames
      db.collection('users').countDocuments({ username: { $exists: true, $ne: null } }),
      
      // Total burns
      db.collection('burns').countDocuments(),
      
      // Total burn amount
      db.collection('burns').aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray().then(result => result[0]?.total || 0),
      
      // Total scans
      db.collection('security_scans').countDocuments(),
      
      // Total referrals
      db.collection('referral_relationships').countDocuments(),
      
      // Recent activity (last 24h)
      Promise.all([
        db.collection('users').countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        db.collection('burns').countDocuments({
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        db.collection('security_scans').countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]).then(([users, burns, scans]) => ({ users, burns, scans }))
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalUsersWithUsernames,
        totalBurns,
        totalBurnAmount,
        totalScans,
        totalReferrals,
        recentActivity,
        usernameRegistrationRate: totalUsers > 0 ? (totalUsersWithUsernames / totalUsers) * 100 : 0
      }
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    )
  }
}