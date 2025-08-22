import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'
import { getTokenBalance, connection } from '@/lib/solana'
import { verifyBurnTransaction } from '@/lib/solana-burn'
import { config } from '@/lib/config'

const REQUIRED_BALANCE = 100000 // 100,000 LYN tokens required to hold
const BURN_AMOUNT = 10000 // 10,000 LYN tokens to burn for registration

export async function POST(request: NextRequest) {
  try {
    const { username, signature, transaction, walletAddress } = await request.json()
    
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
    
    // Verify the burn transaction on-chain
    console.log(`[Username Reg] Verifying burn transaction: ${signature}`)
    const burnVerified = await verifyBurnTransaction(connection, signature, BURN_AMOUNT)
    
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

    return NextResponse.json({
      success: true,
      username,
      profileUrl: `https://app.lynai.xyz/profile/${username}`,
      reputationScore: 100
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
    
    if (!username) {
      return NextResponse.json({ error: 'Username parameter required' }, { status: 400 })
    }

    const db = await getDatabase()
    const usersCollection = db.collection('users')
    
    const user = await usersCollection.findOne({ username })
    
    return NextResponse.json({
      available: !user,
      username
    })

  } catch (error) {
    console.error('Username check error:', error)
    return NextResponse.json(
      { error: 'Failed to check username availability' },
      { status: 500 }
    )
  }
}
