import { connectToDatabase } from '@/lib/mongodb'
import { 
  SecurityChallenge, 
  ChallengeAttempt, 
  UserChallengeStats,
  ISecurityChallenge,
  IChallengeAttempt 
} from '@/lib/models/security-challenge'
import { User } from '@/lib/models/user'
import { achievementService } from './achievement-service'
import { badgeService } from './badge-service'

class SecurityChallengeService {
  async getChallenges(
    filters: {
      category?: string
      difficulty?: string
      simulationType?: string
    },
    limit: number = 20
  ): Promise<ISecurityChallenge[]> {
    try {
      await connectToDatabase()
      
      const query: any = { isActive: true }
      if (filters.category) query.category = filters.category
      if (filters.difficulty) query.difficulty = filters.difficulty
      if (filters.simulationType) query.simulationType = filters.simulationType
      
      return await SecurityChallenge.find(query)
        .sort({ completions: 1, createdAt: -1 })
        .limit(limit)
        .exec()
    } catch (error) {
      console.error('Error getting challenges:', error)
      return []
    }
  }
  
  async startChallenge(
    challengeId: string,
    userId: string,
    username: string
  ): Promise<IChallengeAttempt | null> {
    try {
      await connectToDatabase()
      
      const challenge = await SecurityChallenge.findById(challengeId)
      if (!challenge) return null
      
      // Check if user already has an in-progress attempt
      const existingAttempt = await ChallengeAttempt.findOne({
        challengeId,
        userId,
        status: 'in_progress'
      })
      
      if (existingAttempt) {
        return existingAttempt
      }
      
      const attempt = new ChallengeAttempt({
        challengeId,
        userId,
        username
      })
      
      await attempt.save()
      return attempt
    } catch (error) {
      console.error('Error starting challenge:', error)
      return null
    }
  }
  
  async submitChallengeSolution(
    attemptId: string,
    answers: any,
    timeSpent: number
  ): Promise<{
    success: boolean
    score: number
    xpEarned: number
    badgeEarned?: string
    feedback: string
  }> {
    try {
      await connectToDatabase()
      
      const attempt = await ChallengeAttempt.findById(attemptId)
      const challenge = await SecurityChallenge.findById(attempt?.challengeId)
      
      if (!attempt || !challenge) {
        throw new Error('Attempt or challenge not found')
      }
      
      // Evaluate solution (simplified - in production would be more complex)
      const score = this.evaluateSolution(challenge, answers, attempt.hintsUsed)
      const passed = score >= 70
      
      // Calculate XP
      let xpEarned = 0
      if (passed) {
        xpEarned = challenge.xpReward
        // Reduce XP for hints used
        xpEarned -= attempt.hintsUsed.length * 5
        xpEarned = Math.max(10, xpEarned)
        
        // Bonus for time efficiency
        if (challenge.timeLimit && timeSpent < challenge.timeLimit * 60 * 0.5) {
          xpEarned += 10 // Completed in half the time
        }
      }
      
      // Update attempt
      attempt.completedAt = new Date()
      attempt.status = passed ? 'completed' : 'failed'
      attempt.score = score
      attempt.xpEarned = xpEarned
      attempt.answers = answers
      attempt.timeSpent = timeSpent
      attempt.feedback = this.generateFeedback(score, passed)
      
      await attempt.save()
      
      // Update challenge stats
      if (passed) {
        challenge.completions += 1
        challenge.averageScore = 
          (challenge.averageScore * (challenge.completions - 1) + score) / challenge.completions
        await challenge.save()
      }
      
      // Update user stats
      await this.updateUserChallengeStats(attempt, challenge, passed)
      
      // Award XP
      if (xpEarned > 0) {
        await this.awardXpToUser(attempt.userId, xpEarned)
      }
      
      // Check for badge reward
      let badgeEarned
      if (passed && challenge.badgeReward) {
        await badgeService.awardBadge(attempt.userId, challenge.badgeReward)
        badgeEarned = challenge.badgeReward
      }
      
      // Check achievements
      if (passed) {
        await achievementService.checkAndUnlockAchievements(attempt.userId, 'challenge_completed')
      }
      
      return {
        success: passed,
        score,
        xpEarned,
        badgeEarned,
        feedback: attempt.feedback
      }
    } catch (error) {
      console.error('Error submitting challenge solution:', error)
      return {
        success: false,
        score: 0,
        xpEarned: 0,
        feedback: 'Error processing solution'
      }
    }
  }
  
  async getHint(
    attemptId: string,
    hintIndex: number
  ): Promise<{ hint: string; xpPenalty: number } | null> {
    try {
      await connectToDatabase()
      
      const attempt = await ChallengeAttempt.findById(attemptId)
      const challenge = await SecurityChallenge.findById(attempt?.challengeId)
      
      if (!attempt || !challenge || !challenge.hints[hintIndex]) {
        return null
      }
      
      const hint = challenge.hints[hintIndex]
      
      // Track hint usage
      if (!attempt.hintsUsed.includes(hint.text)) {
        attempt.hintsUsed.push(hint.text)
        await attempt.save()
      }
      
      return {
        hint: hint.text,
        xpPenalty: hint.xpPenalty
      }
    } catch (error) {
      console.error('Error getting hint:', error)
      return null
    }
  }
  
