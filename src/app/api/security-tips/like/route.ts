import { NextRequest, NextResponse } from 'next/server'
import { securityTipsService } from '@/lib/services/security-tips-service'
import { verifyAuth } from '@/lib/auth-helper'

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { tipId } = await req.json()
    
    if (!tipId) {
      return NextResponse.json(
        { error: 'Tip ID required' },
        { status: 400 }
      )
    }
    
    const success = await securityTipsService.likeTip(tipId, authResult.userId)
    
    return NextResponse.json({
      success
    })
  } catch (error) {
    console.error('Error liking tip:', error)
    return NextResponse.json(
      { error: 'Failed to like tip' },
      { status: 500 }
    )
  }
}