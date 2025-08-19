import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { SecurityScan } from '@/lib/models/scan'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const range = searchParams.get('range') || '7d'
    
    // Calculate date range
    const now = new Date()
    const startDate = new Date()
    
    switch (range) {
      case '24h':
        startDate.setDate(now.getDate() - 1)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }
    
    const db = await getDatabase()
    const scansCollection = db.collection<SecurityScan>('security_scans')
    
    // Fetch all scans in the date range
    const scans = await scansCollection.find({
      createdAt: { $gte: startDate, $lte: now }
    }).toArray()
    
    // Calculate metrics
    const totalScans = scans.length
    const threatsBlocked = scans.filter(scan => 
      scan.result && !scan.result.isSafe
    ).length
    
    // Get unique users (excluding null/anonymous)
    const uniqueUsers = new Set(
      scans
        .filter(scan => scan.userId !== null)
        .map(scan => scan.userId?.toString())
    )
    const activeUsers = uniqueUsers.size
    
    // Calculate success rate
    const completedScans = scans.filter(scan => scan.status === 'completed')
    const successRate = completedScans.length > 0 
      ? Math.round((completedScans.length / totalScans) * 100) 
      : 100
    
    // Generate daily data for the last 7 days
    const dailyData = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      const dayScans = scans.filter(scan => {
        const scanDate = new Date(scan.createdAt)
        return scanDate >= date && scanDate < nextDate
      })
      
      dailyData.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        scans: dayScans.length,
        threats: dayScans.filter(scan => !scan.result?.isSafe).length
      })
    }
    
    // Calculate threat categories
    const threatCategories = {
      phishing: 0,
      malware: 0,
      suspiciousWallets: 0,
      smartContractExploits: 0
    }
    
    scans.forEach(scan => {
      if (!scan.result?.isSafe && scan.result?.threats) {
        scan.result.threats.forEach(threat => {
          const threatLower = threat.toLowerCase()
          if (threatLower.includes('phishing')) {
            threatCategories.phishing++
          } else if (threatLower.includes('malware') || threatLower.includes('virus')) {
            threatCategories.malware++
          } else if (scan.type === 'wallet') {
            threatCategories.suspiciousWallets++
          } else if (threatLower.includes('contract') || threatLower.includes('exploit')) {
            threatCategories.smartContractExploits++
          }
        })
      }
    })
    
    // Get recent security events
    const recentEvents = scans
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(scan => {
        const timeAgo = getTimeAgo(new Date(scan.createdAt))
        let eventType = 'Security scan completed'
        
        if (!scan.result?.isSafe) {
          if (scan.type === 'url') {
            eventType = 'Blocked phishing attempt'
          } else if (scan.type === 'document') {
            eventType = 'Malicious document detected'
          } else if (scan.type === 'wallet') {
            eventType = 'Suspicious wallet flagged'
          }
        } else if (scan.type === 'smart_contract') {
          eventType = scan.result?.isSafe ? 'Smart contract verified' : 'Malicious contract detected'
        } else if (scan.type === 'document') {
          eventType = 'Document scan completed'
        }
        
        return {
          time: timeAgo,
          event: eventType,
          severity: scan.severity || 'low',
          details: scan.target.length > 50 ? scan.target.substring(0, 47) + '...' : scan.target
        }
      })
    
    // Calculate change percentages by comparing with previous period
    const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()))
    const previousPeriodEnd = startDate
    
    const previousScans = await scansCollection.find({
      createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd }
    }).toArray()
    
    const previousTotalScans = previousScans.length
    const previousThreatsBlocked = previousScans.filter(scan => 
      scan.result && !scan.result.isSafe
    ).length
    const previousUniqueUsers = new Set(
      previousScans
        .filter(scan => scan.userId !== null)
        .map(scan => scan.userId?.toString())
    ).size
    const previousCompletedScans = previousScans.filter(scan => scan.status === 'completed').length
    const previousSuccessRate = previousCompletedScans > 0 
      ? Math.round((previousCompletedScans / previousTotalScans) * 100) 
      : 100
    
    // Calculate percentage changes
    const totalScansChange = previousTotalScans > 0 ? 
      `${((totalScans - previousTotalScans) / previousTotalScans * 100).toFixed(1)}%` : '+100%'
    const threatsChange = previousThreatsBlocked > 0 ? 
      `${((threatsBlocked - previousThreatsBlocked) / previousThreatsBlocked * 100).toFixed(1)}%` : 
      threatsBlocked > 0 ? '+100%' : '0%'
    const usersChange = previousUniqueUsers > 0 ? 
      `${((activeUsers - previousUniqueUsers) / previousUniqueUsers * 100).toFixed(1)}%` : 
      activeUsers > 0 ? '+100%' : '0%'
    const successRateChange = `${(successRate - previousSuccessRate).toFixed(1)}%`
    
    // Format changes with + prefix for positive numbers
    const formatChange = (change: string) => {
      const num = parseFloat(change)
      return num > 0 ? `+${change}` : change
    }
    
    return NextResponse.json({
      totalScans,
      threatsBlocked,
      activeUsers,
      successRate,
      dailyData,
      threatCategories,
      recentEvents,
      totalScansChange: formatChange(totalScansChange),
      threatsChange: formatChange(threatsChange),
      usersChange: formatChange(usersChange),
      successRateChange: formatChange(successRateChange)
    })
  } catch (error) {
    console.error('Analytics metrics error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch metrics',
      totalScans: 0,
      threatsBlocked: 0,
      activeUsers: 0,
      successRate: 100,
      dailyData: [],
      threatCategories: {
        phishing: 0,
        malware: 0,
        suspiciousWallets: 0,
        smartContractExploits: 0
      }
    }, { status: 500 })
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000) // difference in seconds
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? 's' : ''} ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`
  
  return date.toLocaleDateString()
}