  async getUserChallengeStats(userId: string): Promise<any> {
    try {
      await connectToDatabase()
      
      let stats = await UserChallengeStats.findOne({ userId })
      
      if (!stats) {
        const user = await User.findOne({ wallet: userId })
        if (user) {
          stats = new UserChallengeStats({
            userId,
            username: user.username || 'Anonymous'
          })
          await stats.save()
        }
      }
      
      return stats
    } catch (error) {
      console.error('Error getting user challenge stats:', error)
      return null
    }
  }
  
  async getChallengeLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      await connectToDatabase()
      
      return await UserChallengeStats.find()
        .sort({ totalXpEarned: -1, completedChallenges: -1 })
        .limit(limit)
        .select('username completedChallenges totalXpEarned badges')
        .exec()
    } catch (error) {
      console.error('Error getting challenge leaderboard:', error)
      return []
    }
  }
  
  private evaluateSolution(
    challenge: ISecurityChallenge,
    answers: any,
    hintsUsed: string[]
  ): number {
    // Simplified evaluation - in production would be more sophisticated
    let score = 100
    
    // Deduct points for hints
    score -= hintsUsed.length * 10
    
    // In a real implementation, this would evaluate based on challenge type
    // For now, we'll simulate with random scoring
    const randomFactor = Math.random() * 20
    score = Math.max(0, Math.min(100, score - randomFactor))
    
    return Math.round(score)
  }
  
  private generateFeedback(score: number, passed: boolean): string {
    if (score >= 90) {
      return "Excellent work! You've demonstrated mastery of this security concept."
    } else if (score >= 80) {
      return "Great job! You have a strong understanding of the material."
    } else if (score >= 70) {
      return "Good effort! You passed, but there's room for improvement."
    } else if (score >= 60) {
      return "Close! Review the solution and try similar challenges to improve."
    } else {
      return "Keep practicing! Review the fundamentals and try again."
    }
  }
  
  private async updateUserChallengeStats(
    attempt: IChallengeAttempt,
    challenge: ISecurityChallenge,
    passed: boolean
  ): Promise<void> {
    try {
      let stats = await UserChallengeStats.findOne({ userId: attempt.userId })
      
      if (!stats) {
        stats = new UserChallengeStats({
          userId: attempt.userId,
          username: attempt.username
        })
      }
      
      stats.totalChallenges += 1
      
      if (passed) {
        stats.completedChallenges += 1
        stats.totalXpEarned += attempt.xpEarned
        stats.categoriesCompleted[challenge.category] += 1
        stats.difficultyCompleted[challenge.difficulty] += 1
        
        // Update streak
        const today = new Date()
        const lastDate = stats.lastChallengeDate
        
        if (lastDate) {
          const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          if (daysSince === 1) {
            stats.currentStreak += 1
          } else if (daysSince > 1) {
            stats.currentStreak = 1
          }
        } else {
          stats.currentStreak = 1
        }
        
        stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak)
        stats.lastChallengeDate = today
        
        // Update average score
        stats.averageScore = 
          (stats.averageScore * (stats.completedChallenges - 1) + attempt.score) / stats.completedChallenges
      }
      
      await stats.save()
    } catch (error) {
      console.error('Error updating user challenge stats:', error)
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
  
  async initializeDefaultChallenges(): Promise<void> {
    try {
      await connectToDatabase()
      
      const existingChallenges = await SecurityChallenge.countDocuments()
      if (existingChallenges > 0) return
      
      const defaultChallenges = [
        {
          title: "Spot the Phishing Email",
          description: "Analyze an email and identify phishing indicators",
          scenario: "You receive an email claiming to be from your bank asking you to verify your account. The email contains several red flags. Can you identify them all?",
          objectives: [
            "Identify at least 3 phishing indicators",
            "Explain why each indicator is suspicious",
            "Describe the correct action to take"
          ],
          difficulty: "beginner",
          category: "phishing",
          timeLimit: 10,
          xpReward: 30,
          hints: [
            { text: "Check the sender's email address carefully", xpPenalty: 5 },
            { text: "Look for spelling and grammar errors", xpPenalty: 5 },
            { text: "Hover over links without clicking", xpPenalty: 5 }
          ],
          solution: {
            steps: [
              "Check sender email - likely spoofed",
              "Look for urgent language",
              "Verify grammar and spelling",
              "Check link destinations",
              "Contact bank directly"
            ],
            explanation: "Phishing emails often use urgency, contain errors, and have suspicious links. Always verify through official channels."
          },
          simulationType: "scenario",
          tags: ["email", "phishing", "social-engineering"]
        },
        {
          title: "Secure the Wallet",
          description: "Configure a crypto wallet with maximum security",
          scenario: "You've just created a new crypto wallet. Walk through the steps to secure it properly against common attack vectors.",
          objectives: [
            "Enable all security features",
            "Create secure backup",
            "Set up 2FA correctly",
            "Configure transaction limits"
          ],
          difficulty: "intermediate",
          category: "crypto",
          timeLimit: 15,
          xpReward: 50,
          badgeReward: "wallet_guardian",
          hints: [
            { text: "Hardware wallets are most secure", xpPenalty: 5 },
            { text: "Never share your seed phrase", xpPenalty: 5 },
            { text: "Use a password manager", xpPenalty: 5 }
          ],
          solution: {
            steps: [
              "Use hardware wallet if possible",
              "Generate and securely store seed phrase",
              "Enable 2FA with authenticator app",
              "Set transaction limits and confirmations",
              "Create encrypted backups"
            ],
            explanation: "Proper wallet security involves multiple layers of protection, from hardware security to proper backup procedures."
          },
          simulationType: "interactive",
          tags: ["wallet", "crypto", "security-setup"]
        },
        {
          title: "Incident Response Drill",
          description: "Respond to a simulated security breach",
          scenario: "Your monitoring system alerts you to suspicious activity on your account. Multiple login attempts from unknown locations have been detected. Take appropriate action.",
          objectives: [
            "Secure the account immediately",
            "Investigate the breach",
            "Document the incident",
            "Implement preventive measures"
          ],
          difficulty: "advanced",
          category: "incident_response",
          timeLimit: 20,
          xpReward: 75,
          badgeReward: "incident_responder",
          hints: [
            { text: "Change passwords immediately", xpPenalty: 10 },
            { text: "Check all connected accounts", xpPenalty: 10 },
            { text: "Enable all security features", xpPenalty: 10 }
          ],
          solution: {
            steps: [
              "Immediately change passwords",
              "Revoke all active sessions",
              "Enable 2FA if not already",
              "Check activity logs",
              "Scan devices for malware",
              "Monitor financial accounts",
              "Document everything",
              "Report to authorities if needed"
            ],
            explanation: "Quick response and thorough investigation are crucial in incident response. Document everything for future reference."
          },
          simulationType: "scenario",
          tags: ["incident-response", "breach", "security"]
        },
        {
          title: "Smart Contract Audit Challenge",
          description: "Find vulnerabilities in a smart contract",
          scenario: "Review this simplified smart contract code and identify potential security vulnerabilities that could be exploited.",
          objectives: [
            "Identify at least 2 vulnerabilities",
            "Explain potential exploits",
            "Suggest fixes"
          ],
          difficulty: "expert",
          category: "crypto",
          timeLimit: 30,
          xpReward: 100,
          badgeReward: "contract_auditor",
          hints: [
            { text: "Check for reentrancy vulnerabilities", xpPenalty: 15 },
            { text: "Look for integer overflow/underflow", xpPenalty: 15 },
            { text: "Verify access controls", xpPenalty: 15 }
          ],
          solution: {
            steps: [
              "Check reentrancy guards",
              "Verify integer operations",
              "Review access modifiers",
              "Check for front-running vulnerabilities",
              "Verify gas limits"
            ],
            explanation: "Smart contract security requires understanding of common vulnerabilities like reentrancy, overflow, and access control issues."
          },
          simulationType: "ctf",
          tags: ["smart-contract", "audit", "vulnerabilities"]
        },
        {
          title: "Social Engineering Defense",
          description: "Defend against a social engineering attack",
          scenario: "You receive a call from someone claiming to be from IT support, asking for your credentials to 'fix an urgent issue'. How do you respond?",
          objectives: [
            "Identify the attack",
            "Respond appropriately",
            "Report the incident",
            "Educate others"
          ],
          difficulty: "beginner",
          category: "social_engineering",
          timeLimit: 10,
          xpReward: 25,
          hints: [
            { text: "IT never asks for passwords", xpPenalty: 5 },
            { text: "Verify through official channels", xpPenalty: 5 }
          ],
          solution: {
            steps: [
              "Never share credentials over phone",
              "Ask for ticket number",
              "Hang up and call IT directly",
              "Report the incident",
              "Alert colleagues"
            ],
            explanation: "Social engineering relies on urgency and authority. Always verify through official channels."
          },
          simulationType: "scenario",
          tags: ["social-engineering", "phone", "defense"]
        }
      ]
      
      for (const challengeData of defaultChallenges) {
        const challenge = new SecurityChallenge(challengeData)
        await challenge.save()
      }
      
      console.log('Default security challenges initialized')
    } catch (error) {
      console.error('Error initializing default challenges:', error)
    }
  }
}

export const securityChallengeService = new SecurityChallengeService()