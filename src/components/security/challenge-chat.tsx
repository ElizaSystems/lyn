'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Send, Bot, User, Shield, Trophy, Brain, Target, 
  Sparkles, CheckCircle, XCircle, Clock, Lightbulb,
  AlertTriangle, Lock, Users, Mail, Key, Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWallet } from '@/components/solana/solana-provider'
import { toast } from 'sonner'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  hint?: boolean
  evaluation?: {
    correct: boolean
    score: number
    feedback: string
  }
}

interface Challenge {
  _id: string
  title: string
  description: string
  scenario: string
  objectives: string[]
  difficulty: string
  category: string
  timeLimit?: number
  xpReward: number
  hints?: { text: string; cost: number }[]
}

interface ChallengeChatProps {
  challenge: Challenge
  onComplete?: (result: any) => void
}

export function ChallengeChat({ challenge, onComplete }: ChallengeChatProps) {
  const { connected, publicKey } = useWallet()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionId] = useState(() => `challenge_${challenge._id}_${Date.now()}`)
  const [startTime] = useState(Date.now())
  const [timeRemaining, setTimeRemaining] = useState(challenge.timeLimit ? challenge.timeLimit * 60 : 0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [score, setScore] = useState(0)
  const [completed, setCompleted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Timer for time-limited challenges
  useEffect(() => {
    if (challenge.timeLimit && !completed) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const remaining = (challenge.timeLimit * 60) - elapsed
        setTimeRemaining(Math.max(0, remaining))
        
        if (remaining <= 0) {
          handleTimeout()
        }
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [challenge.timeLimit, startTime, completed])

  // Initialize challenge with AI scenario
  useEffect(() => {
    const initChallenge = async () => {
      // AI presents the scenario interactively
      const initialMessage: Message = {
        id: '1',
        type: 'assistant',
        content: `🛡️ **${challenge.title}**\n\n${challenge.scenario}\n\n**Your objectives:**\n${challenge.objectives.map(obj => `• ${obj}`).join('\n')}\n\nLet's work through this scenario together. How would you approach this situation?`,
        timestamp: new Date()
      }
      
      setMessages([initialMessage])

      // Start challenge session in backend
      if (connected && publicKey) {
        try {
          await fetch('/api/security-challenges/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              challengeId: challenge._id,
              sessionId
            })
          })
        } catch (error) {
          console.error('Failed to start challenge:', error)
        }
      }
    }

    initChallenge()
  }, [challenge, connected, publicKey])

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsProcessing(true)

    try {
      // Send to AI for evaluation and response
      const response = await fetch('/api/security-challenges/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          challengeId: challenge._id,
          sessionId,
          context: {
            scenario: challenge.scenario,
            objectives: challenge.objectives,
            hintsUsed,
            timeSpent: Math.floor((Date.now() - startTime) / 1000)
          }
        })
      })

      const data = await response.json()

      // AI response with guidance
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.message,
        timestamp: new Date(),
        evaluation: data.evaluation
      }

      setMessages(prev => [...prev, aiMessage])

      // Update score if provided
      if (data.evaluation?.score) {
        setScore(prev => Math.max(prev, data.evaluation.score))
      }

      // Check if challenge is completed
      if (data.completed) {
        handleCompletion(data)
      }

    } catch (error) {
      console.error('Failed to process message:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const requestHint = async () => {
    if (hintsUsed >= (challenge.hints?.length || 0)) {
      toast.error('No more hints available')
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch('/api/security-challenges/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge._id,
          sessionId,
          hintIndex: hintsUsed
        })
      })

      const data = await response.json()

      const hintMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `💡 **Hint ${hintsUsed + 1}:** ${data.hint}`,
        timestamp: new Date(),
        hint: true
      }

      setMessages(prev => [...prev, hintMessage])
      setHintsUsed(prev => prev + 1)
      toast.info(`Hint revealed (-${challenge.hints?.[hintsUsed]?.cost} XP)`)

    } catch (error) {
      console.error('Failed to get hint:', error)
      toast.error('Failed to get hint')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTimeout = () => {
    setCompleted(true)
    const timeoutMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: '⏰ Time\'s up! Let\'s review your approach.',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, timeoutMessage])
    
    // Submit final evaluation
    submitFinalAnswer()
  }

  const handleCompletion = (result: any) => {
    setCompleted(true)
    
    const completionMessage: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content: result.feedback || `Great work! You've completed the challenge with a score of ${result.score}/100.`,
      timestamp: new Date(),
      evaluation: {
        correct: result.passed,
        score: result.score,
        feedback: result.feedback
      }
    }
    
    setMessages(prev => [...prev, completionMessage])
    
    if (onComplete) {
      onComplete(result)
    }
  }

  const submitFinalAnswer = async () => {
    if (completed) return

    setIsProcessing(true)

    try {
      // Compile all user responses
      const userResponses = messages
        .filter(m => m.type === 'user')
        .map(m => m.content)
        .join('\n')

      const response = await fetch('/api/security-challenges/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge._id,
          sessionId,
          responses: userResponses,
          hintsUsed,
          timeSpent: Math.floor((Date.now() - startTime) / 1000)
        })
      })

      const result = await response.json()
      handleCompletion(result)

    } catch (error) {
      console.error('Failed to submit answer:', error)
      toast.error('Failed to submit answer')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'phishing': return <Mail className="w-4 h-4" />
      case 'social_engineering': return <Users className="w-4 h-4" />
      case 'malware': return <AlertTriangle className="w-4 h-4" />
      case 'password': return <Key className="w-4 h-4" />
      case 'network': return <Globe className="w-4 h-4" />
      case 'crypto': return <Lock className="w-4 h-4" />
      default: return <Shield className="w-4 h-4" />
    }
  }

  return (
    <div className="flex flex-col h-[600px] rounded-xl border border-border bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              {getCategoryIcon(challenge.category)}
            </div>
            <div>
              <h3 className="font-semibold">{challenge.title}</h3>
              <p className="text-xs text-muted-foreground">{challenge.difficulty} • {challenge.xpReward} XP</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Score */}
            {score > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 text-primary">
                <Trophy className="w-4 h-4" />
                <span className="text-sm font-medium">{score}/100</span>
              </div>
            )}
            
            {/* Timer */}
            {challenge.timeLimit && !completed && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg",
                timeRemaining < 60 ? "bg-red-500/10 text-red-500" : "bg-muted"
              )}>
                <Clock className="w-4 h-4" />
                <span className="font-mono text-sm">{formatTime(timeRemaining)}</span>
              </div>
            )}
            
            {/* Hints */}
            {challenge.hints && challenge.hints.length > 0 && !completed && (
              <Button
                onClick={requestHint}
                disabled={isProcessing || hintsUsed >= challenge.hints.length}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Lightbulb className="w-4 h-4" />
                Hint ({hintsUsed}/{challenge.hints.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.type === 'user' && "flex-row-reverse"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              message.type === 'user' 
                ? "bg-primary/10" 
                : message.type === 'system'
                ? "bg-yellow-500/10"
                : "bg-gradient-to-br from-primary/10 to-accent/10"
            )}>
              {message.type === 'user' ? (
                <User className="w-4 h-4 text-primary" />
              ) : message.type === 'system' ? (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              ) : (
                <Bot className="w-4 h-4 text-primary" />
              )}
            </div>
            
            <div className={cn(
              "max-w-[75%] rounded-lg p-3",
              message.type === 'user' 
                ? "bg-primary text-primary-foreground" 
                : message.hint
                ? "bg-yellow-500/10 border border-yellow-500/20"
                : message.evaluation
                ? message.evaluation.correct
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
                : "bg-muted"
            )}>
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              
              {message.evaluation && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    {message.evaluation.correct ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-xs font-medium">
                      Score: {message.evaluation.score}/100
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!completed && (
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Describe your approach to this security challenge..."
              disabled={isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isProcessing}
              size="icon"
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Completion Actions */}
      {completed && (
        <div className="p-4 border-t border-border">
          <Button
            onClick={submitFinalAnswer}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                Evaluating...
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 mr-2" />
                Complete Challenge
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}