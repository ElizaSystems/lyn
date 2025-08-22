import { NextRequest, NextResponse } from 'next/server'
import { BurnService } from '@/lib/services/burn-service'

export async function GET(request: NextRequest) {
  try {
    const stats = await BurnService.getGlobalStats()
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Burn stats fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch burn statistics' },
      { status: 500 }
    )
  }
}