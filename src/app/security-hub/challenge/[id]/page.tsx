'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWallet } from '@/components/solana/solana-provider'
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, Clock,
  Lightbulb, Send, ArrowLeft, Trophy, Target, Brain,
  AlertOctagon, Lock, Users, Mail, Key, Globe
} from 'lucide-react'
import { toast } from 'sonner'

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
  simulationType?: string
}

interface ChallengeAttempt {
  challengeId: string
  answers: Record<string, any>
  timeSpent: number
  hintsUsed: number
}

export default function ChallengePage() {
  const params = useParams()
  const router = useRouter()
  const { connected, publicKey } = useWallet()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [attemptStarted, setAttemptStarted] = useState(false)
  const [startTime, setStartTime] = useState<number>(0)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [hintsRevealed, setHintsRevealed] = useState<number[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [attemptResult, setAttemptResult] = useState<any>(null)

  useEffect(() => {
    loadChallenge()
  }, [params.id])

  useEffect(() => {
    if (attemptStarted && challenge?.timeLimit) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const remaining = (challenge.timeLimit * 60) - elapsed
        setTimeRemaining(Math.max(0, remaining))
        
        if (remaining <= 0) {
          submitChallenge(true)
        }
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [attemptStarted, startTime, challenge])

  const loadChallenge = async () => {
    try {
      setLoading(true)
      // Get challenge details from the API
      const response = await fetch('/api/security-challenges?limit=100')
      const data = await response.json()
      
      if (data.success) {
        const foundChallenge = data.challenges.find((c: Challenge) => c._id === params.id)
        if (foundChallenge) {
          setChallenge(foundChallenge)
          if (foundChallenge.timeLimit) {
            setTimeRemaining(foundChallenge.timeLimit * 60)
          }
        } else {
          toast.error('Challenge not found')
          router.push('/security-hub')
        }
      }
    } catch (error) {
      console.error('Error loading challenge:', error)
      toast.error('Failed to load challenge')
    } finally {
      setLoading(false)
    }
  }

  const startChallenge = async () => {
    if (!connected) {
      toast.error('Please connect wallet to start challenge')
      return
    }

    try {
      const response = await fetch('/api/security-challenges/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          challengeId: challenge?._id,
          userId: publicKey?.toString(),
          username: publicKey?.toString().slice(0, 8)
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setAttemptStarted(true)
        setStartTime(Date.now())
        toast.success('Challenge started!')
      }
    } catch (error) {
      console.error('Error starting challenge:', error)
      toast.error('Failed to start challenge')
    }
  }

  const revealHint = (index: number) => {
    if (!hintsRevealed.includes(index)) {
      setHintsRevealed([...hintsRevealed, index])
      toast.info(`Hint revealed (-${challenge?.hints?.[index]?.cost} XP)`)
    }
  }

  const submitChallenge = async (timeout = false) => {
    if (submitting) return
    
    try {
      setSubmitting(true)
      
      const attempt: ChallengeAttempt = {
        challengeId: challenge!._id,
        answers,
        timeSpent: Math.floor((Date.now() - startTime) / 1000),
        hintsUsed: hintsRevealed.length
      }
      
      const response = await fetch('/api/security-challenges/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...attempt,
          userId: publicKey?.toString(),
          timeout
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setAttemptResult(data)
        if (data.passed) {
          toast.success(`Challenge completed! +${data.xpEarned} XP`)
        } else {
          toast.error('Challenge failed. Try again!')
        }
      }
    } catch (error) {
      console.error('Error submitting challenge:', error)
      toast.error('Failed to submit challenge')
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'phishing': return <Mail className="w-5 h-5" />
      case 'social_engineering': return <Users className="w-5 h-5" />
      case 'malware': return <AlertOctagon className="w-5 h-5" />
      case 'password': return <Key className="w-5 h-5" />
      case 'network': return <Globe className="w-5 h-5" />
      case 'crypto': return <Lock className="w-5 h-5" />
      default: return <Shield className="w-5 h-5" />
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-500'
      case 'intermediate': return 'text-yellow-500'
      case 'advanced': return 'text-orange-500'
      case 'expert': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Challenge Not Found</h2>
        <button
          onClick={() => router.push('/security-hub')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Back to Security Hub
        </button>
      </div>
    )
  }

  if (attemptResult) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="p-6 rounded-xl border border-border bg-muted/30">
          <div className="flex items-center justify-center mb-6">
            {attemptResult.passed ? (
              <CheckCircle className="w-16 h-16 text-green-500" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-center mb-4">
            {attemptResult.passed ? 'Challenge Completed!' : 'Challenge Failed'}
          </h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between p-3 rounded-lg bg-background/50">
              <span>Score</span>
              <span className="font-semibold">{attemptResult.score}/100</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-background/50">
              <span>XP Earned</span>
              <span className="font-semibold text-primary">+{attemptResult.xpEarned} XP</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-background/50">
              <span>Time Spent</span>
              <span className="font-semibold">{formatTime(attemptResult.timeSpent)}</span>
            </div>
            {attemptResult.badge && (
              <div className="flex justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20">
                <span>Badge Earned</span>
                <span className="font-semibold text-yellow-500">{attemptResult.badge}</span>
              </div>
            )}
          </div>
          
          {attemptResult.feedback && (
            <div className="p-4 rounded-lg bg-background/50 mb-6">
              <h3 className="font-semibold mb-2">Feedback</h3>
              <p className="text-sm text-muted-foreground">{attemptResult.feedback}</p>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/security-hub')}
              className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Back to Hub
            </button>
            {!attemptResult.passed && (
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/security-hub')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Security Hub
        </button>
        
        {attemptStarted && challenge.timeLimit && (
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
            timeRemaining < 60 ? 'bg-red-500/10 text-red-500' : 'bg-muted'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      {/* Challenge Info */}
      <div className="p-6 rounded-xl border border-border bg-muted/30 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">{challenge.title}</h1>
            <p className="text-muted-foreground">{challenge.description}</p>
          </div>
          <div className="text-right">
            <span className={`block text-sm font-medium mb-1 ${getDifficultyColor(challenge.difficulty)}`}>
              {challenge.difficulty}
            </span>
            <span className="text-xs text-muted-foreground">
              {challenge.xpReward} XP
            </span>
          </div>
        </div>
        
        <div className="flex gap-2 mb-4">
          <span className="px-2 py-1 text-xs bg-background/50 rounded flex items-center gap-1">
            {getCategoryIcon(challenge.category)}
            {challenge.category}
          </span>
          {challenge.simulationType && (
            <span className="px-2 py-1 text-xs bg-background/50 rounded">
              {challenge.simulationType}
            </span>
          )}
          {challenge.timeLimit && (
            <span className="px-2 py-1 text-xs bg-background/50 rounded flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {challenge.timeLimit} min
            </span>
          )}
        </div>

        {/* Scenario */}
        <div className="p-4 rounded-lg bg-background/50 mb-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Scenario
          </h3>
          <p className="text-sm">{challenge.scenario}</p>
        </div>

        {/* Objectives */}
        <div className="p-4 rounded-lg bg-background/50 mb-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Objectives
          </h3>
          <ul className="space-y-1">
            {challenge.objectives.map((objective, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Hints */}
        {challenge.hints && challenge.hints.length > 0 && attemptStarted && (
          <div className="p-4 rounded-lg bg-background/50 mb-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              Hints Available
            </h3>
            <div className="space-y-2">
              {challenge.hints.map((hint, index) => (
                <div key={index} className="flex items-center justify-between">
                  {hintsRevealed.includes(index) ? (
                    <p className="text-sm text-muted-foreground">{hint.text}</p>
                  ) : (
                    <button
                      onClick={() => revealHint(index)}
                      className="text-sm px-3 py-1 bg-muted rounded hover:bg-muted/80 transition-colors"
                    >
                      Reveal Hint (-{hint.cost} XP)
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answer Section */}
        {attemptStarted && (
          <div className="p-4 rounded-lg bg-background/50 mb-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Your Response
            </h3>
            <textarea
              className="w-full p-3 rounded-lg bg-background border border-border focus:border-primary focus:outline-none transition-colors"
              rows={6}
              placeholder="Describe how you would handle this scenario..."
              value={answers.response || ''}
              onChange={(e) => setAnswers({ ...answers, response: e.target.value })}
            />
            
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Quick Actions (select all that apply):</h4>
              {[
                'Report to IT/Security',
                'Document the incident',
                'Alert colleagues',
                'Change passwords',
                'Enable 2FA',
                'Review logs',
                'Isolate affected systems',
                'Contact authorities'
              ].map((action) => (
                <label key={action} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={answers[action] || false}
                    onChange={(e) => setAnswers({ ...answers, [action]: e.target.checked })}
                    className="rounded border-border"
                  />
                  {action}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!attemptStarted ? (
            <button
              onClick={startChallenge}
              disabled={!connected}
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              Start Challenge
            </button>
          ) : (
            <button
              onClick={() => submitChallenge()}
              disabled={submitting || !answers.response}
              className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Answer
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}