import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { NotificationService } from '@/lib/services/notification-service'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { eventType, channel } = body

    // Validate input
    const validEventTypes = ['task-completed', 'task-failed', 'security-alert', 'price-alert', 'wallet-activity', 'system-alert', 'account-activity']
    const validChannels = ['email', 'webhook', 'in-app']

    if (!eventType || !validEventTypes.includes(eventType)) {
      return NextResponse.json({ 
        error: 'Invalid eventType. Must be one of: ' + validEventTypes.join(', ') 
      }, { status: 400 })
    }

    if (channel && !validChannels.includes(channel)) {
      return NextResponse.json({ 
        error: 'Invalid channel. Must be one of: ' + validChannels.join(', ') 
      }, { status: 400 })
    }

    // Generate test notification variables based on event type
    const testVariables: Record<string, any> = {
      userId: authResult.user.id,
      timestamp: new Date().toISOString(),
      dashboardUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` : '#'
    }

    switch (eventType) {
      case 'task-completed':
        Object.assign(testVariables, {
          taskName: 'Test Security Scan',
          taskDescription: 'This is a test notification for a completed security scan task',
          executionTime: new Date().toISOString(),
          successRate: 95,
          result: JSON.stringify({ scanned: 5, threats: 0, status: 'clean' }, null, 2)
        })
        break

      case 'task-failed':
        Object.assign(testVariables, {
          taskName: 'Test Price Monitor',
          taskDescription: 'This is a test notification for a failed price monitoring task',
          failureTime: new Date().toISOString(),
          successRate: 78,
          error: 'API rate limit exceeded. Unable to fetch current price data.'
        })
        break

      case 'security-alert':
        Object.assign(testVariables, {
          alertType: 'Phishing Detection',
          severity: 'high',
          target: 'https://fake-dex.scam.com',
          detectionTime: new Date().toISOString(),
          threats: ['Phishing website detected', 'Malicious smart contract', 'Fake DEX interface'],
          recommendations: ['Do not connect your wallet', 'Report the website', 'Verify URLs before interacting'],
          score: 85,
          securityDashboardUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/security` : '#'
        })
        break

      case 'price-alert':
        Object.assign(testVariables, {
          tokenSymbol: 'LYN',
          currentPrice: 1.25,
          previousPrice: 1.18,
          changePercent: 5.93,
          priceChange: 0.07,
          volume24h: '$125,450',
          marketCap: '$12.5M',
          alertCondition: 'Price above $1.20',
          portfolioUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/wallet` : '#'
        })
        break

      case 'wallet-activity':
        Object.assign(testVariables, {
          activityType: 'Token Transfer',
          walletAddress: '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq',
          transactionHash: '5a8B2cD3eF4g5H6i7J8k9L0m1N2o3P4q5R6s7T8u9V0w1X2y3Z',
          amount: 150.75,
          tokenSymbol: 'LYN',
          from: '75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq',
          to: '9qA8r7S6t5U4v3W2x1Y0z9B8c7D6e5F4g3H2i1J0k9L8m7N6',
          riskLevel: 'low',
          riskDetails: 'Transaction appears normal with known counterparty',
          walletDashboardUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/wallet` : '#'
        })
        break

      case 'system-alert':
        Object.assign(testVariables, {
          alertType: 'Service Maintenance',
          severity: 'medium',
          detectionTime: new Date().toISOString(),
          description: 'Scheduled maintenance will be performed on the price monitoring service',
          affectedServices: ['Price Alerts', 'Portfolio Tracking', 'Market Data'],
          actions: ['Services temporarily paused', 'Users notified', 'Maintenance scheduled for low-traffic period'],
          statusPageUrl: 'https://status.lyn-ai.com'
        })
        break

      case 'account-activity':
        Object.assign(testVariables, {
          activityType: 'Login Attempt',
          activityDescription: 'New device login detected from unusual location',
          timestamp: new Date().toISOString(),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          location: 'San Francisco, CA, USA',
          requiresAction: true,
          actionRequired: 'Please verify this login attempt was authorized',
          securityUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/security` : '#'
        })
        break
    }

    // Add common variables
    testVariables.title = `Test ${eventType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Notification`
    testVariables.message = `This is a test notification of type "${eventType}" sent from the LYN Security Platform.`

    // Send test notification
    const channels = channel ? [channel] : ['in-app'] // Default to in-app for safety
    const results = await NotificationService.sendNotification(
      authResult.user.id,
      eventType as any,
      testVariables,
      { 
        priority: 'low',
        channels: channels as any,
        forceNotification: true // Bypass quiet hours and rate limits for test
      }
    )

    return NextResponse.json({
      success: true,
      message: `Test notification sent successfully`,
      results,
      eventType,
      channels,
      variables: testVariables
    })
  } catch (error) {
    console.error('Error sending test notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}