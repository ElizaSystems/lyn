/**
 * Centralized configuration management
 * All environment variables should be accessed through this module
 */

import { z } from 'zod'

// Define the configuration schema
const configSchema = z.object({
  // Database
  database: z.object({
    url: z.string().default('mongodb://localhost:27017'),
    name: z.string().default('lyn_ai'),
    redis: z.string().optional(),
  }),

  // Solana
  solana: z.object({
    rpcEndpoint: z.string().default('https://api.mainnet-beta.solana.com'),
    privateRpcEndpoint: z.string().optional(),
    network: z.enum(['mainnet-beta', 'testnet', 'devnet', 'localnet']).default('mainnet-beta'),
  }),

  // Token
  token: z.object({
    mintAddress: z.string().default('3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump'),
    symbol: z.string().default('LYN'),
    decimals: z.number().default(6),
    agentWallet: z.string().default('75G6PEiVjgVPS13LNkRU7nzVqUvdRGLhGotZNQVUz3mq'),
  }),

  // API Keys
  apiKeys: z.object({
    openai: z.string().optional(),
    anthropic: z.string().optional(),
    virustotal: z.string().optional(),
    phishtank: z.string().optional(),
    sentry: z.string().optional(),
    datadog: z.string().optional(),
  }),

  // Security
  security: z.object({
    jwtSecret: z.string().min(32),
    sessionSecret: z.string().min(32),
    rateLimitPerMinute: z.number().default(60),
    rateLimitPerHour: z.number().default(1000),
    cloudflare: z.object({
      turnstileSiteKey: z.string().optional(),
      turnstileSecretKey: z.string().optional(),
    }),
  }),

  // Features
  features: z.object({
    walletAuth: z.boolean().default(true),
    tokenGate: z.boolean().default(true),
    analytics: z.boolean().default(true),
    terminal: z.boolean().default(true),
  }),

  // App
  app: z.object({
    url: z.string().default('http://localhost:3000'),
    apiUrl: z.string().default('http://localhost:3000/api'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    adminWallets: z.string().default(''),
  }),

  // Email
  email: z.object({
    smtp: z.object({
      host: z.string().optional(),
      port: z.number().optional(),
      user: z.string().optional(),
      pass: z.string().optional(),
    }),
    from: z.string().default('security@lyn-ai.com'),
  }),
})

type Config = z.infer<typeof configSchema>

// Load configuration from environment variables
function loadConfig(): Config {
  const config = {
    database: {
      url: process.env.MONGODB_URI,
      name: process.env.MONGODB_DB_NAME,
      redis: process.env.REDIS_URL,
    },
    solana: {
      rpcEndpoint: process.env.NEXT_PUBLIC_SOLANA_RPC,
      privateRpcEndpoint: process.env.SOLANA_PRIVATE_RPC,
      network: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
    },
    token: {
      mintAddress: process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS,
      symbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL,
      decimals: process.env.NEXT_PUBLIC_TOKEN_DECIMALS ? parseInt(process.env.NEXT_PUBLIC_TOKEN_DECIMALS) : undefined,
      agentWallet: process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS,
    },
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      virustotal: process.env.VIRUSTOTAL_API_KEY,
      phishtank: process.env.PHISHTANK_API_KEY,
      sentry: process.env.SENTRY_DSN,
      datadog: process.env.DATADOG_API_KEY,
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      sessionSecret: process.env.SESSION_SECRET || 'development-session-secret-change-in-production',
      rateLimitPerMinute: process.env.API_RATE_LIMIT_PER_MINUTE ? parseInt(process.env.API_RATE_LIMIT_PER_MINUTE) : undefined,
      rateLimitPerHour: process.env.API_RATE_LIMIT_PER_HOUR ? parseInt(process.env.API_RATE_LIMIT_PER_HOUR) : undefined,
      cloudflare: {
        turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY,
        turnstileSecretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
      },
    },
    features: {
      walletAuth: process.env.ENABLE_WALLET_AUTH === 'true',
      tokenGate: process.env.ENABLE_TOKEN_GATE === 'true',
      analytics: process.env.ENABLE_ANALYTICS === 'true',
      terminal: process.env.ENABLE_TERMINAL === 'true',
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
      logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
      adminWallets: process.env.ADMIN_WALLETS,
    },
    email: {
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      from: process.env.EMAIL_FROM,
    },
  }

  // Validate and return config
  try {
    return configSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:', error.issues)
      // In production, we should fail fast
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Invalid configuration. Please check environment variables.')
      }
    }
    // Return config with defaults in development
    return configSchema.parse({})
  }
}

// Export singleton config instance
export const config = loadConfig()

// Export typed config for better IDE support
export type { Config }

// Helper functions for common config access patterns
export const isDevelopment = () => config.app.environment === 'development'
export const isProduction = () => config.app.environment === 'production'
export const isStaging = () => config.app.environment === 'staging'

// Admin wallet helpers
export const getAdminWallets = (): string[] => {
  if (!config.app.adminWallets) return []
  return config.app.adminWallets.split(',').map(w => w.trim()).filter(w => w.length > 0)
}

export const isAdminWallet = (walletAddress: string): boolean => {
  const adminWallets = getAdminWallets()
  return adminWallets.includes(walletAddress)
}

// Validate critical production configs
export function validateProductionConfig() {
  const errors: string[] = []

  if (isProduction()) {
    // Check critical security configs
    if (config.security.jwtSecret === 'development-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production')
    }
    if (config.security.sessionSecret === 'development-session-secret-change-in-production') {
      errors.push('SESSION_SECRET must be set in production')
    }
    
    // Check database
    if (!config.database.url || config.database.url.includes('localhost')) {
      errors.push('MONGODB_URI must point to production database')
    }
    
    // Check API keys
    if (!config.apiKeys.openai && !config.apiKeys.anthropic) {
      errors.push('At least one AI API key must be configured')
    }
    
    // Check monitoring
    if (!config.apiKeys.sentry) {
      console.warn('Warning: Sentry is not configured for production')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Production configuration errors:\n${errors.join('\n')}`)
  }
}

// Export for use in other modules
export default config