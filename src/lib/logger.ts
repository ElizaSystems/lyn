/**
 * Centralized logging system
 */

import winston from 'winston'
import { config } from './config'

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors)

// Create the logger
const logger = winston.createLogger({
  level: config.app.logLevel,
  levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
})

// Add file transports for production
if (config.app.environment === 'production') {
  // Error log file
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  )

  // Combined log file
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  )

  // Remove console transport in production
  logger.remove(logger.transports[0])
}

// Create different log functions
export const log = {
  error: (message: string, meta?: Record<string, unknown>) => {
    logger.error(message, meta)
  },

  warn: (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta)
  },

  info: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta)
  },

  http: (message: string, meta?: Record<string, unknown>) => {
    logger.http(message, meta)
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta)
  },

  // Security-specific logging
  security: {
    authFailure: (details: {
      walletAddress?: string
      ip: string
      userAgent: string
      reason: string
    }) => {
      logger.warn('Authentication failure', {
        type: 'security',
        event: 'auth_failure',
        ...details,
      })
    },

    rateLimitExceeded: (details: {
      key: string
      action: string
      count: number
      ip: string
    }) => {
      logger.warn('Rate limit exceeded', {
        type: 'security',
        event: 'rate_limit_exceeded',
        ...details,
      })
    },

    suspiciousActivity: (details: {
      userId?: string
      ip: string
      userAgent: string
      activity: string
      details?: Record<string, unknown>
    }) => {
      logger.warn('Suspicious activity detected', {
        type: 'security',
        event: 'suspicious_activity',
        ...details,
      })
    },

    threatDetected: (details: {
      type: 'phishing' | 'malware' | 'suspicious'
      target: string
      riskLevel: string
      userId?: string
    }) => {
      logger.info('Threat detected', {
        type: 'security',
        event: 'threat_detected',
        threatType: details.type,
        target: details.target,
        riskLevel: details.riskLevel,
        userId: details.userId,
      })
    },
  },

  // Performance logging
  performance: {
    apiCall: (details: {
      method: string
      path: string
      duration: number
      statusCode: number
      userId?: string
      ip: string
    }) => {
      logger.http('API call', {
        type: 'performance',
        event: 'api_call',
        ...details,
      })
    },

    slowQuery: (details: {
      query: string
      duration: number
      model?: string
    }) => {
      logger.warn('Slow database query', {
        type: 'performance',
        event: 'slow_query',
        ...details,
      })
    },
  },

  // Business logic logging
  business: {
    userSignup: (details: {
      userId: string
      walletAddress: string
      hasTokenAccess: boolean
    }) => {
      logger.info('User signup', {
        type: 'business',
        event: 'user_signup',
        ...details,
      })
    },

    tokenCheck: (details: {
      userId?: string
      walletAddress: string
      tokenBalance: number
      hasAccess: boolean
    }) => {
      logger.info('Token access check', {
        type: 'business',
        event: 'token_check',
        ...details,
      })
    },

    taskCreated: (details: {
      userId: string
      taskType: string
      taskName: string
    }) => {
      logger.info('Task created', {
        type: 'business',
        event: 'task_created',
        ...details,
      })
    },

    scanCompleted: (details: {
      userId?: string
      scanType: string
      target: string
      safe: boolean
      riskLevel?: string
      duration: number
    }) => {
      logger.info('Security scan completed', {
        type: 'business',
        event: 'scan_completed',
        ...details,
      })
    },
  },
}

// Export the winston logger for advanced usage
export { logger }

export default log