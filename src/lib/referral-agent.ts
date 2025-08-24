/**
 * Referral Optimization Agent
 * Autonomously manages and optimizes referral networks
 */

import { runAgentLoop } from './agent-framework'
import { getDatabase } from './mongodb'

export interface ReferralStrategy {
  targetAudience: string[]
  incentiveMultiplier: number
  campaignDuration: number // days
  expectedROI: number
  channels: string[]
}

/**
 * Generate optimized referral code and strategy for user
 */
export async function generateOptimizedReferral(
  userId: string,
  walletAddress: string
): Promise<{ code: string; strategy: ReferralStrategy }> {
  console.log(`[ReferralAgent] Generating optimized referral for user: ${userId}`)
  
  const db = await getDatabase()
  
  try {
    // Get user profile and network data
    const user = await db.collection('users').findOne({ walletAddress })
    const existingReferrals = await db.collection('referral_codes_v2')
      .findOne({ walletAddress })
    
    // Run agent to optimize referral strategy
    const outcome = await runAgentLoop(
      'Generate and optimize referral strategy',
      {
        userId,
        walletAddress,
        userProfile: user,
        existingPerformance: existingReferrals?.stats || {},
        networkSize: existingReferrals?.referredUsers?.length || 0
      },
      'referral_optimize'
    )
    
    // Extract strategy from agent decision
    const strategy = parseReferralStrategy(outcome)
    
    // Generate or update referral code
    const code = user?.username || generateVanityCode(walletAddress)
    
    // Update database with optimized settings
    await db.collection('referral_codes_v2').updateOne(
      { walletAddress },
      {
        $set: {
          code,
          strategy,
          optimizedAt: new Date(),
          agentOptimized: true
        },
        $setOnInsert: {
          walletAddress,
          createdAt: new Date(),
          stats: {
            totalReferrals: 0,
            totalBurned: 0,
            totalRewards: 0
          }
        }
      },
      { upsert: true }
    )
    
    return { code, strategy }
    
  } catch (error) {
    console.error(`[ReferralAgent] Optimization failed:`, error)
    
    // Fallback strategy
    return {
      code: generateVanityCode(walletAddress),
      strategy: {
        targetAudience: ['crypto_enthusiasts'],
        incentiveMultiplier: 1,
        campaignDuration: 30,
        expectedROI: 1.5,
        channels: ['twitter', 'discord']
      }
    }
  }
}

/**
 * Detect and prevent referral fraud
 */
