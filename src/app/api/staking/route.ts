import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { getTokenBalance, getWalletBalance } from '@/lib/solana'

const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'

interface StakingPosition {
  _id?: ObjectId
  userId: string
  walletAddress: string
  poolId: string
  amount: number
  stakedAt: Date
  unlockAt: Date | null
  claimed: number
  lastClaimAt?: Date
  status: 'active' | 'unlocked' | 'withdrawn'
}

interface StakingPool {
  id: string
  name: string
  apy: number
  lockPeriod: number // in days, 0 for flexible
  minStake: number
  totalStaked: number
  available: boolean
}

// DeFAI Staking Program Constants (from /Users/futjr/defai_audit/audit/security-auditor/defai_staking/src/lib.rs)
// const DEFAI_STAKING_PROGRAM_ID = '2TLhCW35y5jcuoKtfwTx7H5EPMqUtCf3UQhYKdKKg3Hq' // For future on-chain integration

// Staking tiers from DeFAI contract
const GOLD_MIN = 10_000_000 // 10M LYN/DEFAI
const GOLD_APY = 0.5 // 0.5% APY

const TITANIUM_MIN = 100_000_000 // 100M LYN/DEFAI
const TITANIUM_APY = 0.75 // 0.75% APY

const INFINITE_MIN = 1_000_000_000 // 1B LYN/DEFAI
const INFINITE_APY = 1.0 // 1% APY

const STAKING_POOLS: StakingPool[] = [
  {
    id: 'gold',
    name: 'Gold Tier (DeFAI)',
    apy: GOLD_APY,
    lockPeriod: 7, // 7 day initial lock from contract
    minStake: GOLD_MIN,
    totalStaked: 12500000,
    available: true,
  },
  {
    id: 'titanium',
    name: 'Titanium Tier (DeFAI)',
    apy: TITANIUM_APY,
    lockPeriod: 7, // 7 day initial lock from contract
    minStake: TITANIUM_MIN,
    totalStaked: 42300000,
    available: true,
  },
  {
    id: 'infinite',
    name: 'Infinite Tier (DeFAI)',
    apy: INFINITE_APY,
    lockPeriod: 7, // 7 day initial lock from contract
    minStake: INFINITE_MIN,
    totalStaked: 18700000,
    available: true,
  },
  {
    id: 'flexible',
    name: 'Flexible Staking',
    apy: 12,
    lockPeriod: 0,
    minStake: 100,
    totalStaked: 25800000,
    available: true,
  },
]

