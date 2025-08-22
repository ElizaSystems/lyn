import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDatabase } from '@/lib/mongodb'
import { getTokenBalance } from '@/lib/solana'
import { config } from '@/lib/config'

const REQUIRED_BALANCE = 100000 // 100,000 LYN tokens required
const REGISTRATION_FEE = 10000 // 10,000 LYN tokens fee
const AGENT_WALLET = 'eS5PgEoCFN2KuJnBfgvoenFJ7THDhvWZzBJ2SrxwkX1'

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

    // Verify payment transaction (simplified - in production you'd verify the actual transaction)
    if (!transaction || !signature) {
      return NextResponse.json({ 
        error: 'Payment transaction and signature required' 
      }, { status: 400 })
    }

    // Register username
    const registrationDate = new Date()
    const userResult = await usersCollection.updateOne(
      { walletAddress },
      {
        $set: {
          username,
          usernameRegisteredAt: registrationDate,
          registrationFee: REGISTRATION_FEE,
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
        registrationFee: REGISTRATION_FEE,
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
