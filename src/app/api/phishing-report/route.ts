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
    const data = await req.json()
    
    // Validate required fields
    if (!data.description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }
    
    if (!data.url && !data.domain) {
      return NextResponse.json(
        { error: 'Either URL or domain is required' },
        { status: 400 }
      )
    }
    
    // Check for authentication (optional - allow anonymous reports)
    const authResult = await verifyAuth(req)
    
    const report = await phishingReportService.createReport({
      reporterId: authResult?.userId || 'anonymous',
      reporterUsername: authResult?.username || 'Anonymous',
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