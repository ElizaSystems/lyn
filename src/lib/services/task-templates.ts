import { TaskExecutor, TaskTemplate, TaskType } from './task-executor'

/**
 * Built-in task templates for common security scenarios
 */
export class TaskTemplateLibrary {
  
  /**
   * Initialize default task templates in the database
   */
  static async initializeDefaultTemplates(): Promise<void> {
    console.log('Initializing default task templates...')
    
    const templates = await this.getDefaultTemplates()
    
    for (const template of templates) {
      try {
        // Check if template already exists
        const existing = await TaskExecutor.getTaskTemplates({
          type: template.type,
          category: template.category
        })
        
        if (existing.length === 0) {
          await TaskExecutor.createTaskTemplate(template)
          console.log(`Created template: ${template.name}`)
        } else {
          console.log(`Template already exists: ${template.name}`)
        }
      } catch (error) {
        console.error(`Failed to create template ${template.name}:`, error)
      }
    }
    
    console.log('Default task templates initialization completed')
  }

  /**
   * Get all default templates
   */
  static getDefaultTemplates(): Omit<TaskTemplate, '_id' | 'createdAt' | 'updatedAt'>[] {
    return [
      // Security Scan Templates
      {
        name: 'Basic Website Security Scan',
        description: 'Comprehensive security scan for websites and web applications',
        type: 'security-scan' as TaskType,
        defaultConfig: {
          urls: [], // To be filled by user
          scanInterval: 3600000, // 1 hour
          notifications: {
            email: '',
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['urls'],
        optionalFields: ['scanInterval', 'notifications'],
        defaultFrequency: 'Every 6 hours',
        category: 'Security',
        tags: ['security', 'website', 'vulnerability'],
        isPublic: true,
        createdBy: 'system'
      },
      
      {
        name: 'Smart Contract Security Audit',
        description: 'Automated security audit for smart contracts',
        type: 'smart-contract-audit' as TaskType,
        defaultConfig: {
          contractAddresses: [], // To be filled by user
          auditDepth: 'standard',
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['contractAddresses'],
        optionalFields: ['auditDepth', 'notifications'],
        defaultFrequency: 'Daily',
        category: 'Security',
        tags: ['security', 'smart-contract', 'audit'],
        isPublic: true,
        createdBy: 'system'
      },

      {
        name: 'Wallet Security Monitor',
        description: 'Monitor wallet addresses for suspicious activities',
        type: 'wallet-monitor' as TaskType,
        defaultConfig: {
          walletAddress: '', // To be filled by user
          alertOnTransaction: true,
          minTransactionAmount: 0.1, // SOL
          trackTokens: ['SOL'],
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['walletAddress'],
        optionalFields: ['alertOnTransaction', 'minTransactionAmount', 'trackTokens', 'notifications'],
        defaultFrequency: 'Every 5 minutes',
        category: 'Security',
        tags: ['security', 'wallet', 'monitoring'],
        isPublic: true,
        createdBy: 'system'
      },

      // Price Alert Templates
      {
        name: 'LYN Token Price Alert',
        description: 'Monitor LYN token price with customizable thresholds',
        type: 'price-alert' as TaskType,
        defaultConfig: {
          tokenSymbol: 'LYN',
          tokenMint: process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || '',
          priceThreshold: {
            above: 0.05, // Alert when price goes above $0.05
            below: 0.03, // Alert when price goes below $0.03
            percentChange: 10 // Alert on 10% change
          },
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['tokenMint', 'priceThreshold'],
        optionalFields: ['tokenSymbol', 'notifications'],
        defaultFrequency: 'Every 5 minutes',
        category: 'Price Monitoring',
        tags: ['price', 'lyn', 'token', 'alert'],
        isPublic: true,
        createdBy: 'system'
      },

      {
        name: 'Custom Token Price Alert',
        description: 'Monitor any Solana token price with customizable thresholds',
        type: 'price-alert' as TaskType,
        defaultConfig: {
          tokenSymbol: '', // To be filled by user
          tokenMint: '', // To be filled by user
          priceThreshold: {
            percentChange: 15 // Alert on 15% change
          },
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['tokenMint', 'priceThreshold'],
        optionalFields: ['tokenSymbol', 'notifications'],
        defaultFrequency: 'Every 30 minutes',
        category: 'Price Monitoring',
        tags: ['price', 'token', 'alert', 'custom'],
        isPublic: true,
        createdBy: 'system'
      },

      // Portfolio Tracking Templates
      {
        name: 'Solana Portfolio Tracker',
        description: 'Track your Solana wallet portfolio value and performance',
        type: 'portfolio-tracker' as TaskType,
        defaultConfig: {
          portfolioAddress: '', // To be filled by user
          trackingTokens: [process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS || ''], // LYN by default
          rebalanceThreshold: 20, // Alert when token changes 20%
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['portfolioAddress'],
        optionalFields: ['trackingTokens', 'rebalanceThreshold', 'notifications'],
        defaultFrequency: 'Every hour',
        category: 'Portfolio',
        tags: ['portfolio', 'tracking', 'solana', 'wallet'],
        isPublic: true,
        createdBy: 'system'
      },

      // Threat Hunting Templates
      {
        name: 'Comprehensive Threat Hunter',
        description: 'Actively hunt for new threats across multiple intelligence sources',
        type: 'threat-hunter' as TaskType,
        defaultConfig: {
          threatSources: ['virustotal', 'urlvoid', 'phishtank', 'malwaredomainlist'],
          threatTypes: ['malicious_url', 'phishing', 'malware', 'suspicious_domain'],
          confidenceThreshold: 70,
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: [],
        optionalFields: ['threatSources', 'threatTypes', 'confidenceThreshold', 'notifications'],
        defaultFrequency: 'Every 2 hours',
        category: 'Security',
        tags: ['threat', 'hunting', 'intelligence', 'security'],
        isPublic: true,
        createdBy: 'system'
      },

      // DeFi Monitoring Templates
      {
        name: 'DeFi Protocol Monitor',
        description: 'Monitor DeFi protocols for yield opportunities and risks',
        type: 'defi-monitor' as TaskType,
        defaultConfig: {
          protocols: ['raydium', 'orca', 'serum'], // Popular Solana DeFi protocols
          yieldThreshold: 20, // Alert when APY > 20%
          riskThreshold: 'medium',
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['protocols'],
        optionalFields: ['yieldThreshold', 'riskThreshold', 'notifications'],
        defaultFrequency: 'Every 30 minutes',
        category: 'DeFi',
        tags: ['defi', 'yield', 'protocol', 'monitoring'],
        isPublic: true,
        createdBy: 'system'
      },

      // NFT Tracking Templates
      {
        name: 'Solana NFT Collection Tracker',
        description: 'Track floor prices and volume for Solana NFT collections',
        type: 'nft-tracker' as TaskType,
        defaultConfig: {
          nftCollections: [], // To be filled by user
          floorPriceAlerts: true,
          volumeAlerts: true,
          changeThreshold: 15, // Alert on 15% change
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['nftCollections'],
        optionalFields: ['floorPriceAlerts', 'volumeAlerts', 'changeThreshold', 'notifications'],
        defaultFrequency: 'Every hour',
        category: 'NFT',
        tags: ['nft', 'collection', 'floor-price', 'tracking'],
        isPublic: true,
        createdBy: 'system'
      },

      // Governance Monitoring Templates
      {
        name: 'DAO Governance Monitor',
        description: 'Monitor DAO proposals and voting deadlines',
        type: 'governance-monitor' as TaskType,
        defaultConfig: {
          daoAddresses: [], // To be filled by user
          votingReminders: true,
          reminderThreshold: 24, // Hours before voting ends
          notifications: {
            channels: ['email', 'in-app']
          }
        },
        requiredFields: ['daoAddresses'],
        optionalFields: ['votingReminders', 'reminderThreshold', 'notifications'],
        defaultFrequency: 'Every 2 hours',
        category: 'Governance',
        tags: ['dao', 'governance', 'voting', 'proposals'],
        isPublic: true,
        createdBy: 'system'
      }
    ]
  }

  /**
   * Get templates by category
   */
  static async getTemplatesByCategory(category: string): Promise<TaskTemplate[]> {
    return await TaskExecutor.getTaskTemplates({ category, isPublic: true })
  }

  /**
   * Get popular templates
   */
  static async getPopularTemplates(limit: number = 10): Promise<TaskTemplate[]> {
    const templates = await TaskExecutor.getTaskTemplates({ isPublic: true })
    
    // For now, return all templates. In production, you'd track usage stats
    return templates.slice(0, limit)
  }

  /**
   * Create task from template with guided configuration
   */
  static async createTaskFromTemplateGuided(
    templateId: string,
    userId: string,
    config: {
      name?: string
      customConfig?: Record<string, unknown>
      frequency?: string
      cronExpression?: string
      priority?: 'low' | 'normal' | 'high' | 'critical'
      dependencies?: Array<{
        taskId: string
        condition: 'success' | 'failure' | 'completion' | 'custom'
        delay?: number
      }>
      retryConfig?: {
        maxRetries: number
        initialDelay: number
        maxDelay: number
        backoffMultiplier: number
        retryConditions?: ('network_error' | 'timeout' | 'rate_limit' | 'temporary_failure')[]
      }
    }
  ): Promise<{
    task: any
    missingRequiredFields: string[]
    recommendations: string[]
  }> {
    const templates = await TaskExecutor.getTaskTemplates()
    const template = templates.find(t => t._id?.toString() === templateId)
    
    if (!template) {
      throw new Error('Template not found')
    }

    // Validate required fields
    const missingRequiredFields: string[] = []
    const customConfig = config.customConfig || {}

    for (const field of template.requiredFields) {
      if (!customConfig[field] && !template.defaultConfig[field]) {
        missingRequiredFields.push(field)
      }
    }

    // Generate recommendations
    const recommendations: string[] = []
    
    if (template.type === 'price-alert' && !config.frequency) {
      recommendations.push('Consider using "Every 5 minutes" frequency for price alerts to catch rapid price movements')
    }
    
    if (template.type === 'security-scan' && !config.retryConfig) {
      recommendations.push('Consider adding retry configuration for security scans to handle network issues')
    }
    
    if (template.type === 'wallet-monitor' && !customConfig.alertOnTransaction) {
      recommendations.push('Enable transaction alerts to monitor wallet activity in real-time')
    }

    if (missingRequiredFields.length === 0) {
      // Create the task
      const taskConfig = {
        ...template.defaultConfig,
        ...customConfig
      }

      const tasksCollection = await TaskExecutor['getTasksCollection']()
      const now = new Date()

      const task = {
        userId,
        name: config.name || template.name,
        description: template.description,
        status: 'active' as any,
        type: template.type,
        frequency: config.frequency || template.defaultFrequency,
        cronExpression: config.cronExpression,
        priority: config.priority || 'normal',
        dependencies: config.dependencies,
        retryConfig: config.retryConfig,
        templateId: template._id!.toString(),
        successRate: 100,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        config: taskConfig,
        createdAt: now,
        updatedAt: now
      }

      const result = await tasksCollection.insertOne(task)
      const createdTask = { ...task, _id: result.insertedId }

      return {
        task: createdTask,
        missingRequiredFields: [],
        recommendations
      }
    }

    return {
      task: null,
      missingRequiredFields,
      recommendations
    }
  }

  /**
   * Get template configuration schema for UI generation
   */
  static getTemplateConfigSchema(template: TaskTemplate): {
    required: Array<{
      field: string
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      description: string
      placeholder?: string
      validation?: any
    }>
    optional: Array<{
      field: string
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      description: string
      placeholder?: string
      defaultValue?: any
    }>
  } {
    const required: any[] = []
    const optional: any[] = []

    // Define field schemas based on template type and field names
    const fieldSchemas: Record<string, any> = {
      urls: {
        type: 'array',
        description: 'List of URLs to scan for security vulnerabilities',
        placeholder: 'https://example.com'
      },
      walletAddress: {
        type: 'string',
        description: 'Solana wallet address to monitor',
        placeholder: 'EPCzpDDs4dNJvBEmJ1pvBN4tfCVNxZqJ7sTcHcepHdKT',
        validation: { minLength: 32, maxLength: 44 }
      },
      contractAddresses: {
        type: 'array',
        description: 'Smart contract addresses to audit',
        placeholder: 'Contract address'
      },
      tokenMint: {
        type: 'string',
        description: 'Token mint address',
        placeholder: 'Token mint address'
      },
      priceThreshold: {
        type: 'object',
        description: 'Price alert thresholds',
        placeholder: '{ "above": 0.05, "below": 0.03, "percentChange": 10 }'
      },
      portfolioAddress: {
        type: 'string',
        description: 'Portfolio wallet address to track',
        placeholder: 'Wallet address'
      },
      nftCollections: {
        type: 'array',
        description: 'NFT collection addresses to track',
        placeholder: 'Collection address'
      },
      daoAddresses: {
        type: 'array',
        description: 'DAO addresses to monitor for governance',
        placeholder: 'DAO address'
      },
      protocols: {
        type: 'array',
        description: 'DeFi protocol names to monitor',
        placeholder: 'Protocol name'
      }
    }

    // Build required fields
    for (const field of template.requiredFields) {
      if (fieldSchemas[field]) {
        required.push({
          field,
          ...fieldSchemas[field]
        })
      }
    }

    // Build optional fields
    for (const field of template.optionalFields) {
      if (fieldSchemas[field]) {
        optional.push({
          field,
          ...fieldSchemas[field],
          defaultValue: template.defaultConfig[field]
        })
      }
    }

    return { required, optional }
  }
}