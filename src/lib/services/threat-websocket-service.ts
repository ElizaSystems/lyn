import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { ThreatStreamEvent, ThreatData, ThreatType, ThreatSeverity, ThreatSubscription } from '@/lib/models/threat-feed'
import { ThreatFeedService } from './threat-feed-service'
import { logger } from '@/lib/logger'
import crypto from 'crypto'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

interface SocketSubscription {
  socketId: string
  userId?: string
  sessionId?: string
  filters: {
    types?: ThreatType[]
    severities?: ThreatSeverity[]
    sources?: string[]
    targets?: string[]
    minimumConfidence?: number
    tags?: string[]
  }
  joinedAt: Date
}

interface ThreatStreamMessage {
  type: 'threat_update' | 'subscription_confirmed' | 'error' | 'ping' | 'stats_update'
  data: ThreatStreamEvent | ThreatSubscription | { message: string } | { timestamp: Date } | Record<string, unknown>
  timestamp: Date
}

export class ThreatWebSocketService {
  private static instance: ThreatWebSocketService | null = null
  private io: SocketIOServer | null = null
  private subscriptions = new Map<string, SocketSubscription>()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private statsInterval: NodeJS.Timeout | null = null
  
  // Rate limiting
  private rateLimits = new Map<string, { count: number; resetTime: number }>()
  private readonly RATE_LIMIT_WINDOW = 60000 // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100
  
