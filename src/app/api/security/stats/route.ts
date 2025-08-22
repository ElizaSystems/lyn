import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase()
    
    // Get real statistics from the database
    const [
      securityAnalyses,
      walletReports,
      blacklistedWallets
    ] = await Promise.all([
      db.collection('wallet_security').countDocuments(),
      db.collection('wallet_reports').find({}).toArray(),
      db.collection('wallet_blacklist').countDocuments()
    ])
    
    // Calculate statistics
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const monthlyAnalyses = await db.collection('wallet_security')
      .countDocuments({ cachedAt: { $gte: thisMonth } })
    
    const verifiedReports = walletReports.filter(r => r.status === 'verified').length
    const totalReports = walletReports.length
    
    // Calculate detection rate based on verified vs total reports
    const detectionRate = totalReports > 0 
      ? Math.round((verifiedReports / totalReports) * 100 * 10) / 10
      : 0
    
    return NextResponse.json({
      walletsAnalyzed: {
        total: securityAnalyses,
        thisMonth: monthlyAnalyses
      },
      scammersFound: {
        total: blacklistedWallets,
        blacklisted: blacklistedWallets
      },
      communityReports: {
        total: totalReports,
        verified: verifiedReports
      },
      detectionRate: {
        percentage: detectionRate,
        accuracy: 'Real-time data'
      }
    })
  } catch (error) {
    console.error('[Security Stats] Error:', error)
    
    // Return default stats if database is not available
    return NextResponse.json({
      walletsAnalyzed: {
        total: 0,
        thisMonth: 0
      },
      scammersFound: {
        total: 0,
        blacklisted: 0
      },
      communityReports: {
        total: 0,
        verified: 0
      },
      detectionRate: {
        percentage: 0,
        accuracy: 'No data'
      }
    })
  }
}