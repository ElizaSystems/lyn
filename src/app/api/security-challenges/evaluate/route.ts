import { NextRequest, NextResponse } from 'next/server'
import { VeniceAIService } from '@/lib/services/venice-ai-service'
import { securityChallengeService } from '@/lib/services/security-challenge-service'

export async function POST(request: NextRequest) {
  try {
    const { 
      challengeId, 
      sessionId, 
      responses,
      hintsUsed,
      timeSpent
    } = await request.json()
    
    if (!challengeId || !responses) {
      return NextResponse.json({ error: 'Challenge ID and responses are required' }, { status: 400 })
    }

    // Get challenge details for context
    const challenge = await securityChallengeService.getChallengeById(challengeId)
    
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Use AI to evaluate the user's responses
    const evaluationPrompt = `Evaluate this security challenge response:

Challenge: ${challenge.title}
Scenario: ${challenge.scenario}
Objectives: ${challenge.objectives.join(', ')}

User's Responses:
${responses}

Evaluation Criteria:
1. Did they identify the security threat correctly?
2. Did they propose appropriate defensive measures?
3. Did they follow security best practices?
4. Did they consider all objectives?
5. Was their reasoning sound?

Provide a score from 0-100 and constructive feedback.`

    const aiEvaluation = await VeniceAIService.generateSecurityResponse(
      evaluationPrompt,
      [{ role: 'system', content: 'You are an expert cybersecurity instructor evaluating a student\'s challenge response. Provide constructive feedback and a numerical score.' }],
      { username: 'Instructor' }
    )

    // Parse AI evaluation to extract score
    const scoreMatch = aiEvaluation.match(/\b(\d{1,3})\/100\b/)
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50
    const passed = score >= 70

    // Calculate XP reward
    let xpEarned = 0
    if (passed) {
      xpEarned = challenge.xpReward
      // Reduce XP for hints
      xpEarned -= hintsUsed * 5
      // Bonus for quick completion
      if (challenge.timeLimit && timeSpent < challenge.timeLimit * 30) {
        xpEarned += 10
      }
      xpEarned = Math.max(10, xpEarned)
    } else {
      xpEarned = 5 // Participation XP
    }

    // Generate detailed feedback
    const feedback = passed
      ? `🎉 Excellent work! ${aiEvaluation}\n\nYou earned ${xpEarned} XP!`
      : `Keep practicing! ${aiEvaluation}\n\nYou earned ${xpEarned} XP for participating. Try again to improve your score!`

    return NextResponse.json({
      success: true,
      passed,
      score,
      xpEarned,
      timeSpent,
      hintsUsed,
      feedback,
      challengeId,
      sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Evaluation error:', error)
    
    return NextResponse.json({
      success: false,
      passed: false,
      score: 0,
      xpEarned: 5,
      feedback: "Unable to evaluate your response at this time. You've earned 5 XP for participating!",
      timestamp: new Date().toISOString()
    })
  }
}