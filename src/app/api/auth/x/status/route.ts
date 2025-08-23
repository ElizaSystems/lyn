import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Get current user session
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const walletAddress = authResult.user.walletAddress
    const db = await getDatabase()
    const usersCollection = db.collection('users')
    const scansCollection = db.collection('user_scan_quotas')

    // Get user's X connection status
    const user = await usersCollection.findOne({ walletAddress })
    
    if (!user?.xUsername) {
      return NextResponse.json({
        connected: false,
        xUsername: null,
        xFreeScans: 0,
        xFreeScansUsed: 0,
        xFreeScansRemaining: 0
      })
    }

    // Get current month's scan quota
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    const scanQuota = await scansCollection.findOne({
      walletAddress,
      month: currentMonth
    })

    const xFreeScans = scanQuota?.xFreeScans || 5
    const xFreeScansUsed = scanQuota?.xFreeScansUsed || 0
    const xFreeScansRemaining = Math.max(0, xFreeScans - xFreeScansUsed)

    return NextResponse.json({
      connected: true,
      xUsername: user.xUsername,
      xName: user.xName,
      xConnectedAt: user.xConnectedAt,
      xFreeScans,
      xFreeScansUsed,
      xFreeScansRemaining,
      month: currentMonth
    })
  } catch (error) {
    console.error('X status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check X connection status' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Disconnect X account
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const walletAddress = authResult.user.walletAddress
    const db = await getDatabase()
    const usersCollection = db.collection('users')

    // Remove X connection info
    await usersCollection.updateOne(
      { walletAddress },
      {
        $unset: {
          xUsername: '',
          xUserId: '',
          xName: '',
          xConnectedAt: '',
          xAccessToken: ''
        },
        $set: {
          updatedAt: new Date()
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: 'X account disconnected successfully'
    })
  } catch (error) {
    console.error('X disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect X account' },
      { status: 500 }
    )
  }
}