'use client'

import { useState, useEffect } from 'react'
import { useThreatWebSocket } from './threat-websocket-client'
import { ThreatStreamEvent, ThreatType, ThreatSeverity } from '@/lib/models/threat-feed'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ThreatFeedDashboardProps {
  className?: string
  maxThreats?: number
  autoConnect?: boolean
}

export function ThreatFeedDashboard({ 
  className = '',
  maxThreats = 50,
  autoConnect = true 
}: ThreatFeedDashboardProps) {
  const [selectedFilters, setSelectedFilters] = useState({
    types: [] as ThreatType[],
    severities: [] as ThreatSeverity[],
    minimumConfidence: 50
  })

  const {
    threats,
    isConnected,
    isSubscribed,
    threatCount,
    lastThreatTime,
    connectionStats,
    error,
    connect,
    disconnect,
    updateSubscription,
    clearThreats,
    clearError
  } = useThreatWebSocket({
    filters: selectedFilters,
    autoConnect,
    onThreatReceived: (event) => {
      console.log('New threat received:', event.threat?.context.title)
    }
  })

  const handleFilterChange = (newFilters: typeof selectedFilters) => {
    setSelectedFilters(newFilters)
    updateSubscription(newFilters)
  }

  const getSeverityColor = (severity: ThreatSeverity) => {
    const colors = {
      info: 'text-blue-600 bg-blue-50',
      low: 'text-green-600 bg-green-50',
      medium: 'text-yellow-600 bg-yellow-50',
      high: 'text-orange-600 bg-orange-50',
      critical: 'text-red-600 bg-red-50'
    }
    return colors[severity] || colors.medium
  }

  const getConnectionStatusColor = () => {
    if (isSubscribed) return 'text-green-600'
    if (isConnected) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConnectionStatusText = () => {
    if (isSubscribed) return 'Subscribed to threat feed'
    if (isConnected) return 'Connected, not subscribed'
    return 'Disconnected'
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <p className={`font-medium ${getConnectionStatusColor()}`}>
                {getConnectionStatusText()}
              </p>
              {lastThreatTime && (
                <p className="text-sm text-gray-500">
                  Last threat: {lastThreatTime.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <p className="text-sm font-medium">{threatCount} threats received</p>
              {connectionStats && (
                <p className="text-xs text-gray-500">
                  {connectionStats.activeConnections} active connections
                </p>
              )}
            </div>
            
            <Button
              variant={isConnected ? "outline" : "default"}
              size="sm"
              onClick={isConnected ? disconnect : connect}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Button>
          </div>
        </div>
        
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            Error: {error}
            <Button variant="link" size="sm" onClick={clearError} className="ml-2 text-red-600">
              Dismiss
            </Button>
          </div>
        )}
      </Card>

      {/* Threat Filters */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Threat Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Severity Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Severities</label>
            <div className="space-y-1">
              {(['info', 'low', 'medium', 'high', 'critical'] as ThreatSeverity[]).map(severity => (
                <label key={severity} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedFilters.severities.includes(severity)}
                    onChange={(e) => {
                      const newSeverities = e.target.checked
                        ? [...selectedFilters.severities, severity]
                        : selectedFilters.severities.filter(s => s !== severity)
                      handleFilterChange({ ...selectedFilters, severities: newSeverities })
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(severity)}`}>
                    {severity.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Threat Types</label>
            <div className="space-y-1">
              {(['scam', 'phishing', 'rugpull', 'honeypot', 'exploit', 'malware'] as ThreatType[]).map(type => (
                <label key={type} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedFilters.types.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...selectedFilters.types, type]
                        : selectedFilters.types.filter(t => t !== type)
                      handleFilterChange({ ...selectedFilters, types: newTypes })
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Confidence Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Confidence: {selectedFilters.minimumConfidence}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedFilters.minimumConfidence}
              onChange={(e) => {
                handleFilterChange({ 
                  ...selectedFilters, 
                  minimumConfidence: parseInt(e.target.value) 
                })
              }}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const resetFilters = { types: [] as ThreatType[], severities: [] as ThreatSeverity[], minimumConfidence: 0 }
              setSelectedFilters(resetFilters)
              updateSubscription(resetFilters)
            }}
          >
            Clear Filters
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearThreats}
          >
            Clear Threats ({threats.length})
          </Button>
        </div>
      </Card>

      {/* Threat Feed */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Live Threat Feed</h3>
        
        {threats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No threats received yet</p>
            {!isSubscribed && (
              <p className="text-sm mt-2">Configure filters and connect to start receiving threats</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {threats.slice(0, maxThreats).map((event, index) => {
              if (!event.threat) return null
              
              const threat = event.threat
              return (
                <div key={`${event.threatId}-${index}`} className="border rounded p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(threat.severity)}`}>
                          {threat.severity.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {threat.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {threat.confidence}% confidence
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-sm mb-1">
                        {threat.context.title}
                      </h4>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {threat.context.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Target: {threat.target.value}</span>
                        <span>Source: {threat.source.name}</span>
                        <span>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {threat.context.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {threat.context.tags.map(tag => (
                            <span key={tag} className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4 text-right">
                      <div className="text-xs text-gray-400">
                        Event: {event.eventType}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Statistics */}
      {connectionStats && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Connection Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{connectionStats.activeConnections}</p>
              <p className="text-sm text-gray-500">Active Connections</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{connectionStats.threatsStreamed}</p>
              <p className="text-sm text-gray-500">Threats Streamed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{connectionStats.subscriptionsActive}</p>
              <p className="text-sm text-gray-500">Active Subscriptions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{connectionStats.messagesDelivered}</p>
              <p className="text-sm text-gray-500">Messages Delivered</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}