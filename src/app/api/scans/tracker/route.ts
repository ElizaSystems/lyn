import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ScanTrackerService } from '@/lib/services/scan-tracker-service'

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
    
    // Get user's scan stats
    const stats = await ScanTrackerService.getUserScanStats(walletAddress)
    
    if (!stats) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        totalScans: 0,
        todayScans: 0,
        badges: [],
        achievements: {},
        weeklyScans: [],
        monthlyScans: []
      })
    }
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to get scan stats:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve scan statistics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Track a new scan
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const walletAddress = authResult.user.walletAddress
    const { scanType, isThreat } = await request.json()
    
    // Track the scan
    const result = await ScanTrackerService.trackScan(
      walletAddress,
      scanType || 'unknown',
      isThreat || false
    )
    
    return NextResponse.json({
      success: true,
      newBadges: result.newBadges,
      streakUpdate: result.streakUpdate
    })
  } catch (error) {
    console.error('Failed to track scan:', error)
    return NextResponse.json(
      { error: 'Failed to track scan' },
      { status: 500 }
    )
  }
}