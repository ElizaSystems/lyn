import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { ThreatWebSocketService } from './src/lib/services/threat-websocket-service'
import { ThreatAgingService } from './src/lib/services/threat-aging-service'
import { ExternalThreatSourceService } from './src/lib/services/external-threat-sources'
import { ThreatPatternService } from './src/lib/services/threat-pattern-service'
import { logger } from './src/lib/logger'

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

async function startServer() {
  try {
    await app.prepare()

    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        logger.error('Error occurred handling request:', err)
        res.statusCode = 500
        res.end('internal server error')
      }
    })

    // Initialize WebSocket service
    const wsService = ThreatWebSocketService.getInstance()
    wsService.initialize(server)

    // Initialize background services
    await initializeBackgroundServices()

    server.listen(port, () => {
      logger.info(`> Server listening at http://localhost:${port} as ${dev ? 'development' : process.env.NODE_ENV}`)
      logger.info(`> WebSocket server ready for threat streaming`)
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server')
      server.close(() => {
        logger.info('HTTP server closed')
        
        // Shutdown services
        wsService.shutdown()
        ThreatAgingService.stop()
        ExternalThreatSourceService.shutdown()
        
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server')
      server.close(() => {
        logger.info('HTTP server closed')
        
        // Shutdown services
        wsService.shutdown()
        ThreatAgingService.stop()
        ExternalThreatSourceService.shutdown()
        
        process.exit(0)
      })
    })

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

async function initializeBackgroundServices() {
  try {
    logger.info('Initializing background services...')

    // Initialize threat patterns
    await ThreatPatternService.initializeDefaultPatterns()

    // Start external threat source monitoring
    ExternalThreatSourceService.initialize()

    // Start threat aging service (runs every 6 hours)
    ThreatAgingService.start(6)

    logger.info('Background services initialized successfully')

  } catch (error) {
    logger.error('Failed to initialize background services:', error)
    // Don't exit here, let the server continue without background services
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the server
startServer()