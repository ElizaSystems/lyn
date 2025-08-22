import { NextRequest, NextResponse } from 'next/server'
import { isAdminWallet } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json()
    
    if (!walletAddress) {
      return NextResponse.json(
        { isAdmin: false, error: 'Wallet address required' },
        { status: 400 }
      )
    }

    const isAdmin = isAdminWallet(walletAddress)
    
    return NextResponse.json({
      isAdmin,
      walletAddress,
      message: isAdmin ? 'Admin access granted' : 'Not an admin wallet'
    })
  } catch (error) {
    console.error('Simple admin check error:', error)
    return NextResponse.json(
      { isAdmin: false, error: 'Failed to check admin status' },
      { status: 500 }
    )
  }
}