import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { isAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await isAdmin(request)
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const walletAddress = searchParams.get('wallet')
    const listType = searchParams.get('type') as 'whitelist' | 'blacklist' | null
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    switch (action) {
      case 'global_entries': {
        // Get global list entries
        const result = await WalletListService.checkWalletInLists('', undefined, {
          includeGlobal: true,
          includePublic: false,
          includeShared: false
        })
        
        return NextResponse.json({
          entries: result.entries.slice(offset, offset + limit),
          total: result.entries.length,
          summary: {
            whitelisted: result.entries.filter(e => e.listType === 'whitelist').length,
            blacklisted: result.entries.filter(e => e.listType === 'blacklist').length,
            categories: result.entries.reduce((acc, entry) => {
              acc[entry.category] = (acc[entry.category] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          }
        })
      }

      case 'config': {
        const config = await WalletListService.getGlobalConfig()
        return NextResponse.json({ config })
      }

      case 'stats': {
        // Get comprehensive statistics
        return NextResponse.json({
          message: 'Admin statistics endpoint - to be implemented',
          availableActions: ['global_entries', 'config', 'stats', 'pending_reports']
        })
      }

      case 'pending_reports': {
        // Get pending community reports for admin review
        return NextResponse.json({
          message: 'Pending reports endpoint - to be implemented',
          reports: []
        })
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['global_entries', 'config', 'stats', 'pending_reports']
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin Wallet Lists] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to process admin request' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin(request)
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'add_global_entry': {
        const {
          walletAddress,
          listType,
          category,
          reason,
          evidence,
          confidence,
          severity,
          expiresAt
        } = data

        if (!walletAddress || !listType || !category || !reason) {
          return NextResponse.json(
            { error: 'Missing required fields: walletAddress, listType, category, reason' },
            { status: 400 }
          )
        }

        const entry = await WalletListService.addWalletToList({
          walletAddress,
          listType,
          category,
          reason,
          evidence: evidence || undefined,
          confidence: confidence || 90,
          severity: severity || 'high',
          tags: ['admin_managed'],
          ownerId: new ObjectId(adminCheck.user.userId),
          ownerAddress: adminCheck.user.walletAddress,
          visibility: 'public',
          sharedWith: [],
          allowContributions: false,
          isGlobal: true, // Mark as global admin-managed entry
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          source: 'admin_global'
        })

        return NextResponse.json({
          entry,
          message: 'Global list entry added successfully'
        })
      }

      case 'bulk_global_operation': {
        const { operation, entries, options } = data

        if (!operation || !entries || !Array.isArray(entries)) {
          return NextResponse.json(
            { error: 'Invalid bulk operation data' },
            { status: 400 }
          )
        }

        // Mark all entries as global
        const globalEntries = entries.map(entry => ({
          ...entry,
          isGlobal: true,
          visibility: 'public',
          allowContributions: false,
          source: 'admin_global',
          tags: [...(entry.tags || []), 'admin_managed'],
          ownerId: new ObjectId(adminCheck.user.userId),
          ownerAddress: adminCheck.user.walletAddress
        }))

        const result = await WalletListService.bulkListOperation(
          { operation, entries: globalEntries, options },
          new ObjectId(adminCheck.user.userId)
        )

        return NextResponse.json({
          ...result,
          message: `Bulk ${operation} operation completed`
        })
      }

      case 'update_config': {
        const { config } = data

        if (!config) {
          return NextResponse.json(
            { error: 'Missing config data' },
            { status: 400 }
          )
        }

        // Update global configuration - implementation would go here
        return NextResponse.json({
          message: 'Global configuration update - to be implemented',
          config
        })
      }

      case 'approve_report': {
        const { reportId, approved, reason } = data

        if (!reportId) {
          return NextResponse.json(
            { error: 'Missing reportId' },
            { status: 400 }
          )
        }

        // Approve or reject community report - implementation would go here
        return NextResponse.json({
          message: `Report ${approved ? 'approved' : 'rejected'}`,
          reportId,
          reason
        })
      }

      case 'emergency_blacklist': {
        const { walletAddress, reason, evidence } = data

        if (!walletAddress || !reason) {
          return NextResponse.json(
            { error: 'Missing walletAddress or reason' },
            { status: 400 }
          )
        }

        // Emergency blacklist with highest priority
        const entry = await WalletListService.addWalletToList({
          walletAddress,
          listType: 'blacklist',
          category: 'scam',
          reason: `EMERGENCY: ${reason}`,
          evidence: evidence || undefined,
          confidence: 100,
          severity: 'critical',
          tags: ['emergency', 'admin_priority'],
          ownerId: new ObjectId(adminCheck.user.userId),
          ownerAddress: adminCheck.user.walletAddress,
          visibility: 'public',
          sharedWith: [],
          allowContributions: false,
          isGlobal: true,
          source: 'admin_emergency'
        })

        // Log emergency action
        console.log(`[ADMIN EMERGENCY] Wallet ${walletAddress} emergency blacklisted by ${adminCheck.user.walletAddress}: ${reason}`)

        return NextResponse.json({
          entry,
          message: 'Emergency blacklist applied',
          alert: 'This wallet has been immediately flagged as critical risk'
        })
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['add_global_entry', 'bulk_global_operation', 'update_config', 'approve_report', 'emergency_blacklist']
        }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin Wallet Lists] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process admin request' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminCheck = await isAdmin(request)
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('entryId')
    const walletAddress = searchParams.get('wallet')
    const listType = searchParams.get('type') as 'whitelist' | 'blacklist'

    if (entryId) {
      // Remove specific entry by ID - implementation would go here
      return NextResponse.json({
        message: 'Global entry removal by ID - to be implemented',
        entryId
      })
    } else if (walletAddress && listType) {
      // Remove wallet from global list
      const success = await WalletListService.removeWalletFromList(
        walletAddress,
        listType,
        new ObjectId(adminCheck.user.userId)
      )

      return NextResponse.json({
        success,
        message: success ? 'Global entry removed' : 'Entry not found or cannot be removed'
      })
    } else {
      return NextResponse.json(
        { error: 'Missing entryId or (wallet + type) parameters' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[Admin Wallet Lists] DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove global entry' },
      { status: 500 }
    )
  }
}