'use client'

import { useState } from 'react'
import { ThreatFeedDashboard } from '@/components/threat/threat-feed-dashboard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ThreatFeedPage() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const initializeThreatFeed = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/threats/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      })

      const data = await response.json()
      if (data.success) {
        setIsInitialized(true)
        alert('Threat feed system initialized successfully!')
      } else {
        alert('Failed to initialize: ' + data.error)
      }
    } catch (error) {
      alert('Error: ' + error)
    }
    setIsLoading(false)
  }

  const generateTestAlert = async () => {
    try {
      const response = await fetch('/api/threats/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'emergency_alert',
          title: 'Test Critical Alert',
          message: 'This is a test emergency alert to demonstrate the real-time threat feed system.',
          severity: 'critical',
          targetType: 'wallet',
          targetValue: 'test-wallet-address'
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('Test alert broadcasted!')
      } else {
        alert('Failed to broadcast alert: ' + data.error)
      }
    } catch (error) {
      alert('Error: ' + error)
    }
  }

  const manualFetch = async (sourceId: string) => {
    try {
      const response = await fetch('/api/threats/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'fetch_external',
          sourceId
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Fetched ${data.data.threatsAdded} new threats from ${sourceId}`)
      } else {
        alert('Failed to fetch: ' + data.error)
      }
    } catch (error) {
      alert('Error: ' + error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">LYN Threat Feed System</h1>
          <p className="text-muted-foreground mt-2">
            Real-time threat intelligence aggregation and streaming platform
          </p>
        </div>

        {/* Initialization Card */}
        <Card className="glass-card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">System Control</h2>
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={initializeThreatFeed} 
              disabled={isLoading}
              variant={isInitialized ? "outline" : "default"}
            >
              {isLoading ? 'Initializing...' : (isInitialized ? 'Reinitialize System' : 'Initialize Threat Feed System')}
            </Button>
            
            <Button 
              onClick={generateTestAlert} 
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive/10"
            >
              Send Test Alert
            </Button>
            
            <Button 
              onClick={() => manualFetch('phishing_tracker')} 
              variant="outline"
            >
              Fetch Phishing Data
            </Button>
            
            <Button 
              onClick={() => manualFetch('scam_database')} 
              variant="outline"
            >
              Fetch Scam Data
            </Button>
            
            <Button 
              onClick={() => manualFetch('blockchain_monitor')} 
              variant="outline"
            >
              Fetch Blockchain Threats
            </Button>
          </div>
        </Card>

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-primary mb-2">Real-time</div>
            <p className="text-sm text-muted-foreground">WebSocket-based threat streaming with millisecond latency</p>
          </Card>
          
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-green-500 mb-2">Multi-source</div>
            <p className="text-sm text-muted-foreground">Aggregates threats from multiple external sources and community reports</p>
          </Card>
          
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-accent mb-2">AI-powered</div>
            <p className="text-sm text-muted-foreground">Pattern detection, correlation analysis, and automated threat scoring</p>
          </Card>
          
          <Card className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-destructive mb-2">Scalable</div>
            <p className="text-sm text-muted-foreground">Handles thousands of threats per minute with automatic aging and cleanup</p>
          </Card>
        </div>

        {/* System Features */}
        <Card className="glass-card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">System Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2 text-green-500">✅ Implemented Features</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Real-time threat feed aggregation</li>
                <li>• WebSocket-based streaming</li>
                <li>• Threat correlation and deduplication</li>
                <li>• Pattern detection and analytics</li>
                <li>• Subscription management</li>
                <li>• Automated threat aging and expiration</li>
                <li>• Multiple external source integration</li>
                <li>• RESTful API endpoints</li>
                <li>• MongoDB storage with indexing</li>
                <li>• Community reporting integration</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2 text-primary">🔧 Technical Architecture</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Node.js/Next.js backend with Socket.io</li>
                <li>• MongoDB with aggregation pipelines</li>
                <li>• React/TypeScript frontend</li>
                <li>• Background job processing</li>
                <li>• Rate limiting and connection management</li>
                <li>• Comprehensive error handling</li>
                <li>• Webhook delivery system</li>
                <li>• Pattern matching engine</li>
                <li>• Statistics and analytics generation</li>
                <li>• Graceful shutdown and recovery</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Main Threat Feed Dashboard */}
        <ThreatFeedDashboard />

        {/* Usage Instructions */}
        <Card className="glass-card p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Usage Instructions</h2>
          <div className="prose text-sm text-muted-foreground">
            <ol className="space-y-2">
              <li>1. <strong>Initialize the system</strong> by clicking "Initialize Threat Feed System" above</li>
              <li>2. <strong>Configure filters</strong> in the dashboard to specify what types of threats you want to monitor</li>
              <li>3. <strong>Connect to the feed</strong> using the Connect button to start receiving real-time threats</li>
              <li>4. <strong>Generate test data</strong> using the "Send Test Alert" or manual fetch buttons</li>
              <li>5. <strong>Monitor the live feed</strong> as threats are detected and streamed in real-time</li>
            </ol>
            
            <h3 className="font-medium mt-4 mb-2">API Endpoints</h3>
            <ul className="space-y-1">
              <li>• <code>GET /api/threats</code> - Query threats with filtering</li>
              <li>• <code>POST /api/threats</code> - Add new threats</li>
              <li>• <code>GET /api/threats/stats</code> - Get threat statistics</li>
              <li>• <code>POST /api/threats/subscriptions</code> - Create threat subscriptions</li>
              <li>• <code>GET /api/threats/search</code> - Search threats by content</li>
              <li>• <code>POST /api/threats/admin</code> - Administrative actions</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}