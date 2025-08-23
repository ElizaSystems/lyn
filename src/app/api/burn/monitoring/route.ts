import { NextRequest, NextResponse } from 'next/server'
import { BurnMonitorService } from '@/lib/services/burn-monitor'
import { BurnService } from '@/lib/services/burn-service'
import { BurnMonitoringStats } from '@/lib/models/burn'

export async function GET(request: NextRequest) {
  try {
    console.log('[BurnMonitoring] Getting monitoring statistics')
    
    const searchParams = request.nextUrl.searchParams
    const detailed = searchParams.get('detailed') === 'true'
    
    const monitorService = new BurnMonitorService()
    
    if (detailed) {
      // Get detailed monitoring stats
      const stats = await monitorService.getMonitoringStats()
      
      const response: BurnMonitoringStats & { pendingBurns?: any[] } = {
        ...stats,
        pendingBurns: []
      }
      
      // Optionally include pending burn details
      if (searchParams.get('include_pending') === 'true') {
        const pendingBurns = await BurnService.getPendingVerificationBurns(10)
        response.pendingBurns = pendingBurns
      }
      
      return NextResponse.json({
        success: true,
        stats: response,
        timestamp: new Date()
      })
    } else {
      // Get basic verification stats
      const verificationStats = await BurnService.getVerificationStats()
      
      return NextResponse.json({
        success: true,
        stats: verificationStats,
        timestamp: new Date()
      })
    }
    
  } catch (error) {
    console.error('[BurnMonitoring] Error getting stats:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get monitoring stats'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    console.log(`[BurnMonitoring] Executing action: ${action}`)
    
    const monitorService = new BurnMonitorService()
    
    switch (action) {
      case 'scan': {
        // Trigger manual scan for new burns
        const scanResults = await monitorService.scanForNewBurns()
        
        return NextResponse.json({
          success: true,
          message: 'Scan completed',
          results: scanResults,
          timestamp: new Date()
        })
      }
      
      case 'verify_pending': {
        // Trigger verification of pending burns
        await monitorService.verifyPendingBurns()
        
        return NextResponse.json({
          success: true,
          message: 'Pending burns verification completed',
          timestamp: new Date()
        })
      }
      
      case 'cleanup': {
        // Clean up old pending verifications
        const cleanedUp = await monitorService.cleanupPendingBurns()
        
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${cleanedUp} old pending verifications`,
          cleanedUp,
          timestamp: new Date()
        })
      }
      
      case 'batch_verify': {
        // Batch verify burns that need verification
        const pendingBurns = await BurnService.getPendingVerificationBurns(50)
        const signatures = pendingBurns.map(burn => burn.transactionSignature)
        
        if (signatures.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No burns need verification',
            results: { verified: 0, failed: 0, errors: [] }
          })
        }
        
        const results = await BurnService.batchVerify(signatures)
        
        return NextResponse.json({
          success: true,
          message: `Batch verification completed: ${results.verified} verified, ${results.failed} failed`,
          results,
          timestamp: new Date()
        })
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: scan, verify_pending, cleanup, batch_verify'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error(`[BurnMonitoring] Error executing action:`, error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Action failed'
    }, { status: 500 })
  }
}