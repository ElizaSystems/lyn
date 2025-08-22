import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error.message },
        { status: authResult.error.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type') || ''
    const severity = searchParams.get('severity') || ''
    const skip = (page - 1) * limit

    const db = await getDatabase()
    const scansCollection = db.collection('security_scans')
    
    // Build filter
    const filter: Record<string, unknown> = {}
    if (type) filter.scanType = type
    if (severity) filter['results.riskLevel'] = severity

    // Get scans with pagination
    const [scans, totalCount] = await Promise.all([
      scansCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      scansCollection.countDocuments(filter)
    ])

    // Get user info for each scan
    const userIds = [...new Set(scans.map(scan => scan.userId).filter(Boolean))]
    const users = await db.collection('users')
      .find({ _id: { $in: userIds } })
      .toArray()
    
    const userMap = new Map(users.map(u => [u._id?.toString(), u]))

    const enrichedScans = scans.map(scan => ({
      id: scan._id?.toString(),
      userId: scan.userId,
      user: userMap.get(scan.userId),
      scanType: scan.scanType,
      target: scan.target,
      status: scan.status,
      results: scan.results,
      createdAt: scan.createdAt,
      updatedAt: scan.updatedAt,
      ipAddress: scan.ipAddress,
      userAgent: scan.userAgent
    }))

    return NextResponse.json({
      success: true,
      scans: enrichedScans,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Admin scans error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scans' },
      { status: 500 }
    )
  }
}