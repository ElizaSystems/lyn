import { NextRequest, NextResponse } from 'next/server'
import { phishingReportService } from '@/lib/services/phishing-report-service'

export async function GET(req: NextRequest) {
  try {
    const stats = await phishingReportService.getReportStats()
    
    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('Error getting report stats:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}