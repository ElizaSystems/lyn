import { connectToDatabase } from '@/lib/mongodb'
import { QuizQuestion, QuizSession, UserQuizStats, IQuizQuestion, IQuizSession } from '@/lib/models/security-quiz'
import { User } from '@/lib/models/user'
import { achievementService } from './achievement-service'

class SecurityQuizService {
  async getQuizQuestions(category?: string, difficulty?: string, count: number = 10): Promise<IQuizQuestion[]> {
    try {
      await connectToDatabase()
      
      const query: any = { isActive: true }
      if (category) query.category = category
      if (difficulty) query.difficulty = difficulty
      
      return await QuizQuestion.find(query)
        .sort({ timesAnswered: 1 }) // Prioritize less answered questions
        .limit(count)
        .exec()
    } catch (error) {
      console.error('Error getting quiz questions:', error)
      return []
    }
  }
  
  async startQuizSession(userId: string, username: string, questionIds: string[]): Promise<IQuizSession | null> {
    try {
      await connectToDatabase()
      
      const session = new QuizSession({
        userId,
        username,
        questions: questionIds.map(id => ({
          questionId: id,
          answeredCorrectly: false,
          timeSpent: 0,
          hintsUsed: 0
        }))
      })
      
      await session.save()
      return session
    } catch (error) {
      console.error('Error starting quiz session:', error)
      return null
    }
  }
  
