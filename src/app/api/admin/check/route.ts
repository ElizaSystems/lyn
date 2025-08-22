import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) {
      return NextResponse.json(
        { 
          isAdmin: false, 
          error: authResult.error.message 
        },
        { status: authResult.error.status }
      )
    }

    return NextResponse.json({
      isAdmin: true,
      user: {
        walletAddress: authResult.user.walletAddress,
        username: authResult.user.username
      }
    })
  } catch (error) {
    console.error('Admin check error:', error)
    return NextResponse.json(
      { isAdmin: false, error: 'Failed to check admin status' },
      { status: 500 }
    )
  }
}