export async function detectReferralFraud(
  referralCode: string,
  referredWallet: string
): Promise<{ isFraud: boolean; confidence: number; reason?: string }> {
  const db = await getDatabase()
  
  try {
    // Get referral data
    const referral = await db.collection('referral_codes_v2')
      .findOne({ code: referralCode })
    
    if (!referral) {
      return { isFraud: false, confidence: 0 }
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = await checkSuspiciousPatterns(
      referral.walletAddress,
      referredWallet,
      db
    )
    
    // Run fraud detection agent
    const outcome = await runAgentLoop(
      'Detect referral fraud',
      {
        referralCode,
        referrerWallet: referral.walletAddress,
        referredWallet,
        patterns: suspiciousPatterns,
        referralHistory: referral.referredUsers || []
      },
      'fraud_detection'
    )
    
    return {
      isFraud: outcome.threat || false,
      confidence: outcome.decision.confidence,
      reason: outcome.decision.reasoning
    }
    
  } catch (error) {
    console.error(`[ReferralAgent] Fraud detection failed:`, error)
    return { isFraud: false, confidence: 0 }
  }
}

/**
 * Auto-manage referral campaigns
 */
export async function manageReferralCampaign(
  walletAddress: string
): Promise<{ actions: string[]; improvements: number }> {
  const db = await getDatabase()
  const actions: string[] = []
  
  try {
    // Get current campaign data
    const referral = await db.collection('referral_codes_v2')
      .findOne({ walletAddress })
    
    if (!referral) {
      return { actions: ['no_campaign'], improvements: 0 }
    }
    
    // Analyze performance
    const performance = analyzePerformance(referral.stats)
    
    // Run optimization agent
    const outcome = await runAgentLoop(
      'Manage and optimize referral campaign',
      {
        walletAddress,
        currentStats: referral.stats,
        performance,
        strategy: referral.strategy
      },
      'referral_optimize'
    )
    
    // Execute recommended actions
    if (outcome.decision.action === 'increase_incentive') {
      await db.collection('referral_codes_v2').updateOne(
        { walletAddress },
        { $mul: { 'strategy.incentiveMultiplier': 1.2 } }
      )
      actions.push('increased_incentives')
    }
    
    if (outcome.decision.action === 'expand_channels') {
      await db.collection('referral_codes_v2').updateOne(
        { walletAddress },
        { $addToSet: { 'strategy.channels': { $each: ['telegram', 'reddit'] } } }
      )
      actions.push('expanded_channels')
    }
    
    if (outcome.decision.action === 'pause_campaign') {
      await db.collection('referral_codes_v2').updateOne(
        { walletAddress },
        { $set: { paused: true, pausedAt: new Date() } }
      )
      actions.push('paused_underperforming')
    }
    
    // Calculate improvement score
    const improvements = outcome.decision.confidence * 100
    
    return { actions, improvements }
    
  } catch (error) {
    console.error(`[ReferralAgent] Campaign management failed:`, error)
    return { actions: ['error'], improvements: 0 }
  }
}

/**
 * Helper: Parse referral strategy from agent outcome
 */
function parseReferralStrategy(outcome: any): ReferralStrategy {
  const reasoning = outcome.decision.reasoning || ''
  
  // Extract strategy elements from reasoning
  const strategy: ReferralStrategy = {
    targetAudience: [],
    incentiveMultiplier: 1,
    campaignDuration: 30,
    expectedROI: 1.5,
    channels: ['twitter']
  }
  
  // Parse target audience
  if (reasoning.includes('whale')) strategy.targetAudience.push('whales')
  if (reasoning.includes('developer')) strategy.targetAudience.push('developers')
  if (reasoning.includes('trader')) strategy.targetAudience.push('traders')
  if (strategy.targetAudience.length === 0) strategy.targetAudience.push('general')
  
  // Adjust incentives based on confidence
  strategy.incentiveMultiplier = 1 + (outcome.decision.confidence * 0.5)
  
  // Set campaign duration based on urgency
  if (outcome.decision.risks?.includes('high_competition')) {
    strategy.campaignDuration = 14 // Shorter, more intense
  }
  
  // Add channels based on audience
  if (strategy.targetAudience.includes('developers')) {
    strategy.channels.push('github', 'discord')
  }
  if (strategy.targetAudience.includes('traders')) {
    strategy.channels.push('telegram', 'tradingview')
  }
  
  return strategy
}

/**
 * Helper: Generate vanity code from wallet
 */
function generateVanityCode(walletAddress: string): string {
  // Take first 4 and last 4 chars of wallet
  const prefix = walletAddress.slice(0, 4).toLowerCase()
  const suffix = walletAddress.slice(-4).toLowerCase()
  return `${prefix}${suffix}`
}

/**
 * Helper: Check suspicious referral patterns
 */
async function checkSuspiciousPatterns(
  referrer: string,
  referred: string,
  db: any
): Promise<any> {
  const patterns: any = {}
  
  // Check if wallets interacted before
  const previousInteraction = await db.collection('transactions')
    .findOne({
      $or: [
        { from: referrer, to: referred },
        { from: referred, to: referrer }
      ]
    })
  
  patterns.hadPreviousInteraction = !!previousInteraction
  
  // Check creation time proximity
  const [referrerUser, referredUser] = await Promise.all([
    db.collection('users').findOne({ walletAddress: referrer }),
    db.collection('users').findOne({ walletAddress: referred })
  ])
  
  if (referrerUser?.createdAt && referredUser?.createdAt) {
    const timeDiff = Math.abs(
      new Date(referrerUser.createdAt).getTime() - 
      new Date(referredUser.createdAt).getTime()
    )
    patterns.createdWithinHour = timeDiff < 60 * 60 * 1000
  }
  
  // Check IP address similarity (if available)
  const sessions = await db.collection('sessions')
    .find({ 
      userId: { $in: [referrerUser?._id, referredUser?._id] } 
    })
    .toArray()
  
  const ips = sessions.map(s => s.ipAddress).filter(Boolean)
  patterns.sameIP = ips.length > 1 && new Set(ips).size < ips.length
  
  return patterns
}

/**
 * Helper: Analyze referral performance
 */
function analyzePerformance(stats: any): any {
  const performance: any = {}
  
  performance.conversionRate = stats.totalReferrals > 0 
    ? stats.totalBurned / stats.totalReferrals 
    : 0
    
  performance.avgRewardPerReferral = stats.totalReferrals > 0
    ? stats.totalRewards / stats.totalReferrals
    : 0
    
  performance.isUnderperforming = performance.conversionRate < 0.1
  performance.isOverperforming = performance.conversionRate > 0.5
  
  return performance
}