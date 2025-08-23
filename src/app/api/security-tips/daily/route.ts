import { NextRequest, NextResponse } from 'next/server'
import { securityTipsService } from '@/lib/services/security-tips-service'
import { verifyAuth } from '@/lib/auth-helper'

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req)
    const userId = authResult?.userId
    
    // Initialize default tips if needed
    await securityTipsService.initializeDefaultTips()
    
    const tip = await securityTipsService.getDailyTip(userId)
    
    if (!tip) {
      return NextResponse.json(
        { error: 'No tips available' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      tip
    })
  } catch (error) {
    console.error('Error getting daily tip:', error)
    return NextResponse.json(
      { error: 'Failed to get daily tip' },
      { status: 500 }
    )
  }
}