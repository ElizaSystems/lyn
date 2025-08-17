import { NextRequest, NextResponse } from 'next/server'
import { SecurityAIAgent } from '@/lib/ai-agent'
import { tokenGateService } from '@/lib/token-gate'

// Store agent instances per session (in production, use proper session management)
const agents = new Map<string, SecurityAIAgent>()

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId = 'default', walletAddress } = await request.json()
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Check if user can ask questions
    const canAsk = tokenGateService.canAskQuestion(sessionId)
    
    if (!canAsk.allowed) {
      return NextResponse.json({
        error: 'limit_reached',
        message: canAsk.reason,
        requiresTokens: canAsk.requiresTokens,
        tokenInfo: tokenGateService.getTokenInfo()
      }, { status: 403 })
    }

    // Track usage
    tokenGateService.trackUsage(sessionId, walletAddress)

    // Get or create agent for this session
    if (!agents.has(sessionId)) {
      agents.set(sessionId, new SecurityAIAgent())
    }
    const agent = agents.get(sessionId)!
    
    // Analyze user intent and generate response
    const aiResponse = agent.analyzeUserIntent(message)
    
    // Update conversation context
    agent.updateContext(message, aiResponse.message)
    
    // Add a security tip occasionally
    const includeTip = Math.random() > 0.7
    const securityTip = includeTip ? agent.generateSecurityTip() : null
    
    // Generate follow-up suggestions
    const suggestions = agent.generateFollowUpSuggestions(aiResponse.suggestedAction || 'general_help')
    
    // Get updated usage info
    const usage = tokenGateService.getUsage(sessionId)
    const updatedCanAsk = tokenGateService.canAskQuestion(sessionId)
    
    return NextResponse.json({
      ...aiResponse,
      securityTip,
      suggestions,
      sessionId,
      usage: {
        questionsAsked: usage.questionsAsked,
        questionsRemaining: updatedCanAsk.questionsRemaining,
        hasTokenAccess: usage.hasTokenAccess
      }
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}