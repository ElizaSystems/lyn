'use client'
import { useState, useEffect } from 'react'
import { useWallet } from '@/components/solana/solana-provider'
import { useRouter } from 'next/navigation'
import { 
  Shield, Brain, AlertTriangle, Trophy, BookOpen, Target,
  TrendingUp, Award, Users, Zap, Clock, ChevronRight,
  Info, Heart, Flag, Play, HelpCircle, CheckCircle,
  XCircle, Timer, Star, Flame, MessageSquare
} from 'lucide-react'
import { toast } from 'sonner'

export default function SecurityHubPage() {
  const { connected, publicKey } = useWallet()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('tips')
  const [dailyTip, setDailyTip] = useState<any>(null)
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  const [quizSession, setQuizSession] = useState<any>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [quizScore, setQuizScore] = useState(0)
  const [challenges, setChallenges] = useState<any[]>([])
  const [phishingReports, setPhishingReports] = useState<any[]>([])
  const [userStats, setUserStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDailyTip()
    loadChallenges()
    loadPhishingReports()
    if (connected) {
      loadUserStats()
    }
  }, [connected])

  const loadDailyTip = async () => {
    try {
      const response = await fetch('/api/security-tips/daily')
      const data = await response.json()
      if (data.success) {
        setDailyTip(data.tip)
      }
    } catch (error) {
      console.error('Error loading daily tip:', error)
    }
  }

  const loadChallenges = async () => {
    try {
      const response = await fetch('/api/security-challenges?limit=5')
      const data = await response.json()
      if (data.success) {
        setChallenges(data.challenges)
      }
    } catch (error) {
      console.error('Error loading challenges:', error)
    }
  }

  const loadPhishingReports = async () => {
    try {
      const response = await fetch('/api/phishing-report?status=pending&limit=5')
      const data = await response.json()
      if (data.success) {
        setPhishingReports(data.reports)
      }
    } catch (error) {
      console.error('Error loading phishing reports:', error)
    }
  }

  const loadUserStats = async () => {
    try {
      const [quizStats, challengeStats] = await Promise.all([
        fetch('/api/security-quiz/stats').then(r => r.json()),
        fetch('/api/security-challenges/stats').then(r => r.json())
      ])
      
      setUserStats({
        quiz: quizStats.stats,
        challenges: challengeStats.stats
      })
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const startQuiz = async (category?: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/security-quiz/questions?category=${category || ''}&count=5`)
      const data = await response.json()
      
      if (data.success && data.questions.length > 0) {
        setQuizQuestions(data.questions)
        setCurrentQuizIndex(0)
        setQuizScore(0)
        setSelectedAnswer(null)
        setShowExplanation(false)
        
        if (connected) {
          const sessionResponse = await fetch('/api/security-quiz/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionIds: data.questions.map((q: any) => q._id)
            })
          })
          const sessionData = await sessionResponse.json()
          if (sessionData.success) {
            setQuizSession(sessionData)
          }
        }
        
        setActiveTab('quiz')
      }
    } catch (error) {
      console.error('Error starting quiz:', error)
      toast.error('Failed to start quiz')
    } finally {
      setLoading(false)
    }
  }

  const submitQuizAnswer = async () => {
    if (selectedAnswer === null) return
    
    try {
      if (quizSession?.sessionId) {
        const response = await fetch('/api/security-quiz/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: quizSession.sessionId,
            questionId: quizQuestions[currentQuizIndex]._id,
            answer: selectedAnswer,
            timeSpent: 30,
            hintsUsed: 0
          })
        })
        
        const data = await response.json()
        if (data.correct) {
          setQuizScore(quizScore + 1)
          toast.success(`Correct! +${data.xpEarned} XP`)
        } else {
          toast.error('Incorrect answer')
        }
      }
      
      setShowExplanation(true)
    } catch (error) {
      console.error('Error submitting answer:', error)
    }
  }

  const nextQuestion = () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1)
      setSelectedAnswer(null)
      setShowExplanation(false)
    } else {
      completeQuiz()
    }
  }

  const completeQuiz = async () => {
    if (quizSession?.sessionId) {
      try {
        const response = await fetch('/api/security-quiz/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: quizSession.sessionId
          })
        })
        
        const data = await response.json()
        if (data.success) {
          toast.success(`Quiz completed! Score: ${quizScore}/${quizQuestions.length} | +${data.results.xpEarned} XP`)
        }
      } catch (error) {
        console.error('Error completing quiz:', error)
      }
    }
    
    setActiveTab('tips')
    loadUserStats()
  }

  const likeTip = async () => {
    if (!dailyTip || !connected) return
    
    try {
      const response = await fetch('/api/security-tips/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipId: dailyTip._id })
      })
      
      const data = await response.json()
      if (data.success) {
        setDailyTip({ ...dailyTip, likes: dailyTip.likes + 1 })
        toast.success('+1 XP for engagement!')
      }
    } catch (error) {
      console.error('Error liking tip:', error)
    }
  }

  const startChallenge = async (challengeId: string) => {
    if (!connected) {
      toast.error('Please connect wallet to start challenges')
      return
    }
    
    try {
      const response = await fetch('/api/security-challenges/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId })
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success('Challenge started!')
        router.push(`/security-hub/challenge/${challengeId}`)
      }
    } catch (error) {
      console.error('Error starting challenge:', error)
      toast.error('Failed to start challenge')
    }
  }

  const reportPhishing = () => {
    router.push('/security-hub/report-phishing')
  }

  const voteOnReport = async (reportId: string, vote: string) => {
    if (!connected) {
      toast.error('Please connect wallet to vote')
      return
    }
    
    try {
      const response = await fetch('/api/phishing-report/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, vote })
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success('+1 XP for voting!')
        loadPhishingReports()
      }
    } catch (error) {
      console.error('Error voting:', error)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
      case 'beginner':
        return 'text-green-500'
      case 'medium':
      case 'intermediate':
        return 'text-yellow-500'
      case 'hard':
      case 'advanced':
        return 'text-orange-500'
      case 'expert':
        return 'text-red-500'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Security Hub</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Learn, Practice, and Stay Safe</p>
              </div>
            </div>
            {connected && userStats && (
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span>{userStats.quiz?.totalScore || 0} Quiz Points</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>{userStats.quiz?.currentStreak || 0} Day Streak</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-6 overflow-x-auto">
            {[
              { id: 'tips', label: 'Daily Tips', icon: BookOpen },
              { id: 'quiz', label: 'Security Quiz', icon: Brain },
              { id: 'challenges', label: 'Challenges', icon: Target },
              { id: 'phishing', label: 'Phishing Reports', icon: AlertTriangle }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Daily Tips Tab */}
        {activeTab === 'tips' && (
          <div className="space-y-6">
            {/* Today's Tip */}
            {dailyTip && (
              <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Today's Security Tip</h2>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full bg-background/50 ${getDifficultyColor(dailyTip.difficulty)}`}>
                    {dailyTip.difficulty}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold mb-3">{dailyTip.title}</h3>
                <p className="text-muted-foreground mb-4">{dailyTip.content}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {dailyTip.tags?.map((tag: string) => (
                      <span key={tag} className="px-2 py-1 text-xs bg-background/50 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={likeTip}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">{dailyTip.likes || 0}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => startQuiz()}
                className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Brain className="w-8 h-8 text-primary" />
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-left">Take Daily Quiz</h3>
                <p className="text-sm text-muted-foreground text-left">Test your security knowledge</p>
              </button>

              <button
                onClick={() => setActiveTab('challenges')}
                className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-8 h-8 text-primary" />
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-left">Security Challenges</h3>
                <p className="text-sm text-muted-foreground text-left">Practice real scenarios</p>
              </button>

              <button
                onClick={reportPhishing}
                className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Flag className="w-8 h-8 text-primary" />
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-left">Report Phishing</h3>
                <p className="text-sm text-muted-foreground text-left">Help the community</p>
              </button>
            </div>

            {/* Stats Overview */}
            {connected && userStats && (
              <div className="p-6 rounded-xl border border-border bg-muted/30">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Your Progress
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-2xl font-bold">{userStats.quiz?.totalQuizzes || 0}</p>
                    <p className="text-sm text-muted-foreground">Quizzes Taken</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{userStats.challenges?.completedChallenges || 0}</p>
                    <p className="text-sm text-muted-foreground">Challenges Done</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{userStats.quiz?.totalXpEarned || 0}</p>
                    <p className="text-sm text-muted-foreground">XP Earned</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{userStats.quiz?.longestStreak || 0}</p>
                    <p className="text-sm text-muted-foreground">Best Streak</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div className="space-y-6">
            {quizQuestions.length > 0 ? (
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Question {currentQuizIndex + 1} of {quizQuestions.length}
                  </span>
                  <span className="text-sm font-medium">
                    Score: {quizScore}/{quizQuestions.length}
                  </span>
                </div>

                <div className="p-6 rounded-xl border border-border bg-muted/30">
                  <div className="mb-4">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full bg-background/50 mb-3 ${
                      getDifficultyColor(quizQuestions[currentQuizIndex]?.difficulty)
                    }`}>
                      {quizQuestions[currentQuizIndex]?.difficulty}
                    </span>
                    <h3 className="text-lg font-semibold mb-4">
                      {quizQuestions[currentQuizIndex]?.question}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {quizQuestions[currentQuizIndex]?.options.map((option: any, index: number) => (
                      <button
                        key={index}
                        onClick={() => !showExplanation && setSelectedAnswer(index)}
                        disabled={showExplanation}
                        className={`w-full p-4 rounded-lg border text-left transition-all ${
                          selectedAnswer === index
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        } ${
                          showExplanation && option.isCorrect
                            ? 'border-green-500 bg-green-500/10'
                            : ''
                        } ${
                          showExplanation && selectedAnswer === index && !option.isCorrect
                            ? 'border-red-500 bg-red-500/10'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.text}</span>
                          {showExplanation && (
                            option.isCorrect ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : selectedAnswer === index ? (
                              <XCircle className="w-5 h-5 text-red-500" />
                            ) : null
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {!showExplanation ? (
                    <button
                      onClick={submitQuizAnswer}
                      disabled={selectedAnswer === null}
                      className="mt-6 w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <div className="mt-6">
                      <div className="p-4 rounded-lg bg-background/50 mb-4">
                        <p className="text-sm">{quizQuestions[currentQuizIndex]?.explanation || 'No explanation available'}</p>
                      </div>
                      <button
                        onClick={nextQuestion}
                        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        {currentQuizIndex < quizQuestions.length - 1 ? 'Next Question' : 'Complete Quiz'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start a Security Quiz</h3>
                <p className="text-muted-foreground mb-6">Test your knowledge and earn XP</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => startQuiz()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Random Quiz
                  </button>
                  <button
                    onClick={() => startQuiz('phishing')}
                    className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Phishing Quiz
                  </button>
                  <button
                    onClick={() => startQuiz('crypto')}
                    className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Crypto Security
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {challenges.map((challenge) => (
                <div key={challenge._id} className="p-6 rounded-xl border border-border bg-muted/30 hover:bg-muted/40 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{challenge.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{challenge.description}</p>
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

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="px-2 py-1 text-xs bg-background/50 rounded">
                        {challenge.category}
                      </span>
                      <span className="px-2 py-1 text-xs bg-background/50 rounded">
                        {challenge.simulationType}
                      </span>
                      {challenge.timeLimit && (
                        <span className="px-2 py-1 text-xs bg-background/50 rounded flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {challenge.timeLimit} min
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => startChallenge(challenge._id)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start Challenge
                    </button>
                  </div>

                  {challenge.completions > 0 && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{challenge.completions} completions</span>
                      <span>Avg score: {Math.round(challenge.averageScore)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {challenges.length === 0 && (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Challenges Available</h3>
                <p className="text-muted-foreground">Check back later for new security challenges</p>
              </div>
            )}
          </div>
        )}

        {/* Phishing Reports Tab */}
        {activeTab === 'phishing' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Community Phishing Reports</h2>
              <button
                onClick={reportPhishing}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Flag className="w-4 h-4" />
                Report Phishing
              </button>
            </div>

            <div className="space-y-4">
              {phishingReports.map((report) => (
                <div key={report._id} className="p-4 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-background/50 mb-2">
                        {report.category}
                      </span>
                      <p className="text-sm font-medium mb-1">
                        {report.url || report.email || 'Suspicious Content'}
                      </p>
                      <p className="text-xs text-muted-foreground">{report.description}</p>
                    </div>
                    <span className={`text-xs font-medium ${
                      report.severity === 'critical' ? 'text-red-500' :
                      report.severity === 'high' ? 'text-orange-500' :
                      report.severity === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {report.severity}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => voteOnReport(report._id, 'legitimate')}
                        className="px-3 py-1 text-xs bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors"
                      >
                        Legitimate ({report.communityVotes?.legitimate || 0})
                      </button>
                      <button
                        onClick={() => voteOnReport(report._id, 'suspicious')}
                        className="px-3 py-1 text-xs bg-yellow-500/10 text-yellow-500 rounded hover:bg-yellow-500/20 transition-colors"
                      >
                        Suspicious ({report.communityVotes?.suspicious || 0})
                      </button>
                      <button
                        onClick={() => voteOnReport(report._id, 'phishing')}
                        className="px-3 py-1 text-xs bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors"
                      >
                        Phishing ({report.communityVotes?.phishing || 0})
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      by {report.reporterUsername}
                    </span>
                  </div>

                  {report.analysis && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium mb-1">AI Analysis: {report.analysis.verdict}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              report.analysis.aiScore >= 70 ? 'bg-red-500' :
                              report.analysis.aiScore >= 40 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${report.analysis.aiScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{report.analysis.aiScore}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {phishingReports.length === 0 && (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                <p className="text-muted-foreground mb-4">Be the first to report a phishing attempt</p>
                <button
                  onClick={reportPhishing}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Report Phishing
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}