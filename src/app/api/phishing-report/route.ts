import { NextRequest, NextResponse } from 'next/server'
import { phishingReportService } from '@/lib/services/phishing-report-service'
import { verifyAuth } from '@/lib/auth-helper'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const severity = searchParams.get('severity')
    const reporterId = searchParams.get('reporterId')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    const reports = await phishingReportService.getReports(
      {
        status: status || undefined,
        category: category || undefined,
        severity: severity || undefined,
        reporterId: reporterId || undefined
      },
      limit
    )
    
    return NextResponse.json({
      success: true,
      reports
    })
  } catch (error) {
    console.error('Error getting phishing reports:', error)
    return NextResponse.json(
      { error: 'Failed to get reports' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const data = await req.json()
    
    const report = await phishingReportService.createReport({
      reporterId: authResult.userId,
      reporterUsername: authResult.username || 'Anonymous',
      ...data
    })
    
    if (!report) {
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      report
    })
  } catch (error) {
    console.error('Error creating phishing report:', error)
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    )
  }
}