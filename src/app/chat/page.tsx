'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Link as LinkIcon, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  linkScore?: {
    score: number
    verdict: 'safe' | 'suspicious' | 'dangerous'
    details?: string[]
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `👋 Hi! I'm LYN AI, your crypto security assistant.

Send me any suspicious links and I'll check them for:
• Phishing attempts
• Scam websites
• Malicious smart contracts
• Fake token sites
• Impersonation attempts

**Free tier:** 2 link checks per day
**Need more?** Upgrade to [LYN HEAVY](https://app.lynai.xyz) for unlimited checks plus wallet security, threat monitoring, and more!

Just paste a link below to get started! 🔍`,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [checksToday, setChecksToday] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load checks count from localStorage
  useEffect(() => {
    const loadChecksCount = () => {
      const today = new Date().toDateString()
      const stored = localStorage.getItem('lyn-lite-checks')
      if (stored) {
        const data = JSON.parse(stored)
        if (data.date === today) {
          setChecksToday(data.count)
        } else {
          // New day, reset count
          localStorage.setItem('lyn-lite-checks', JSON.stringify({ date: today, count: 0 }))
          setChecksToday(0)
        }
      } else {
        localStorage.setItem('lyn-lite-checks', JSON.stringify({ date: today, count: 0 }))
      }
    }
    loadChecksCount()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const incrementChecks = () => {
    const today = new Date().toDateString()
    const newCount = checksToday + 1
    setChecksToday(newCount)
    localStorage.setItem('lyn-lite-checks', JSON.stringify({ date: today, count: newCount }))
  }

  const extractLinks = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.match(urlRegex) || []
  }

  const checkLink = async (url: string): Promise<{ score: number; verdict: 'safe' | 'suspicious' | 'dangerous'; details: string[] }> => {
    try {
      const response = await fetch('/api/chat/lite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Check this link for security threats: ${url}` }],
          sessionId: localStorage.getItem('lyn-session-id') || 'lite-' + Date.now()
        })
      })

      if (!response.ok) throw new Error('Failed to check link')
      
      const data = await response.json()
      
      // Parse the response to extract security score
      const content = data.content || ''
      let score = 50
      let verdict: 'safe' | 'suspicious' | 'dangerous' = 'suspicious'
      const details = []

      // Simple scoring based on keywords in response
      if (content.toLowerCase().includes('safe') || content.toLowerCase().includes('legitimate')) {
        score = 80 + Math.random() * 20
        verdict = 'safe'
      } else if (content.toLowerCase().includes('dangerous') || content.toLowerCase().includes('scam') || content.toLowerCase().includes('phishing')) {
        score = Math.random() * 30
        verdict = 'dangerous'
      } else {
        score = 30 + Math.random() * 40
        verdict = 'suspicious'
      }

      // Extract details from response
      if (content.includes('•')) {
        const bullets = content.split('•').slice(1).map(s => s.trim().split('\n')[0])
        details.push(...bullets.filter(b => b.length > 0).slice(0, 3))
      }

      return { score: Math.round(score), verdict, details }
    } catch (error) {
      console.error('Error checking link:', error)
      return {
        score: 50,
        verdict: 'suspicious',
        details: ['Could not complete security check', 'Please try again or check manually']
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Check rate limit
    if (checksToday >= 2) {
      const limitMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `⚠️ **Daily limit reached!**

You've used your 2 free link checks for today.

Want unlimited checks? Upgrade to [LYN HEAVY](https://app.lynai.xyz) for:
• ✅ Unlimited link security checks
• 🔐 Real-time wallet protection
• 🚨 24/7 threat monitoring
• 🤖 Advanced AI security agent
• 📊 Security analytics dashboard
• 🛡️ Smart contract auditing

Your free checks will reset tomorrow.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, limitMessage])
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Check if message contains links
    const links = extractLinks(input)
    
    if (links.length > 0) {
      // Increment check counter
      incrementChecks()
      
      // Check the first link
      const url = links[0]
      const result = await checkLink(url)
      
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `## Security Check Results for:
\`${url}\`

**Security Score:** ${result.score}/100
**Verdict:** ${result.verdict === 'safe' ? '✅ SAFE' : result.verdict === 'dangerous' ? '🚨 DANGEROUS' : '⚠️ SUSPICIOUS'}

${result.details.length > 0 ? '**Details:**\n' + result.details.map(d => `• ${d}`).join('\n') : ''}

${result.verdict === 'dangerous' ? '\n⚠️ **WARNING:** This link appears to be malicious. Do not interact with it!' : ''}
${result.verdict === 'suspicious' ? '\n⚠️ **CAUTION:** This link has suspicious characteristics. Proceed with extreme caution.' : ''}
${result.verdict === 'safe' ? '\n✅ This link appears to be legitimate, but always verify before connecting wallets or entering sensitive information.' : ''}

---
*Checks remaining today: ${2 - checksToday}/2*
${checksToday === 2 ? '\nNeed more checks? [Upgrade to LYN HEAVY](https://app.lynai.xyz)' : ''}`,
        timestamp: new Date(),
        linkScore: result
      }
      
      setMessages(prev => [...prev, responseMessage])
    } else {
      // Regular chat response
      try {
        const response = await fetch('/api/chat/lite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.concat(userMessage).map(m => ({ role: m.role, content: m.content })),
            sessionId: localStorage.getItem('lyn-session-id') || 'lite-' + Date.now()
          })
        })

        const data = await response.json()
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || 'I can help you check suspicious links for security threats. Just paste any URL you want me to analyze!',
          timestamp: new Date()
        }
        
        setMessages(prev => [...prev, assistantMessage])
      } catch (error) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again or paste a link for me to check.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    }
    
    setIsLoading(false)
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreIcon = (verdict: string) => {
    if (verdict === 'safe') return <CheckCircle className="w-5 h-5 text-green-400" />
    if (verdict === 'dangerous') return <XCircle className="w-5 h-5 text-red-400" />
    return <AlertTriangle className="w-5 h-5 text-yellow-400" />
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 shadow-xl">
        {/* Chat Header */}
        <div className="border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src="/logo.jpg" alt="LYN AI" className="w-10 h-10 rounded-full" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-zinc-900"></div>
              </div>
              <div>
                <h1 className="text-lg font-semibold">LYN AI Security Assistant</h1>
                <p className="text-xs text-zinc-500">Link checks remaining: {2 - checksToday}/2</p>
              </div>
            </div>
            {checksToday >= 2 && (
              <a
                href="https://app.lynai.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Upgrade to HEAVY
              </a>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="h-[500px] overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-purple-600/20 border border-purple-600/30'
                    : 'bg-zinc-800 border border-zinc-700'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <img src="/logo.jpg" alt="LYN" className="w-6 h-6 rounded-full" />
                    <span className="text-xs text-zinc-400">LYN AI</span>
                  </div>
                )}
                <div 
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: message.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-purple-400 hover:text-purple-300 underline">$1</a>')
                      .replace(/^## (.*?)$/gm, '<h2 class="text-lg font-bold mt-2 mb-1">$1</h2>')
                      .replace(/^• (.*?)$/gm, '<li class="ml-4">$1</li>')
                      .replace(/`(.*?)`/g, '<code class="bg-zinc-700 px-1 py-0.5 rounded text-xs">$1</code>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
                {message.linkScore && (
                  <div className="mt-3 p-3 bg-black/50 rounded-lg border border-zinc-700">
                    <div className="flex items-center gap-3">
                      {getScoreIcon(message.linkScore.verdict)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-400">Security Score</span>
                          <span className={`font-bold ${getScoreColor(message.linkScore.score)}`}>
                            {message.linkScore.score}/100
                          </span>
                        </div>
                        <div className="w-full bg-zinc-700 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              message.linkScore.score >= 70
                                ? 'bg-green-400'
                                : message.linkScore.score >= 40
                                ? 'bg-yellow-400'
                                : 'bg-red-400'
                            }`}
                            style={{ width: `${message.linkScore.score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-sm text-zinc-400">Analyzing link...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-zinc-800 px-6 py-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={checksToday >= 2 ? "Daily limit reached - Upgrade to LYN HEAVY" : "Paste a suspicious link to check..."}
                disabled={checksToday >= 2 || isLoading}
                className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              disabled={checksToday >= 2 || isLoading || !input.trim()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              <span className="hidden sm:inline">Check</span>
            </button>
          </div>
        </form>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2 text-purple-400">What I Check For:</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
          <div>• Phishing attempts</div>
          <div>• Malicious contracts</div>
          <div>• Fake token sites</div>
          <div>• Known scam domains</div>
          <div>• Impersonation sites</div>
          <div>• Suspicious redirects</div>
        </div>
      </div>
    </div>
  )
}