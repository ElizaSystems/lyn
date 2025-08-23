'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWallet } from '@/components/solana/solana-provider'
import { ChallengeChat } from '@/components/security/challenge-chat'
import { 
  Shield, ArrowLeft, Trophy, CheckCircle, XCircle,
  AlertTriangle, Loader2
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

export default function ChallengePage() {
  const params = useParams()
  const router = useRouter()
  const { connected, publicKey } = useWallet()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [completionResult, setCompletionResult] = useState<any>(null)

  useEffect(() => {
    loadChallenge()
  }, [params.id])

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

  const handleChallengeComplete = (result: any) => {
    setCompletionResult(result)
    
    if (result.passed) {
      toast.success(`Challenge completed! You earned ${result.xpEarned} XP!`)
    } else {
      toast.info(`Good effort! You earned ${result.xpEarned} XP. Try again to improve your score!`)
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
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
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

  // Show completion screen if challenge is completed
  if (completionResult) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="p-6 rounded-xl border border-border bg-muted/30">
          <div className="flex items-center justify-center mb-6">
            {completionResult.passed ? (
              <div className="relative">
                <Trophy className="w-20 h-20 text-yellow-500" />
                <CheckCircle className="w-8 h-8 text-green-500 absolute -bottom-2 -right-2" />
              </div>
            ) : (
              <div className="relative">
                <Shield className="w-20 h-20 text-primary" />
                <XCircle className="w-8 h-8 text-orange-500 absolute -bottom-2 -right-2" />
              </div>
            )}
          </div>
          
          <h2 className="text-3xl font-bold text-center mb-4">
            {completionResult.passed ? 'Challenge Mastered!' : 'Challenge Complete'}
          </h2>
          
          <div className="text-center mb-6">
            <p className="text-lg text-muted-foreground">
              {completionResult.passed 
                ? 'Excellent work! You demonstrated strong security knowledge.'
                : 'Good effort! Review the feedback and try again to improve.'}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <p className="text-3xl font-bold text-primary">{completionResult.score}</p>
              <p className="text-sm text-muted-foreground">Score</p>
            </div>
            <div className="p-4 rounded-lg bg-background/50 text-center">
              <p className="text-3xl font-bold text-green-500">+{completionResult.xpEarned}</p>
              <p className="text-sm text-muted-foreground">XP Earned</p>
            </div>
          </div>
          
          {completionResult.feedback && (
            <div className="p-4 rounded-lg bg-background/50 mb-6">
              <h3 className="font-semibold mb-2">AI Feedback</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {completionResult.feedback}
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/security-hub')}
              className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Back to Security Hub
            </button>
            {!completionResult.passed && (
              <button
                onClick={() => {
                  setCompletionResult(null)
                  loadChallenge()
                }}
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/security-hub')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Security Hub
        </button>
        
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${getDifficultyColor(challenge.difficulty)}`}>
            {challenge.difficulty}
          </span>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">{challenge.category}</span>
        </div>
      </div>

      {/* Challenge Info */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
        <p className="text-lg text-muted-foreground">{challenge.description}</p>
      </div>

      {/* Notice for non-connected users */}
      {!connected && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-500">Wallet Connection Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your wallet to track progress, earn XP, and save your achievements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Interface */}
      <ChallengeChat 
        challenge={challenge}
        onComplete={handleChallengeComplete}
      />

      {/* Challenge Tips */}
      <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Challenge Tips
        </h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• Take your time to analyze the scenario thoroughly</li>
          <li>• Consider multiple security aspects and potential vulnerabilities</li>
          <li>• Explain your reasoning to demonstrate understanding</li>
          <li>• Use hints strategically - they reduce XP rewards</li>
          <li>• Learn from the AI feedback to improve your security knowledge</li>
        </ul>
      </div>
    </div>
  )
}