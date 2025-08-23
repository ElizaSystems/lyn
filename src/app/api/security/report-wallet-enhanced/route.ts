import { NextRequest, NextResponse } from 'next/server'
import { MultiChainWalletSecurityIntegration } from '@/lib/services/multi-chain-wallet-security-integration'
import { requireAuth } from '@/lib/auth'
import { BlockchainType } from '@/lib/models/multi-chain'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    
    if (!authResult.user?.walletAddress) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      walletAddress, 
      reportType, 
      description, 
      evidence 
    } = body

    if (!walletAddress || !reportType || !description) {
      return NextResponse.json(
        { error: 'Wallet address, report type, and description are required' },
        { status: 400 }
      )
    }

    // Validate report type
    const validTypes = ['scam', 'phishing', 'rugpull', 'impersonation', 'bot', 'other']
    if (!validTypes.includes(reportType)) {
      return NextResponse.json(
        { error: `Invalid report type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate chains if provided
    if (evidence?.suspectedChains) {
      const validChains = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base']
      const invalidChains = evidence.suspectedChains.filter((chain: string) => !validChains.includes(chain))
      
      if (invalidChains.length > 0) {
        return NextResponse.json(
          { error: `Invalid chains: ${invalidChains.join(', ')}. Valid chains: ${validChains.join(', ')}` },
          { status: 400 }
        )
      }
    }

    console.log(`[Enhanced Wallet Report] Reporting wallet: ${walletAddress} for ${reportType}`)

    // Submit enhanced report
    const report = await MultiChainWalletSecurityIntegration.reportWalletEnhanced(
      walletAddress,
      authResult.user.walletAddress,
      reportType,
      description,
      evidence
    )

    console.log(`[Enhanced Wallet Report] Report submitted successfully: ${report._id}`)

    return NextResponse.json({
      success: true,
      data: {
        reportId: report._id,
        walletAddress,
        reportType,
        status: report.status,
        submittedAt: report.createdAt,
        multiChainContext: evidence?.suspectedChains ? {
          chains: evidence.suspectedChains,
          bridgeActivity: evidence.bridgeActivity?.length || 0
        } : null
      },
      message: 'Report submitted successfully'
    })
  } catch (error) {
    console.error('[Enhanced Wallet Report] Error:', error)
    
    return NextResponse.json({
      error: 'Failed to submit report',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}