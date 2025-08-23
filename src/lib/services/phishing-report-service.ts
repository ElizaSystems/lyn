import { connectToDatabase } from '@/lib/mongodb'
import { PhishingReport, IPhishingReport } from '@/lib/models/phishing-report'
import { User } from '@/lib/models/user-mongoose'
// Commenting out for now - need refactoring
// import { achievementService } from './achievement-service'

class PhishingReportService {
  async createReport(
    reportData: {
      reporterId: string
      reporterUsername: string
      url?: string
      email?: string
      description: string
      category: string
      evidence?: any
    }
  ): Promise<IPhishingReport | null> {
    try {
      await connectToDatabase()
      
      const report = new PhishingReport({
        ...reportData,
        status: 'pending',
        severity: 'medium'
      })
      
      await report.save()
      
      // Award XP for reporting
      await this.awardReportingXp(reportData.reporterId, 5)
      
      // Trigger AI analysis
      await this.analyzeReport(report._id.toString())
      
      return report
    } catch (error) {
      console.error('Error creating phishing report:', error)
      return null
    }
  }
  
  async analyzeReport(reportId: string): Promise<void> {
    try {
      const report = await PhishingReport.findById(reportId)
      if (!report) return
      
      // Simulate AI analysis (in production, this would call an AI service)
      const indicators: string[] = []
      let aiScore = 0
      
      if (report.url) {
        // Check for suspicious URL patterns
        if (report.url.includes('bit.ly') || report.url.includes('tinyurl')) {
          indicators.push('Shortened URL detected')
          aiScore += 20
        }
        if (report.url.includes('@')) {
          indicators.push('@ symbol in URL (possible deception)')
          aiScore += 30
        }
        if (!/^https:\/\//.test(report.url)) {
          indicators.push('Non-HTTPS URL')
          aiScore += 15
        }
        // Check for homograph attacks
        if (/[а-яА-Я]/.test(report.url)) {
          indicators.push('Cyrillic characters detected (possible homograph attack)')
          aiScore += 40
        }
      }
      
      if (report.description) {
        // Check for common phishing keywords
        const phishingKeywords = ['urgent', 'verify', 'suspend', 'click here', 'act now', 'limited time']
        for (const keyword of phishingKeywords) {
          if (report.description.toLowerCase().includes(keyword)) {
            indicators.push(`Phishing keyword detected: "${keyword}"`)
            aiScore += 10
          }
        }
      }
      
      // Determine verdict
      let verdict = 'Legitimate'
      let severity = 'low'
      
      if (aiScore >= 70) {
        verdict = 'Highly Suspicious - Likely Phishing'
        severity = 'critical'
        report.status = 'verified'
      } else if (aiScore >= 40) {
        verdict = 'Suspicious - Possible Phishing'
        severity = 'high'
        report.status = 'investigating'
      } else if (aiScore >= 20) {
        verdict = 'Potentially Suspicious'
        severity = 'medium'
        report.status = 'investigating'
      } else {
        verdict = 'Appears Legitimate'
        severity = 'low'
      }
      
      report.analysis = {
        aiScore,
        indicators,
        verdict,
        analyzedAt: new Date()
      }
      report.severity = severity as any
      
      await report.save()
      
      // If verified as phishing, reward the reporter
      if (report.status === 'verified') {
        await this.rewardVerifiedReport(report.reporterId, reportId)
      }
    } catch (error) {
      console.error('Error analyzing report:', error)
    }
  }
  
  async voteOnReport(
    reportId: string,
    userId: string,
    vote: 'legitimate' | 'suspicious' | 'phishing'
  ): Promise<boolean> {
    try {
      await connectToDatabase()
      
      const report = await PhishingReport.findById(reportId)
      if (!report) return false
      
      report.communityVotes[vote] += 1
      
      // Check if community consensus reached
      const totalVotes = report.communityVotes.legitimate + 
                        report.communityVotes.suspicious + 
                        report.communityVotes.phishing
      
      if (totalVotes >= 10) {
        if (report.communityVotes.phishing > totalVotes * 0.7) {
          report.status = 'verified'
          report.severity = 'high'
          await this.rewardVerifiedReport(report.reporterId, reportId)
        } else if (report.communityVotes.legitimate > totalVotes * 0.7) {
          report.status = 'false_positive'
        }
      }
      
      await report.save()
      
      // Award small XP for voting
      await this.awardReportingXp(userId, 1)
      
      return true
    } catch (error) {
      console.error('Error voting on report:', error)
      return false
    }
  }
  
  async getReports(
    filters: {
      status?: string
      category?: string
      severity?: string
      reporterId?: string
    },
    limit: number = 20
  ): Promise<IPhishingReport[]> {
    try {
      await connectToDatabase()
      
      const query: any = { isPublic: true }
      if (filters.status) query.status = filters.status
      if (filters.category) query.category = filters.category
      if (filters.severity) query.severity = filters.severity
      if (filters.reporterId) query.reporterId = filters.reporterId
      
      return await PhishingReport.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec()
    } catch (error) {
      console.error('Error getting reports:', error)
      return []
    }
  }
  
  async getReportStats(): Promise<any> {
    try {
      await connectToDatabase()
      
      const totalReports = await PhishingReport.countDocuments()
      const verifiedThreats = await PhishingReport.countDocuments({ status: 'verified' })
      
      const categoryStats = await PhishingReport.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
      
      const severityStats = await PhishingReport.aggregate([
        { $match: { status: 'verified' } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ])
      
      const topReporters = await PhishingReport.aggregate([
        { $match: { status: 'verified' } },
        { $group: { 
          _id: '$reporterUsername', 
          count: { $sum: 1 },
          totalXp: { $sum: '$xpRewarded' }
        }},
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
      
      return {
        totalReports,
        verifiedThreats,
        categoryStats,
        severityStats,
        topReporters
      }
    } catch (error) {
      console.error('Error getting report stats:', error)
      return null
    }
  }
  
  private async rewardVerifiedReport(reporterId: string, reportId: string): Promise<void> {
    try {
      const report = await PhishingReport.findById(reportId)
      if (!report || report.xpRewarded) return
      
      // Skip rewards for anonymous reports
      if (reporterId === 'anonymous') {
        report.verifiedAt = new Date()
        await report.save()
        return
      }
      
      // Award significant XP for verified threat
      const xpReward = report.severity === 'critical' ? 50 : 
                      report.severity === 'high' ? 30 : 20
      
      report.xpRewarded = xpReward
      report.verifiedAt = new Date()
      await report.save()
      
      await this.awardReportingXp(reporterId, xpReward)
      
      // Check for achievements
      // Commenting out for now - need refactoring
      // await achievementService.checkAndUnlockAchievements(reporterId, 'phishing_reported')
    } catch (error) {
      console.error('Error rewarding verified report:', error)
    }
  }
  
  private async awardReportingXp(userId: string, xp: number): Promise<void> {
    try {
      // Skip XP award for anonymous users
      if (userId === 'anonymous') {
        return
      }
      
      const user = await User.findOne({ wallet: userId })
      if (user) {
        user.totalXp = (user.totalXp || 0) + xp
        user.reputation = (user.reputation || 0) + Math.floor(xp / 5)
        
        if (!user.metadata) user.metadata = {}
        user.metadata.phishingReportsCount = (user.metadata.phishingReportsCount || 0) + 1
        
        await user.save()
      }
    } catch (error) {
      console.error('Error awarding reporting XP:', error)
    }
  }
}

export const phishingReportService = new PhishingReportService()