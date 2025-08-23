import { NextRequest, NextResponse } from 'next/server'
import { WalletListCleanupService } from '@/lib/services/wallet-list-cleanup-service'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (in production, you'd verify the source)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'quick'

    console.log(`[Cron] Starting ${type} wallet list cleanup...`)

    if (type === 'full') {
      // Full cleanup (run daily)
      const result = await WalletListCleanupService.runFullCleanup()
      
      return NextResponse.json({
        success: true,
        type: 'full',
        result,
        timestamp: new Date().toISOString()
      })
    } else {
      // Quick cleanup (run hourly)
      const result = await WalletListCleanupService.quickCleanup()
      
      return NextResponse.json({
        success: true,
        type: 'quick',
        removed: result.removed,
        duration: result.duration,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('[Cron] Wallet list cleanup error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}