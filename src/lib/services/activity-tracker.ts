import { AchievementService } from './achievement-service'
import { ActivityType } from '@/lib/models/achievement'

/**
 * Activity Tracker - Helper service for tracking user activities
 * that contribute to achievements throughout the platform
 */
export class ActivityTracker {
  /**
   * Track a security scan completion
   */
  static async trackScanCompleted(
    userId: string, 
    scanType: 'url' | 'document' | 'wallet' | 'smart_contract' | 'transaction',
    metadata?: {
      scanId?: string
      severity?: string
      threatsFound?: number
    }
  ): Promise<void> {
    try {
      // Track the scan completion
      await AchievementService.trackActivity(
        userId, 
        'scan_completed', 
        1, 
        { scanType, ...metadata }
      )

      // If threats were detected, track that separately
      if (metadata?.threatsFound && metadata.threatsFound > 0) {
        await AchievementService.trackActivity(
          userId, 
          'threat_detected', 
          metadata.threatsFound, 
          { scanType, severity: metadata.severity, scanId: metadata.scanId }
        )
      }

      // Track specific scan types
      switch (scanType) {
        case 'wallet':
          await AchievementService.trackActivity(userId, 'wallet_analyzed', 1, metadata)
          break
        case 'document':
          await AchievementService.trackActivity(userId, 'document_scanned', 1, metadata)
          break
        case 'url':
          await AchievementService.trackActivity(userId, 'url_checked', 1, metadata)
          break
      }
    } catch (error) {
      console.error('Error tracking scan completion:', error)
    }
  }

  /**
   * Track token burning activity
   */
  static async trackTokensBurned(
    userId: string,
    amount: number,
    metadata?: {
      transactionSignature?: string
      burnType?: string
      burnAddress?: string
    }
  ): Promise<void> {
    try {
      await AchievementService.trackActivity(
        userId, 
        'tokens_burned', 
        amount, 
        metadata
      )
    } catch (error) {
      console.error('Error tracking tokens burned:', error)
    }
  }

  /**
   * Track successful referral
   */
  static async trackReferralCompleted(
    referrerId: string,
    metadata?: {
      referralCode?: string
      newUserId?: string
      referralValue?: number
    }
  ): Promise<void> {
    try {
      await AchievementService.trackActivity(
        referrerId, 
        'referral_completed', 
        1, 
        metadata
      )
    } catch (error) {
      console.error('Error tracking referral completion:', error)
    }
  }

  /**
   * Track community participation (votes, feedback, etc.)
   */
  static async trackCommunityParticipation(
    userId: string,
    participationType: 'vote' | 'feedback' | 'report' | 'moderation',
    metadata?: {
      targetId?: string
      value?: any
      context?: string
    }
  ): Promise<void> {
    try {
      const activityType = participationType === 'vote' ? 'community_vote' : 'feedback_submitted'
      
      await AchievementService.trackActivity(
        userId, 
        activityType, 
        1, 
        { participationType, ...metadata }
      )
    } catch (error) {
      console.error('Error tracking community participation:', error)
    }
  }

  /**
   * Track daily login/activity
   */
  static async trackDailyLogin(userId: string): Promise<void> {
    try {
      await AchievementService.trackActivity(
        userId, 
        'daily_login', 
        1, 
        { loginDate: new Date().toISOString().split('T')[0] }
      )
    } catch (error) {
      console.error('Error tracking daily login:', error)
    }
  }

