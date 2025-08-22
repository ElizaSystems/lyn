import { NextRequest, NextResponse } from 'next/server'
import { WalletSecurityService } from '@/lib/services/wallet-security'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: 'Authentication required to report wallets' },
        { status: 401 }
      )
    }

    const { 
      walletAddress, 
      reportType, 
      description, 
      evidence 
    } = await request.json()
    
    if (!walletAddress || !reportType || !description) {
      return NextResponse.json({ 
        error: 'Wallet address, report type, and description are required' 
      }, { status: 400 })
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 })
    }

    // Validate report type
    const validReportTypes = ['scam', 'phishing', 'rugpull', 'impersonation', 'bot', 'other']
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    console.log(`[Wallet Report] ${authResult.user.walletAddress} reporting ${walletAddress} for ${reportType}`)

    // Submit the report
    const report = await WalletSecurityService.reportWallet(
      walletAddress,
      authResult.user.walletAddress,
      reportType,
      description,
      evidence
    )

    // Auto-blacklist if critical report with evidence
    if (reportType === 'scam' && evidence?.transactionHashes?.length) {
      try {
        await WalletSecurityService.blacklistWallet(
          walletAddress,
          `Community report: ${reportType} - ${description}`,
          authResult.user.walletAddress,
          evidence.transactionHashes
        )
        console.log(`[Wallet Report] Auto-blacklisted ${walletAddress} due to scam report with evidence`)
      } catch (error) {
        console.error('[Wallet Report] Failed to auto-blacklist:', error)
      }
    }

    return NextResponse.json({
      success: true,
      reportId: report._id?.toString(),
      message: 'Wallet report submitted successfully',
      status: 'pending_review'
    })

  } catch (error) {
    console.error('Wallet report error:', error)
    return NextResponse.json({
      error: 'Failed to submit wallet report',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('address')
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address parameter required' }, { status: 400 })
    }

    // Get reputation and reports for the wallet
    const reputation = await WalletSecurityService.getWalletReputation(walletAddress)

    return NextResponse.json({
      walletAddress,
      reputation: reputation.score,
      totalReports: reputation.reports.length,
      verifiedReports: reputation.reports.filter(r => r.status === 'verified').length,
      pendingReports: reputation.reports.filter(r => r.status === 'pending').length,
      reportTypes: reputation.reports.reduce((acc, report) => {
        acc[report.reportType] = (acc[report.reportType] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      lastReported: reputation.reports.length > 0 ? 
        Math.max(...reputation.reports.map(r => r.createdAt.getTime())) : null
    })

  } catch (error) {
    console.error('Wallet report GET error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve wallet reports'
    }, { status: 500 })
  }
}
