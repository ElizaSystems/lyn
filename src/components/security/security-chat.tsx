'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CheckCircle, Send, Upload, FileText, Shield, Loader2, Bot, User, Sparkles, Info, Lock, Coins, Wallet, Activity, Clock, Zap, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWallet } from '@/components/solana/solana-provider'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  analysis?: {
    type: 'link' | 'document'
    safe: boolean
    risk_level?: 'low' | 'medium' | 'high' | 'critical'
    details?: string[]
    recommendations?: string[]
  }
  suggestions?: string[]
  securityTip?: string
}

interface UsageInfo {
  questionsAsked: number
  questionsRemaining?: number
  hasTokenAccess: boolean
  accessTier?: 'free' | 'basic' | 'premium' | 'elite' | 'unlimited'
  scansToday?: number
  scansRemaining?: number | 'unlimited'
  canScan?: boolean
  hoursUntilReset?: number
  upgradeMessage?: string
}

interface SecurityChatProps {
  initialMessage?: string
  onScanComplete?: () => void
}

export function SecurityChat({ initialMessage, onScanComplete }: SecurityChatProps = {}) {
  const { connected, publicKey } = useWallet()
  const [username, setUsername] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [sessionId] = useState(() => {
    // Get or create a persistent session ID
    if (typeof window !== 'undefined') {
      let storedId = localStorage.getItem('security-session-id')
      if (!storedId) {
        storedId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
        localStorage.setItem('security-session-id', storedId)
      }
      return storedId
    }
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
  })
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [usage, setUsage] = useState<UsageInfo>({ questionsAsked: 0, hasTokenAccess: false })
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [showTokenGate, setShowTokenGate] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch username and show personalized greeting
  useEffect(() => {
    const fetchUserInfo = async () => {
      // Try to get username from localStorage first (if previously fetched)
      const storedUsername = localStorage.getItem('user-username')
      if (storedUsername) {
        setUsername(storedUsername)
      }

      // If we have a wallet address, fetch the latest username from database
      if (publicKey) {
        try {
          const response = await fetch(`/api/user/info?walletAddress=${publicKey.toString()}`)
          if (response.ok) {
            const data = await response.json()
            if (data.username) {
              setUsername(data.username)
              localStorage.setItem('user-username', data.username)
            }
          }
        } catch (error) {
          console.error('Failed to fetch user info:', error)
        }
      }
    }

    fetchUserInfo()
  }, [publicKey])

  // Initialize messages with personalized greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = username 
        ? `Hello ${username}! I'm your cybersecurity assistant. I'm here to help you stay safe online by checking suspicious links and scanning documents for potential threats. How can I help protect you today?`
        : 'Hello! I\'m your cybersecurity assistant. I\'m here to help you stay safe online by checking suspicious links and scanning documents for potential threats. How can I help protect you today?'
      
      setMessages([
        initialMessage ? {
          id: '0',
          type: 'user' as const,
          content: initialMessage,
          timestamp: new Date(Date.now() - 1000)
        } : null,
        {
          id: '1',
          type: 'assistant',
          content: greeting,
          timestamp: new Date(),
          suggestions: [
            "I received a suspicious email with a link",
            "I want to scan a document for malware",
            "How do I identify phishing attempts?",
            "What are common online security threats?"
          ]
        }
      ].filter(Boolean) as Message[])
    }
  }, [username, initialMessage])

  // Check access when wallet connects/disconnects
  useEffect(() => {
    const checkAccess = async (walletAddress?: string) => {
      try {
        const response = await fetch('/api/security/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId, 
            walletAddress: publicKey?.toString()
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          setUsage({
            questionsAsked: data.questionsAsked || 0,
            questionsRemaining: data.questionsRemaining,
            hasTokenAccess: data.hasTokenAccess || false
          })
          setTokenBalance(data.tokenBalance || null)
        }
      } catch (error) {
        console.error('Failed to check access:', error)
      }
    }

    // Check access with wallet address if connected
    checkAccess(publicKey?.toString())
  }, [connected, publicKey, sessionId])


  const processAIResponse = async (userInput: string) => {
    try {
      const response = await fetch('/api/security/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userInput, 
          sessionId,
          walletAddress: publicKey?.toString(),
          username: username // Pass username to AI for personalization
        })
      })
      
      if (response.status === 403) {
        const data = await response.json()
        setShowTokenGate(true)
        return {
          message: data.message,
          suggestedAction: 'token_required',
          tokenInfo: data.tokenInfo
        }
      }
      
      if (!response.ok) throw new Error('AI response failed')
      
      const data = await response.json()
      
      // Update usage info
      if (data.usage) {
        setUsage(data.usage)
      }
      
      // Check if AI detected a URL to analyze
      if (data.suggestedAction === 'analyze_link' && data.extractedUrl) {
        // Automatically analyze the URL
        setTimeout(() => analyzeLink(data.extractedUrl), 500)
      }
      
      return data
    } catch (error) {
      console.error('AI chat error:', error)
      return {
        message: 'I apologize, but I encountered an error. Please try again or directly paste a link or upload a document for analysis.',
        suggestedAction: 'general_help'
      }
    }
  }

  const analyzeLink = async (url: string) => {
    setIsAnalyzing(true)
    
    const analyzingMessage: Message = {
      id: Date.now().toString() + '-analyzing',
      type: 'system',
      content: `🔍 Analyzing link: ${url}\n\n⏳ Checking against multiple threat intelligence sources:\n• VirusTotal - Scanning...\n• Google Safe Browsing - Scanning...\n• IPQualityScore - Scanning...\n• URLVoid - Scanning...\n• PhishTank - Scanning...\n• AbuseIPDB - Scanning...\n\nThis may take a few seconds for comprehensive analysis...`,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, analyzingMessage])
    
    try {
      const response = await fetch('/api/security/analyze-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({ url })
      })
      
      if (!response.ok) throw new Error('Analysis failed')
      
      const data = await response.json()
      
      // Create enhanced analysis message with threat source details
      let analysisContent = generateAnalysisMessage({ ...data, type: 'link' })
      
      // Add threat source breakdown if available
      if (data.threat_sources && data.threat_sources.length > 0) {
        analysisContent += '\n\n**Security Service Results:**\n'
        data.threat_sources.forEach((source: { name: string; safe: boolean; score: number; threats: string[] }) => {
          const icon = source.safe ? '✅' : '⚠️'
          analysisContent += `${icon} ${source.name}: Score ${source.score}/100`
          if (source.threats && source.threats.length > 0) {
            analysisContent += ` - ${source.threats.join(', ')}`
          }
          analysisContent += '\n'
        })
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: analysisContent,
        timestamp: new Date(),
        analysis: { ...data, type: 'link' },
        suggestions: [
          "Check another link",
          "How can I identify phishing emails?",
          "What makes a link suspicious?",
          "Upload a document to scan"
        ]
      }

      setMessages(prev => prev.filter(m => m.id !== analyzingMessage.id).concat(assistantMessage))
      
      // Call onScanComplete callback to refresh scan history
      if (onScanComplete) {
        onScanComplete()
      }
    } catch (error) {
      console.error('Link analysis error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '❌ Unable to analyze the link. Please ensure it\'s properly formatted and try again.',
        timestamp: new Date()
      }
      setMessages(prev => prev.filter(m => m.id !== analyzingMessage.id).concat(errorMessage))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analyzeDocument = async (file: File) => {
    setIsAnalyzing(true)
    
    const analyzingMessage: Message = {
      id: Date.now().toString() + '-analyzing',
      type: 'system',
      content: `📄 Scanning document: ${file.name}\n\n⏳ Performing comprehensive malware analysis:\n• Uploading to VirusTotal...\n• Checking against ${file.size > 1024 * 1024 ? Math.round(file.size / 1024 / 1024) + 'MB' : Math.round(file.size / 1024) + 'KB'} file\n• Scanning with multiple antivirus engines...\n• Analyzing file behavior and patterns...\n\nThis may take 5-15 seconds for thorough scanning...`,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, analyzingMessage])
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/security/analyze-document', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Session-Id': sessionId
        },
        body: formData
      })
      
      if (!response.ok) throw new Error('Analysis failed')
      
      const data = await response.json()
      
      // Create enhanced analysis message with scan details
      let analysisContent = generateAnalysisMessage({ ...data, type: 'document' })
      
      // Add scan source and details if available
      if (data.scan_source) {
        analysisContent += `\n\n**Scan Engine:** ${data.scan_source}`
      }
      if (data.scan_details && data.scan_details.stats) {
        const stats = data.scan_details.stats
        analysisContent += `\n**Detection Results:** ${stats.malicious || 0} malicious, ${stats.suspicious || 0} suspicious, ${stats.harmless || 0} clean`
      }
      if (data.threats_found && data.threats_found.length > 0) {
        analysisContent += `\n**Threats Detected:**\n${data.threats_found.map((t: string) => `• ${t}`).join('\n')}`
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: analysisContent,
        timestamp: new Date(),
        analysis: { ...data, type: 'document' },
        suggestions: [
          "Scan another document",
          "What types of malware exist?",
          "How to identify safe attachments?",
          "Check a suspicious link"
        ]
      }

      setMessages(prev => prev.filter(m => m.id !== analyzingMessage.id).concat(assistantMessage))
      
      // Call onScanComplete callback to refresh scan history
      if (onScanComplete) {
        onScanComplete()
      }
    } catch (error) {
      console.error('Document analysis error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '❌ Unable to analyze the document. Please ensure the file is not corrupted and try again.',
        timestamp: new Date()
      }
      setMessages(prev => prev.filter(m => m.id !== analyzingMessage.id).concat(errorMessage))
    } finally {
      setIsAnalyzing(false)
      setUploadedFile(null)
    }
  }

  const handleSubmit = async () => {
    if (!input.trim() && !uploadedFile) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: uploadedFile ? `Uploading document: ${uploadedFile.name}` : input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setShowSuggestions(false)

    if (uploadedFile) {
      await analyzeDocument(uploadedFile)
    } else {
      // Process through AI first
      setIsAnalyzing(true)
      const aiResponse = await processAIResponse(input)
      
      if (aiResponse.suggestedAction === 'token_required') {
        // Show token gate message
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: aiResponse.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        setIsAnalyzing(false)
      } else if (aiResponse.suggestedAction !== 'analyze_link' || !aiResponse.extractedUrl) {
        // If not auto-analyzing a link, show the AI response
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: aiResponse.message,
          timestamp: new Date(),
          suggestions: aiResponse.suggestions,
          securityTip: aiResponse.securityTip
        }
        setMessages(prev => [...prev, assistantMessage])
        setIsAnalyzing(false)
      }
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    setShowSuggestions(false)
  }

  const generateAnalysisMessage = (analysis: Message['analysis']) => {
    if (!analysis) return ''
    const { type, safe, risk_level, details, recommendations } = analysis
    
    let message = ''
    
    if (type === 'link') {
      if (safe) {
        message = '✅ **Link Analysis Complete**\n\nThis link appears to be safe. No phishing indicators were detected.'
      } else {
        const riskEmoji = risk_level === 'critical' ? '🚨' : risk_level === 'high' ? '⚠️' : risk_level === 'medium' ? '⚡' : 'ℹ️'
        message = `${riskEmoji} **Security Alert - Risk Level: ${risk_level?.toUpperCase()}**\n\nThis link shows signs of potential phishing.`
      }
    } else {
      if (safe) {
        message = '✅ **Document Scan Complete**\n\nThis document appears to be clean. No malicious code detected.'
      } else {
        const riskEmoji = risk_level === 'critical' ? '🚨' : risk_level === 'high' ? '⚠️' : risk_level === 'medium' ? '⚡' : 'ℹ️'
        message = `${riskEmoji} **Security Alert - Risk Level: ${risk_level?.toUpperCase()}**\n\nThis document may contain malicious code.`
      }
    }

    if (details && details.length > 0) {
      message += '\n\n**Findings:**\n' + details.map(d => `• ${d}`).join('\n')
    }

    if (recommendations && recommendations.length > 0) {
      message += '\n\n**Recommendations:**\n' + recommendations.map(r => `• ${r}`).join('\n')
    }

    return message
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setInput('')
    }
  }

  // Process initial message if provided
  useEffect(() => {
    if (initialMessage && messages.length === 2) {
      handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm rounded-xl border border-border/50">
      <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Security Assistant</h2>
            <Sparkles className="h-4 w-4 text-secondary" />
          </div>
          <div className="flex items-center gap-2">
            {usage.accessTier && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-sm",
                usage.accessTier === 'unlimited' ? 'bg-purple-500/10 text-purple-600' :
                usage.accessTier === 'elite' ? 'bg-green-500/10 text-green-600' :
                usage.accessTier === 'premium' ? 'bg-blue-500/10 text-blue-600' :
                usage.accessTier === 'basic' ? 'bg-cyan-500/10 text-cyan-600' :
                'bg-yellow-500/10 text-yellow-600'
              )}>
                {usage.accessTier === 'unlimited' && <Zap className="h-3 w-3" />}
                {usage.accessTier === 'elite' && <TrendingUp className="h-3 w-3" />}
                {usage.accessTier === 'premium' && <TrendingUp className="h-3 w-3" />}
                {usage.accessTier === 'basic' && <Activity className="h-3 w-3" />}
                {usage.accessTier === 'free' && <Info className="h-3 w-3" />}
                <span>
                  {usage.accessTier === 'unlimited' && 'Unlimited'}
                  {usage.accessTier === 'elite' && `${usage.scansRemaining}/250 scans today`}
                  {usage.accessTier === 'premium' && `${usage.scansRemaining}/20 scans today`}
                  {usage.accessTier === 'basic' && `${usage.scansRemaining}/2 scans today`}
                  {usage.accessTier === 'free' && `${usage.scansRemaining}/1 free scan`}
                </span>
              </div>
            )}
            {usage.hoursUntilReset && usage.accessTier !== 'unlimited' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-sm">
                <Clock className="h-3 w-3" />
                <span>Resets in {usage.hoursUntilReset}h</span>
              </div>
            )}
            {connected && tokenBalance !== null && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/10 text-sm">
                <Coins className="h-3 w-3" />
                <span>{tokenBalance.toLocaleString()} LYN</span>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered protection against phishing and malware
        </p>
      </div>

      {showTokenGate && !usage.hasTokenAccess && (
        <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Token Access Required</p>
              <p className="text-xs text-muted-foreground">
                {usage.accessTier === 'free' && 'Free tier: 1 scan/day • Upgrade with LYN tokens'}
                {usage.accessTier === 'basic' && 'Basic: 2 scans/day • 10k LYN'}
                {usage.accessTier === 'premium' && 'Premium: 20 scans/day • 100k LYN'}
                {usage.accessTier === 'elite' && 'Elite: 250 scans/day • 1M LYN'}
                {usage.accessTier === 'unlimited' && 'Unlimited scans • 10M LYN'}
                {!usage.accessTier && 'Get LYN tokens for more scans'}
              </p>
            </div>
            {!connected && (
              <Button
                size="sm"
                variant="outline"
                className="border-primary/30 hover:bg-primary/10"
                onClick={() => {
                  // Wallet connection would be handled here
                  console.log('Connect wallet functionality')
                }}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={cn(
                'flex gap-3',
                message.type === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.type !== 'user' && (
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  message.type === 'system' ? 'bg-yellow-500/20' : 'bg-gradient-to-br from-primary/20 to-secondary/20'
                )}>
                  {message.type === 'system' ? (
                    <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                  ) : (
                    <img 
                      src="/logo.jpg" 
                      alt="LYN AI" 
                      className="h-6 w-6 object-contain rounded-full"
                    />
                  )}
                </div>
              )}
              
              <div
                className={cn(
                  'max-w-[80%] rounded-lg p-3 space-y-2',
                  message.type === 'user'
                    ? 'bg-primary/20 text-foreground border border-primary/30'
                    : message.type === 'system'
                    ? 'bg-yellow-500/10 text-yellow-900 dark:text-yellow-100 border border-yellow-500/20'
                    : 'bg-card/50 backdrop-blur-sm border border-border/50'
                )}
              >
                {message.analysis && (
                  <div className="flex items-center gap-2 mb-2">
                    {message.analysis.safe ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle 
                        className={cn(
                          "h-4 w-4",
                          message.analysis.risk_level === 'critical' ? 'text-red-500' :
                          message.analysis.risk_level === 'high' ? 'text-orange-500' :
                          message.analysis.risk_level === 'medium' ? 'text-yellow-500' :
                          'text-blue-500'
                        )}
                      />
                    )}
                    <span className="text-sm font-medium">
                      {message.analysis.type === 'link' ? 'Link Analysis' : 'Document Analysis'}
                    </span>
                  </div>
                )}
                <div className="whitespace-pre-wrap">
                  {message.content.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <div key={i} className="font-semibold mt-2">{line.slice(2, -2)}</div>
                    }
                    return <div key={i}>{line}</div>
                  })}
                </div>
                <p className="text-xs opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              
              {message.type === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-secondary" />
                </div>
              )}
            </div>
            
            {message.securityTip && (
              <div className="ml-11 mt-2 p-2 bg-secondary/5 rounded-lg flex items-start gap-2 border border-secondary/20">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">{message.securityTip}</p>
              </div>
            )}
            
            {message.suggestions && showSuggestions && (
              <div className="ml-11 mt-2 flex flex-wrap gap-2">
                {message.suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {isAnalyzing && !messages.some(m => m.type === 'system') && (
          <div className="flex justify-start">
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2 border border-border/50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border/50 space-y-2">
        {uploadedFile && (
          <div className="flex items-center justify-between bg-card/50 backdrop-blur-sm rounded-lg p-2 border border-border/50">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-secondary" />
              <span className="text-sm">{uploadedFile.name}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setUploadedFile(null)}
              className="hover:bg-primary/10"
            >
              Remove
            </Button>
          </div>
        )}
        
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Ask about security, paste a link, or describe your concern..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setShowSuggestions(true)
            }}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            disabled={isAnalyzing || !!uploadedFile}
            className="flex-1 bg-input border-border/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.txt,.js,.py,.html,.exe,.zip,.xls,.xlsx,.ppt,.pptx"
            className="hidden"
          />
          
          <Button
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            title="Upload document to scan"
            className="border-border/50 hover:bg-primary/10 hover:border-primary/30"
          >
            <Upload className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={isAnalyzing || (!input.trim() && !uploadedFile)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <p className="text-xs text-center text-muted-foreground">
          Your security is our priority. Never share passwords or sensitive data.
        </p>
      </div>
    </div>
  )
}