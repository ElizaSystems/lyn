import { NextRequest, NextResponse } from 'next/server'
import { phishingReportService } from '@/lib/services/phishing-report-service'
import { verifyAuth } from '@/lib/auth-helper'

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { reportId, vote } = await req.json()
    
    if (!reportId || !vote) {
      return NextResponse.json(
        { error: 'Report ID and vote required' },
        { status: 400 }
      )
    }
    
    if (!['legitimate', 'suspicious', 'phishing'].includes(vote)) {
      return NextResponse.json(
        { error: 'Invalid vote type' },
        { status: 400 }
      )
    }
    
    const success = await phishingReportService.voteOnReport(
      reportId,
      authResult.userId,
      vote
    )
    
    return NextResponse.json({
      success
    })
  } catch (error) {
    console.error('Error voting on report:', error)
    return NextResponse.json(
      { error: 'Failed to vote on report' },
      { status: 500 }
    )
  }
}