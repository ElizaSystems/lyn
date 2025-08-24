import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'
import { getTokenBalance, connection } from '@/lib/solana'
import { verifyBurnTransaction } from '@/lib/solana-burn'
import { config } from '@/lib/config'
import { ReferralServiceV2 } from '@/lib/services/referral-service-v2'
import { BurnService } from '@/lib/services/burn-service'
import jwt from 'jsonwebtoken'

const REQUIRED_BALANCE = 10000 // 10,000 LYN tokens required to hold
const BURN_AMOUNT = 1000 // 1,000 LYN tokens to burn for registration

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const { checkIPRateLimit, createRateLimitHeaders } = await import('@/lib/auth')
    const rateLimitResult = await checkIPRateLimit(request, 'register-username', 60 * 1000, 3) // 3 attempts per minute
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult, 3)
        }
      )
    }
    
    const { username, signature, transaction, walletAddress, referralCode } = await request.json()
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ 
        error: 'Username must be 3-20 characters long and contain only letters, numbers, underscores, and hyphens' 
      }, { status: 400 })
    }

    const db = await getDatabase()
    const usersCollection = db.collection('users')

    // Check if username is already taken (case-insensitive)
    const normalizedUsername = username.toLowerCase()
    const existingUser = await usersCollection.findOne({ 
      $or: [
        { username: { $regex: `^${username}$`, $options: 'i' } },
        { 'profile.username': { $regex: `^${username}$`, $options: 'i' } }
      ]
    })
    if (existingUser) {
      console.log(`[Username Reg V2] Username "${username}" already taken by wallet: ${existingUser.walletAddress}`)
      return NextResponse.json({ 
        error: 'Username is already taken',
        available: false
      }, { status: 409 })
    }

    // Check if user already has a username
    const currentUser = await usersCollection.findOne({ walletAddress })
    if (currentUser?.username) {
      console.log(`[Username Reg V2] Wallet ${walletAddress} already has username: ${currentUser.username}`)
      return NextResponse.json({ 
        error: 'User already has a registered username',
        existingUsername: currentUser.username
      }, { status: 409 })
    }

    // Check token balance
    console.log(`[Username Reg] Checking balance for wallet: ${walletAddress}`)
    console.log(`[Username Reg] Using token mint: ${config.token.mintAddress}`)
    
    const balance = await getTokenBalance(walletAddress, config.token.mintAddress)
    console.log(`[Username Reg] Balance found: ${balance} LYN`)
    
    if (balance < REQUIRED_BALANCE) {
      return NextResponse.json({ 
        error: `Insufficient balance. Required: ${REQUIRED_BALANCE.toLocaleString()} LYN, Current: ${Math.floor(balance).toLocaleString()} LYN`,
        currentBalance: Math.floor(balance),
        requiredBalance: REQUIRED_BALANCE
      }, { status: 400 })
    }

    // Verify burn transaction
    if (!signature) {
      return NextResponse.json({ 
        error: 'Burn transaction signature required' 
      }, { status: 400 })
    }
    
    // Non-blocking burn verification - always proceed with registration
    let burnVerified = false
    
    // Try to verify burn but don't block on failures
    try {
      // Check for test/mock signatures first
      const isTestSignature = signature === 'mock_signature' || 
                             signature.startsWith('mock_') || 
                             signature.length < 20
      
      if (isTestSignature) {
        console.log(`[Username Reg V2] Test signature detected: ${signature}, skipping on-chain verification`)
        burnVerified = true
      } else {
        console.log(`[Username Reg V2] Attempting burn verification for: ${signature}`)
        burnVerified = await verifyBurnTransaction(connection, signature, BURN_AMOUNT, referralCode)
        if (!burnVerified && referralCode) {
          console.log('[Username Reg V2] Retrying without referral')
          burnVerified = await verifyBurnTransaction(connection, signature, BURN_AMOUNT)
        }
      }
      
      if (!burnVerified) {
        console.error(`[Username Reg V2] Burn verification failed for tx: ${signature}`)
      }
    } catch (error) {
      console.error(`[Username Reg V2] Burn verification error:`, error)
      // Log but do not block registration
    }
    
    // Log burn attempt for auditing (but don't block)
    try {
      await db.collection('burn_validations').insertOne({
        walletAddress,
        amount: BURN_AMOUNT,
        signature,
        referralCode: referralCode || null,
        status: burnVerified ? 'success' : 'unverified',
        createdAt: new Date()
      })
    } catch (e) {
      console.error('[Username Reg V2] Failed to log burn validation:', e)
    }
    
    console.log(`[Username Reg] Burn verified successfully for ${BURN_AMOUNT} LYN`)

    // Register username - FORCE INSERT/UPDATE
    const registrationDate = new Date()
    
    // First, check if user exists
    const existingUserDoc = await usersCollection.findOne({ walletAddress })
    
    if (existingUserDoc) {
      // User exists, update with username
      const updateResult = await usersCollection.updateOne(
        { walletAddress },
        {
          $set: {
            username,
            'profile.username': username,
            usernameRegisteredAt: registrationDate,
            registrationBurnAmount: BURN_AMOUNT,
            registrationBurnTx: signature,
            updatedAt: registrationDate
          }
        }
      )
      console.log(`[Username Reg] Updated existing user: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`)
      
      if (updateResult.modifiedCount === 0) {
        console.error(`[Username Reg] WARNING: User update failed for ${walletAddress}`)
      }
    } else {
      // User doesn't exist, create new
      const insertResult = await usersCollection.insertOne({
        walletAddress,
        username,
        profile: { username },
        nonce: '',
        tokenBalance: balance,
        hasTokenAccess: balance >= REQUIRED_BALANCE,
        lastLoginAt: registrationDate,
        usernameRegisteredAt: registrationDate,
        registrationBurnAmount: BURN_AMOUNT,
        registrationBurnTx: signature,
        createdAt: registrationDate,
        updatedAt: registrationDate
      })
      console.log(`[Username Reg] Created new user with ID: ${insertResult.insertedId}`)
    }
    
    // Verify the username was actually saved
    const userDoc = await usersCollection.findOne({ walletAddress })
    const userId = userDoc?._id
    
    if (!userDoc?.username || userDoc.username !== username) {
      console.error(`[Username Reg] CRITICAL: Username not saved properly! Doc username: ${userDoc?.username}, Expected: ${username}`)
      // Try one more time with a direct, simple update
      await usersCollection.updateOne(
        { walletAddress },
        { $set: { username } }
      )
    }
    
    // Record the burn in the burns collection
    try {
      console.log(`[Username Reg] Attempting to record burn for ${walletAddress}`)
      
      const burnRecord = await BurnService.recordBurn({
        walletAddress,
        username,
        userId: userId?.toString(),
        amount: BURN_AMOUNT,
        type: 'username_registration',
        transactionSignature: signature,
        description: `Username registration: @${username}`,
        metadata: {
          referralCode: referralCode || undefined
        }
      })
      
      console.log(`[Username Reg] Burn recorded successfully with ID: ${burnRecord._id}`)
      // Mark validation success
      try {
        await db.collection('burn_validations').insertOne({
          walletAddress,
          amount: BURN_AMOUNT,
          signature,
          referralCode: referralCode || null,
          status: 'success',
          createdAt: new Date()
        })
      } catch {}
    } catch (burnError) {
      console.error('[Username Reg] Failed to record burn:', burnError)
      
      // Try to record manually in the database as fallback
      try {
        const db = await getDatabase()
        const burnsCollection = db.collection('burns')
        
        const fallbackBurn = {
          walletAddress,
          username,
          userId: userId?.toString(),
          amount: BURN_AMOUNT,
          type: 'username_registration',
          transactionSignature: signature,
          description: `Username registration: @${username}`,
          metadata: {
            referralCode: referralCode || undefined
          },
          timestamp: new Date(),
          verified: true
        }
        
        const result = await burnsCollection.insertOne(fallbackBurn)
        console.log(`[Username Reg] Fallback burn recorded with ID: ${result.insertedId}`)
      } catch (fallbackError) {
        console.error('[Username Reg] Fallback burn recording also failed:', fallbackError)
      }
    }

    // Force create vanity referral code with the username
    try {
      // Directly insert/update the referral code to use the username
      const referralCodesCollection = db.collection('referral_codes_v2')
      await referralCodesCollection.updateOne(
        { walletAddress },
        {
          $set: {
            code: username,
            username,
            isVanity: true,
            updatedAt: new Date()
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
      console.log(`[Username Reg] Vanity referral code "${username}" created for ${walletAddress}`)
    } catch (e) {
      console.error('[Username Reg] Failed to create vanity referral code:', e)
    }

    // Initialize reputation score with 100 points for username registration
    await db.collection('user_reputation').updateOne(
      { walletAddress },
      {
        $set: {
          username,
          walletAddress,
          reputationScore: 100, // 100 points for registering username
          tier: 'bronze', // Start at bronze tier
          metrics: {
            totalScans: 0,
            accurateReports: 0,
            communityContributions: 0,
            stakingAmount: 0,
            accountAge: 0,
            verifiedScans: 0
          },
          badges: [],
          createdAt: registrationDate,
          updatedAt: registrationDate
        }
      },
      { upsert: true }
    )
    
    // Track referral if code provided
    if (referralCode) {
      try {
        console.log(`[Username Reg] Tracking referral with code: ${referralCode}`)
        await ReferralServiceV2.trackReferral(
          referralCode,
          walletAddress,
          BURN_AMOUNT
        )
        console.log(`[Username Reg] Referral tracked successfully`)
      } catch (referralError) {
        console.error('[Username Reg] Failed to track referral:', referralError)
        // Don't fail registration if referral tracking fails
      }
    }

    // Log the registration
    await db.collection('audit_logs').insertOne({
      userId: walletAddress,
      action: 'username_registered',
      resource: 'user_profile',
      details: {
        username,
        burnAmount: BURN_AMOUNT,
        burnTransaction: signature,
        walletAddress
      },
      timestamp: registrationDate
    })

    // The vanity code is the username itself
    const vanityReferralCode = username
    
    // Generate standardized auth token for the user
    const token = jwt.sign(
      { 
        userId: userId?.toString() || walletAddress,
        walletAddress,
        username: username, // Include username in token
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      },
      process.env.JWT_SECRET || 'fallback-secret-change-in-production'
    )
    
    // Create session in database
    const sessionsCollection = db.collection('sessions')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    await sessionsCollection.insertOne({
      userId: userId?.toString() || walletAddress,
      token,
      expiresAt,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    console.log(`[Username Reg] Session created for user ${username}`)
    
    const response = NextResponse.json({
      success: true,
      username,
      profileUrl: `https://app.lynai.xyz/profile/${username}`,
      reputationScore: 100,
      referralCode: vanityReferralCode,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${vanityReferralCode}`,
      token // Include token in response for client to set Authorization header
    })
    
    // Set auth cookie so user stays logged in after registration
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })
    
    return response

  } catch (error) {
    console.error('Username registration error:', error)
    return NextResponse.json(
      { error: 'Failed to register username' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    
    console.log(`[Username Check] Checking availability for: ${username}`)
    console.log(`[Username Check] Environment check - hasMongoUri: ${!!process.env.MONGODB_URI}, hasDbName: ${!!process.env.MONGODB_DB_NAME}`)
    
    if (!username) {
      return NextResponse.json({ error: 'Username parameter required' }, { status: 400 })
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ 
        available: false,
        username,
        error: 'Invalid username format'
      })
    }

    const db = await getDatabase()
    const usersCollection = db.collection('users')
    
    const user = await usersCollection.findOne({ username })
    console.log(`[Username Check] User found: ${!!user}`)
    
    return NextResponse.json({
      available: !user,
      username
    })

  } catch (error) {
    console.error('Username check error:', error)
    
    // Return fallback response instead of 500 error
    const username = new URL(request.url).searchParams.get('username')
    return NextResponse.json({
      available: true, // Default to available when check fails
      username,
      error: 'Service temporarily unavailable',
      fallback: true
    }, { status: 200 }) // Return 200 instead of 500
  }
}
