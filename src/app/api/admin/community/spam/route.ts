import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, checkUserRateLimit, createRateLimitHeaders } from '@/lib/auth'
import { getClientIP, getUserAgent } from '@/lib/auth'
import { db } from '@/lib/mongodb'

// Admin wallet addresses (you can move this to config)
const ADMIN_WALLETS = [
  process.env.ADMIN_WALLET_1,
  process.env.ADMIN_WALLET_2,
].filter(Boolean)

function isAdmin(walletAddress: string): boolean {
  return ADMIN_WALLETS.includes(walletAddress)
}

/**
 * GET /api/admin/community/spam
 * Get spam detection reports
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const authResult = await requireAuth(request)
    if (authResult.error || !authResult.user?.walletAddress || !isAdmin(authResult.user.walletAddress)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const severity = searchParams.get('severity')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Rate limiting
    const userRateLimit = await checkUserRateLimit(authResult.user.id, 'admin_spam_review', 60 * 1000, 200)
    if (!userRateLimit.allowed) {
      const headers = createRateLimitHeaders(userRateLimit, 200)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers }
      )
    }

    const database = await db.getDatabase()
    const spamCollection = database.collection('spam_detection')

    // Build query
    const query: any = {}
    if (status !== 'all') query.status = status
    if (severity) query.severity = severity
    if (userId) query.userId = userId

    const spamReports = await spamCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    // Enhance with user data
    const enhancedReports = await Promise.all(
      spamReports.map(async (report) => {
        const user = await db.users.findByWalletAddress(report.walletAddress)
        const reputation = await db.userReputation.findByUserId(report.userId)
        
        return {
          id: report._id.toString(),
          userId: report.userId,
          walletAddress: report.walletAddress.slice(0, 8) + '...' + report.walletAddress.slice(-4),
          detectionType: report.detectionType,
          severity: report.severity,
          evidence: report.evidence,
          autoAction: report.autoAction,
          status: report.status,
          resolvedBy: report.resolvedBy,
          resolvedAt: report.resolvedAt,
          createdAt: report.createdAt,
          user: user ? {
            registrationDate: user.createdAt,
            lastLogin: user.lastLoginAt,
            hasTokenAccess: user.hasTokenAccess
          } : null,
          reputation: reputation ? {
            score: reputation.reputationScore,
            tier: reputation.tier,
            totalFeedback: reputation.feedbackCount,
            accuracyScore: reputation.accuracyScore
          } : null
        }
      })
    )

    // Get summary statistics
    const stats = await spamCollection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          severityBreakdown: {
            $push: '$severity'
          }
        }
      }
    ]).toArray()

    const summary = {
      total: spamReports.length,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count
        return acc
      }, {} as Record<string, number>),
      bySeverity: spamReports.reduce((acc, report) => {
        acc[report.severity] = (acc[report.severity] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    return NextResponse.json({
      reports: enhancedReports,
      summary,
      pagination: {
        limit,
        total: enhancedReports.length,
        filters: { status, severity, userId }
      }
    })

  } catch (error) {
    console.error('[Admin Spam API] Get reports error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve spam reports',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/community/spam
 * Resolve spam detection
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const authResult = await requireAuth(request)
    if (authResult.error || !authResult.user?.walletAddress || !isAdmin(authResult.user.walletAddress)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { reportId, action, notes } = body

    // Validation
    if (!reportId || !action) {
      return NextResponse.json({
        error: 'Missing required fields: reportId, action'
      }, { status: 400 })
    }

    const validActions = ['resolve', 'false_positive', 'escalate']
    if (!validActions.includes(action)) {
      return NextResponse.json({
        error: 'Invalid action. Must be one of: ' + validActions.join(', ')
      }, { status: 400 })
    }

    // Rate limiting
    const userRateLimit = await checkUserRateLimit(authResult.user.id, 'admin_spam_action', 60 * 60 * 1000, 100)
    if (!userRateLimit.allowed) {
      const headers = createRateLimitHeaders(userRateLimit, 100)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers }
      )
    }

    const database = await db.getDatabase()
    const spamCollection = database.collection('spam_detection')

    // Find and update spam report
    const report = await spamCollection.findOneAndUpdate(
      { _id: new db.ObjectId(reportId) },
      {
        $set: {
          status: action === 'resolve' ? 'resolved' : 'false_positive',
          resolvedBy: authResult.user.id,
          resolvedAt: new Date(),
          adminNotes: notes
        }
      },
      { returnDocument: 'after' }
    )

    if (!report) {
      return NextResponse.json({
        error: 'Spam report not found'
      }, { status: 404 })
    }

    // If resolving as false positive, restore user reputation
    if (action === 'false_positive' && report.userId) {
      await db.userReputation.updateScore(
        report.userId,
        10, // Restore some reputation points
        'spam_false_positive_resolved'
      )
    }

    // Log audit event
    await db.audit.log({
      userId: authResult.user.id,
      action: `resolve_spam_${action}`,
      resource: 'spam_detection',
      details: {
        reportId,
        originalSeverity: report.severity,
        originalDetectionType: report.detectionType,
        targetUserId: report.userId,
        hasNotes: !!notes
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    })

    console.log(`[Admin Spam API] ${authResult.user.walletAddress} resolved spam report ${reportId}: ${action}`)

    return NextResponse.json({
      success: true,
      message: `Spam report ${action}d successfully`,
      resolution: {
        reportId,
        action,
        resolvedBy: authResult.user.walletAddress,
        timestamp: new Date()
      }
    })

  } catch (error) {
    console.error('[Admin Spam API] Resolve error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = errorMessage.includes('not found') ? 404 : 500

    return NextResponse.json({
      error: 'Failed to resolve spam report',
      message: errorMessage
    }, { status })
  }
}

/**
 * PUT /api/admin/community/spam
 * Update user spam status
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const authResult = await requireAuth(request)
    if (authResult.error || !authResult.user?.walletAddress || !isAdmin(authResult.user.walletAddress)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, action, reason, duration } = body

    // Validation
    if (!userId || !action || !reason) {
      return NextResponse.json({
        error: 'Missing required fields: userId, action, reason'
      }, { status: 400 })
    }

    const validActions = ['suspend', 'unsuspend', 'warn', 'clear_reports']
    if (!validActions.includes(action)) {
      return NextResponse.json({
        error: 'Invalid action. Must be one of: ' + validActions.join(', ')
      }, { status: 400 })
    }

    // Rate limiting
    const userRateLimit = await checkUserRateLimit(authResult.user.id, 'admin_user_action', 60 * 60 * 1000, 50)
    if (!userRateLimit.allowed) {
      const headers = createRateLimitHeaders(userRateLimit, 50)
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers }
      )
    }

    const database = await db.getDatabase()
    
    // Get user info
    const user = await database.collection('users').findOne({ _id: new db.ObjectId(userId) })
    if (!user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 })
    }

    let reputationChange = 0
    let statusUpdate = {}

    switch (action) {
      case 'suspend':
        reputationChange = -50
        statusUpdate = { 
          suspended: true, 
          suspendedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null,
          suspensionReason: reason
        }
        break
      case 'unsuspend':
        reputationChange = 25
        statusUpdate = { 
          suspended: false, 
          suspendedUntil: null,
          suspensionReason: null
        }
        break
      case 'warn':
        reputationChange = -10
        break
      case 'clear_reports':
        reputationChange = 10
        // Clear active spam reports
        await database.collection('spam_detection').updateMany(
          { userId, status: 'active' },
          { 
            $set: { 
              status: 'resolved', 
              resolvedBy: authResult.user.id,
              resolvedAt: new Date(),
              adminNotes: 'Cleared by admin: ' + reason
            } 
          }
        )
        break
    }

    // Update user reputation
    if (reputationChange !== 0) {
      await db.userReputation.updateScore(userId, reputationChange, `admin_${action}`)
    }

    // Update user status if needed
    if (Object.keys(statusUpdate).length > 0) {
      await database.collection('users').updateOne(
        { _id: new db.ObjectId(userId) },
        { $set: statusUpdate }
      )
    }

    // Log audit event
    await db.audit.log({
      userId: authResult.user.id,
      action: `admin_user_${action}`,
      resource: 'user_management',
      details: {
        targetUserId: userId,
        targetWalletAddress: user.walletAddress,
        reason,
        duration,
        reputationChange
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    })

    console.log(`[Admin Spam API] ${authResult.user.walletAddress} performed ${action} on user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `User ${action} completed successfully`,
      action: {
        type: action,
        targetUserId: userId,
        reason,
        reputationChange,
        timestamp: new Date()
      }
    })

  } catch (error) {
    console.error('[Admin Spam API] User action error:', error)
    return NextResponse.json({
      error: 'Failed to perform user action',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}