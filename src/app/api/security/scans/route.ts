import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ScanService } from '@/lib/services/scan-service'
import { SecurityScan } from '@/lib/models/scan'

export async function GET(request: NextRequest) {
  try {
    console.log(`[Security Scans] GET request received`)
    console.log(`[Security Scans] Environment check - hasMongoUri: ${!!process.env.MONGODB_URI}, hasDbName: ${!!process.env.MONGODB_DB_NAME}`)
    
    // Get session ID from headers or cookies
    const sessionId = request.headers.get('x-session-id') || 
                     request.cookies.get('sessionId')?.value ||
                     `session_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Try to get scans from database, fall back to empty array
    let scans: SecurityScan[] = []
    let stats = null
    
    try {
      // Check authentication (now handles both authenticated and anonymous users)
      const authResult = await requireAuth(request)
      const userId = authResult.user?.id || sessionId
      
      const type = searchParams.get('type') as SecurityScan['type'] | null
      const severity = searchParams.get('severity') as SecurityScan['severity'] | null

      if (type) {
        scans = await ScanService.getUserScansByType(userId, type, limit)
      } else if (severity) {
        scans = await ScanService.getUserScansBySeverity(userId, severity, limit)
      } else {
        scans = await ScanService.getUserRecentScans(userId, limit)
      }
      
      stats = await ScanService.getUserStatistics(userId)
    } catch (dbError) {
      console.log('Database not available, using fallback data')
    }

    // Format the scans for the frontend
    const formattedScans = scans.map((scan: SecurityScan) => ({
      id: scan._id?.toString() || `scan-${Date.now()}`,
      hash: scan.hash,
      type: scan.type,
      target: scan.target,
      severity: scan.severity,
      status: scan.status,
      result: scan.result,
      metadata: scan.metadata,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt
    }))

    return NextResponse.json({
      scans: formattedScans,
      statistics: stats ? {
        totalScans: stats.totalScans,
        safeScans: stats.safeScans,
        threatsDetected: stats.threatsDetected,
        lastScanDate: stats.lastScanDate,
        scansByType: stats.scansByType,
        scansBySeverity: stats.scansBySeverity
      } : {
        totalScans: 0,
        safeScans: 0,
        threatsDetected: 0,
        lastScanDate: null,
        scansByType: {
          url: 0,
          document: 0,
          wallet: 0,
          smart_contract: 0,
          transaction: 0
        },
        scansBySeverity: {
          safe: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        }
      }
    })
  } catch (error) {
    console.error('Failed to fetch scans:', error)
    
    // Return empty results instead of failing completely
    return NextResponse.json({
      scans: [],
      statistics: {
        totalScans: 0,
        safeScans: 0,
        threatsDetected: 0,
        lastScanDate: null,
        scansByType: {
          url: 0,
          document: 0,
          wallet: 0,
          smart_contract: 0,
          transaction: 0
        },
        scansBySeverity: {
          safe: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        }
      },
      error: 'Service temporarily unavailable',
      fallback: true
    }, { status: 200 }) // Return 200 instead of 500
  }
}

// Get a specific scan by hash
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error.message },
        { status: authResult.error.status }
      )
    }

    const { hash } = await request.json()
    
    if (!hash) {
      return NextResponse.json({ error: 'Scan hash is required' }, { status: 400 })
    }

    const scan = await ScanService.getScanByHash(hash)
    
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }

    // Verify the scan belongs to the user
    if (!scan.userId || scan.userId.toString() !== authResult.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({
      id: scan._id?.toString(),
      hash: scan.hash,
      type: scan.type,
      target: scan.target,
      severity: scan.severity,
      status: scan.status,
      result: scan.result,
      metadata: scan.metadata,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt
    })
  } catch (error) {
    console.error('Failed to fetch scan:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch scan details',
        fallback: true 
      },
      { status: 200 } // Return 200 instead of 500
    )
  }
}