  /**
   * Track profile updates
   */
  static async trackProfileUpdate(
    userId: string,
    updateType: 'username' | 'avatar' | 'bio' | 'preferences',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await AchievementService.trackActivity(
        userId, 
        'profile_updated', 
        1, 
        { updateType, ...metadata }
      )
    } catch (error) {
      console.error('Error tracking profile update:', error)
    }
  }

  /**
   * Track subscription purchase
   */
  static async trackSubscriptionPurchase(
    userId: string,
    subscriptionTier: string,
    metadata?: {
      price?: number
      duration?: string
      transactionId?: string
    }
  ): Promise<void> {
    try {
      await AchievementService.trackActivity(
        userId, 
        'subscription_purchased', 
        1, 
        { subscriptionTier, ...metadata }
      )
    } catch (error) {
      console.error('Error tracking subscription purchase:', error)
    }
  }

  /**
   * Track streak maintenance
   */
  static async trackStreakMaintained(
    userId: string,
    streakType: 'daily_activity' | 'daily_scan' | 'weekly_burn',
    streakCount: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await AchievementService.trackActivity(
        userId, 
        'streak_maintained', 
        streakCount, 
        { streakType, ...metadata }
      )
    } catch (error) {
      console.error('Error tracking streak maintenance:', error)
    }
  }

  /**
   * Batch track multiple activities (for efficiency)
   */
  static async trackMultipleActivities(
    userId: string,
    activities: Array<{
      type: ActivityType
      value: number
      metadata?: Record<string, any>
    }>
  ): Promise<void> {
    try {
      const promises = activities.map(activity => 
        AchievementService.trackActivity(userId, activity.type, activity.value, activity.metadata)
      )
      
      await Promise.all(promises)
    } catch (error) {
      console.error('Error tracking multiple activities:', error)
    }
  }

  /**
   * Get user activity summary for a time period
   */
  static async getUserActivitySummary(
    userId: string,
    days: number = 30
  ): Promise<{
    totalActivities: number
    activitiesByType: Record<ActivityType, number>
    recentActivities: Array<{
      type: ActivityType
      value: number
      timestamp: Date
      metadata?: Record<string, any>
    }>
  }> {
    try {
      // This would query the user_activities collection
      // For now, return a placeholder
      return {
        totalActivities: 0,
        activitiesByType: {} as Record<ActivityType, number>,
        recentActivities: []
      }
    } catch (error) {
      console.error('Error getting user activity summary:', error)
      throw error
    }
  }
}

// Helper functions for common achievement tracking scenarios

/**
 * Integration helper for scan service
 */
export const integrateScanTracking = {
  /**
   * Call this after a security scan is completed
   */
  onScanCompleted: async (
    userId: string,
    scanData: {
      id: string
      type: 'url' | 'document' | 'wallet' | 'smart_contract' | 'transaction'
      severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'
      threatsFound: number
    }
  ) => {
    await ActivityTracker.trackScanCompleted(userId, scanData.type, {
      scanId: scanData.id,
      severity: scanData.severity,
      threatsFound: scanData.threatsFound
    })
  }
}

/**
 * Integration helper for burn service
 */
export const integrateBurnTracking = {
  /**
   * Call this after tokens are successfully burned
   */
  onTokensBurned: async (
    userId: string,
    burnData: {
      amount: number
      transactionSignature: string
      type: string
      burnAddress?: string
    }
  ) => {
    await ActivityTracker.trackTokensBurned(userId, burnData.amount, {
      transactionSignature: burnData.transactionSignature,
      burnType: burnData.type,
      burnAddress: burnData.burnAddress
    })
  }
}

/**
 * Integration helper for referral service
 */
export const integrateReferralTracking = {
  /**
   * Call this when a referral is successfully completed
   */
  onReferralCompleted: async (
    referrerId: string,
    referralData: {
      code: string
      newUserId: string
      value?: number
    }
  ) => {
    await ActivityTracker.trackReferralCompleted(referrerId, {
      referralCode: referralData.code,
      newUserId: referralData.newUserId,
      referralValue: referralData.value
    })
  }
}

/**
 * Integration helper for user authentication
 */
export const integrateAuthTracking = {
  /**
   * Call this on successful user login/authentication
   */
  onUserLogin: async (userId: string) => {
    await ActivityTracker.trackDailyLogin(userId)
  }
}

export default ActivityTracker