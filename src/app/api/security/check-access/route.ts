import { NextRequest, NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/mongodb'
import { getTokenBalance } from '@/lib/solana'
import { config } from '@/lib/config'
import { PublicKey } from '@solana/web3.js'

// Token tier thresholds
const UNLIMITED_TOKEN_AMOUNT = 10000000 // 10M LYN for unlimited access
const ELITE_TOKEN_AMOUNT = 1000000 // 1M LYN for 250 scans per day
const PREMIUM_TOKEN_AMOUNT = 100000 // 100k LYN for 20 scans per day
const BASIC_TOKEN_AMOUNT = 10000 // 10k LYN for 2 scans per day
const FREE_QUESTIONS_LIMIT = 1 // Free questions per day for users with no tokens

// Add GET handler for the route
export async function GET(request: NextRequest) {
  return POST(request)
}

// Helper to get user's daily usage (works with both userId and sessionId)
async function getDailyUsage(identifier: string): Promise<{ scansToday: number; lastResetDate: Date }> {
  try {
    const database = await db.checkDatabaseHealth() ? await import('@/lib/mongodb').then(m => m.getDatabase()) : null
    if (!database) {
      // Use in-memory storage as fallback
      return { scansToday: 0, lastResetDate: new Date() }
    }
    
    const usageCollection = database.collection('daily_usage')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const usage = await usageCollection.findOne({ 
      $or: [
        { userId: identifier },
        { sessionId: identifier }
      ],
      date: { $gte: today } 
    })
    
    if (!usage) {
      // Create new daily usage record
      await usageCollection.insertOne({
        sessionId: identifier,
        userId: identifier.startsWith('session_') ? null : identifier,
        date: today,
        scansToday: 0,
        lastResetDate: today
      })
      return { scansToday: 0, lastResetDate: today }
    }
    
    return { 
      scansToday: usage.scansToday || 0, 
      lastResetDate: usage.lastResetDate || today 
    }
  } catch (error) {
    console.log('Could not get daily usage from DB:', error)
    return { scansToday: 0, lastResetDate: new Date() }
  }
}

// Helper to increment daily usage (works with both userId and sessionId)
async function incrementDailyUsage(identifier: string): Promise<void> {
  try {
    const database = await db.checkDatabaseHealth() ? await import('@/lib/mongodb').then(m => m.getDatabase()) : null
    if (!database) return
    
    const usageCollection = database.collection('daily_usage')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const query = identifier.startsWith('session_') 
      ? { sessionId: identifier, date: { $gte: today } }
      : { userId: identifier, date: { $gte: today } }
    
    await usageCollection.updateOne(
      query,
      { 
        $inc: { scansToday: 1 },
        $set: { 
          lastUpdate: new Date(),
          sessionId: identifier.startsWith('session_') ? identifier : undefined,
          userId: !identifier.startsWith('session_') ? identifier : undefined
        }
      },
      { upsert: true }
    )
  } catch (error) {
    console.log('Could not update daily usage:', error)
  }
}

export const POST = withMiddleware(
  async (req: NextRequest, context) => {
    const { walletAddress, sessionId } = await req.json()
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    let user = context.user
    let tokenBalance = 0
    let accessTier: 'unlimited' | 'elite' | 'premium' | 'basic' | 'free' = 'free'
    let dailyLimit = FREE_QUESTIONS_LIMIT
    let hasTokenAccess = false

    // If wallet address provided, check token balance and get/create user
    if (walletAddress) {
      try {
        // Validate wallet address
        new PublicKey(walletAddress)
        
        // Get token balance
        tokenBalance = await getTokenBalance(walletAddress, config.token.mintAddress)
        
        // Determine access tier based on token balance
        if (tokenBalance >= UNLIMITED_TOKEN_AMOUNT) {
          accessTier = 'unlimited'
          hasTokenAccess = true
          dailyLimit = -1 // No limit
        } else if (tokenBalance >= ELITE_TOKEN_AMOUNT) {
          accessTier = 'elite'
          hasTokenAccess = true
          dailyLimit = 250 // 250 scans per day
        } else if (tokenBalance >= PREMIUM_TOKEN_AMOUNT) {
          accessTier = 'premium'
          hasTokenAccess = true
          dailyLimit = 20 // 20 scans per day
        } else if (tokenBalance >= BASIC_TOKEN_AMOUNT) {
          accessTier = 'basic'
          hasTokenAccess = true
          dailyLimit = 2 // 2 scans per day
        } else {
          accessTier = 'free'
          hasTokenAccess = false
          dailyLimit = FREE_QUESTIONS_LIMIT
        }

        // Get or create user
        const existingUser = await db.users.findByWalletAddress(walletAddress)
        if (existingUser) {
          const updatedUser = await db.users.update(existingUser._id!.toString(), {
            tokenBalance,
            hasTokenAccess,
          })
          if (updatedUser) {
            user = { 
              id: updatedUser._id!.toString(),
              walletAddress: updatedUser.walletAddress,
              tokenBalance,
              hasTokenAccess,
              questionsAsked: 0
            }
          }
        } else {
          const newUser = await db.users.create({
            walletAddress,
            nonce: '',
            tokenBalance,
            hasTokenAccess,
            lastLoginAt: new Date(),
          })
          user = {
            id: newUser._id!.toString(),
            walletAddress: newUser.walletAddress,
            tokenBalance,
            hasTokenAccess,
            questionsAsked: 0
          }
        }

        // Log token check
        if (user) {
          await db.analytics.trackEvent({
            userId: user.id,
            eventType: 'token_check',
            eventData: {
              walletAddress,
              tokenBalance,
              hasTokenAccess,
            },
            sessionId: user.id,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          })
        }

      } catch (error) {
        console.error('Error checking wallet balance:', error)
        // Continue without token access
      }
    }

    // Get the identifier for tracking (userId if logged in, sessionId if anonymous)
    const trackingId = user?.id || sessionId
    
    // Check for X (Twitter) connected free scans
    let xFreeScansRemaining = 0
    let xUsername: string | null = null
    if (walletAddress) {
      try {
        const database = await db.checkDatabaseHealth() ? await import('@/lib/mongodb').then(m => m.getDatabase()) : null
        if (database) {
          const usersCollection = database.collection('users')
          const scansCollection = database.collection('user_scan_quotas')
          
          const userDoc = await usersCollection.findOne({ walletAddress })
          if (userDoc?.xUsername) {
            xUsername = userDoc.xUsername
            
            const currentMonth = new Date().toISOString().slice(0, 7)
            const scanQuota = await scansCollection.findOne({
              walletAddress,
              month: currentMonth
            })
            
            const xFreeScans = scanQuota?.xFreeScans || 5
            const xFreeScansUsed = scanQuota?.xFreeScansUsed || 0
            xFreeScansRemaining = Math.max(0, xFreeScans - xFreeScansUsed)
          }
        }
      } catch (error) {
        console.log('Could not check X free scans:', error)
      }
    }
    
    // Get daily usage
    const { scansToday, lastResetDate } = await getDailyUsage(trackingId)
    
    // Calculate remaining scans based on tier (including X free scans)
    let scansRemaining: number | null = null
    let canScan = false
    let upgradeMessage = ''
    
    if (accessTier === 'unlimited') {
      scansRemaining = null // Unlimited
      canScan = true
      upgradeMessage = ''
    } else if (accessTier === 'elite') {
      scansRemaining = Math.max(0, 250 - scansToday)
      canScan = scansToday < 250
      if (!canScan) {
        upgradeMessage = `Daily limit reached (250 scans). Hold ${UNLIMITED_TOKEN_AMOUNT.toLocaleString()} LYN tokens for unlimited access.`
      }
    } else if (accessTier === 'premium') {
      scansRemaining = Math.max(0, 20 - scansToday)
      canScan = scansToday < 20
      if (!canScan) {
        upgradeMessage = `Daily limit reached (20 scans). Upgrade for more:\n• ${ELITE_TOKEN_AMOUNT.toLocaleString()} LYN = 250 scans/day\n• ${UNLIMITED_TOKEN_AMOUNT.toLocaleString()} LYN = Unlimited`
      }
    } else if (accessTier === 'basic') {
      scansRemaining = Math.max(0, 2 - scansToday)
      canScan = scansToday < 2
      if (!canScan) {
        upgradeMessage = `Daily limit reached (2 scans). Upgrade for more:\n• ${PREMIUM_TOKEN_AMOUNT.toLocaleString()} LYN = 20 scans/day\n• ${ELITE_TOKEN_AMOUNT.toLocaleString()} LYN = 250 scans/day\n• ${UNLIMITED_TOKEN_AMOUNT.toLocaleString()} LYN = Unlimited`
      }
    } else {
      // Free tier - check X free scans first
      if (xFreeScansRemaining > 0) {
        scansRemaining = xFreeScansRemaining
        canScan = true
        // Will use X free scan
      } else {
        scansRemaining = Math.max(0, FREE_QUESTIONS_LIMIT - scansToday)
        canScan = scansToday < FREE_QUESTIONS_LIMIT
      }
      
      if (!canScan) {
        if (!walletAddress) {
          upgradeMessage = `Daily free scan used. Connect wallet with LYN tokens or connect X account for more scans:\n• Connect X = 5 free scans/month\n• ${BASIC_TOKEN_AMOUNT.toLocaleString()} LYN = 2 scans/day\n• ${PREMIUM_TOKEN_AMOUNT.toLocaleString()} LYN = 20 scans/day`
        } else if (!xUsername) {
          upgradeMessage = `Daily free scan used. Connect your X account for 5 free scans/month or get LYN tokens:\n• Connect X = 5 free scans/month\n• ${BASIC_TOKEN_AMOUNT.toLocaleString()} LYN = 2 scans/day\n• ${PREMIUM_TOKEN_AMOUNT.toLocaleString()} LYN = 20 scans/day`
        } else {
          upgradeMessage = `All free scans used. Get LYN tokens for more:\n• ${BASIC_TOKEN_AMOUNT.toLocaleString()} LYN = 2 scans/day\n• ${PREMIUM_TOKEN_AMOUNT.toLocaleString()} LYN = 20 scans/day\n• ${ELITE_TOKEN_AMOUNT.toLocaleString()} LYN = 250 scans/day`
        }
      }
    }
    
    // Calculate time until reset (midnight UTC)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setUTCHours(24, 0, 0, 0)
    const hoursUntilReset = Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60))

    return NextResponse.json({
      hasAccess: hasTokenAccess,
      tokenBalance,
      accessTier,
      scansToday,
      dailyLimit: dailyLimit === -1 ? 'unlimited' : dailyLimit,
      scansRemaining: scansRemaining === null ? 'unlimited' : scansRemaining,
      canScan,
      hoursUntilReset,
      lastResetDate,
      upgradeMessage,
      requiresTokens: !hasTokenAccess && scansToday >= FREE_QUESTIONS_LIMIT,
      xConnected: !!xUsername,
      xUsername,
      xFreeScansRemaining,
      useXFreeScan: !hasTokenAccess && xFreeScansRemaining > 0 && canScan,
      tokenInfo: {
        tokenSymbol: config.token.symbol,
        tiers: {
          free: {
            tokens: 0,
            scansPerDay: FREE_QUESTIONS_LIMIT,
            description: '1 free scan per day'
          },
          basic: {
            tokens: BASIC_TOKEN_AMOUNT,
            scansPerDay: 2,
            description: '2 scans per day'
          },
          premium: {
            tokens: PREMIUM_TOKEN_AMOUNT,
            scansPerDay: 20,
            description: '20 scans per day'
          },
          elite: {
            tokens: ELITE_TOKEN_AMOUNT,
            scansPerDay: 250,
            description: '250 scans per day'
          },
          unlimited: {
            tokens: UNLIMITED_TOKEN_AMOUNT,
            scansPerDay: 'unlimited',
            description: 'Unlimited scans'
          }
        },
        currentTier: accessTier,
        nextTier: 
          accessTier === 'free' ? 'basic' : 
          accessTier === 'basic' ? 'premium' : 
          accessTier === 'premium' ? 'elite' :
          accessTier === 'elite' ? 'unlimited' : null,
        tokensNeededForNextTier: 
          accessTier === 'free' ? BASIC_TOKEN_AMOUNT - tokenBalance :
          accessTier === 'basic' ? PREMIUM_TOKEN_AMOUNT - tokenBalance :
          accessTier === 'premium' ? ELITE_TOKEN_AMOUNT - tokenBalance :
          accessTier === 'elite' ? UNLIMITED_TOKEN_AMOUNT - tokenBalance : 0
      }
    })
  },
  {
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 checks per minute
      action: 'access-check',
    },
    analytics: {
      trackEvent: 'access_check',
    },
  }
)