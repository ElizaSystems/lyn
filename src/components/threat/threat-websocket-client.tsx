'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { ThreatStreamEvent, ThreatType, ThreatSeverity } from '@/lib/models/threat-feed'
import { logger } from '@/lib/logger'

interface ThreatStreamMessage {
  type: 'threat_update' | 'subscription_confirmed' | 'error' | 'ping' | 'stats_update'
  data: ThreatStreamEvent | Record<string, unknown>
  timestamp: Date
}

interface ThreatSubscriptionFilters {
  types?: ThreatType[]
  severities?: ThreatSeverity[]
  sources?: string[]
  targets?: string[]
  minimumConfidence?: number
  tags?: string[]
}

interface ConnectionStats {
  totalConnections: number
  activeConnections: number
  messagesDelivered: number
  threatsStreamed: number
  subscriptionsActive: number
  lastActivity: Date
}

interface ThreatWebSocketClientProps {
  onThreatReceived?: (event: ThreatStreamEvent) => void
  onConnectionChange?: (connected: boolean) => void
  onError?: (error: string) => void
  onStats?: (stats: ConnectionStats) => void
  filters?: ThreatSubscriptionFilters
  autoConnect?: boolean
}

export function ThreatWebSocketClient({
  onThreatReceived,
  onConnectionChange,
  onError,
  onStats,
  filters = {},
  autoConnect = true
}: ThreatWebSocketClientProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null)
  const [threatCount, setThreatCount] = useState(0)
  const [lastThreatTime, setLastThreatTime] = useState<Date | null>(null)
  
  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    try {
      const socket = io({
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      })

      socketRef.current = socket

      // Connection event handlers
      socket.on('connect', () => {
        console.log('[ThreatWS] Connected to threat feed')
        setIsConnected(true)
        onConnectionChange?.(true)
        
        // Authenticate
        socket.emit('authenticate', {
          sessionId: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        })
      })

      socket.on('authenticated', (data) => {
        console.log('[ThreatWS] Authentication successful:', data)
        
        // Subscribe to threat feed
        if (Object.keys(filters).length > 0) {
          socket.emit('subscribe_threats', filters)
        }
      })

      socket.on('disconnect', (reason) => {
        console.log('[ThreatWS] Disconnected:', reason)
        setIsConnected(false)
        setIsSubscribed(false)
        onConnectionChange?.(false)
        
        // Auto-reconnect after 5 seconds
        if (reason !== 'io client disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[ThreatWS] Attempting to reconnect...')
            connect()
          }, 5000)
        }
      })

      // Threat feed events
      socket.on('threat_stream', (message: ThreatStreamMessage) => {
        if (message.type === 'subscription_confirmed') {
          console.log('[ThreatWS] Subscription confirmed')
          setIsSubscribed(true)
        } else if (message.type === 'threat_update' && message.data) {
          const event = message.data as ThreatStreamEvent
          console.log('[ThreatWS] Threat received:', event.threatId)
          
          setThreatCount(prev => prev + 1)
          setLastThreatTime(new Date())
          onThreatReceived?.(event)
        } else if (message.type === 'stats_update') {
          const stats = message.data as ConnectionStats
          setConnectionStats(stats)
          onStats?.(stats)
        }
      })

      socket.on('unsubscribed', () => {
        console.log('[ThreatWS] Unsubscribed from threat feed')
        setIsSubscribed(false)
      })

      socket.on('error', (error) => {
        console.error('[ThreatWS] Socket error:', error)
        onError?.(error.message || 'WebSocket error')
      })

      socket.on('connect_error', (error) => {
        console.error('[ThreatWS] Connection error:', error)
        onError?.(error.message || 'Connection failed')
      })

      // Heartbeat
      socket.on('heartbeat', () => {
        // Server heartbeat received
      })

      socket.on('pong', (data) => {
        console.log('[ThreatWS] Pong received:', data.timestamp)
      })

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping')
        }
      }, 30000)

    } catch (error) {
      console.error('[ThreatWS] Failed to connect:', error)
      onError?.('Failed to establish WebSocket connection')
    }
  }, [filters, onThreatReceived, onConnectionChange, onError, onStats])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
    }
    
    socketRef.current?.disconnect()
    socketRef.current = null
    setIsConnected(false)
    setIsSubscribed(false)
    onConnectionChange?.(false)
  }, [onConnectionChange])

  const updateSubscription = useCallback((newFilters: ThreatSubscriptionFilters) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_threats', newFilters)
    }
  }, [])

  const unsubscribe = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe_threats')
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    // Connection state
    isConnected,
    isSubscribed,
    connectionStats,
    threatCount,
    lastThreatTime,
    
    // Actions
    connect,
    disconnect,
    updateSubscription,
    unsubscribe
  }
}

// React hook for easier usage
export function useThreatWebSocket({
  filters = {},
  autoConnect = true,
  onThreatReceived,
  onConnectionChange,
  onError,
  onStats
}: Omit<ThreatWebSocketClientProps, 'children'> = {}) {
  const [threats, setThreats] = useState<ThreatStreamEvent[]>([])
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'subscribed'>('disconnected')
  const [error, setError] = useState<string | null>(null)

  const handleThreatReceived = useCallback((event: ThreatStreamEvent) => {
    setThreats(prev => [event, ...prev.slice(0, 99)]) // Keep last 100 threats
    onThreatReceived?.(event)
  }, [onThreatReceived])

  const handleConnectionChange = useCallback((connected: boolean) => {
    setConnectionState(connected ? 'connected' : 'disconnected')
    if (connected) {
      setError(null)
    }
    onConnectionChange?.(connected)
  }, [onConnectionChange])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    onError?.(errorMessage)
  }, [onError])

  const client = ThreatWebSocketClient({
    filters,
    autoConnect,
    onThreatReceived: handleThreatReceived,
    onConnectionChange: handleConnectionChange,
    onError: handleError,
    onStats
  })

  return {
    ...client,
    threats,
    connectionState: client.isSubscribed ? 'subscribed' : (client.isConnected ? 'connected' : 'disconnected'),
    error,
    clearThreats: () => setThreats([]),
    clearError: () => setError(null)
  }
}