import { NextRequest, NextResponse } from 'next/server'
import { ThreatIntelligenceService } from '@/lib/services/threat-intelligence'
import { ScanService } from '@/lib/services/scan-service'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication (now handles anonymous users with sessionId)
    const authResult = await requireAuth(request)
    const userId = authResult.user?.id || 'anonymous' // Will have sessionId for anonymous users
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Check file size (limit to 32MB for VirusTotal free tier)
    const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` 
      }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    const fileName = file.name

    // Create scan record
    const scan = await ScanService.createScan(
      userId,
      'document',
      fileName,
      {
        fileSize: file.size,
        fileType: file.type || 'unknown'
      }
    )

    // Get real malware analysis from VirusTotal
    const scanResult = await ThreatIntelligenceService.checkFile(fileBuffer, fileName)
    
    // Build response
    const details: string[] = []
    const recommendations: string[] = []
    
    if (scanResult.safe) {
      details.push(`✅ File scanned by ${scanResult.source} - No malware detected`)
      details.push(`Safety score: ${scanResult.score}/100`)
      
      if (scanResult.details.stats) {
        const stats = scanResult.details.stats as Record<string, number>
        details.push(`Scan results: ${stats.harmless || 0} clean, ${stats.malicious || 0} malicious, ${stats.suspicious || 0} suspicious`)
      }
      
      recommendations.push('This file appears to be safe based on antivirus scanning')
      recommendations.push('Always keep your antivirus software updated')
      recommendations.push('Be cautious when enabling macros in Office documents')
    } else {
      details.push(`🚨 MALWARE DETECTED by ${scanResult.source}`)
      details.push(`Threat score: ${100 - scanResult.score}/100 (Higher is more dangerous)`)
      
      if (scanResult.threats.length > 0) {
        details.push('Detected threats:')
        scanResult.threats.forEach(threat => {
          details.push(`  • ${threat}`)
        })
      }
      
      if (scanResult.details.stats) {
        const stats = scanResult.details.stats as Record<string, number>
        details.push(`Detection summary: ${stats.malicious || 0} antivirus engines flagged this file`)
      }
      
      recommendations.push('⚠️ DO NOT OPEN THIS FILE - High risk of malware infection')
      recommendations.push('Delete this file immediately from your system')
      recommendations.push('Run a full system scan with updated antivirus software')
      recommendations.push('If you opened this file, disconnect from network and scan for infections')
    }

    // Add file metadata
    if (scanResult.details.fileType) {
      details.push(`File type: ${scanResult.details.fileType}`)
    }
    if (scanResult.details.md5) {
      details.push(`MD5 hash: ${scanResult.details.md5}`)
    }
    if (scanResult.details.sha256) {
      details.push(`SHA256 hash: ${scanResult.details.sha256}`)
    }

    // Determine risk level and severity
    let risk_level: 'low' | 'medium' | 'high' | 'critical'
    let severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'
    
    if (scanResult.score >= 90) {
      risk_level = 'low'
      severity = scanResult.safe ? 'safe' : 'low'
    } else if (scanResult.score >= 70) {
      risk_level = 'medium'
      severity = 'medium'
    } else if (scanResult.score >= 40) {
      risk_level = 'high'
      severity = 'high'
    } else {
      risk_level = 'critical'
      severity = 'critical'
    }

    // Update scan with results
    if (scan._id) {
      await ScanService.updateScanResult(
        scan._id.toString(),
        {
          isSafe: scanResult.safe,
          threats: scanResult.threats,
          confidence: scanResult.score,
          details: details.join('\n'),
          recommendations
        },
        severity
      )
    }

    return NextResponse.json({
      scanId: scan._id?.toString(),
      scanHash: scan.hash,
      safe: scanResult.safe,
      risk_level,
      confidence_score: scanResult.score,
      details,
      recommendations,
      scan_source: scanResult.source,
      threats_found: scanResult.threats,
      file_info: {
        name: fileName,
        size: file.size,
        type: file.type || 'unknown',
        last_modified: new Date(file.lastModified).toISOString()
      },
      scan_details: scanResult.details,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Document analysis error:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to analyze document. Please try again.'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('File size exceeds')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('Invalid file')) {
        errorMessage = 'Invalid file format. Please upload a valid document.'
        statusCode = 400
      } else if (error.message.includes('Authentication')) {
        errorMessage = 'Authentication required to scan documents.'
        statusCode = 401
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}