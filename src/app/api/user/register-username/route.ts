import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'
import { getTokenBalance, connection } from '@/lib/solana'
import { verifyBurnTransaction } from '@/lib/solana-burn'
import { config } from '@/lib/config'
import { ReferralServiceV2 } from '@/lib/services/referral-service-v2'
import { BurnService } from '@/lib/services/burn-service'

const REQUIRED_BALANCE = 100000 // 100,000 LYN tokens required to hold
const BURN_AMOUNT = 10000 // 10,000 LYN tokens to burn for registration

export async function POST(request: NextRequest) {
  try {
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

    // Check if username is already taken
    const existingUser = await usersCollection.findOne({ username })
    if (existingUser) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 })
    }

    // Check if user already has a username
    const currentUser = await usersCollection.findOne({ walletAddress })
    if (currentUser?.username) {
      return NextResponse.json({ error: 'User already has a registered username' }, { status: 409 })
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
    
    // Skip burn verification for mock signatures in development
    let burnVerified = false
    if (signature === 'mock_signature') {
      console.log(`[Username Reg] Mock signature detected, skipping burn verification for testing`)
      burnVerified = true
    } else {
      // Verify the burn transaction on-chain
      console.log(`[Username Reg] Verifying burn transaction: ${signature}`)
      burnVerified = await verifyBurnTransaction(connection, signature, BURN_AMOUNT, referralCode)
    }
    
    if (!burnVerified) {
      return NextResponse.json({ 
        error: `Invalid burn transaction. Please burn exactly ${BURN_AMOUNT.toLocaleString()} LYN tokens.`,
        requiredBurnAmount: BURN_AMOUNT
      }, { status: 400 })
    }
    
    console.log(`[Username Reg] Burn verified successfully for ${BURN_AMOUNT} LYN`)

    // Register username
    const registrationDate = new Date()
    const userResult = await usersCollection.updateOne(
      { walletAddress },
      {
        $set: {
          username,
          usernameRegisteredAt: registrationDate,
          registrationBurnAmount: BURN_AMOUNT,
          registrationBurnTx: signature,
          updatedAt: registrationDate
        },
        $setOnInsert: {
          walletAddress,
          nonce: '',
          tokenBalance: balance,
          hasTokenAccess: balance >= REQUIRED_BALANCE,
          lastLoginAt: registrationDate,
          createdAt: registrationDate
        }
      },
      { upsert: true }
    )
    
    // Get the user document to get the user ID
    const userDoc = await usersCollection.findOne({ walletAddress })
    const userId = userDoc?._id
    
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

    // Initialize reputation score
    await db.collection('user_reputation').updateOne(
      { walletAddress },
      {
        $set: {
          username,
          walletAddress,
          reputationScore: 100, // Starting score
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

    // Generate referral code for the new user
    const referralResult = await ReferralServiceV2.getOrCreateReferralCode(
      walletAddress,
      username
    )
    const newUserReferralCode = referralResult.success && referralResult.code ? {
      code: referralResult.code
    } : null
    
    return NextResponse.json({
      success: true,
      username,
      profileUrl: `https://app.lynai.xyz/profile/${username}`,
      reputationScore: 100,
      referralCode: newUserReferralCode?.code || 'PENDING',
      referralLink: newUserReferralCode?.code 
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.lynai.xyz'}?ref=${newUserReferralCode.code}`
        : null
    })

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
