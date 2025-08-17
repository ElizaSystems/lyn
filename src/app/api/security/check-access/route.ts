import { NextRequest, NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/mongodb'
import { getTokenBalance } from '@/lib/solana'
import { config } from '@/lib/config'
import { PublicKey } from '@solana/web3.js'

const REQUIRED_TOKEN_AMOUNT = 1000 // Minimum LYN tokens required
const FREE_QUESTIONS_LIMIT = 10 // Free questions per session

export const POST = withMiddleware(
  async (req: NextRequest, context) => {
    const { walletAddress, sessionId } = await req.json()
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    let user = context.user
    let tokenBalance = 0
    let hasTokenAccess = false

    // If wallet address provided, check token balance and get/create user
    if (walletAddress) {
      try {
        // Validate wallet address
        new PublicKey(walletAddress)
        
        // Get token balance
        tokenBalance = await getTokenBalance(walletAddress, config.token.mintAddress)
        hasTokenAccess = tokenBalance >= REQUIRED_TOKEN_AMOUNT

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

    // Calculate questions remaining (track separately in analytics)
    const questionsAsked = 0 // Will be tracked in analytics collection
    const questionsRemaining = hasTokenAccess 
      ? null // Unlimited for token holders
      : Math.max(0, FREE_QUESTIONS_LIMIT - questionsAsked)
    
    const canAskQuestion = hasTokenAccess || questionsAsked < FREE_QUESTIONS_LIMIT

    return NextResponse.json({
      hasAccess: hasTokenAccess,
      tokenBalance,
      requiredTokens: REQUIRED_TOKEN_AMOUNT,
      questionsAsked,
      freeQuestionsLimit: FREE_QUESTIONS_LIMIT,
      canAskQuestion,
      questionsRemaining,
      reason: !canAskQuestion 
        ? `Free limit of ${FREE_QUESTIONS_LIMIT} questions reached. Hold ${REQUIRED_TOKEN_AMOUNT} LYN tokens for unlimited access.`
        : null,
      requiresTokens: !hasTokenAccess && questionsAsked >= FREE_QUESTIONS_LIMIT,
      tokenInfo: {
        tokenSymbol: config.token.symbol,
        requiredAmount: REQUIRED_TOKEN_AMOUNT,
        freeQuestionsLimit: FREE_QUESTIONS_LIMIT,
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

export const GET = withMiddleware(
  async () => {
    return NextResponse.json({
      tokenInfo: {
        tokenSymbol: config.token.symbol,
        requiredAmount: REQUIRED_TOKEN_AMOUNT,
        freeQuestionsLimit: FREE_QUESTIONS_LIMIT,
      },
      message: `Hold at least ${REQUIRED_TOKEN_AMOUNT} ${config.token.symbol} tokens for unlimited access. Free users get ${FREE_QUESTIONS_LIMIT} questions.`
    })
  },
  {
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 60,
      action: 'token-info',
    },
  }
)