import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const filter = searchParams.get('filter') || 'all'
    
    console.log(`[User Scans] Fetching scans for username: ${username}`)
    
    const db = await getDatabase()
    const scansCollection = db.collection('security_scans')
    const usersCollection = db.collection('users')
    
    // Find user by username
    const user = await usersCollection.findOne({ 
      username: { $regex: `^${username}$`, $options: 'i' } 
    })
    
    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        scans: [],
        stats: {
          totalScans: 0,
          safeScans: 0,
          threatsDetected: 0,
          lastScanDate: null
        }
      }, { status: 404 })
    }
    
    // Build query for user's scans
    const query: Record<string, unknown> = { 
      userId: user._id,
      status: 'completed'
    }
    
    if (filter !== 'all') {
      if (filter === 'safe') {
        query.severity = 'safe'
      } else if (filter === 'threats') {
        query.severity = { $ne: 'safe' }
      } else if (['url', 'document', 'wallet', 'smart_contract', 'transaction'].includes(filter)) {
        query.type = filter
      }
    }
    
    // Get total count
    const totalCount = await scansCollection.countDocuments(query)
    
    // Get paginated scans
    const skip = (page - 1) * limit
    const scans = await scansCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    
    // Format scans
    const formattedScans = scans.map(scan => ({
      id: scan._id?.toString(),
      hash: scan.hash,
      type: scan.type,
      target: scan.target,
      severity: scan.severity,
      status: scan.status,
      result: {
        isSafe: scan.result?.isSafe,
        threatsCount: scan.result?.threats?.length || 0,
        confidence: scan.result?.confidence
      },
      user: {
        address: user.walletAddress || user.address,
        username: user.username
      },
      metadata: scan.metadata,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt
    }))
    
    // Calculate user stats
    const stats = {
      totalScans: totalCount,
      safeScans: await scansCollection.countDocuments({ userId: user._id, severity: 'safe', status: 'completed' }),
      threatsDetected: await scansCollection.countDocuments({ userId: user._id, severity: { $ne: 'safe' }, status: 'completed' }),
      lastScanDate: scans[0]?.createdAt || null,
      scansByType: {
        url: await scansCollection.countDocuments({ userId: user._id, type: 'url', status: 'completed' }),
        document: await scansCollection.countDocuments({ userId: user._id, type: 'document', status: 'completed' }),
        wallet: await scansCollection.countDocuments({ userId: user._id, type: 'wallet', status: 'completed' }),
        smart_contract: await scansCollection.countDocuments({ userId: user._id, type: 'smart_contract', status: 'completed' }),
        transaction: await scansCollection.countDocuments({ userId: user._id, type: 'transaction', status: 'completed' })
      }
    }
    
    return NextResponse.json({
      user: {
        username: user.username,
        walletAddress: user.walletAddress || user.address,
        joinedDate: user.createdAt
      },
      scans: formattedScans,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount
      },
      stats
    })
  } catch (error) {
    console.error('Failed to fetch user scans:', error)
    return NextResponse.json({
      error: 'Failed to fetch user scans',
      scans: [],
      stats: {
        totalScans: 0,
        safeScans: 0,
        threatsDetected: 0,
        lastScanDate: null
      }
    }, { status: 500 })
  }
}