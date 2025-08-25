import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiting for lite version
const rateLimitStore = new Map<string, { count: number; date: string }>()

// Clean up old entries periodically
setInterval(() => {
  const today = new Date().toDateString()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.date !== today) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const today = new Date().toDateString()
  const entry = rateLimitStore.get(identifier)
  
  if (!entry || entry.date !== today) {
    // New day or new user
    rateLimitStore.set(identifier, { count: 1, date: today })
    return { allowed: true, remaining: 1 }
  }
  
  if (entry.count >= 2) {
    return { allowed: false, remaining: 0 }
  }
  
  entry.count++
  return { allowed: true, remaining: 2 - entry.count }
}

// Helper function to extract client IP
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId } = await req.json()
    
    // Get identifier for rate limiting (session ID + IP)
    const ip = getClientIP(req)
    const identifier = `${sessionId || 'anonymous'}-${ip}`
    
    // Check if message contains a link
    const lastMessage = messages[messages.length - 1]?.content || ''
    const hasLink = /https?:\/\/[^\s]+/.test(lastMessage)
    
    // Only apply rate limiting for link checks
    if (hasLink) {
      const rateLimit = checkRateLimit(identifier)
      
      if (!rateLimit.allowed) {
        return NextResponse.json({
          content: `⚠️ **Daily limit reached!**

You've used your 2 free link checks for today.

Want unlimited checks? Upgrade to [LYN HEAVY](https://app.lynai.xyz) for:
• ✅ Unlimited link security checks
• 🔐 Real-time wallet protection  
• 🚨 24/7 threat monitoring
• 🤖 Advanced AI security agent
• 📊 Security analytics dashboard

Your free checks will reset tomorrow.`,
          remaining: 0
        }, { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '2',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
          }
        })
      }
    }
    
    // Forward to main chat API
    const response = await fetch(new URL('/api/chat', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, sessionId })
    })
    
    if (!response.ok) {
      throw new Error('Chat API failed')
    }
    
    const data = await response.json()
    
    // Add remaining count to response
    const entry = rateLimitStore.get(identifier)
    const remaining = entry ? 2 - entry.count : 2
    
    return NextResponse.json({
      ...data,
      remaining
    })
    
  } catch (error) {
    console.error('[Chat Lite] Error:', error)
    return NextResponse.json({
      content: 'Sorry, I encountered an error. Please try again.',
      error: true
    }, { status: 500 })
  }
}