import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for metrics (in production, use a database)
const metrics = {
  totalScans: 12847,
  threatsBlocked: 892,
  activeUsers: 3421,
  successRate: 99.7,
  dailyScans: [] as number[],
  threatCategories: {
    phishing: 342,
    malware: 256,
    suspiciousWallets: 189,
    smartContractExploits: 105
  },
  recentEvents: [] as Array<{ timestamp: string; event: string; category?: string }>
}

export async function GET(req: NextRequest) {
  try {
    const timeRange = req.nextUrl.searchParams.get('range') || '7d'
    
    // Simulate real-time data updates
    metrics.totalScans += Math.floor(Math.random() * 10)
    metrics.threatsBlocked += Math.floor(Math.random() * 3)
    metrics.activeUsers += Math.floor(Math.random() * 5) - 2
    
    // Generate daily data based on timeRange
    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const dailyData = Array.from({ length: days }, (_, i) => ({
      day: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      scans: 1500 + Math.floor(Math.random() * 1000),
      threats: 50 + Math.floor(Math.random() * 150)
    }))
    
    return NextResponse.json({
      ...metrics,
      dailyData,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { event, category } = await req.json()
    
    if (event === 'scan') {
      metrics.totalScans++
    } else if (event === 'threat') {
      metrics.threatsBlocked++
      if (category && metrics.threatCategories[category as keyof typeof metrics.threatCategories]) {
        metrics.threatCategories[category as keyof typeof metrics.threatCategories]++
      }
    }
    
    // Add to recent events
    metrics.recentEvents.unshift({
      timestamp: new Date().toISOString(),
      event,
      category
    })
    
    // Keep only last 100 events
    metrics.recentEvents = metrics.recentEvents.slice(0, 100)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Metrics POST error:', error)
    return NextResponse.json({ error: 'Failed to update metrics' }, { status: 500 })
  }
}