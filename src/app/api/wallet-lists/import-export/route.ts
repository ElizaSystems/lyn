import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { WalletListService } from '@/lib/services/wallet-list-service'
import { authMiddleware } from '@/lib/middleware/auth'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { action, listId, format, data } = await request.json()

    if (!action || !['import', 'export'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "import" or "export"' },
        { status: 400 }
      )
    }

    if (!format || !['json', 'csv', 'txt'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "json", "csv", or "txt"' },
        { status: 400 }
      )
    }

    if (!listId) {
      return NextResponse.json(
        { error: 'Missing listId' },
        { status: 400 }
      )
    }

    if (action === 'import') {
      if (!data) {
        return NextResponse.json(
          { error: 'Missing import data' },
          { status: 400 }
        )
      }

      const job = await WalletListService.importList(
        new ObjectId(authResult.user.userId),
        authResult.user.walletAddress,
        new ObjectId(listId),
        data,
        format as 'json' | 'csv' | 'txt'
      )

      return NextResponse.json({
        job,
        message: 'Import job started. Check job status for progress.'
      })
    } else {
      const job = await WalletListService.exportList(
        new ObjectId(authResult.user.userId),
        authResult.user.walletAddress,
        new ObjectId(listId),
        format as 'json' | 'csv' | 'txt'
      )

      return NextResponse.json({
        job,
        message: 'Export job started. Check job status for download link.'
      })
    }
  } catch (error) {
    console.error('[WalletLists Import/Export API] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process import/export request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      )
    }

    // Get job status - this would be implemented in the service
    return NextResponse.json({
      message: 'Job status retrieval to be implemented',
      jobId
    })
  } catch (error) {
    console.error('[WalletLists Import/Export API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    )
  }
}