import { getDatabase } from '@/lib/mongodb'
import { WebhookEvent } from '@/lib/models/subscription'
import crypto from 'crypto'

export interface WebhookConfig {
  url: string
  events: WebhookEvent['eventType'][]
  secret?: string
  active: boolean
  retryAttempts: number
  retryDelayMs: number
  timeoutMs: number
}

export interface WebhookEndpoint {
  _id?: string
  name: string
  url: string
  events: WebhookEvent['eventType'][]
  secret: string
  active: boolean
  createdAt: Date
  updatedAt: Date
  lastDeliveryAt?: Date
  successCount: number
  failureCount: number
  walletAddress?: string // If endpoint is user-specific
}

export class WebhookService {
  private static readonly DEFAULT_RETRY_ATTEMPTS = 3
  private static readonly DEFAULT_RETRY_DELAY_MS = 5000 // 5 seconds
  private static readonly DEFAULT_TIMEOUT_MS = 30000 // 30 seconds
  private static readonly MAX_RETRY_DELAY_MS = 300000 // 5 minutes

  /**
   * Register a webhook endpoint
   */
  static async registerWebhook(
    name: string,
    url: string,
    events: WebhookEvent['eventType'][],
    walletAddress?: string
  ): Promise<{
    success: boolean
    endpoint?: WebhookEndpoint
    error?: string
  }> {
    try {
      // Validate URL
      try {
        new URL(url)
      } catch {
        return { success: false, error: 'Invalid webhook URL' }
      }

      if (events.length === 0) {
        return { success: false, error: 'At least one event type must be specified' }
      }

      const db = await getDatabase()
      const webhookEndpointsCollection = db.collection('webhook_endpoints')

      // Check if endpoint already exists for this URL and wallet
      const existingEndpoint = await webhookEndpointsCollection.findOne({ 
        url, 
        walletAddress: walletAddress || null 
      })

      if (existingEndpoint) {
        return { success: false, error: 'Webhook endpoint already exists for this URL' }
      }

      // Generate secret for signature verification
      const secret = crypto.randomBytes(32).toString('hex')

      const endpoint: WebhookEndpoint = {
        name,
        url,
        events,
        secret,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        successCount: 0,
        failureCount: 0,
        walletAddress: walletAddress || undefined
      }

      const result = await webhookEndpointsCollection.insertOne(endpoint)
      const createdEndpoint = { ...endpoint, _id: result.insertedId.toString() }

      console.log(`[Webhook Service] Registered webhook endpoint: ${name} -> ${url}`)
      return { success: true, endpoint: createdEndpoint }

    } catch (error) {
      console.error('Error registering webhook:', error)
      return { 
        success: false, 
        error: `Failed to register webhook: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Update webhook endpoint
   */
  static async updateWebhook(
    endpointId: string,
    updates: Partial<Pick<WebhookEndpoint, 'name' | 'url' | 'events' | 'active'>>
  ): Promise<{
    success: boolean
    endpoint?: WebhookEndpoint
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const webhookEndpointsCollection = db.collection('webhook_endpoints')

      // Validate URL if provided
      if (updates.url) {
        try {
          new URL(updates.url)
        } catch {
          return { success: false, error: 'Invalid webhook URL' }
        }
      }

      // Validate events if provided
      if (updates.events && updates.events.length === 0) {
        return { success: false, error: 'At least one event type must be specified' }
      }

      const result = await webhookEndpointsCollection.updateOne(
        { _id: endpointId },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        }
      )

      if (result.matchedCount === 0) {
        return { success: false, error: 'Webhook endpoint not found' }
      }

      const updatedEndpoint = await webhookEndpointsCollection.findOne({ _id: endpointId })
      
      console.log(`[Webhook Service] Updated webhook endpoint: ${endpointId}`)
      return { success: true, endpoint: updatedEndpoint as WebhookEndpoint }

    } catch (error) {
      console.error('Error updating webhook:', error)
      return { 
        success: false, 
        error: `Failed to update webhook: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Delete webhook endpoint
   */
  static async deleteWebhook(endpointId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const webhookEndpointsCollection = db.collection('webhook_endpoints')

      const result = await webhookEndpointsCollection.deleteOne({ _id: endpointId })

      if (result.deletedCount === 0) {
        return { success: false, error: 'Webhook endpoint not found' }
      }

      console.log(`[Webhook Service] Deleted webhook endpoint: ${endpointId}`)
      return { success: true }

    } catch (error) {
      console.error('Error deleting webhook:', error)
      return { 
        success: false, 
        error: `Failed to delete webhook: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Get webhook endpoints
   */
  static async getWebhookEndpoints(walletAddress?: string): Promise<WebhookEndpoint[]> {
    const db = await getDatabase()
    const webhookEndpointsCollection = db.collection('webhook_endpoints')

    const query = walletAddress ? { walletAddress } : {}
    const endpoints = await webhookEndpointsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    return endpoints.map(endpoint => ({
      ...endpoint,
      _id: endpoint._id.toString()
    })) as WebhookEndpoint[]
  }

  /**
   * Create webhook event
   */
  static async createWebhookEvent(
    eventType: WebhookEvent['eventType'],
    data: any,
    walletAddress?: string
  ): Promise<WebhookEvent> {
    const db = await getDatabase()
    const webhookEventsCollection = db.collection('webhook_events')

    const webhookEvent: WebhookEvent = {
      eventId: crypto.randomUUID(),
      eventType,
      data: {
        ...data,
        walletAddress: walletAddress || data.walletAddress,
        timestamp: new Date().toISOString()
      },
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await webhookEventsCollection.insertOne(webhookEvent)
    const createdEvent = { ...webhookEvent, _id: result.insertedId }

    // Trigger delivery processing in background
    setTimeout(() => {
      this.processWebhookDeliveries([createdEvent])
    }, 0)

    return createdEvent
  }

  /**
   * Process webhook deliveries
   */
  static async processWebhookDeliveries(events?: WebhookEvent[]): Promise<{
    processed: number
    delivered: number
    failed: number
    retrying: number
  }> {
    const db = await getDatabase()
    const webhookEventsCollection = db.collection('webhook_events')
    const webhookEndpointsCollection = db.collection('webhook_endpoints')

    let processed = 0
    let delivered = 0
    let failed = 0
    let retrying = 0

    try {
      // Get pending events if not provided
      if (!events) {
        events = await webhookEventsCollection
          .find({ 
            deliveryStatus: { $in: ['pending', 'retrying'] },
            deliveryAttempts: { $lt: this.DEFAULT_RETRY_ATTEMPTS }
          })
          .limit(50)
          .toArray() as WebhookEvent[]
      }

      // Get active webhook endpoints
      const endpoints = await webhookEndpointsCollection
        .find({ active: true })
        .toArray() as WebhookEndpoint[]

      if (endpoints.length === 0) {
        console.log('[Webhook Service] No active webhook endpoints found')
        return { processed, delivered, failed, retrying }
      }

      for (const event of events) {
        processed++
        
        // Find matching endpoints for this event
        const matchingEndpoints = endpoints.filter(endpoint => {
          // Check if endpoint subscribes to this event type
          if (!endpoint.events.includes(event.eventType)) {
            return false
          }
          
          // If endpoint is user-specific, check wallet address
          if (endpoint.walletAddress && endpoint.walletAddress !== event.data.walletAddress) {
            return false
          }
          
          return true
        })

        if (matchingEndpoints.length === 0) {
          // No matching endpoints, mark as delivered
          await webhookEventsCollection.updateOne(
            { _id: event._id },
            {
              $set: {
                deliveryStatus: 'delivered',
                deliveredAt: new Date(),
                updatedAt: new Date()
              }
            }
          )
          delivered++
          continue
        }

        // Attempt delivery to each matching endpoint
        let eventDelivered = false
        
        for (const endpoint of matchingEndpoints) {
          const deliveryResult = await this.deliverWebhook(event, endpoint)
          
          if (deliveryResult.success) {
            eventDelivered = true
            
            // Update endpoint success count
            await webhookEndpointsCollection.updateOne(
              { _id: endpoint._id },
              {
                $inc: { successCount: 1 },
                $set: { 
                  lastDeliveryAt: new Date(),
                  updatedAt: new Date()
                }
              }
            )
          } else {
            // Update endpoint failure count
            await webhookEndpointsCollection.updateOne(
              { _id: endpoint._id },
              {
                $inc: { failureCount: 1 },
                $set: { updatedAt: new Date() }
              }
            )
          }
        }

        // Update event status
        const newAttempts = event.deliveryAttempts + 1
        const maxAttempts = this.DEFAULT_RETRY_ATTEMPTS

        if (eventDelivered) {
          await webhookEventsCollection.updateOne(
            { _id: event._id },
            {
              $set: {
                deliveryStatus: 'delivered',
                deliveryAttempts: newAttempts,
                deliveredAt: new Date(),
                updatedAt: new Date()
              }
            }
          )
          delivered++
        } else if (newAttempts >= maxAttempts) {
          await webhookEventsCollection.updateOne(
            { _id: event._id },
            {
              $set: {
                deliveryStatus: 'failed',
                deliveryAttempts: newAttempts,
                lastDeliveryAttempt: new Date(),
                updatedAt: new Date()
              }
            }
          )
          failed++
        } else {
          await webhookEventsCollection.updateOne(
            { _id: event._id },
            {
              $set: {
                deliveryStatus: 'retrying',
                deliveryAttempts: newAttempts,
                lastDeliveryAttempt: new Date(),
                updatedAt: new Date()
              }
            }
          )
          retrying++
        }

        // Small delay between events
        await this.delay(100)
      }

      console.log(`[Webhook Service] Delivery batch complete: ${processed} processed, ${delivered} delivered, ${failed} failed, ${retrying} retrying`)
      
      return { processed, delivered, failed, retrying }

    } catch (error) {
      console.error('Error processing webhook deliveries:', error)
      return { processed, delivered, failed, retrying }
    }
  }

  /**
   * Deliver webhook to specific endpoint
   */
  private static async deliverWebhook(
    event: WebhookEvent,
    endpoint: WebhookEndpoint
  ): Promise<{
    success: boolean
    responseCode?: number
    responseBody?: string
    error?: string
  }> {
    try {
      // Create payload
      const payload = {
        id: event.eventId,
        event: event.eventType,
        created: event.createdAt.toISOString(),
        data: event.data
      }

      // Create signature for verification
      const signature = this.createWebhookSignature(JSON.stringify(payload), endpoint.secret)

      // Make HTTP request
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT_MS)

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LYN-Webhook/1.0',
            'X-LYN-Signature': signature,
            'X-LYN-Event': event.eventType,
            'X-LYN-Delivery': event.eventId
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        })

        clearTimeout(timeout)

        const responseBody = await response.text()

        if (response.ok) {
          return {
            success: true,
            responseCode: response.status,
            responseBody: responseBody.slice(0, 1000) // Limit response body size
          }
        } else {
          return {
            success: false,
            responseCode: response.status,
            responseBody: responseBody.slice(0, 1000),
            error: `HTTP ${response.status}: ${response.statusText}`
          }
        }

      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }

    } catch (error) {
      let errorMessage = 'Unknown error'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout'
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Network error'
        } else {
          errorMessage = error.message
        }
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Create webhook signature for verification
   */
  private static createWebhookSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload, 'utf8')
    return `sha256=${hmac.digest('hex')}`
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = this.createWebhookSignature(payload, secret)
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    } catch (error) {
      console.error('Error verifying webhook signature:', error)
      return false
    }
  }

  /**
   * Get webhook statistics
   */
  static async getWebhookStatistics(): Promise<{
    totalEndpoints: number
    activeEndpoints: number
    totalEvents: number
    deliveredEvents: number
    failedEvents: number
    retryingEvents: number
    averageDeliveryTime: number
    topEventTypes: Array<{ eventType: string; count: number }>
    endpointHealth: Array<{ 
      endpointId: string
      name: string
      url: string
      successRate: number
      lastDelivery?: Date
    }>
  }> {
    const db = await getDatabase()
    const webhookEndpointsCollection = db.collection('webhook_endpoints')
    const webhookEventsCollection = db.collection('webhook_events')

    // Get endpoint statistics
    const [totalEndpoints, activeEndpoints] = await Promise.all([
      webhookEndpointsCollection.countDocuments({}),
      webhookEndpointsCollection.countDocuments({ active: true })
    ])

    // Get event statistics
    const [totalEvents, deliveredEvents, failedEvents, retryingEvents] = await Promise.all([
      webhookEventsCollection.countDocuments({}),
      webhookEventsCollection.countDocuments({ deliveryStatus: 'delivered' }),
      webhookEventsCollection.countDocuments({ deliveryStatus: 'failed' }),
      webhookEventsCollection.countDocuments({ deliveryStatus: 'retrying' })
    ])

    // Get top event types
    const topEventTypes = await webhookEventsCollection.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray()

    const eventTypeStats = topEventTypes.map(item => ({
      eventType: item._id,
      count: item.count
    }))

    // Get endpoint health
    const endpoints = await webhookEndpointsCollection.find({}).toArray()
    const endpointHealth = endpoints.map(endpoint => {
      const totalDeliveries = endpoint.successCount + endpoint.failureCount
      const successRate = totalDeliveries > 0 ? (endpoint.successCount / totalDeliveries) * 100 : 100
      
      return {
        endpointId: endpoint._id.toString(),
        name: endpoint.name,
        url: endpoint.url,
        successRate: Math.round(successRate * 100) / 100,
        lastDelivery: endpoint.lastDeliveryAt
      }
    })

    // Calculate average delivery time (simplified - would need more detailed tracking)
    const averageDeliveryTime = 0 // Would need to track delivery timestamps

    return {
      totalEndpoints,
      activeEndpoints,
      totalEvents,
      deliveredEvents,
      failedEvents,
      retryingEvents,
      averageDeliveryTime,
      topEventTypes: eventTypeStats,
      endpointHealth
    }
  }

  /**
   * Clean up old webhook events
   */
  static async cleanupOldEvents(daysToKeep: number = 30): Promise<number> {
    const db = await getDatabase()
    const webhookEventsCollection = db.collection('webhook_events')

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await webhookEventsCollection.deleteMany({
      createdAt: { $lt: cutoffDate },
      deliveryStatus: { $in: ['delivered', 'failed'] }
    })

    console.log(`[Webhook Service] Cleaned up ${result.deletedCount} old webhook events`)
    return result.deletedCount
  }

  /**
   * Test webhook endpoint
   */
  static async testWebhookEndpoint(endpointId: string): Promise<{
    success: boolean
    responseCode?: number
    responseTime?: number
    error?: string
  }> {
    try {
      const db = await getDatabase()
      const webhookEndpointsCollection = db.collection('webhook_endpoints')

      const endpoint = await webhookEndpointsCollection.findOne({ _id: endpointId })
      if (!endpoint) {
        return { success: false, error: 'Webhook endpoint not found' }
      }

      // Create test event
      const testEvent: WebhookEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'subscription.created', // Use a common event type for testing
        data: {
          test: true,
          message: 'This is a test webhook delivery',
          timestamp: new Date().toISOString()
        },
        deliveryStatus: 'pending',
        deliveryAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const startTime = Date.now()
      const result = await this.deliverWebhook(testEvent, endpoint as WebhookEndpoint)
      const responseTime = Date.now() - startTime

      return {
        success: result.success,
        responseCode: result.responseCode,
        responseTime,
        error: result.error
      }

    } catch (error) {
      console.error('Error testing webhook endpoint:', error)
      return {
        success: false,
        error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Utility method for delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}