import { NextRequest, NextResponse } from 'next/server'
import { VeniceAIService, ChatMessage } from '@/lib/services/venice-ai-service'

// Store conversation history per session
const conversations = new Map<string, ChatMessage[]>()

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId = 'default', context } = await request.json()
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, [])
    }
    const history = conversations.get(sessionId)!
    
    // Analyze user intent
    const intentAnalysis = await VeniceAIService.analyzeIntent(message)
    
    // Generate AI response
    const aiResponse = await VeniceAIService.generateSecurityResponse(
      message,
      history,
      {
        hasUrlToAnalyze: intentAnalysis.intent === 'check_url',
        hasFileToScan: intentAnalysis.intent === 'scan_file',
        previousAnalysisResult: context?.analysisResult
      }
    )
    
    // Update conversation history
    history.push({ role: 'user', content: message })
    history.push({ role: 'assistant', content: aiResponse })
    
    // Keep only last 20 messages to prevent token overflow
    if (history.length > 20) {
      conversations.set(sessionId, history.slice(-20))
    }
    
    // Generate contextual security tip
    const securityTip = Math.random() > 0.7 
      ? await VeniceAIService.generateSecurityTip(message)
      : null
    
    // Generate follow-up suggestions based on intent
    const suggestions = generateSuggestions(intentAnalysis.intent)
    
    // Clean up old sessions (simple memory management)
    if (conversations.size > 100) {
      const oldestKey = conversations.keys().next().value
      if (oldestKey) {
        conversations.delete(oldestKey)
      }
    }
    
    return NextResponse.json({
      message: aiResponse,
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      sentiment: intentAnalysis.sentiment,
      extractedUrl: intentAnalysis.extractedUrl,
      suggestedAction: intentAnalysis.intent === 'check_url' ? 'analyze_link' : undefined,
      securityTip,
      suggestions,
      sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Chat error:', error)
    
    // Provide a helpful fallback response
    return NextResponse.json({
      message: "I'm here to help with your security concerns. You can paste a suspicious link or upload a document for analysis. What would you like me to check?",
      intent: 'general_chat',
      confidence: 1,
      sentiment: 'neutral',
      suggestions: [
        "How do I identify phishing emails?",
        "Can you check if a link is safe?",
        "What are common online scams?",
        "How can I protect my accounts?"
      ],
      sessionId: 'default',
      timestamp: new Date().toISOString()
    })
  }
}

function generateSuggestions(intent: string): string[] {
  const suggestions: { [key: string]: string[] } = {
    'check_url': [
      "What makes a URL suspicious?",
      "How do phishing sites work?",
      "Check another link",
      "How to spot fake websites"
    ],
    'scan_file': [
      "What types of malware exist?",
      "How to identify infected files?",
      "Safe email attachment practices",
      "Upload another document"
    ],
    'ask_security': [
      "Best password practices",
      "How to enable 2FA",
      "Common security threats",
      "Protecting personal data online"
    ],
    'general_chat': [
      "Check a suspicious link",
      "Scan a document for malware",
      "Learn about phishing",
      "Security best practices"
    ]
  }
  
  return suggestions[intent] || suggestions['general_chat']
}