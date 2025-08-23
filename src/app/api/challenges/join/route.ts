import { NextRequest, NextResponse } from 'next/server'
import { ChallengeArenaService } from '@/lib/services/challenge-arena-service'
import { getDatabase } from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const { arenaId, walletAddress } = await request.json()
    
    if (!arenaId || !walletAddress) {
      return NextResponse.json({
        success: false,
        message: 'Arena ID and wallet address are required'
      }, { status: 400 })
    }
    
    // Get username from database
    const db = await getDatabase()
    const usersCollection = db.collection('users')
    const user = await usersCollection.findOne({ walletAddress })
    const username = user?.username || walletAddress.slice(0, 8) + '...'
    
    const arenaService = ChallengeArenaService.getInstance()
    const result = await arenaService.joinArena(arenaId, walletAddress, username)
    
    if (result.success) {
      // Get challenge details
      const challengesCollection = db.collection('gamified_challenges')
      const challenge = await challengesCollection.findOne({ id: result.challengeId })
      
      return NextResponse.json({
        success: true,
        challengeId: result.challengeId,
        totalQuestions: challenge?.questions?.length || 5,
        message: result.message
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.message
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to join arena:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to join arena'
    }, { status: 500 })
  }
}