async function getStakingCollection() {
  const db = await getDatabase()
  return db.collection<StakingPosition>('staking_positions')
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const walletAddress = searchParams.get('wallet')
    
    if (!walletAddress) {
      // Return general staking info
      const stakingCollection = await getStakingCollection()
      const totalStakers = await stakingCollection.distinct('walletAddress')
      
      return NextResponse.json({
        pools: STAKING_POOLS,
        totalStakers: totalStakers.length,
        totalValueLocked: STAKING_POOLS.reduce((sum, pool) => sum + pool.totalStaked, 0),
        averageApy: STAKING_POOLS.reduce((sum, pool) => sum + pool.apy, 0) / STAKING_POOLS.length
      })
    }
    
    // Get user's staking positions
    const stakingCollection = await getStakingCollection()
    const positions = await stakingCollection.find({ 
      walletAddress,
      status: 'active'
    }).toArray()
    
    // Get wallet balances
    const [solBalance, tokenBalance] = await Promise.all([
      getWalletBalance(walletAddress),
      getTokenBalance(walletAddress, TOKEN_MINT)
    ])
    
    // Calculate rewards for each position
    const positionsWithRewards = positions.map(position => {
      const pool = STAKING_POOLS.find(p => p.id === position.poolId)
      if (!pool) return position
      
      const now = new Date()
      const stakedDays = Math.floor((now.getTime() - position.stakedAt.getTime()) / (1000 * 60 * 60 * 24))
      const dailyRate = pool.apy / 365 / 100
      const totalRewards = position.amount * dailyRate * stakedDays
      const unclaimedRewards = totalRewards - position.claimed
      
      return {
        ...position,
        poolName: pool.name,
        apy: pool.apy,
        totalRewards: Math.floor(totalRewards),
        unclaimedRewards: Math.floor(unclaimedRewards),
        canWithdraw: pool.lockPeriod === 0 || (position.unlockAt && now >= position.unlockAt)
      }
    })
    
    return NextResponse.json({
      positions: positionsWithRewards,
      balance: {
        sol: solBalance,
        lyn: tokenBalance
      },
      pools: STAKING_POOLS,
      totalStaked: positions.reduce((sum, p) => sum + p.amount, 0),
      totalRewards: positionsWithRewards.reduce((sum, p) => sum + ('unclaimedRewards' in p ? p.unclaimedRewards || 0 : 0), 0)
    })
  } catch (error) {
    console.error('Staking GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch staking data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, walletAddress, poolId, amount, positionId } = body
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 })
    }
    
    const stakingCollection = await getStakingCollection()
    
    switch (action) {
      case 'stake': {
        if (!poolId || !amount) {
          return NextResponse.json({ error: 'Pool ID and amount required' }, { status: 400 })
        }
        
        const pool = STAKING_POOLS.find(p => p.id === poolId)
        if (!pool) {
          return NextResponse.json({ error: 'Invalid pool' }, { status: 400 })
        }
        
        if (amount < pool.minStake) {
          return NextResponse.json({ 
            error: `Minimum stake is ${pool.minStake} LYN` 
          }, { status: 400 })
        }
        
        // Check wallet balance
        const tokenBalance = await getTokenBalance(walletAddress, TOKEN_MINT)
        if (tokenBalance < amount) {
          return NextResponse.json({ 
            error: 'Insufficient balance' 
          }, { status: 400 })
        }
        
        const now = new Date()
        const unlockAt = pool.lockPeriod > 0 
          ? new Date(now.getTime() + pool.lockPeriod * 24 * 60 * 60 * 1000)
          : null
        
        const newPosition: StakingPosition = {
          userId: walletAddress, // In production, use actual user ID
          walletAddress,
          poolId,
          amount,
          stakedAt: now,
          unlockAt,
          claimed: 0,
          status: 'active'
        }
        
        const result = await stakingCollection.insertOne(newPosition)
        
        // Update pool total (in production, this would be on-chain)
        const poolIndex = STAKING_POOLS.findIndex(p => p.id === poolId)
        if (poolIndex !== -1) {
          STAKING_POOLS[poolIndex].totalStaked += amount
        }
        
        return NextResponse.json({
          success: true,
          position: { ...newPosition, _id: result.insertedId }
        })
      }
      
      case 'unstake': {
        if (!positionId) {
          return NextResponse.json({ error: 'Position ID required' }, { status: 400 })
        }
        
        const position = await stakingCollection.findOne({
          _id: new ObjectId(positionId),
          walletAddress,
          status: 'active'
        })
        
        if (!position) {
          return NextResponse.json({ error: 'Position not found' }, { status: 404 })
        }
        
        const pool = STAKING_POOLS.find(p => p.id === position.poolId)
        if (!pool) {
          return NextResponse.json({ error: 'Invalid pool' }, { status: 400 })
        }
        
        // Check if position can be unstaked
        const now = new Date()
        if (position.unlockAt && now < position.unlockAt) {
          return NextResponse.json({ 
            error: `Position locked until ${position.unlockAt.toLocaleDateString()}` 
          }, { status: 400 })
        }
        
        // Calculate final rewards
        const stakedDays = Math.floor((now.getTime() - position.stakedAt.getTime()) / (1000 * 60 * 60 * 24))
        const dailyRate = pool.apy / 365 / 100
        const totalRewards = position.amount * dailyRate * stakedDays
        const finalRewards = Math.floor(totalRewards - position.claimed)
        
        // Update position status
        await stakingCollection.updateOne(
          { _id: new ObjectId(positionId) },
          { 
            $set: { 
              status: 'withdrawn',
              claimed: totalRewards
            } 
          }
        )
        
        // Update pool total
        const poolIndex = STAKING_POOLS.findIndex(p => p.id === position.poolId)
        if (poolIndex !== -1) {
          STAKING_POOLS[poolIndex].totalStaked -= position.amount
        }
        
        return NextResponse.json({
          success: true,
          withdrawn: position.amount,
          rewards: finalRewards,
          total: position.amount + finalRewards
        })
      }
      
      case 'claim': {
        if (!positionId) {
          return NextResponse.json({ error: 'Position ID required' }, { status: 400 })
        }
        
        const position = await stakingCollection.findOne({
          _id: new ObjectId(positionId),
          walletAddress,
          status: 'active'
        })
        
        if (!position) {
          return NextResponse.json({ error: 'Position not found' }, { status: 404 })
        }
        
        const pool = STAKING_POOLS.find(p => p.id === position.poolId)
        if (!pool) {
          return NextResponse.json({ error: 'Invalid pool' }, { status: 400 })
        }
        
        // Calculate claimable rewards
        const now = new Date()
        const stakedDays = Math.floor((now.getTime() - position.stakedAt.getTime()) / (1000 * 60 * 60 * 24))
        const dailyRate = pool.apy / 365 / 100
        const totalRewards = position.amount * dailyRate * stakedDays
        const claimableRewards = Math.floor(totalRewards - position.claimed)
        
        if (claimableRewards <= 0) {
          return NextResponse.json({ error: 'No rewards to claim' }, { status: 400 })
        }
        
        // Update claimed amount
        await stakingCollection.updateOne(
          { _id: new ObjectId(positionId) },
          { 
            $set: { 
              claimed: position.claimed + claimableRewards,
              lastClaimAt: now
            } 
          }
        )
        
        return NextResponse.json({
          success: true,
          claimed: claimableRewards
        })
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Staking POST error:', error)
    return NextResponse.json({ error: 'Failed to process staking request' }, { status: 500 })
  }
}