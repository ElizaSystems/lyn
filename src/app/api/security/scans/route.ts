import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ScanService } from '@/lib/services/scan-service'
import { SecurityScan } from '@/lib/models/scan'

export async function GET(request: NextRequest) {
  try {
    // Check authentication (now handles both authenticated and anonymous users)
    const authResult = await requireAuth(request)
    
    // If we have a user (authenticated or anonymous with sessionId), proceed
    const userId = authResult.user.id

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const type = searchParams.get('type') as SecurityScan['type'] | null
    const severity = searchParams.get('severity') as SecurityScan['severity'] | null

    let scans

    if (type) {
      // Get scans by type
      scans = await ScanService.getUserScansByType(userId, type, limit)
    } else if (severity) {
      // Get scans by severity
      scans = await ScanService.getUserScansBySeverity(userId, severity, limit)
    } else {
      // Get recent scans (works with both userId and sessionId)
      scans = await ScanService.getUserRecentScans(userId, limit)
    }

    // Get user statistics (works with both userId and sessionId)
    const stats = await ScanService.getUserStatistics(userId)

    // Format the scans for the frontend
    const formattedScans = scans.map(scan => ({
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
      } : null
    })
  } catch (error) {
    console.error('Failed to fetch scans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scan history' },
      { status: 500 }
    )
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
      { error: 'Failed to fetch scan details' },
      { status: 500 }
    )
  }
}