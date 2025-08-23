import { NextRequest, NextResponse } from 'next/server'
import { VeniceAIService } from '@/lib/services/venice-ai-service'

// Store challenge conversations
const challengeConversations = new Map<string, any[]>()

export async function POST(request: NextRequest) {
  try {
    const { 
      message, 
      challengeId, 
      sessionId, 
      context 
    } = await request.json()
    
    if (!message || !challengeId) {
      return NextResponse.json({ error: 'Message and challengeId are required' }, { status: 400 })
    }

    // Get or create conversation history
    const conversationKey = `${challengeId}_${sessionId}`
    if (!challengeConversations.has(conversationKey)) {
      challengeConversations.set(conversationKey, [])
    }
    const history = challengeConversations.get(conversationKey)!
    
    // Build context for AI
    const systemPrompt = `You are a cybersecurity expert helping a user work through a security challenge scenario. 
    
Challenge Context:
- Scenario: ${context.scenario}
- Objectives: ${context.objectives.join(', ')}
- Time spent: ${context.timeSpent} seconds
- Hints used: ${context.hintsUsed}

Your role is to:
1. Guide the user through the challenge interactively
2. Ask probing questions to understand their approach
3. Provide feedback on their security decisions
4. Evaluate their understanding of security concepts
5. Score their responses based on correctness and completeness

Be encouraging but also point out areas for improvement. Help them learn from the challenge.`

    // Add system context to history if first message
    if (history.length === 0) {
      history.push({ role: 'system', content: systemPrompt })
    }
    
    // Add user message to history
    history.push({ role: 'user', content: message })
    
    // Generate AI response
    const aiResponse = await VeniceAIService.generateResponse(
      message,
      history,
      {
        temperature: 0.7,
        max_tokens: 500
      }
    )
    
    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse })
    
    // Evaluate if the user has completed key objectives
    const evaluation = await evaluateResponse(message, context, history)
    
    // Check if challenge is completed
    const completed = evaluation.objectivesCompleted >= context.objectives.length * 0.7
    
    // Calculate score based on conversation
    const score = calculateScore(history, context, evaluation)
    
    // Clean up old conversations
    if (challengeConversations.size > 50) {
      const oldestKey = challengeConversations.keys().next().value
      if (oldestKey) {
        challengeConversations.delete(oldestKey)
      }
    }
    
    return NextResponse.json({
      message: aiResponse,
      evaluation: evaluation.hasEvaluation ? {
        correct: evaluation.correct,
        score: score,
        feedback: evaluation.feedback
      } : undefined,
      completed,
      score,
      sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Challenge chat error:', error)
    
    // Provide fallback response
    return NextResponse.json({
      message: "Let me help you think through this security challenge. What specific aspect would you like to discuss?",
      sessionId: 'fallback',
      timestamp: new Date().toISOString()
    })
  }
}

async function evaluateResponse(message: string, context: any, history: any[]): Promise<any> {
  // Simple evaluation logic - in production this would be more sophisticated
  const lowerMessage = message.toLowerCase()
  
  const securityKeywords = [
    'verify', 'authenticate', 'report', 'block', 'suspicious',
    'phishing', 'malware', 'password', '2fa', 'encryption',
    'backup', 'update', 'patch', 'firewall', 'antivirus'
  ]
  
  const hasSecurityConcepts = securityKeywords.some(keyword => lowerMessage.includes(keyword))
  
  // Check if user addressed objectives
  const addressedObjectives = context.objectives.filter((obj: string) => {
    const objLower = obj.toLowerCase()
    return lowerMessage.includes(objLower.split(' ')[0]) || 
           history.some(h => h.role === 'user' && h.content.toLowerCase().includes(objLower.split(' ')[0]))
  })
  
  return {
    hasEvaluation: hasSecurityConcepts,
    correct: addressedObjectives.length > 0,
    objectivesCompleted: addressedObjectives.length,
    feedback: hasSecurityConcepts 
      ? "Good security thinking! You're considering the right aspects."
      : "Think about the security implications of this scenario."
  }
}

function calculateScore(history: any[], context: any, evaluation: any): number {
  let score = 0
  
  // Base score for participation
  score += 20
  
  // Score for addressing objectives
  const objectiveScore = (evaluation.objectivesCompleted / context.objectives.length) * 40
  score += Math.round(objectiveScore)
  
  // Score for quality of responses
  const userMessages = history.filter(h => h.role === 'user')
  const avgMessageLength = userMessages.reduce((acc, m) => acc + m.content.length, 0) / userMessages.length
  if (avgMessageLength > 100) score += 20 // Detailed responses
  else if (avgMessageLength > 50) score += 10
  
  // Score for security concepts mentioned
  const securityTerms = ['security', 'protect', 'safe', 'risk', 'threat', 'vulnerable']
  const mentionedTerms = securityTerms.filter(term => 
    userMessages.some(m => m.content.toLowerCase().includes(term))
  )
  score += mentionedTerms.length * 5
  
  // Penalty for hints
  score -= context.hintsUsed * 5
  
  // Cap at 100
  return Math.min(100, Math.max(0, score))
}