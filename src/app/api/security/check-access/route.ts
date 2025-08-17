import { NextRequest, NextResponse } from 'next/server'
import { tokenGateService } from '@/lib/token-gate'

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, sessionId } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }
    
    // Get current usage
    const usage = tokenGateService.getUsage(sessionId)
    const canAsk = tokenGateService.canAskQuestion(sessionId)
    
    // If wallet address provided, check token balance
    let tokenBalance = null
    if (walletAddress) {
      try {
        tokenBalance = await tokenGateService.checkTokenBalance(walletAddress)
        
        // Update token access status
        tokenGateService.updateTokenAccess(sessionId, tokenBalance.hasAccess, walletAddress)
        
        // Recalculate access after updating token status
        const updatedCanAsk = tokenGateService.canAskQuestion(sessionId)
        
        return NextResponse.json({
          hasAccess: tokenBalance.hasAccess,
          tokenBalance: tokenBalance.balance,
          requiredTokens: tokenBalance.required,
          questionsAsked: usage.questionsAsked,
          freeQuestionsLimit: tokenGateService.getTokenInfo().freeQuestionsLimit,
          canAskQuestion: updatedCanAsk.allowed,
          questionsRemaining: updatedCanAsk.questionsRemaining,
          reason: updatedCanAsk.reason,
          tokenInfo: tokenGateService.getTokenInfo()
        })
      } catch (error) {
        console.error('Error checking wallet balance:', error)
        // Continue without token access
      }
    }
    
    return NextResponse.json({
      hasAccess: usage.hasTokenAccess,
      questionsAsked: usage.questionsAsked,
      freeQuestionsLimit: tokenGateService.getTokenInfo().freeQuestionsLimit,
      canAskQuestion: canAsk.allowed,
      questionsRemaining: canAsk.questionsRemaining,
      reason: canAsk.reason,
      requiresTokens: canAsk.requiresTokens,
      tokenInfo: tokenGateService.getTokenInfo()
    })
  } catch (error) {
    console.error('Access check error:', error)
    return NextResponse.json(
      { error: 'Failed to check access' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const tokenInfo = tokenGateService.getTokenInfo()
  
  return NextResponse.json({
    tokenInfo,
    message: `Hold at least ${tokenInfo.requiredAmount} ${tokenInfo.tokenSymbol} tokens for unlimited access. Free users get ${tokenInfo.freeQuestionsLimit} questions.`
  })
}