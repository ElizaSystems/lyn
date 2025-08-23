import { NextRequest, NextResponse } from 'next/server'
import { CrossChainRiskAnalyzer } from '@/lib/services/cross-chain-risk-analyzer'
import { ObjectId } from 'mongodb'

/**
 * GET /api/multi-chain/wallets/[id]/risk - Get wallet risk assessment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)

    const riskAssessment = await CrossChainRiskAnalyzer.getRiskAssessment(walletId)
    
    if (!riskAssessment) {
      return NextResponse.json(
        { success: false, error: 'Risk assessment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: riskAssessment
    })
  } catch (error) {
    console.error('[Multi-chain Risk] GET error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/multi-chain/wallets/[id]/risk - Perform/update risk assessment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const walletId = new ObjectId(params.id)
    const body = await request.json()
    const { externalRiskFactors, externalRiskScore } = body

    // Perform risk assessment
    const riskAssessment = await CrossChainRiskAnalyzer.assessWalletRisk(walletId)

    // Update with external intelligence if provided
    if (externalRiskFactors || externalRiskScore) {
      await CrossChainRiskAnalyzer.updateWithExternalIntelligence(
        walletId,
        externalRiskFactors || [],
        externalRiskScore || 0
      )
      
      // Get updated assessment
      const updatedAssessment = await CrossChainRiskAnalyzer.getRiskAssessment(walletId)
      
      return NextResponse.json({
        success: true,
        data: updatedAssessment,
        message: 'Risk assessment completed and updated with external intelligence'
      })
    }

    return NextResponse.json({
      success: true,
      data: riskAssessment,
      message: 'Risk assessment completed successfully'
    })
  } catch (error) {
    console.error('[Multi-chain Risk Assessment] POST error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}