import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const filter = searchParams.get('filter') || 'all'
    const search = searchParams.get('search') || ''
    
    const db = await getDatabase()
    const scansCollection = db.collection('security_scans')
    const usersCollection = db.collection('users')
    
    // Build query
    const query: Record<string, unknown> = { status: 'completed' }
    
    if (filter !== 'all') {
      if (filter === 'safe') {
        query.severity = 'safe'
      } else if (filter === 'threats') {
        query.severity = { $ne: 'safe' }
      } else if (['url', 'document', 'wallet', 'smart_contract', 'transaction'].includes(filter)) {
        query.type = filter
      }
    }
    
    if (search) {
      query.$or = [
        { hash: { $regex: search, $options: 'i' } },
        { target: { $regex: search, $options: 'i' } }
      ]
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
    
    // Get unique user IDs
    const userIds = [...new Set(scans.map(scan => scan.userId.toString()))]
    
    // Fetch user data
    const users = await usersCollection
      .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } })
      .toArray()
    
    // Create user map
    const userMap: Record<string, { address: string; username: string }> = {}
    users.forEach(user => {
      userMap[user._id.toString()] = {
        address: user.address,
        username: user.username || user.address.substring(0, 8) + '...'
      }
    })
    
    // Format scans with user info
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
      user: userMap[scan.userId.toString()] || {
        address: 'Unknown',
        username: 'Unknown'
      },
      metadata: scan.metadata,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt
    }))
    
    // Calculate stats
    const stats = {
      totalScans: totalCount,
      safeScans: await scansCollection.countDocuments({ ...query, severity: 'safe' }),
      threatsDetected: await scansCollection.countDocuments({ ...query, severity: { $ne: 'safe' } }),
      uniqueUsers: userIds.length,
      last24h: await scansCollection.countDocuments({
        ...query,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    }
    
    return NextResponse.json({
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
    console.error('Failed to fetch public scans:', error)
    
    // Return empty results instead of failing completely
    return NextResponse.json({
      scans: [],
      pagination: {
        page: 1,
        limit: 20,
        totalPages: 0,
        totalCount: 0
      },
      stats: {
        totalScans: 0,
        safeScans: 0,
        threatsDetected: 0,
        uniqueUsers: 0,
        last24h: 0
      }
    })
  }
}