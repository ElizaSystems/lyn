import { NextRequest, NextResponse } from 'next/server'
import { TelegramWalletService } from '@/lib/services/telegram-wallet'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const telegramId = searchParams.get('telegramId')

    const leaderboard = await TelegramWalletService.getLeaderboard(limit)
    
    let userStats = null
    if (telegramId) {
      userStats = await TelegramWalletService.getUserStats(parseInt(telegramId))
    }

    return NextResponse.json({
      success: true,
      leaderboard,
      userStats
    })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}