  async submitAnswer(
    sessionId: string,
    questionId: string,
    answer: number,
    timeSpent: number,
    hintsUsed: number
  ): Promise<{ correct: boolean; xpEarned: number; explanation: string }> {
    try {
      await connectToDatabase()
      
      const session = await QuizSession.findById(sessionId)
      const question = await QuizQuestion.findById(questionId)
      
      if (!session || !question) {
        throw new Error('Session or question not found')
      }
      
      const correct = question.options[answer]?.isCorrect || false
      let xpEarned = 0
      
      if (correct) {
        // Calculate XP with hint penalty
        xpEarned = Math.max(1, question.xpReward - (hintsUsed * 2))
        
        // Update question stats
        question.timesAnswered += 1
        question.correctAnswers += 1
        await question.save()
      } else {
        question.timesAnswered += 1
        await question.save()
      }
      
      // Update session
      const questionIndex = session.questions.findIndex(q => q.questionId === questionId)
      if (questionIndex !== -1) {
        session.questions[questionIndex].answeredCorrectly = correct
        session.questions[questionIndex].timeSpent = timeSpent
        session.questions[questionIndex].hintsUsed = hintsUsed
        session.totalScore += correct ? 1 : 0
        session.xpEarned += xpEarned
      }
      
      await session.save()
      
      return {
        correct,
        xpEarned,
        explanation: question.explanation
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      return {
        correct: false,
        xpEarned: 0,
        explanation: 'Error processing answer'
      }
    }
  }
  
  async completeQuizSession(sessionId: string): Promise<any> {
    try {
      await connectToDatabase()
      
      const session = await QuizSession.findById(sessionId)
      if (!session) throw new Error('Session not found')
      
      session.completedAt = new Date()
      
      // Calculate streak bonus
      const userStats = await UserQuizStats.findOne({ userId: session.userId })
      if (userStats) {
        const lastQuizDate = userStats.lastQuizDate
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        if (lastQuizDate && lastQuizDate.toDateString() === yesterday.toDateString()) {
          userStats.currentStreak += 1
          session.streakBonus = userStats.currentStreak * 5 // 5 XP per streak day
          session.xpEarned += session.streakBonus
        } else if (!lastQuizDate || lastQuizDate.toDateString() !== today.toDateString()) {
          userStats.currentStreak = 1
        }
        
        userStats.longestStreak = Math.max(userStats.longestStreak, userStats.currentStreak)
        userStats.lastQuizDate = today
      }
      
      // Check for perfect score
      const correctAnswers = session.questions.filter(q => q.answeredCorrectly).length
      if (correctAnswers === session.questions.length) {
        session.perfectScore = true
        session.xpEarned += 20 // Bonus for perfect score
      }
      
      await session.save()
      
      // Update user stats
      await this.updateUserQuizStats(session)
      
      // Award XP to user
      await this.awardXpToUser(session.userId, session.xpEarned)
      
      // Check achievements
      await achievementService.checkAndUnlockAchievements(session.userId, 'quiz_completed')
      
      return {
        totalScore: session.totalScore,
        xpEarned: session.xpEarned,
        streakBonus: session.streakBonus,
        perfectScore: session.perfectScore,
        correctAnswers,
        totalQuestions: session.questions.length
      }
    } catch (error) {
      console.error('Error completing quiz session:', error)
      return null
    }
  }
  
  async getUserQuizStats(userId: string): Promise<any> {
    try {
      await connectToDatabase()
      
      let stats = await UserQuizStats.findOne({ userId })
      if (!stats) {
        const user = await User.findOne({ wallet: userId })
        if (user) {
          stats = new UserQuizStats({
            userId,
            username: user.username || 'Anonymous'
          })
          await stats.save()
        }
      }
      
      return stats
    } catch (error) {
      console.error('Error getting user quiz stats:', error)
      return null
    }
  }
  
  async getQuizLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      await connectToDatabase()
      
      return await UserQuizStats.find()
        .sort({ totalScore: -1, totalXpEarned: -1 })
        .limit(limit)
        .select('username totalScore totalXpEarned currentStreak')
        .exec()
    } catch (error) {
      console.error('Error getting quiz leaderboard:', error)
      return []
    }
  }
  
  private async updateUserQuizStats(session: IQuizSession): Promise<void> {
    try {
      let stats = await UserQuizStats.findOne({ userId: session.userId })
      
      if (!stats) {
        stats = new UserQuizStats({
          userId: session.userId,
          username: session.username
        })
      }
      
      stats.totalQuizzes += 1
      stats.totalScore += session.totalScore
      stats.totalXpEarned += session.xpEarned
      
      // Update category scores
      const questions = await QuizQuestion.find({
        _id: { $in: session.questions.map(q => q.questionId) }
      })
      
      for (const question of questions) {
        const answered = session.questions.find(q => q.questionId === question._id.toString())
        if (answered?.answeredCorrectly) {
          stats.categoryScores[question.category] += 1
        }
      }
      
      await stats.save()
    } catch (error) {
      console.error('Error updating user quiz stats:', error)
    }
  }
  
  private async awardXpToUser(userId: string, xp: number): Promise<void> {
    try {
      const user = await User.findOne({ wallet: userId })
      if (user) {
        user.totalXp = (user.totalXp || 0) + xp
        user.reputation = (user.reputation || 0) + Math.floor(xp / 10)
        await user.save()
      }
    } catch (error) {
      console.error('Error awarding XP to user:', error)
    }
  }
  
  async initializeDefaultQuestions(): Promise<void> {
    try {
      await connectToDatabase()
      
      const existingQuestions = await QuizQuestion.countDocuments()
      if (existingQuestions > 0) return
      
      const defaultQuestions = [
        {
          question: "What is the most secure way to store large amounts of cryptocurrency?",
          options: [
            { text: "On an exchange", isCorrect: false, explanation: "Exchanges can be hacked" },
            { text: "In a hardware wallet", isCorrect: true, explanation: "Hardware wallets store keys offline" },
            { text: "In a mobile wallet", isCorrect: false, explanation: "Mobile devices can be compromised" },
            { text: "On a piece of paper", isCorrect: false, explanation: "Paper can be lost or damaged" }
          ],
          category: "crypto",
          difficulty: "easy",
          xpReward: 10,
          explanation: "Hardware wallets keep your private keys offline, making them immune to online attacks. They're considered the gold standard for storing significant cryptocurrency holdings.",
          hints: ["Think about offline storage", "Consider what can't be hacked remotely"],
          tags: ["wallet", "storage", "security"]
        },
        {
          question: "Which of these is a common sign of a phishing email?",
          options: [
            { text: "Professional formatting", isCorrect: false },
            { text: "Urgent action required", isCorrect: true },
            { text: "Company logo present", isCorrect: false },
            { text: "Sent during business hours", isCorrect: false }
          ],
          category: "phishing",
          difficulty: "easy",
          xpReward: 10,
          explanation: "Phishing emails often create a sense of urgency to make you act without thinking. Legitimate companies rarely require immediate action via email.",
          hints: ["Think about psychological tactics", "What makes people act quickly?"],
          tags: ["email", "phishing", "social-engineering"]
        },
        {
          question: "What type of attack involves tricking someone into revealing sensitive information by pretending to be trustworthy?",
          options: [
            { text: "DDoS Attack", isCorrect: false },
            { text: "SQL Injection", isCorrect: false },
            { text: "Social Engineering", isCorrect: true },
            { text: "Brute Force", isCorrect: false }
          ],
          category: "general",
          difficulty: "easy",
          xpReward: 10,
          explanation: "Social engineering exploits human psychology rather than technical vulnerabilities. It's one of the most effective attack methods.",
          hints: ["Think about human manipulation", "No technical hacking required"],
          tags: ["social-engineering", "psychology", "attacks"]
        },
        {
          question: "What should you check first when visiting a website that asks for sensitive information?",
          options: [
            { text: "The website's color scheme", isCorrect: false },
            { text: "HTTPS and SSL certificate", isCorrect: true },
            { text: "Number of ads", isCorrect: false },
            { text: "Loading speed", isCorrect: false }
          ],
          category: "phishing",
          difficulty: "easy",
          xpReward: 10,
          explanation: "Always verify that a website uses HTTPS (look for the padlock icon) and has a valid SSL certificate before entering any sensitive information.",
          hints: ["Look at the URL bar", "Think about encryption"],
          tags: ["https", "ssl", "web-security"]
        },
        {
          question: "What is a 'rug pull' in cryptocurrency context?",
          options: [
            { text: "A sudden price increase", isCorrect: false },
            { text: "When developers abandon a project and run away with funds", isCorrect: true },
            { text: "A type of mining technique", isCorrect: false },
            { text: "A wallet backup method", isCorrect: false }
          ],
          category: "crypto",
          difficulty: "medium",
          xpReward: 15,
          explanation: "A rug pull is a type of scam where developers abandon a project and run away with investors' funds, leaving them with worthless tokens.",
          hints: ["Think about scams", "What happens when trust is broken?"],
          tags: ["defi", "scams", "rug-pull"]
        },
        {
          question: "Which authentication method is most secure?",
          options: [
            { text: "SMS-based 2FA", isCorrect: false, explanation: "Vulnerable to SIM swapping" },
            { text: "Email verification", isCorrect: false, explanation: "Email can be compromised" },
            { text: "Hardware security key", isCorrect: true, explanation: "Physical device required" },
            { text: "Security questions", isCorrect: false, explanation: "Answers can be guessed or found" }
          ],
          category: "password",
          difficulty: "medium",
          xpReward: 15,
          explanation: "Hardware security keys provide the strongest authentication as they require physical possession and are immune to phishing attacks.",
          hints: ["Think about physical security", "What can't be intercepted remotely?"],
          tags: ["2fa", "authentication", "hardware"]
        },
        {
          question: "What is 'typosquatting'?",
          options: [
            { text: "Making typing errors in code", isCorrect: false },
            { text: "Registering domain names similar to popular sites", isCorrect: true },
            { text: "A type of keyboard malware", isCorrect: false },
            { text: "Fast typing technique", isCorrect: false }
          ],
          category: "phishing",
          difficulty: "medium",
          xpReward: 15,
          explanation: "Typosquatting involves registering domain names that are similar to legitimate sites (like gooogle.com instead of google.com) to catch users who make typing errors.",
          hints: ["Think about domain names", "Related to user mistakes"],
          tags: ["domains", "phishing", "typosquatting"]
        },
        {
          question: "What is the purpose of a 'honeypot' in cybersecurity?",
          options: [
            { text: "To store passwords securely", isCorrect: false },
            { text: "To attract and detect attackers", isCorrect: true },
            { text: "To encrypt data", isCorrect: false },
            { text: "To speed up network traffic", isCorrect: false }
          ],
          category: "general",
          difficulty: "hard",
          xpReward: 20,
          explanation: "A honeypot is a security mechanism that creates a decoy system to attract attackers, allowing security teams to study their methods and protect real systems.",
          hints: ["Think about traps", "Used for detection and research"],
          tags: ["honeypot", "detection", "defense"]
        },
        {
          question: "What is a 'sandwich attack' in DeFi?",
          options: [
            { text: "Attack during lunch hours", isCorrect: false },
            { text: "Front-running and back-running a transaction", isCorrect: true },
            { text: "Attacking multiple wallets", isCorrect: false },
            { text: "Compressing data packets", isCorrect: false }
          ],
          category: "crypto",
          difficulty: "hard",
          xpReward: 20,
          explanation: "A sandwich attack involves placing one order before a target transaction and another after it, manipulating the price to profit from the victim's trade.",
          hints: ["Related to transaction ordering", "Involves MEV (Maximum Extractable Value)"],
          tags: ["defi", "mev", "sandwich-attack"]
        },
        {
          question: "Which of these is NOT a valid blockchain consensus mechanism?",
          options: [
            { text: "Proof of Work", isCorrect: false },
            { text: "Proof of Stake", isCorrect: false },
            { text: "Proof of History", isCorrect: false },
            { text: "Proof of Click", isCorrect: true }
          ],
          category: "crypto",
          difficulty: "medium",
          xpReward: 15,
          explanation: "Proof of Click is not a real consensus mechanism. Common mechanisms include Proof of Work (Bitcoin), Proof of Stake (Ethereum 2.0), and Proof of History (Solana).",
          hints: ["Three are real, one is made up", "Think about how blockchains reach agreement"],
          tags: ["blockchain", "consensus", "crypto"]
        }
      ]
      
      for (const questionData of defaultQuestions) {
        const question = new QuizQuestion(questionData)
        await question.save()
      }
      
      console.log('Default quiz questions initialized')
    } catch (error) {
      console.error('Error initializing default questions:', error)
    }
  }
}

export const securityQuizService = new SecurityQuizService()