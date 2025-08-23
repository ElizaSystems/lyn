import { NextRequest, NextResponse } from 'next/server'
import { securityTipsService } from '@/lib/services/security-tips-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    
    let tips
    
    if (search) {
      tips = await securityTipsService.searchTips(search)
    } else if (category) {
      tips = await securityTipsService.getTipsByCategory(category)
    } else {
      // Get stats if no specific query
      const stats = await securityTipsService.getTipStats()
      return NextResponse.json({
        success: true,
        stats
      })
    }
    
    return NextResponse.json({
      success: true,
      tips
    })
  } catch (error) {
    console.error('Error getting tips:', error)
    return NextResponse.json(
      { error: 'Failed to get tips' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    
    // Admin only - add auth check in production
    const tip = await securityTipsService.createTip(data)
    
    if (!tip) {
      return NextResponse.json(
        { error: 'Failed to create tip' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      tip
    })
  } catch (error) {
    console.error('Error creating tip:', error)
    return NextResponse.json(
      { error: 'Failed to create tip' },
      { status: 500 }
    )
  }
}