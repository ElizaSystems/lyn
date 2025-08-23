import { NextRequest, NextResponse } from 'next/server'
import { securityQuizService } from '@/lib/services/security-quiz-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')
    const count = parseInt(searchParams.get('count') || '10')
    
    // Initialize default questions if needed
    await securityQuizService.initializeDefaultQuestions()
    
    const questions = await securityQuizService.getQuizQuestions(
      category || undefined,
      difficulty || undefined,
      count
    )
    
    // Remove correct answer info from response
    const sanitizedQuestions = questions.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options.map(o => ({
        text: o.text
      })),
      category: q.category,
      difficulty: q.difficulty,
      hints: q.hints,
      imageUrl: q.imageUrl
    }))
    
    return NextResponse.json({
      success: true,
      questions: sanitizedQuestions
    })
  } catch (error) {
    console.error('Error getting quiz questions:', error)
    return NextResponse.json(
      { error: 'Failed to get questions' },
      { status: 500 }
    )
  }
}