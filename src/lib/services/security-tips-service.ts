import { connectToDatabase } from '@/lib/mongodb'
import { SecurityTip, ISecurityTip } from '@/lib/models/security-tips'
import { User } from '@/lib/models/user'
import { achievementService } from './achievement-service'

class SecurityTipsService {
  async getDailyTip(userId?: string): Promise<ISecurityTip | null> {
    try {
      await connectToDatabase()
      
      // Get tip that hasn't been shown recently
      const tip = await SecurityTip.findOne({
        isActive: true
      })
        .sort({ lastShown: 1, showCount: 1 })
        .exec()
      
      if (tip) {
        // Update show count and last shown
        tip.showCount += 1
        tip.lastShown = new Date()
        await tip.save()
        
        // Track user engagement if userId provided
        if (userId) {
          await this.trackTipView(userId, tip._id.toString())
        }
      }
      
      return tip
    } catch (error) {
      console.error('Error getting daily tip:', error)
      return null
    }
  }
  
  async getTipsByCategory(category: string): Promise<ISecurityTip[]> {
    try {
      await connectToDatabase()
      
      return await SecurityTip.find({
        category,
        isActive: true
      })
        .sort({ dateAdded: -1 })
        .limit(10)
        .exec()
    } catch (error) {
      console.error('Error getting tips by category:', error)
      return []
    }
  }
  
  async searchTips(query: string): Promise<ISecurityTip[]> {
    try {
      await connectToDatabase()
      
      return await SecurityTip.find({
        isActive: true,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      })
        .limit(20)
        .exec()
    } catch (error) {
      console.error('Error searching tips:', error)
      return []
    }
  }
  
  async likeTip(tipId: string, userId: string): Promise<boolean> {
    try {
      await connectToDatabase()
      
      const tip = await SecurityTip.findById(tipId)
      if (!tip) return false
      
      tip.likes += 1
      await tip.save()
      
      // Award XP for engagement
      const user = await User.findOne({ wallet: userId })
      if (user) {
        user.reputation = (user.reputation || 0) + 1
        user.totalXp = (user.totalXp || 0) + 1
        await user.save()
        
        // Check for achievement
        await achievementService.checkAndUnlockAchievements(userId, 'tip_engagement')
      }
      
      return true
    } catch (error) {
      console.error('Error liking tip:', error)
      return false
    }
  }
  
  async createTip(tipData: Partial<ISecurityTip>): Promise<ISecurityTip | null> {
    try {
      await connectToDatabase()
      
      const tip = new SecurityTip(tipData)
      await tip.save()
      
      return tip
    } catch (error) {
      console.error('Error creating tip:', error)
      return null
    }
  }
  
  async getTipStats(): Promise<any> {
    try {
      await connectToDatabase()
      
      const totalTips = await SecurityTip.countDocuments({ isActive: true })
      const categoryStats = await SecurityTip.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
      
      const popularTips = await SecurityTip.find({ isActive: true })
        .sort({ likes: -1 })
        .limit(5)
        .select('title likes')
      
      return {
        totalTips,
        categoryStats,
        popularTips
      }
    } catch (error) {
      console.error('Error getting tip stats:', error)
      return null
    }
  }
  
  private async trackTipView(userId: string, tipId: string): Promise<void> {
    try {
      const user = await User.findOne({ wallet: userId })
      if (user) {
        if (!user.metadata) user.metadata = {}
        if (!user.metadata.tipsViewed) user.metadata.tipsViewed = []
        
        if (!user.metadata.tipsViewed.includes(tipId)) {
          user.metadata.tipsViewed.push(tipId)
          user.metadata.lastTipViewedAt = new Date()
          await user.save()
        }
      }
    } catch (error) {
      console.error('Error tracking tip view:', error)
    }
  }
  
  async initializeDefaultTips(): Promise<void> {
    try {
      await connectToDatabase()
      
      const existingTips = await SecurityTip.countDocuments()
      if (existingTips > 0) return
      
      const defaultTips = [
        {
          title: "Always Verify Smart Contract Addresses",
          content: "Before interacting with any smart contract, verify its address through multiple official sources. Scammers often create lookalike contracts with similar names.",
          category: "crypto",
          difficulty: "beginner",
          tags: ["smart-contracts", "verification", "defi"],
          relatedLinks: [
            { title: "Etherscan Verification Guide", url: "https://etherscan.io/verifyContract" }
          ]
        },
        {
          title: "Enable 2FA on All Crypto Exchanges",
          content: "Two-factor authentication adds an extra layer of security. Use authenticator apps instead of SMS whenever possible, as SIM swapping attacks are common.",
          category: "crypto",
          difficulty: "beginner",
          tags: ["2fa", "exchanges", "authentication"],
        },
        {
          title: "Recognize Phishing Email Red Flags",
          content: "Check for misspellings, generic greetings, urgent language, and suspicious sender addresses. Legitimate companies never ask for passwords via email.",
          category: "phishing",
          difficulty: "beginner",
          tags: ["email", "phishing", "social-engineering"],
        },
        {
          title: "Use Hardware Wallets for Large Holdings",
          content: "Hardware wallets keep your private keys offline, making them immune to online attacks. Consider them essential for storing significant crypto amounts.",
          category: "crypto",
          difficulty: "intermediate",
          tags: ["hardware-wallet", "cold-storage", "security"],
        },
        {
          title: "Check URL SSL Certificates",
          content: "Always look for 'https://' and the padlock icon. Click the padlock to verify the certificate details match the organization you expect.",
          category: "phishing",
          difficulty: "beginner",
          tags: ["ssl", "https", "web-security"],
        },
        {
          title: "Regular Security Audits",
          content: "Periodically review all your connected apps, browser extensions, and wallet permissions. Revoke access for services you no longer use.",
          category: "general",
          difficulty: "intermediate",
          tags: ["audit", "permissions", "maintenance"],
        },
        {
          title: "Beware of Fake Browser Extensions",
          content: "Only install browser extensions from official sources. Malicious extensions can steal passwords, private keys, and session cookies.",
          category: "malware",
          difficulty: "intermediate",
          tags: ["browser", "extensions", "malware"],
        },
        {
          title: "Use Unique Passwords for Each Account",
          content: "Password reuse is dangerous. If one service is breached, all your accounts become vulnerable. Use a password manager to generate and store unique passwords.",
          category: "password",
          difficulty: "beginner",
          tags: ["passwords", "password-manager", "authentication"],
        },
        {
          title: "Verify Transaction Details Before Signing",
          content: "Always double-check recipient addresses, amounts, and gas fees before confirming any blockchain transaction. Transactions are irreversible.",
          category: "crypto",
          difficulty: "beginner",
          tags: ["transactions", "verification", "blockchain"],
        },
        {
          title: "Keep Software Updated",
          content: "Security patches fix vulnerabilities. Enable automatic updates for your operating system, browser, and security software.",
          category: "general",
          difficulty: "beginner",
          tags: ["updates", "patches", "maintenance"],
        }
      ]
      
      for (const tipData of defaultTips) {
        await this.createTip(tipData)
      }
      
      console.log('Default security tips initialized')
    } catch (error) {
      console.error('Error initializing default tips:', error)
    }
  }
}

export const securityTipsService = new SecurityTipsService()