  // Connection statistics
  private stats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesDelivered: 0,
    threatsStreamed: 0,
    subscriptionsActive: 0,
    lastActivity: new Date()
  }

  private constructor() {}

  static getInstance(): ThreatWebSocketService {
    if (!ThreatWebSocketService.instance) {
      ThreatWebSocketService.instance = new ThreatWebSocketService()
    }
    return ThreatWebSocketService.instance
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    if (this.io) {
      logger.warn('[ThreatWebSocket] WebSocket server already initialized')
      return
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'development' ? '*' : process.env.NEXT_PUBLIC_APP_URL,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true
    })

    this.setupEventHandlers()
    this.startHeartbeat()
    this.startStatsUpdates()
    this.subscribeToThreatFeed()
    
    logger.info('[ThreatWebSocket] WebSocket server initialized')
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      this.stats.totalConnections++
      this.stats.activeConnections++
      this.stats.lastActivity = new Date()
      
      logger.info(`[ThreatWebSocket] Client connected: ${socket.id}`)

      // Handle authentication
      socket.on('authenticate', async (data: { userId?: string; token?: string; sessionId?: string }) => {
        try {
          // Validate authentication if provided
          if (data.token) {
            // Add token validation logic here if needed
            socket.data.userId = data.userId
            socket.data.authenticated = true
          } else {
            socket.data.sessionId = data.sessionId || crypto.randomUUID()
            socket.data.authenticated = false
          }
          
          socket.emit('authenticated', { 
            success: true, 
            socketId: socket.id,
            userId: socket.data.userId,
            sessionId: socket.data.sessionId
          })
          
          logger.info(`[ThreatWebSocket] Client authenticated: ${socket.id}`)
          
        } catch (error) {
          logger.error(`[ThreatWebSocket] Authentication failed for ${socket.id}:`, error)
          socket.emit('authenticated', { success: false, error: 'Authentication failed' })
        }
      })

      // Handle threat feed subscription
      socket.on('subscribe_threats', async (filters: SocketSubscription['filters']) => {
        try {
          if (!this.checkRateLimit(socket.id)) {
            socket.emit('error', { message: 'Rate limit exceeded' })
            return
          }

          // Validate filters
          const validatedFilters = this.validateFilters(filters)
          
          // Create subscription
          const subscription: SocketSubscription = {
            socketId: socket.id,
            userId: socket.data.userId,
            sessionId: socket.data.sessionId,
            filters: validatedFilters,
            joinedAt: new Date()
          }
          
          this.subscriptions.set(socket.id, subscription)
          this.stats.subscriptionsActive = this.subscriptions.size
          
          // Join socket to appropriate rooms for efficient broadcasting
          const rooms = this.generateRooms(validatedFilters)
          for (const room of rooms) {
            socket.join(room)
          }
          
          // Send subscription confirmation
          const confirmationMessage: ThreatStreamMessage = {
            type: 'subscription_confirmed',
            data: {
              filters: validatedFilters,
              subscriptionId: socket.id,
              timestamp: new Date()
            } as any,
            timestamp: new Date()
          }
          
          socket.emit('threat_stream', confirmationMessage)
          
          // Send recent threats matching filters
          await this.sendRecentThreats(socket, validatedFilters)
          
          logger.info(`[ThreatWebSocket] Client subscribed to threat feed: ${socket.id}`)
          
        } catch (error) {
          logger.error(`[ThreatWebSocket] Subscription failed for ${socket.id}:`, error)
          socket.emit('error', { message: 'Subscription failed' })
        }
      })

      // Handle threat feed unsubscribe
      socket.on('unsubscribe_threats', () => {
        this.subscriptions.delete(socket.id)
        this.stats.subscriptionsActive = this.subscriptions.size
        socket.leave('threat_feed')
        socket.emit('unsubscribed', { success: true })
        logger.info(`[ThreatWebSocket] Client unsubscribed: ${socket.id}`)
      })

      // Handle threat voting
      socket.on('vote_threat', async (data: { threatId: string; voteType: 'upvote' | 'downvote' }) => {
        try {
          if (!this.checkRateLimit(socket.id)) {
            socket.emit('error', { message: 'Rate limit exceeded' })
            return
          }

          if (!socket.data.userId) {
            socket.emit('error', { message: 'Authentication required for voting' })
            return
          }

          // Process vote through threat feed service
          // This would need to be implemented in ThreatFeedService
          socket.emit('vote_recorded', { threatId: data.threatId, success: true })
          
        } catch (error) {
          logger.error(`[ThreatWebSocket] Vote failed for ${socket.id}:`, error)
          socket.emit('error', { message: 'Vote failed' })
        }
      })

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        const pongMessage: ThreatStreamMessage = {
          type: 'ping',
          data: { timestamp: new Date() },
          timestamp: new Date()
        }
        socket.emit('pong', pongMessage)
      })

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.stats.activeConnections--
        this.subscriptions.delete(socket.id)
        this.stats.subscriptionsActive = this.subscriptions.size
        this.stats.lastActivity = new Date()
        
        logger.info(`[ThreatWebSocket] Client disconnected: ${socket.id}, reason: ${reason}`)
      })

      // Handle connection errors
      socket.on('error', (error) => {
        logger.error(`[ThreatWebSocket] Socket error for ${socket.id}:`, error)
      })
    })

    this.io.on('error', (error) => {
      logger.error('[ThreatWebSocket] Server error:', error)
    })
  }

  /**
   * Subscribe to threat feed service events
   */
  private subscribeToThreatFeed(): void {
    // Subscribe to threat feed events
    ThreatFeedService.subscribe('websocket_service', (event: ThreatStreamEvent) => {
      this.broadcastThreatEvent(event)
    })
  }

  /**
   * Broadcast threat event to relevant subscribers
   */
  private async broadcastThreatEvent(event: ThreatStreamEvent): Promise<void> {
    if (!this.io || !event.threat) return

    const message: ThreatStreamMessage = {
      type: 'threat_update',
      data: event,
      timestamp: new Date()
    }

    // Get all relevant subscriptions
    const relevantSubscriptions = Array.from(this.subscriptions.values()).filter(sub => 
      this.matchesFilters(event.threat!, sub.filters)
    )

    // Send to matching subscribers
    for (const subscription of relevantSubscriptions) {
      const socket = this.io.sockets.sockets.get(subscription.socketId)
      if (socket) {
        socket.emit('threat_stream', message)
        this.stats.messagesDelivered++
      }
    }

    this.stats.threatsStreamed++
    this.stats.lastActivity = new Date()

    // Also broadcast to rooms for efficiency
    const rooms = this.generateRoomsFromThreat(event.threat)
    for (const room of rooms) {
      this.io.to(room).emit('threat_stream', message)
    }
  }

  /**
   * Send recent threats to a newly subscribed client
   */
  private async sendRecentThreats(socket: any, filters: SocketSubscription['filters']): Promise<void> {
    try {
      const { threats } = await ThreatFeedService.queryThreats({
        ...filters,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: ['active']
      })

      for (const threat of threats) {
        const event: ThreatStreamEvent = {
          eventId: crypto.randomUUID(),
          eventType: 'threat_added',
          threatId: threat._id!,
          threat,
          metadata: {
            source: 'historical',
            triggeredBy: 'system'
          },
          timestamp: threat.createdAt
        }

        const message: ThreatStreamMessage = {
          type: 'threat_update',
          data: event,
          timestamp: new Date()
        }

        socket.emit('threat_stream', message)
      }

    } catch (error) {
      logger.error('[ThreatWebSocket] Failed to send recent threats:', error)
    }
  }

  /**
   * Check if threat matches subscription filters
   */
  private matchesFilters(threat: ThreatData, filters: SocketSubscription['filters']): boolean {
    // Check threat type filter
    if (filters.types?.length && !filters.types.includes(threat.type)) {
      return false
    }

    // Check severity filter
    if (filters.severities?.length && !filters.severities.includes(threat.severity)) {
      return false
    }

    // Check source filter
    if (filters.sources?.length && !filters.sources.includes(threat.source.id)) {
      return false
    }

    // Check target filter
    if (filters.targets?.length && !filters.targets.includes(threat.target.value)) {
      return false
    }

    // Check confidence filter
    if (filters.minimumConfidence !== undefined && threat.confidence < filters.minimumConfidence) {
      return false
    }

    // Check tags filter
    if (filters.tags?.length) {
      const hasMatchingTag = filters.tags.some(tag => threat.context.tags.includes(tag))
      if (!hasMatchingTag) {
        return false
      }
    }

    return true
  }

  /**
   * Validate and sanitize subscription filters
   */
  private validateFilters(filters: any): SocketSubscription['filters'] {
    const validatedFilters: SocketSubscription['filters'] = {}

    if (filters.types && Array.isArray(filters.types)) {
      validatedFilters.types = filters.types.filter((type: any) => typeof type === 'string')
    }

    if (filters.severities && Array.isArray(filters.severities)) {
      validatedFilters.severities = filters.severities.filter((severity: any) => 
        ['info', 'low', 'medium', 'high', 'critical'].includes(severity)
      )
    }

    if (filters.sources && Array.isArray(filters.sources)) {
      validatedFilters.sources = filters.sources.filter((source: any) => typeof source === 'string')
    }

    if (filters.targets && Array.isArray(filters.targets)) {
      validatedFilters.targets = filters.targets.filter((target: any) => typeof target === 'string')
    }

    if (filters.minimumConfidence && typeof filters.minimumConfidence === 'number') {
      validatedFilters.minimumConfidence = Math.max(0, Math.min(100, filters.minimumConfidence))
    }

    if (filters.tags && Array.isArray(filters.tags)) {
      validatedFilters.tags = filters.tags.filter((tag: any) => typeof tag === 'string')
    }

    return validatedFilters
  }

  /**
   * Generate room names for efficient broadcasting
   */
  private generateRooms(filters: SocketSubscription['filters']): string[] {
    const rooms: string[] = ['threat_feed'] // Base room

    if (filters.types?.length) {
      rooms.push(...filters.types.map(type => `type:${type}`))
    }

    if (filters.severities?.length) {
      rooms.push(...filters.severities.map(severity => `severity:${severity}`))
    }

    if (filters.sources?.length) {
      rooms.push(...filters.sources.map(source => `source:${source}`))
    }

    return rooms
  }

  /**
   * Generate rooms from threat data
   */
  private generateRoomsFromThreat(threat: ThreatData): string[] {
    return [
      'threat_feed',
      `type:${threat.type}`,
      `severity:${threat.severity}`,
      `source:${threat.source.id}`
    ]
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(socketId: string): boolean {
    const now = Date.now()
    const limit = this.rateLimits.get(socketId)

    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(socketId, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      })
      return true
    }

    if (limit.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false
    }

    limit.count++
    return true
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.io) {
        const heartbeatMessage: ThreatStreamMessage = {
          type: 'ping',
          data: { timestamp: new Date() },
          timestamp: new Date()
        }
        
        this.io.emit('heartbeat', heartbeatMessage)
      }
    }, 30000) // Every 30 seconds
  }

  /**
   * Start statistics updates
   */
  private startStatsUpdates(): void {
    this.statsInterval = setInterval(() => {
      this.broadcastStats()
    }, 60000) // Every minute
  }

  /**
   * Broadcast connection statistics
   */
  private broadcastStats(): void {
    if (!this.io) return

    const statsMessage: ThreatStreamMessage = {
      type: 'stats_update',
      data: {
        ...this.stats,
        timestamp: new Date()
      },
      timestamp: new Date()
    }

    this.io.emit('stats_update', statsMessage)
  }

  /**
   * Get current connection statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats }
  }

  /**
   * Get active subscriptions count
   */
  getActiveSubscriptions(): number {
    return this.subscriptions.size
  }

  /**
   * Broadcast emergency alert to all connected clients
   */
  async broadcastEmergencyAlert(alert: {
    title: string
    message: string
    severity: ThreatSeverity
    targetType?: string
    targetValue?: string
  }): Promise<void> {
    if (!this.io) return

    const emergencyEvent: ThreatStreamEvent = {
      eventId: crypto.randomUUID(),
      eventType: 'threat_added',
      threatId: new ObjectId(),
      metadata: {
        source: 'emergency_alert',
        triggeredBy: 'system'
      },
      timestamp: new Date(),
      threat: {
        _id: new ObjectId(),
        threatId: crypto.randomUUID(),
        hash: crypto.randomUUID(),
        source: { id: 'emergency', name: 'Emergency Alert System', type: 'manual', reliability: 100 },
        type: 'scam',
        category: 'financial',
        severity: alert.severity,
        confidence: 100,
        target: {
          type: (alert.targetType as any) || 'other',
          value: alert.targetValue || 'multiple'
        },
        indicators: [],
        context: {
          title: alert.title,
          description: alert.message,
          tags: ['emergency', 'alert']
        },
        impact: {},
        timeline: {
          firstSeen: new Date(),
          lastSeen: new Date(),
          discoveredAt: new Date()
        },
        status: 'active',
        correlatedThreats: [],
        votes: { upvotes: 0, downvotes: 0, totalVotes: 0, score: 0 },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    const message: ThreatStreamMessage = {
      type: 'threat_update',
      data: emergencyEvent,
      timestamp: new Date()
    }

    this.io.emit('emergency_alert', message)
    logger.warn(`[ThreatWebSocket] Emergency alert broadcasted: ${alert.title}`)
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval)
    }

    if (this.io) {
      this.io.close()
      this.io = null
    }

    this.subscriptions.clear()
    this.rateLimits.clear()
    
    logger.info('[ThreatWebSocket] WebSocket server shut down')
  }
}