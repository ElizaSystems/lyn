import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { TelegramUser } from '@/lib/models/telegram-user'
import { connectDB } from '@/lib/mongodb'

export class TelegramWalletService {
  /**
   * Generate a unique linking code for wallet verification
   */
  static generateLinkingCode(telegramId: number): string {
    const timestamp = Date.now()
    const data = `LYN_LINK_${telegramId}_${timestamp}`
    return Buffer.from(data).toString('base64').slice(0, 16)
  }

  /**
   * Verify a signed message from a Solana wallet
   */
  static verifyWalletSignature(
    message: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = bs58.decode(signature)
      const publicKeyBytes = bs58.decode(publicKey)
      
      return nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      )
    } catch (error) {
      console.error('Signature verification error:', error)
      return false
    }
  }

  /**
   * Link a Solana wallet to a Telegram user
   */
  static async linkWallet(
    telegramId: number,
    walletAddress: string,
    signature: string,
    linkingCode: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await connectDB()

      // Verify the signature
      const expectedMessage = `Link LYN wallet to Telegram\nCode: ${linkingCode}`
      const isValid = this.verifyWalletSignature(
        expectedMessage,
        signature,
        walletAddress
      )

      if (!isValid) {
        return { success: false, message: 'Invalid signature' }
      }

      // Check if wallet is already linked to another account
      const existingUser = await TelegramUser.findOne({ walletAddress })
      if (existingUser && existingUser.telegramId !== telegramId) {
        return { success: false, message: 'Wallet already linked to another account' }
      }

      // Update or create user
      const user = await TelegramUser.findOneAndUpdate(
        { telegramId },
        {
          walletAddress,
          walletLinkedAt: new Date(),
          updatedAt: new Date()
        },
        { new: true, upsert: true }
      )

      return { 
        success: true, 
        message: `Wallet ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)} linked successfully!` 
      }
    } catch (error) {
      console.error('Wallet linking error:', error)
      return { success: false, message: 'Failed to link wallet' }
    }
  }

  /**
   * Unlink wallet from Telegram user
   */
  static async unlinkWallet(telegramId: number): Promise<{ success: boolean; message: string }> {
    try {
      await connectDB()

      const user = await TelegramUser.findOneAndUpdate(
        { telegramId },
        {
          $unset: { walletAddress: 1, walletLinkedAt: 1 },
          updatedAt: new Date()
        },
        { new: true }
      )

      if (!user) {
        return { success: false, message: 'User not found' }
      }

      return { success: true, message: 'Wallet unlinked successfully' }
    } catch (error) {
      console.error('Wallet unlinking error:', error)
      return { success: false, message: 'Failed to unlink wallet' }
    }
  }

  /**
   * Get user stats including wallet info
   */
  static async getUserStats(telegramId: number) {
    try {
      await connectDB()

      const user = await TelegramUser.findOne({ telegramId })
      if (!user) {
        return null
      }

      return {
        walletAddress: user.walletAddress,
        walletLinked: !!user.walletAddress,
        totalScans: user.totalScans,
        safeScans: user.safeScans,
        threatsDetected: user.threatsDetected,
        isPremium: user.isPremium,
        rank: await this.getUserRank(user.walletAddress || '')
      }
    } catch (error) {
      console.error('Get user stats error:', error)
      return null
    }
  }

  /**
   * Get user rank in leaderboard
   */
  static async getUserRank(walletAddress: string): Promise<number | null> {
    if (!walletAddress) return null

    try {
      await connectDB()
      
      // Count users with more scans
      const rank = await TelegramUser.countDocuments({
        walletAddress: { $exists: true },
        totalScans: { $gt: 0 }
      })

      return rank + 1
    } catch (error) {
      console.error('Get user rank error:', error)
      return null
    }
  }

  /**
   * Update scan statistics for a user
   */
  static async updateScanStats(
    telegramId: number,
    isSafe: boolean
  ): Promise<void> {
    try {
      await connectDB()

      const update = {
        $inc: {
          totalScans: 1,
          safeScans: isSafe ? 1 : 0,
          threatsDetected: isSafe ? 0 : 1
        },
        lastScanAt: new Date(),
        updatedAt: new Date()
      }

      await TelegramUser.findOneAndUpdate(
        { telegramId },
        update,
        { upsert: true }
      )
    } catch (error) {
      console.error('Update scan stats error:', error)
    }
  }

  /**
   * Get leaderboard data
   */
  static async getLeaderboard(limit: number = 10) {
    try {
      await connectDB()

      const users = await TelegramUser.find({
        walletAddress: { $exists: true },
        totalScans: { $gt: 0 }
      })
        .sort({ totalScans: -1 })
        .limit(limit)
        .select('username firstName walletAddress totalScans safeScans threatsDetected')

      return users.map((user, index) => ({
        rank: index + 1,
        username: user.username || user.firstName,
        walletAddress: user.walletAddress,
        totalScans: user.totalScans,
        safeScans: user.safeScans,
        threatsDetected: user.threatsDetected,
        accuracy: user.totalScans > 0 
          ? Math.round((user.safeScans / user.totalScans) * 100)
          : 0
      }))
    } catch (error) {
      console.error('Get leaderboard error:', error)
      return []
    }
  }
}