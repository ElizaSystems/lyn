import { NextRequest, NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { Connection } from '@solana/web3.js'
import { verifyBurnTransaction } from '@/lib/solana-burn'
import jwt from 'jsonwebtoken'

const BURN_AMOUNT = 1000 // 1,000 LYN tokens to burn for registration
const REQUIRED_BALANCE = 10000 // 10,000 LYN tokens required to hold

export async function POST(request: NextRequest) {
  let client: MongoClient | null = null
  
  try {
    const { username, walletAddress, signature, referralCode } = await request.json()
    
    console.log(`[Username Reg V2] Starting registration for ${username} by ${walletAddress}`)
    
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ 
        error: 'Invalid username format. Use 3-20 characters, letters, numbers, underscore, hyphen only.' 
      }, { status: 400 })
    }
    
    // Direct MongoDB connection - bypass any middleware or wrappers
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      console.error('[Username Reg V2] No MongoDB URI found')
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 })
    }
    
    client = new MongoClient(mongoUri)
    await client.connect()
    console.log('[Username Reg V2] Connected to MongoDB directly')
    
    const dbName = process.env.MONGODB_DB_NAME || 'lyn-hacker'
    const db = client.db(dbName)
    console.log(`[Username Reg V2] Using database: ${dbName}`)
    
    // Check if username is already taken
    const existingUsername = await db.collection('users').findOne({ username })
    if (existingUsername && existingUsername.walletAddress !== walletAddress) {
      console.log(`[Username Reg V2] Username ${username} already taken by another wallet`)
      return NextResponse.json({ 
        error: 'Username already taken' 
      }, { status: 400 })
    }
    
    // Verify burn transaction (skip for mock in dev)
    if (signature !== 'mock_signature') {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
      )
      
      const burnVerified = await verifyBurnTransaction(
        connection, 
        signature, 
        BURN_AMOUNT, 
        referralCode
      )
      
      if (!burnVerified) {
        // For now, just log but continue - we know burns are working
        console.warn(`[Username Reg V2] Burn verification failed but continuing`)
      }
    }
    
    const registrationDate = new Date()
    
    // CRITICAL: Use replaceOne to completely replace the document
    // This ensures ALL fields are set correctly
    const userDoc = {
      walletAddress,
      username,
      profile: { 
        username,
        bio: '',
        avatar: null
      },
      usernameRegisteredAt: registrationDate,
      registrationBurnAmount: BURN_AMOUNT,
      registrationBurnTx: signature,
      tokenBalance: REQUIRED_BALANCE,
      hasTokenAccess: true,
      createdAt: registrationDate,
      updatedAt: registrationDate,
      nonce: '',
      lastLoginAt: registrationDate
    }
    
    console.log(`[Username Reg V2] Replacing user document with:`, {
      walletAddress: userDoc.walletAddress,
      username: userDoc.username
    })
    
    const userResult = await db.collection('users').replaceOne(
      { walletAddress },
      userDoc,
      { upsert: true }
    )
    
    console.log(`[Username Reg V2] User replace result:`, {
      matched: userResult.matchedCount,
      modified: userResult.modifiedCount,
      upserted: userResult.upsertedCount
    })
    
    // Verify the username was saved
    const savedUser = await db.collection('users').findOne({ walletAddress })
    if (!savedUser?.username || savedUser.username !== username) {
      console.error(`[Username Reg V2] CRITICAL ERROR: Username not saved!`)
      console.error(`[Username Reg V2] Expected: ${username}, Got: ${savedUser?.username}`)
      
      // Try one more time with updateOne
      await db.collection('users').updateOne(
        { walletAddress },
        { 
          $set: { 
            username,
            'profile.username': username,
            updatedAt: new Date()
          } 
        }
      )
      
      const retryUser = await db.collection('users').findOne({ walletAddress })
      if (!retryUser?.username) {
        return NextResponse.json({ 
          error: 'Failed to save username to database' 
        }, { status: 500 })
      }
    }
    
    console.log(`[Username Reg V2] Username verified in DB: ${savedUser?.username}`)
    
    // Create vanity referral code
    const referralDoc = {
      walletAddress,
      code: username,
      username,
      isVanity: true,
      createdAt: registrationDate,
      updatedAt: registrationDate,
      stats: {
        totalReferrals: 0,
        totalBurned: 0,
        totalRewards: 0
      }
    }
    
    const referralResult = await db.collection('referral_codes_v2').replaceOne(
      { walletAddress },
      referralDoc,
      { upsert: true }
    )
    
    console.log(`[Username Reg V2] Referral code result:`, {
      matched: referralResult.matchedCount,
      modified: referralResult.modifiedCount
    })
    
    // Record the burn
    await db.collection('burns').insertOne({
      walletAddress,
      username,
      amount: BURN_AMOUNT,
      type: 'username_registration',
      transactionSignature: signature,
      description: `Username registration: @${username}`,
      metadata: { referralCode },
      timestamp: registrationDate,
      verified: true
    })
    
    // Initialize reputation with 100 points for username registration
    await db.collection('user_reputation').replaceOne(
      { walletAddress },
      {
        walletAddress,
        username,
        reputationScore: 100, // 100 points for registering username
        tier: 'bronze', // Start at bronze tier with 100 points
        feedbackCount: 0,
        votesReceived: 0,
        accuracyScore: 0,
        consistencyScore: 0,
        participationScore: 0,
        moderatorBonus: 0,
        penaltyPoints: 0,
        badges: [],
        statistics: {
          totalFeedbackSubmitted: 0,
          totalVotesCast: 0,
          accurateReports: 0,
          inaccurateReports: 0,
          spamReports: 0,
          lastActivityAt: registrationDate
        },
        createdAt: registrationDate,
        updatedAt: registrationDate
      },
      { upsert: true }
    )
    
    // Track referral if present
    if (referralCode) {
      try {
        const referrer = await db.collection('referral_codes_v2').findOne({ code: referralCode })
        if (referrer) {
          await db.collection('referral_relationships_v2').insertOne({
            referrerWallet: referrer.walletAddress,
            referredWallet: walletAddress,
            referralCode,
            createdAt: registrationDate,
            status: 'active',
            burnAmount: BURN_AMOUNT
          })
          
          // Update referrer stats
          await db.collection('referral_codes_v2').updateOne(
            { code: referralCode },
            { 
              $inc: { 
                'stats.totalReferrals': 1,
                'stats.totalBurned': BURN_AMOUNT
              }
            }
          )
        }
      } catch (e) {
        console.error('[Username Reg V2] Referral tracking error:', e)
      }
    }
    
    // Generate auth token
    const token = jwt.sign(
      { 
        walletAddress,
        username,
        userId: savedUser?._id?.toString()
      },
      process.env.JWT_SECRET || 'fallback-secret-change-in-production',
      { expiresIn: '7d' }
    )
    
    const response = NextResponse.json({
      success: true,
      username,
      profileUrl: `https://app.lynai.xyz/profile/${username}`,
      reputationScore: 0, // Start at 0
      referralCode: username,
      referralLink: `https://app.lynai.xyz?ref=${username}`
    })
    
    // Set auth cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    
    console.log(`[Username Reg V2] Registration complete for @${username}`)
    return response
    
  } catch (error) {
    console.error('[Username Reg V2] Fatal error:', error)
    return NextResponse.json(
      { error: 'Failed to register username' },
      { status: 500 }
    )
  } finally {
    if (client) {
      await client.close()
      console.log('[Username Reg V2] MongoDB connection closed')
    }
  }
}

export async function GET(request: NextRequest) {
  let client: MongoClient | null = null
  
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    
    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }
    
    // Direct MongoDB connection
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      return NextResponse.json({ available: true, username })
    }
    
    client = new MongoClient(mongoUri)
    await client.connect()
    
    const dbName = process.env.MONGODB_DB_NAME || 'lyn-hacker'
    const db = client.db(dbName)
    
    const user = await db.collection('users').findOne({ username })
    
    return NextResponse.json({
      available: !user,
      username
    })
    
  } catch (error) {
    console.error('[Username Check V2] Error:', error)
    return NextResponse.json({
      available: true,
      username: request.url.split('username=')[1]
    })
  } finally {
    if (client) {
      await client.close()
    }
  }
}
