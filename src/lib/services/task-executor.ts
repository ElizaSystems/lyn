import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { ScanService } from './scan-service'
import { ThreatIntelligenceService } from './threat-intelligence'
import { getWalletBalance, getTokenBalance, getRecentTransactions } from '@/lib/solana'
import { fetchTokenPrice, fetchMarketData } from './price-service'
import * as cron from 'node-cron'

export type TaskStatus = 'active' | 'paused' | 'completed' | 'failed' | 'scheduled' | 'running' | 'retrying'
export type TaskType = 'security-scan' | 'wallet-monitor' | 'price-alert' | 'auto-trade' | 'threat-hunter' | 'portfolio-tracker' | 'smart-contract-audit' | 'defi-monitor' | 'nft-tracker' | 'governance-monitor'
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

export interface TaskDependency {
  taskId: string
  condition: 'success' | 'failure' | 'completion' | 'custom'
  customCondition?: string
  delay?: number // milliseconds to wait after dependency completion
}

export interface TaskRetryConfig {
  maxRetries: number
  initialDelay: number // milliseconds
  maxDelay: number // milliseconds
  backoffMultiplier: number
  retryConditions?: ('network_error' | 'timeout' | 'rate_limit' | 'temporary_failure')[]
}

export interface TaskTemplate {
  _id?: ObjectId
  name: string
  description: string
  type: TaskType
  defaultConfig: Record<string, unknown>
  requiredFields: string[]
  optionalFields: string[]
  defaultFrequency: string
  category: string
  tags: string[]
  isPublic: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface Task {
  _id?: ObjectId
  userId: string
  name: string
  description: string
  status: TaskStatus
  type: TaskType
  frequency: string
  cronExpression?: string // For advanced scheduling
  priority: TaskPriority
  dependencies?: TaskDependency[]
  retryConfig?: TaskRetryConfig
  templateId?: string
  lastRun?: Date
  nextRun?: Date | null
  successRate: number
  executionCount?: number
  successCount?: number
  failureCount?: number
  retryCount?: number
  totalExecutionTime?: number // Sum of all execution times in milliseconds
  averageExecutionTime?: number
  lastResult?: {
    success: boolean
    message: string
    data?: Record<string, unknown>
    error?: string
    executionTime?: number
    cached?: boolean
  }
  config?: {
    // Security scan config
    urls?: string[]
    wallets?: string[]
    contracts?: string[]
    scanInterval?: number
    
    // Price alert config
    tokenMint?: string
    tokenSymbol?: string
    priceThreshold?: {
      above?: number
      below?: number
      percentChange?: number
    }
    
    // Wallet monitor config
    walletAddress?: string
    trackTokens?: string[]
    alertOnTransaction?: boolean
    minTransactionAmount?: number
    
    // Auto-trade config (simulated, not real trading)
    strategy?: 'dca' | 'grid' | 'arbitrage'
    amount?: number
    interval?: string
    
    // Notification config
    notifications?: {
      email?: string
      discord?: string
      telegram?: string
    }
    
    [key: string]: unknown
  }
  createdAt: Date
  updatedAt: Date
}

export interface TaskExecution {
  _id?: ObjectId
  taskId: ObjectId
  userId: string
  startTime: Date
  endTime?: Date
  success: boolean
  result?: Record<string, unknown>
  error?: string
  duration?: number
  retryCount?: number
  isCached?: boolean
  executionContext?: {
    triggeredBy?: 'cron' | 'manual' | 'dependency' | 'api'
    parentExecutionId?: ObjectId
    batchId?: string
  }
  performance?: {
    cpuUsage?: number
    memoryUsage?: number
    networkCalls?: number
  }
  metadata?: Record<string, unknown>
}

export interface TaskCache {
  _id?: ObjectId
  taskId: ObjectId
  userId: string
  cacheKey: string
  result: Record<string, unknown>
  createdAt: Date
  expiresAt: Date
  hitCount: number
  lastAccessed: Date
}

export interface TaskBatch {
  _id?: ObjectId
  batchId: string
  userId: string
  taskIds: ObjectId[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  startTime: Date
  endTime?: Date
  totalTasks: number
  successfulTasks: number
  failedTasks: number
  parallelExecutions: number
  createdAt: Date
}

export interface TaskAnalytics {
  _id?: ObjectId
  userId: string
  taskId: ObjectId
  date: Date // Day bucket for analytics
  executions: number
  successes: number
  failures: number
  totalExecutionTime: number
  averageExecutionTime: number
  cacheHits: number
  cacheMisses: number
  retries: number
  uniqueErrors: string[]
  performanceMetrics?: {
    avgCpuUsage: number
    avgMemoryUsage: number
    avgNetworkCalls: number
  }
}

export class TaskExecutor {
  private static runningTasks = new Map<string, Promise<TaskExecution>>()
  private static resultCache = new Map<string, { result: any, timestamp: number, ttl: number }>()
  private static cronJobs = new Map<string, any>()
  
  private static async getTasksCollection() {
    const db = await getDatabase()
    return db.collection<Task>('tasks')
  }

  private static async getExecutionsCollection() {
    const db = await getDatabase()
    return db.collection<TaskExecution>('task_executions')
  }

  private static async getTemplatesCollection() {
    const db = await getDatabase()
    return db.collection<TaskTemplate>('task_templates')
  }

  private static async getCacheCollection() {
    const db = await getDatabase()
    return db.collection<TaskCache>('task_cache')
  }

  private static async getBatchCollection() {
    const db = await getDatabase()
    return db.collection<TaskBatch>('task_batches')
  }

  private static async getAnalyticsCollection() {
    const db = await getDatabase()
    return db.collection<TaskAnalytics>('task_analytics')
  }

  /**
   * Execute a single task
   */
  static async executeTask(taskId: string): Promise<TaskExecution> {
    const tasksCollection = await this.getTasksCollection()
    const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) })
    
    if (!task) {
      throw new Error('Task not found')
    }

    if (task.status !== 'active') {
      throw new Error('Task is not active')
    }

    const execution: TaskExecution = {
      taskId: task._id!,
      userId: task.userId,
      startTime: new Date(),
      success: false
    }

    try {
      // Execute based on task type
      let result: Record<string, unknown>
      
      switch (task.type) {
        case 'security-scan':
          result = await this.executeSecurityScan(task)
          break
        case 'wallet-monitor':
          result = await this.executeWalletMonitor(task)
          break
        case 'price-alert':
          result = await this.executePriceAlert(task)
          break
        case 'auto-trade':
          result = await this.executeAutoTrade(task)
          break
        case 'threat-hunter':
          result = await this.executeThreatHunter(task)
          break
        case 'portfolio-tracker':
          result = await this.executePortfolioTracker(task)
          break
        case 'smart-contract-audit':
          result = await this.executeSmartContractAudit(task)
          break
        case 'defi-monitor':
          result = await this.executeDefiMonitor(task)
          break
        case 'nft-tracker':
          result = await this.executeNftTracker(task)
          break
        case 'governance-monitor':
          result = await this.executeGovernanceMonitor(task)
          break
        default:
          throw new Error(`Unknown task type: ${task.type}`)
      }

      execution.success = true
      execution.result = result
      execution.endTime = new Date()
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime()

      // Update task with execution results
      await this.updateTaskAfterExecution(task._id!.toString(), true, result)
      
      // Send notifications if configured
      if (task.config?.notifications && result.alert) {
        await this.sendNotifications(task, result)
      }

    } catch (error) {
      execution.success = false
      execution.error = error instanceof Error ? error.message : 'Unknown error'
      execution.endTime = new Date()
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime()

      // Update task with failure
      await this.updateTaskAfterExecution(task._id!.toString(), false, null, execution.error)
    }

    // Save execution record
    const executionsCollection = await this.getExecutionsCollection()
    await executionsCollection.insertOne(execution)

    return execution
  }

  /**
   * Execute security scan task
   */
  private static async executeSecurityScan(task: Task): Promise<Record<string, unknown>> {
    const results = {
      scanned: [] as Array<Record<string, unknown>>,
      threats: [] as Array<Record<string, unknown>>,
      alert: false
    }

    // Scan URLs
    if (task.config?.urls && Array.isArray(task.config.urls)) {
      for (const url of task.config.urls) {
        try {
          const threatResults = await ThreatIntelligenceService.checkURL(url)
          const aggregated = ThreatIntelligenceService.aggregateResults(threatResults)
          
          const scan = await ScanService.createScan(
            task.userId,
            'url',
            url,
            { automated: true, taskId: task._id?.toString() }
          )

          await ScanService.updateScanResult(
            scan._id!.toString(),
            {
              isSafe: aggregated.overallSafe,
              threats: aggregated.totalThreats,
              confidence: aggregated.overallScore,
              details: `Automated scan completed`,
              recommendations: aggregated.overallSafe ? [] : ['Review threat details']
            },
            aggregated.overallSafe ? 'safe' : 'high'
          )

          results.scanned.push({ type: 'url', target: url, safe: aggregated.overallSafe })
          
          if (!aggregated.overallSafe) {
            results.threats.push({ type: 'url', target: url, threats: aggregated.totalThreats })
            results.alert = true
          }
        } catch (error) {
          console.error(`Failed to scan URL ${url}:`, error)
        }
      }
    }

    // Scan wallets
    if (task.config?.wallets && Array.isArray(task.config.wallets)) {
      for (const wallet of task.config.wallets) {
        try {
          // Check wallet for suspicious activity
          const balance = await getWalletBalance(wallet)
          const transactions = await getRecentTransactions(wallet, 10)
          
          const scan = await ScanService.createScan(
            task.userId,
            'wallet',
            wallet,
            { automated: true, taskId: task._id?.toString() }
          )

          // Simple wallet analysis
          const suspicious = transactions.some((tx: Record<string, unknown>) => {
            const transaction = tx.transaction as Record<string, unknown>
            const meta = transaction?.meta as Record<string, unknown>
            const preBalance = (meta?.preBalances as number[])?.[0] || 0
            const postBalance = (meta?.postBalances as number[])?.[0] || 0
            return tx.err !== null || postBalance < preBalance * 0.5
          })

          await ScanService.updateScanResult(
            scan._id!.toString(),
            {
              isSafe: !suspicious,
              threats: suspicious ? ['Suspicious transaction activity detected'] : [],
              confidence: 85,
              details: `Balance: ${balance} SOL, Recent transactions: ${transactions.length}`,
              recommendations: suspicious ? ['Review recent transactions'] : []
            },
            suspicious ? 'medium' : 'safe'
          )

          results.scanned.push({ type: 'wallet', target: wallet, safe: !suspicious })
          
          if (suspicious) {
            results.threats.push({ type: 'wallet', target: wallet, issue: 'Suspicious activity' })
            results.alert = true
          }
        } catch (error) {
          console.error(`Failed to scan wallet ${wallet}:`, error)
        }
      }
    }

    return results
  }

  /**
   * Execute wallet monitor task
   */
  private static async executeWalletMonitor(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const walletAddress = config.walletAddress as string
    
    if (!walletAddress) {
      throw new Error('Wallet address not configured')
    }

    const result = {
      wallet: walletAddress,
      balance: 0,
      tokens: [] as Array<Record<string, unknown>>,
      recentTransactions: [] as Array<Record<string, unknown>>,
      alert: false,
      alerts: [] as string[]
    }

    try {
      // Get wallet balance
      result.balance = await getWalletBalance(walletAddress)
      
      // Get recent transactions
      const transactions = await getRecentTransactions(walletAddress, 20)
      result.recentTransactions = transactions.slice(0, 5).map((tx: Record<string, unknown>) => ({
        signature: tx.signature,
        blockTime: tx.blockTime,
        type: 'transfer'
      }))

      // Check for new transactions since last run
      if (task.lastRun) {
        const newTransactions = transactions.filter((tx: Record<string, unknown>) => {
          const txTime = new Date(((tx.blockTime as number) || 0) * 1000)
          return txTime > task.lastRun!
        })

        if (newTransactions.length > 0 && config.alertOnTransaction) {
          result.alert = true
          result.alerts.push(`${newTransactions.length} new transaction(s) detected`)
        }

        // Check for large transactions
        if (config.minTransactionAmount) {
          const largeTransactions = newTransactions.filter((tx: Record<string, unknown>) => {
            const transaction = tx.transaction as Record<string, unknown>
            const meta = transaction?.meta as Record<string, unknown>
            const preBalance = (meta?.preBalances as number[])?.[0] || 0
            const postBalance = (meta?.postBalances as number[])?.[0] || 0
            const change = Math.abs(postBalance - preBalance) / 1e9 // Convert lamports to SOL
            return change >= (config.minTransactionAmount as number)
          })

          if (largeTransactions.length > 0) {
            result.alert = true
            result.alerts.push(`${largeTransactions.length} large transaction(s) detected`)
          }
        }
      }

      // Track specific tokens if configured
      if (config.trackTokens && Array.isArray(config.trackTokens)) {
        for (const tokenMint of config.trackTokens) {
          try {
            const tokenBalance = await getTokenBalance(walletAddress, tokenMint)
            result.tokens.push({
              mint: tokenMint,
              balance: tokenBalance
            })
          } catch (error) {
            console.error(`Failed to get balance for token ${tokenMint}:`, error)
          }
        }
      }

    } catch (error) {
      throw new Error(`Wallet monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Execute price alert task
   */
  private static async executePriceAlert(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const tokenMint = config.tokenMint as string || process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS
    const tokenSymbol = config.tokenSymbol as string || 'LYN'
    
    if (!tokenMint) {
      throw new Error('Token mint address not configured')
    }

    const result = {
      token: tokenSymbol,
      currentPrice: 0,
      previousPrice: 0,
      change: 0,
      changePercent: 0,
      alert: false,
      alerts: [] as string[]
    }

    try {
      // Get current market data
      const marketData = await fetchMarketData(tokenMint)
      result.currentPrice = marketData.price
      
      // Calculate change from last execution
      if (task.lastResult?.data?.currentPrice) {
        result.previousPrice = task.lastResult.data.currentPrice as number
        result.change = result.currentPrice - result.previousPrice
        result.changePercent = (result.change / result.previousPrice) * 100
      }

      // Check price thresholds
      const threshold = config.priceThreshold as Record<string, number>
      
      if (threshold?.above && result.currentPrice > threshold.above) {
        result.alert = true
        result.alerts.push(`Price above $${threshold.above} threshold`)
      }
      
      if (threshold?.below && result.currentPrice < threshold.below) {
        result.alert = true
        result.alerts.push(`Price below $${threshold.below} threshold`)
      }
      
      if (threshold?.percentChange && Math.abs(result.changePercent) >= threshold.percentChange) {
        result.alert = true
        result.alerts.push(`Price changed by ${result.changePercent.toFixed(2)}%`)
      }

      // Add market data
      ;(result as Record<string, unknown>).marketData = {
        volume24h: marketData.volume24h,
        marketCap: marketData.marketCap,
        change24h: marketData.change24h
      }

    } catch (error) {
      throw new Error(`Price monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Execute auto-trade task (simulated only - no real trading)
   */
  private static async executeAutoTrade(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const strategy = config.strategy as string || 'dca'
    
    const result = {
      strategy,
      simulated: true,
      action: 'none' as 'buy' | 'sell' | 'none',
      alert: false,
      message: ''
    }

    try {
      const tokenMint = process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS!
      const marketData = await fetchMarketData(tokenMint)
      
      switch (strategy) {
        case 'dca':
          // Dollar Cost Averaging - simulate regular buys
          result.action = 'buy'
          result.message = `DCA Strategy: Simulated buy at $${marketData.price.toFixed(4)}`
          break
          
        case 'grid':
          // Grid trading - simulate buy/sell based on price levels
          const gridLevels = [0.040, 0.042, 0.044, 0.046]
          const currentLevel = gridLevels.findIndex(level => marketData.price < level)
          
          if (currentLevel > 0 && (task.lastResult?.data as Record<string, unknown>)?.gridLevel !== currentLevel) {
            result.action = marketData.price < gridLevels[currentLevel - 1] ? 'buy' : 'sell'
            result.message = `Grid Strategy: Simulated ${result.action} at $${marketData.price.toFixed(4)}`
            ;(result as Record<string, unknown>).gridLevel = currentLevel
          }
          break
          
        case 'arbitrage':
          // Arbitrage - simulate opportunities (mock data)
          const mockOpportunity = Math.random() > 0.8
          if (mockOpportunity) {
            result.action = 'buy'
            result.message = `Arbitrage opportunity detected (simulated)`
            result.alert = true
          }
          break
      }
      
      ;(result as Record<string, unknown>).marketData = {
        price: marketData.price,
        volume: marketData.volume24h,
        change24h: marketData.change24h
      }

    } catch (error) {
      throw new Error(`Auto-trade simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Update task after execution
   */
  private static async updateTaskAfterExecution(
    taskId: string, 
    success: boolean, 
    result: Record<string, unknown> | null, 
    error?: string
  ): Promise<void> {
    const tasksCollection = await this.getTasksCollection()
    const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) })
    
    if (!task) return

    const executionCount = (task.executionCount || 0) + 1
    const successCount = (task.successCount || 0) + (success ? 1 : 0)
    const failureCount = (task.failureCount || 0) + (success ? 0 : 1)
    const successRate = (successCount / executionCount) * 100

    // Calculate next run time based on frequency
    const nextRun = this.calculateNextRun(task.frequency)

    await tasksCollection.updateOne(
      { _id: new ObjectId(taskId) },
      {
        $set: {
          lastRun: new Date(),
          nextRun,
          executionCount,
          successCount,
          failureCount,
          successRate,
          lastResult: {
            success,
            message: success ? 'Task executed successfully' : 'Task execution failed',
            data: result || undefined,
            error
          },
          updatedAt: new Date()
        }
      }
    )
  }

  /**
   * Calculate next run time based on frequency
   */
  private static calculateNextRun(frequency: string): Date | null {
    const now = new Date()
    
    switch (frequency.toLowerCase()) {
      case 'real-time':
      case 'continuous':
        return new Date(now.getTime() + 60 * 1000) // 1 minute
      case 'every 5 minutes':
        return new Date(now.getTime() + 5 * 60 * 1000)
      case 'every 30 minutes':
        return new Date(now.getTime() + 30 * 60 * 1000)
      case 'every hour':
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000)
      case 'every 6 hours':
        return new Date(now.getTime() + 6 * 60 * 60 * 1000)
      case 'every 12 hours':
        return new Date(now.getTime() + 12 * 60 * 60 * 1000)
      case 'every 24 hours':
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      default:
        // Try to parse custom intervals like "Every X hours/minutes"
        const match = frequency.match(/every (\d+) (minute|hour|day)/i)
        if (match) {
          const amount = parseInt(match[1])
          const unit = match[2].toLowerCase()
          const multiplier = unit === 'minute' ? 60 * 1000 : 
                           unit === 'hour' ? 60 * 60 * 1000 : 
                           24 * 60 * 60 * 1000
          return new Date(now.getTime() + amount * multiplier)
        }
        return null
    }
  }

  /**
   * Send notifications for task results
   */
  private static async sendNotifications(task: Task, result: Record<string, unknown>): Promise<void> {
    try {
      // Import NotificationService dynamically to avoid circular dependencies
      const { NotificationService } = await import('./notification-service')
      
      if (!result.alert && !result.alerts && !result.message) {
        // No alert to send, but still send task completion notification
        const variables = {
          taskName: task.name,
          taskDescription: task.description,
          executionTime: new Date().toISOString(),
          successRate: task.successRate,
          result: JSON.stringify(result, null, 2),
          userId: task.userId,
          timestamp: new Date().toISOString(),
          dashboardUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/tasks` : '#'
        }

        // Send task completion notification
        await NotificationService.sendNotification(
          task.userId,
          'task-completed',
          variables,
          { 
            priority: 'low',
            channels: task.config?.notifications?.channels as any || ['in-app']
          }
        )
        return
      }

      // Determine notification type based on result
      let eventType: 'task-completed' | 'task-failed' | 'security-alert' | 'price-alert' | 'wallet-activity' = 'task-completed'
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
      
      // Analyze the result to determine event type and priority
      if (result.error || result.status === 'failed') {
        eventType = 'task-failed'
        priority = 'high'
      } else if (task.type === 'security-scan') {
        eventType = 'security-alert'
        priority = result.riskLevel === 'critical' ? 'critical' : 
                  result.riskLevel === 'high' ? 'high' : 'medium'
      } else if (task.type === 'price-alert') {
        eventType = 'price-alert'
        priority = 'medium'
      } else if (task.type === 'wallet-monitor') {
        eventType = 'wallet-activity'
        priority = 'medium'
      }

      // Prepare notification variables based on event type
      let variables: Record<string, any> = {
        taskName: task.name,
        taskDescription: task.description,
        userId: task.userId,
        timestamp: new Date().toISOString(),
        dashboardUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/tasks` : '#'
      }

      // Add event-specific variables
      switch (eventType) {
        case 'task-completed':
          variables = {
            ...variables,
            executionTime: new Date().toISOString(),
            successRate: task.successRate,
            result: result.message || JSON.stringify(result.data || result, null, 2)
          }
          break

        case 'task-failed':
          variables = {
            ...variables,
            failureTime: new Date().toISOString(),
            successRate: task.successRate,
            error: result.error || result.message || 'Task execution failed'
          }
          break

        case 'security-alert':
          const threats = Array.isArray(result.threats) ? result.threats : []
          const recommendations = Array.isArray(result.recommendations) ? result.recommendations : []
          const severity = result.riskLevel || 'medium'
          
          variables = {
            ...variables,
            alertType: task.type,
            severity,
            severityColor: severity === 'critical' ? '#dc3545' : 
                          severity === 'high' ? '#fd7e14' : 
                          severity === 'medium' ? '#ffc107' : '#28a745',
            target: result.target || task.config?.urls?.[0] || task.config?.wallets?.[0] || 'Unknown',
            detectionTime: new Date().toISOString(),
            threats,
            recommendations,
            threatsList: threats.length > 0 ? threats.map(t => `• ${t}`).join('<br>') : 'No specific threats identified',
            recommendationsList: recommendations.length > 0 ? recommendations.map(r => `• ${r}`).join('<br>') : 'Follow general security best practices',
            threatsJson: JSON.stringify(threats),
            recommendationsJson: JSON.stringify(recommendations),
            score: result.score || 0,
            securityDashboardUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/security` : '#'
          }
          break

        case 'price-alert':
          const config = task.config
          const changePercent = result.changePercent || 0
          const isPositive = changePercent > 0
          
          variables = {
            ...variables,
            tokenSymbol: config?.tokenSymbol || 'TOKEN',
            currentPrice: result.currentPrice || 0,
            previousPrice: result.previousPrice || 0,
            changePercent: Math.abs(changePercent),
            changeSign: isPositive ? '+' : '',
            changeColor: isPositive ? '#28a745' : '#dc3545',
            priceChange: result.priceChange || 0,
            volume24h: result.volume24h || 'N/A',
            marketCap: result.marketCap || 'N/A',
            alertCondition: `Price ${config?.priceThreshold?.above ? `above $${config.priceThreshold.above}` : 
                                  config?.priceThreshold?.below ? `below $${config.priceThreshold.below}` :
                                  config?.priceThreshold?.percentChange ? `changed by ${config.priceThreshold.percentChange}%` : 'threshold met'}`,
            portfolioUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/wallet` : '#'
          }
          break

        case 'wallet-activity':
          variables = {
            ...variables,
            activityType: result.activityType || 'Transaction',
            walletAddress: result.walletAddress || task.config?.walletAddress || 'Unknown',
            transactionHash: result.transactionHash || result.txHash || 'N/A',
            amount: result.amount || 0,
            tokenSymbol: result.tokenSymbol || 'SOL',
            from: result.from || 'N/A',
            to: result.to || 'N/A',
            riskLevel: result.riskLevel || 'low',
            riskDetails: result.riskDetails || '',
            walletDashboardUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/wallet` : '#'
          }
          break

        case 'system-alert':
          const affectedServices = Array.isArray(result.affectedServices) ? result.affectedServices : []
          const actions = Array.isArray(result.actions) ? result.actions : []
          
          variables = {
            ...variables,
            alertType: result.alertType || 'System Maintenance',
            severity: result.severity || 'medium',
            detectionTime: new Date().toISOString(),
            description: result.description || 'System alert triggered',
            affectedServices,
            actions,
            affectedServicesJson: JSON.stringify(affectedServices),
            actionsJson: JSON.stringify(actions),
            statusPageUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/status` : '#'
          }
          break

        case 'account-activity':
          variables = {
            ...variables,
            activityType: result.activityType || 'Account Activity',
            activityDescription: result.activityDescription || result.description || 'Account activity detected',
            ipAddress: result.ipAddress || 'Unknown',
            userAgent: result.userAgent || 'Unknown',
            location: result.location || 'Unknown',
            requiresAction: result.requiresAction || false,
            actionRequired: result.actionRequired || 'No action required',
            actionSuffix: result.requiresAction ? ' - Action required' : '',
            securityUrl: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/security` : '#'
          }
          break
      }

      // Add title and message for in-app notifications
      variables.title = variables.title || `${eventType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${task.name}`
      variables.message = variables.message || result.message || result.alerts || 
                         (Array.isArray(result.alerts) ? result.alerts.join(', ') : '') ||
                         `Task "${task.name}" generated an alert`

      // Determine which channels to send to
      const channels = task.config?.notifications?.channels || ['email', 'in-app']
      const forcedChannels = task.config?.notifications?.forced || priority === 'critical'

      // Send notification
      const results = await NotificationService.sendNotification(
        task.userId,
        eventType,
        variables,
        { 
          priority,
          channels: channels as any,
          forceNotification: forcedChannels as boolean
        }
      )

      console.log(`[NOTIFICATION] Sent ${eventType} notification for task "${task.name}":`, results)

    } catch (error) {
      console.error(`[NOTIFICATION] Failed to send notification for task "${task.name}":`, error)
      
      // Fallback to console logging if notification service fails
      console.log(`[NOTIFICATION FALLBACK] Task "${task.name}" alert:`, result.alerts || result.message || result)
    }
  }

  /**
   * Get tasks that need to be executed
   */
  static async getTasksDueForExecution(): Promise<Task[]> {
    const tasksCollection = await this.getTasksCollection()
    const now = new Date()
    
    return await tasksCollection.find({
      status: 'active',
      $or: [
        { nextRun: { $lte: now } },
        { nextRun: { $exists: false }, lastRun: { $exists: false } }, // Never run
        { 
          frequency: { $in: ['Real-time', 'Continuous'] },
          lastRun: { $lte: new Date(now.getTime() - 60 * 1000) } // Run every minute for real-time
        }
      ]
    }).toArray()
  }

  /**
   * Execute all due tasks
   */
  static async executeAllDueTasks(): Promise<{ 
    executed: number
    successful: number
    failed: number
  }> {
    const tasks = await this.getTasksDueForExecution()
    
    let executed = 0
    let successful = 0
    let failed = 0

    for (const task of tasks) {
      try {
        const execution = await this.executeTask(task._id!.toString())
        executed++
        if (execution.success) {
          successful++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`Failed to execute task ${task._id}:`, error)
        failed++
        executed++
      }
    }

    return { executed, successful, failed }
  }

  /**
   * Get task execution history
   */
  static async getTaskExecutionHistory(
    taskId: string, 
    limit: number = 10
  ): Promise<TaskExecution[]> {
    const executionsCollection = await this.getExecutionsCollection()
    
    return await executionsCollection
      .find({ taskId: new ObjectId(taskId) })
      .sort({ startTime: -1 })
      .limit(limit)
      .toArray()
  }

  /**
   * Get user's task execution statistics
   */
  static async getUserTaskStatistics(userId: string): Promise<{
    totalTasks: number
    activeTasks: number
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageSuccessRate: number
  }> {
    const tasksCollection = await this.getTasksCollection()
    const executionsCollection = await this.getExecutionsCollection()
    
    const userTasks = await tasksCollection.find({ userId }).toArray()
    const taskIds = userTasks.map(t => t._id!)
    
    const executions = await executionsCollection.find({ 
      taskId: { $in: taskIds } 
    }).toArray()
    
    const successfulExecutions = executions.filter(e => e.success).length
    const averageSuccessRate = userTasks.reduce((sum, task) => 
      sum + (task.successRate || 100), 0
    ) / (userTasks.length || 1)
    
    return {
      totalTasks: userTasks.length,
      activeTasks: userTasks.filter(t => t.status === 'active').length,
      totalExecutions: executions.length,
      successfulExecutions,
      failedExecutions: executions.length - successfulExecutions,
      averageSuccessRate
    }
  }

  /**
   * Execute threat hunter task - actively search for new threats
   */
  private static async executeThreatHunter(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const threatSources = config.threatSources as string[] || ['virustotal', 'urlvoid', 'phishtank']
    
    const result = {
      threatsFound: 0,
      newThreats: [] as Array<{
        source: string
        type: string
        indicator: string
        severity: string
        confidence: number
      }>,
      sourcesChecked: threatSources.length,
      alert: false
    }

    try {
      // Simulate threat hunting across multiple sources
      for (const source of threatSources) {
        // In a real implementation, this would query actual threat intelligence APIs
        const threats = await this.queryThreatSource(source)
        result.newThreats.push(...threats)
      }

      result.threatsFound = result.newThreats.length
      result.alert = result.threatsFound > 0

      return result
    } catch (error) {
      throw new Error(`Threat hunting failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute portfolio tracker task
   */
  private static async executePortfolioTracker(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const portfolioAddress = config.portfolioAddress as string
    const trackingTokens = config.trackingTokens as string[] || []
    
    if (!portfolioAddress) {
      throw new Error('Portfolio address not configured')
    }

    const result = {
      totalValue: 0,
      tokens: [] as Array<{
        symbol: string
        balance: number
        value: number
        change24h: number
      }>,
      performance: {
        day: 0,
        week: 0,
        month: 0
      },
      alert: false,
      alerts: [] as string[]
    }

    try {
      // Track each token in the portfolio
      for (const tokenMint of trackingTokens) {
        const balance = await getTokenBalance(portfolioAddress, tokenMint)
        const marketData = await fetchMarketData(tokenMint)
        
        const tokenValue = balance * marketData.price
        result.totalValue += tokenValue
        
        result.tokens.push({
          symbol: 'LYN', // marketData doesn't have symbol property
          balance,
          value: tokenValue,
          change24h: parseFloat(marketData.change24h) || 0
        })
      }

      // Calculate performance alerts
      const performanceThreshold = config.rebalanceThreshold as number || 20
      
      for (const token of result.tokens) {
        if (Math.abs(token.change24h) > performanceThreshold) {
          result.alert = true
          result.alerts.push(`${token.symbol} changed ${token.change24h.toFixed(2)}% in 24h`)
        }
      }

      return result
    } catch (error) {
      throw new Error(`Portfolio tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute smart contract audit task
   */
  private static async executeSmartContractAudit(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const contractAddresses = config.contractAddresses as string[] || []
    
    const result = {
      contractsAudited: 0,
      vulnerabilities: [] as Array<{
        contract: string
        type: string
        severity: string
        description: string
      }>,
      riskScore: 0,
      alert: false
    }

    try {
      for (const contractAddress of contractAddresses) {
        // Simulate contract audit
        const audit = await this.auditSmartContract(contractAddress)
        result.contractsAudited++
        
        if (audit.vulnerabilities.length > 0) {
          result.vulnerabilities.push(...audit.vulnerabilities)
          result.alert = true
        }
        
        result.riskScore = Math.max(result.riskScore, audit.riskScore)
      }

      return result
    } catch (error) {
      throw new Error(`Smart contract audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute DeFi monitor task
   */
  private static async executeDefiMonitor(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const protocols = config.protocols as string[] || []
    
    const result = {
      protocolsMonitored: protocols.length,
      totalValueLocked: 0,
      yieldOpportunities: [] as Array<{
        protocol: string
        apy: number
        risk: string
        liquidity: number
      }>,
      risks: [] as string[],
      alert: false
    }

    try {
      // Monitor DeFi protocols
      for (const protocol of protocols) {
        const protocolData = await this.getProtocolData(protocol)
        result.totalValueLocked += protocolData.tvl
        
        if (protocolData.apy > (config.yieldThresholds as number || 50)) {
          result.yieldOpportunities.push({
            protocol,
            apy: protocolData.apy,
            risk: protocolData.risk,
            liquidity: protocolData.liquidity
          })
        }
        
        if (protocolData.risks.length > 0) {
          result.risks.push(...protocolData.risks)
          result.alert = true
        }
      }

      return result
    } catch (error) {
      throw new Error(`DeFi monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute NFT tracker task
   */
  private static async executeNftTracker(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const collections = config.nftCollections as string[] || []
    
    const result = {
      collectionsTracked: collections.length,
      floorPrices: [] as Array<{
        collection: string
        floorPrice: number
        change24h: number
        volume24h: number
      }>,
      alerts: [] as string[],
      alert: false
    }

    try {
      for (const collection of collections) {
        const collectionData = await this.getNftCollectionData(collection)
        
        result.floorPrices.push({
          collection,
          floorPrice: collectionData.floorPrice,
          change24h: collectionData.change24h,
          volume24h: collectionData.volume24h
        })
        
        if (config.floorPriceAlerts && Math.abs(collectionData.change24h) > 20) {
          result.alert = true
          result.alerts.push(`${collection} floor price changed ${collectionData.change24h.toFixed(2)}%`)
        }
      }

      return result
    } catch (error) {
      throw new Error(`NFT tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute governance monitor task
   */
  private static async executeGovernanceMonitor(task: Task): Promise<Record<string, unknown>> {
    const config = task.config || {}
    const daoAddresses = config.daoAddresses as string[] || []
    
    const result = {
      daosMonitored: daoAddresses.length,
      activeProposals: [] as Array<{
        dao: string
        proposalId: string
        title: string
        status: string
        votingEnds: Date
      }>,
      votingReminders: [] as string[],
      alert: false
    }

    try {
      for (const daoAddress of daoAddresses) {
        const proposals = await this.getActiveProposals(daoAddress)
        result.activeProposals.push(...proposals)
        
        if (config.votingReminders) {
          const endingSoon = proposals.filter(p => 
            p.votingEnds.getTime() - Date.now() < 24 * 60 * 60 * 1000 // 24 hours
          )
          
          if (endingSoon.length > 0) {
            result.alert = true
            result.votingReminders.push(...endingSoon.map(p => 
              `Voting ends soon for "${p.title}" in ${daoAddress}`
            ))
          }
        }
      }

      return result
    } catch (error) {
      throw new Error(`Governance monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Helper methods for new task types
  private static async queryThreatSource(source: string): Promise<Array<{
    source: string
    type: string
    indicator: string
    severity: string
    confidence: number
  }>> {
    // Simulate threat intelligence queries
    const mockThreats = Math.random() > 0.8 ? [{
      source,
      type: 'malicious_url',
      indicator: `suspicious-${Math.random().toString(36).substring(7)}.com`,
      severity: 'medium',
      confidence: 85
    }] : []
    
    return mockThreats
  }

  private static async auditSmartContract(contractAddress: string): Promise<{
    vulnerabilities: Array<{
      contract: string
      type: string
      severity: string
      description: string
    }>
    riskScore: number
  }> {
    // Simulate contract audit
    const hasVulnerability = Math.random() > 0.9
    
    return {
      vulnerabilities: hasVulnerability ? [{
        contract: contractAddress,
        type: 'reentrancy',
        severity: 'high',
        description: 'Potential reentrancy vulnerability detected'
      }] : [],
      riskScore: hasVulnerability ? 75 : 15
    }
  }

  private static async getProtocolData(protocol: string): Promise<{
    tvl: number
    apy: number
    risk: string
    liquidity: number
    risks: string[]
  }> {
    // Simulate DeFi protocol data
    return {
      tvl: Math.random() * 1000000,
      apy: Math.random() * 100,
      risk: Math.random() > 0.7 ? 'high' : 'medium',
      liquidity: Math.random() * 500000,
      risks: Math.random() > 0.8 ? ['Impermanent loss risk'] : []
    }
  }

  private static async getNftCollectionData(collection: string): Promise<{
    floorPrice: number
    change24h: number
    volume24h: number
  }> {
    // Simulate NFT collection data
    return {
      floorPrice: Math.random() * 10,
      change24h: (Math.random() - 0.5) * 40,
      volume24h: Math.random() * 1000
    }
  }

  private static async getActiveProposals(daoAddress: string): Promise<Array<{
    dao: string
    proposalId: string
    title: string
    status: string
    votingEnds: Date
  }>> {
    // Simulate governance proposals
    const hasProposals = Math.random() > 0.7
    
    return hasProposals ? [{
      dao: daoAddress,
      proposalId: `prop_${Math.random().toString(36).substring(7)}`,
      title: 'Update protocol parameters',
      status: 'active',
      votingEnds: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000)
    }] : []
  }

  // ============ ENHANCED FEATURES ============

  /**
   * Task Dependency Management
   */
  private static async checkTaskDependencies(task: Task): Promise<{
    canExecute: boolean
    reason?: string
    delay?: number
  }> {
    if (!task.dependencies?.length) {
      return { canExecute: true }
    }

    const executionsCollection = await this.getExecutionsCollection()
    let totalDelay = 0

    for (const dependency of task.dependencies) {
      const dependentTask = await (await this.getTasksCollection()).findOne({
        _id: new ObjectId(dependency.taskId)
      })

      if (!dependentTask) {
        return {
          canExecute: false,
          reason: `Dependent task ${dependency.taskId} not found`
        }
      }

      // Get latest execution of dependent task
      const latestExecution = await executionsCollection.findOne(
        { taskId: new ObjectId(dependency.taskId) },
        { sort: { startTime: -1 } }
      )

      if (!latestExecution) {
        if (dependency.condition !== 'custom') {
          return {
            canExecute: false,
            reason: `Dependent task ${dependency.taskId} has never run`
          }
        }
      } else {
        // Check condition
        switch (dependency.condition) {
          case 'success':
            if (!latestExecution.success) {
              return {
                canExecute: false,
                reason: `Dependent task ${dependency.taskId} did not complete successfully`
              }
            }
            break
          case 'failure':
            if (latestExecution.success) {
              return {
                canExecute: false,
                reason: `Dependent task ${dependency.taskId} did not fail as expected`
              }
            }
            break
          case 'completion':
            // Just needs to have completed, success or failure doesn't matter
            break
          case 'custom':
            // Implement custom condition logic here
            // For now, always allow
            break
        }
      }

      // Add delay if specified
      if (dependency.delay) {
        totalDelay = Math.max(totalDelay, dependency.delay)
      }
    }

    return {
      canExecute: true,
      delay: totalDelay
    }
  }

  /**
   * Trigger dependent tasks after execution
   */
  private static async triggerDependentTasks(task: Task, execution: TaskExecution): Promise<void> {
    const tasksCollection = await this.getTasksCollection()
    
    // Find tasks that depend on this one
    const dependentTasks = await tasksCollection.find({
      'dependencies.taskId': task._id!.toString(),
      status: { $in: ['active', 'scheduled'] }
    }).toArray()

    for (const dependentTask of dependentTasks) {
      // Check if this execution satisfies the dependency condition
      const dependency = dependentTask.dependencies?.find(
        d => d.taskId === task._id!.toString()
      )
      
      if (!dependency) continue

      let shouldTrigger = false
      switch (dependency.condition) {
        case 'success':
          shouldTrigger = execution.success
          break
        case 'failure':
          shouldTrigger = !execution.success
          break
        case 'completion':
          shouldTrigger = true
          break
        case 'custom':
          // Implement custom condition evaluation
          shouldTrigger = true // For now
          break
      }

      if (shouldTrigger) {
        console.log(`Triggering dependent task: ${dependentTask.name} (${dependentTask._id})`)
        
        // Schedule dependent task execution with delay if specified
        if (dependency.delay && dependency.delay > 0) {
          setTimeout(async () => {
            try {
              await this.executeTask(dependentTask._id!.toString(), {
                triggeredBy: 'dependency',
                parentExecutionId: execution._id
              })
            } catch (error) {
              console.error(`Failed to execute dependent task ${dependentTask._id}:`, error)
            }
          }, dependency.delay)
        } else {
          // Execute immediately (in background)
          this.executeTask(dependentTask._id!.toString(), {
            triggeredBy: 'dependency',
            parentExecutionId: execution._id
          }).catch(error => {
            console.error(`Failed to execute dependent task ${dependentTask._id}:`, error)
          })
        }
      }
    }
  }

  /**
   * Result Caching
   */
  private static async getCachedResult(task: Task): Promise<Record<string, unknown> | null> {
    if (!this.shouldCache(task)) {
      return null
    }

    const cacheKey = this.generateCacheKey(task)
    
    // Check in-memory cache first
    const memoryCache = this.resultCache.get(cacheKey)
    if (memoryCache && Date.now() < memoryCache.timestamp + memoryCache.ttl) {
      console.log(`Cache hit (memory) for task ${task._id}: ${cacheKey}`)
      return memoryCache.result
    }

    // Check database cache
    const cacheCollection = await this.getCacheCollection()
    const cached = await cacheCollection.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() }
    })

    if (cached) {
      console.log(`Cache hit (database) for task ${task._id}: ${cacheKey}`)
      
      // Update hit count and last accessed
      await cacheCollection.updateOne(
        { _id: cached._id },
        {
          $inc: { hitCount: 1 },
          $set: { lastAccessed: new Date() }
        }
      )

      // Store in memory cache for faster subsequent access
      this.resultCache.set(cacheKey, {
        result: cached.result,
        timestamp: Date.now(),
        ttl: cached.expiresAt.getTime() - Date.now()
      })

      return cached.result
    }

    return null
  }

  private static async setCachedResult(
    task: Task, 
    result: Record<string, unknown>
  ): Promise<void> {
    if (!this.shouldCache(task)) {
      return
    }

    const cacheKey = this.generateCacheKey(task)
    const ttl = this.getCacheTTL(task)
    const expiresAt = new Date(Date.now() + ttl)

    // Store in memory cache
    this.resultCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl
    })

    // Store in database cache
    const cacheCollection = await this.getCacheCollection()
    await cacheCollection.replaceOne(
      { cacheKey },
      {
        taskId: task._id!,
        userId: task.userId,
        cacheKey,
        result,
        createdAt: new Date(),
        expiresAt,
        hitCount: 0,
        lastAccessed: new Date()
      },
      { upsert: true }
    )

    console.log(`Cached result for task ${task._id}: ${cacheKey} (TTL: ${ttl}ms)`)
  }

  private static shouldCache(task: Task): boolean {
    // Define which task types should be cached
    const cacheableTypes: TaskType[] = [
      'price-alert',
      'portfolio-tracker',
      'defi-monitor',
      'nft-tracker'
    ]
    
    return cacheableTypes.includes(task.type)
  }

  private static shouldCacheResult(
    task: Task, 
    result: Record<string, unknown>
  ): boolean {
    // Don't cache failed results or alerts
    if (result.error || result.alert) {
      return false
    }

    return this.shouldCache(task)
  }

  private static generateCacheKey(task: Task): string {
    // Create a cache key based on task type and relevant config
    const relevantConfig = { ...task.config }
    
    // Remove non-relevant fields from cache key
    delete relevantConfig.notifications
    delete relevantConfig.alertChannels
    
    const configHash = Buffer.from(JSON.stringify(relevantConfig)).toString('base64')
    return `task_${task.type}_${configHash}`
  }

  private static getCacheTTL(task: Task): number {
    // Define cache TTL based on task type and frequency
    switch (task.type) {
      case 'price-alert':
        return 2 * 60 * 1000 // 2 minutes for price data
      case 'portfolio-tracker':
        return 5 * 60 * 1000 // 5 minutes for portfolio data
      case 'defi-monitor':
        return 10 * 60 * 1000 // 10 minutes for DeFi data
      case 'nft-tracker':
        return 15 * 60 * 1000 // 15 minutes for NFT data
      default:
        return 5 * 60 * 1000 // 5 minutes default
    }
  }

  /**
   * Retry Logic
   */
  private static shouldRetryError(error: Error, retryConfig: TaskRetryConfig): boolean {
    const errorMessage = error.message.toLowerCase()
    
    // Check if error matches retry conditions
    return retryConfig.retryConditions?.some(condition => {
      switch (condition) {
        case 'network_error':
          return errorMessage.includes('network') || 
                 errorMessage.includes('connection') ||
                 errorMessage.includes('timeout') ||
                 errorMessage.includes('econnreset')
        case 'timeout':
          return errorMessage.includes('timeout')
        case 'rate_limit':
          return errorMessage.includes('rate limit') || 
                 errorMessage.includes('too many requests')
        case 'temporary_failure':
          return errorMessage.includes('temporary') ||
                 errorMessage.includes('unavailable') ||
                 errorMessage.includes('service error')
        default:
          return false
      }
    }) ?? false
  }

  /**
   * Task Templates
   */
  static async createTaskTemplate(template: Omit<TaskTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<TaskTemplate> {
    const templatesCollection = await this.getTemplatesCollection()
    const now = new Date()
    
    const newTemplate: TaskTemplate = {
      ...template,
      createdAt: now,
      updatedAt: now
    }

    const result = await templatesCollection.insertOne(newTemplate)
    return { ...newTemplate, _id: result.insertedId }
  }

  static async getTaskTemplates(filters?: {
    type?: TaskType
    category?: string
    isPublic?: boolean
    createdBy?: string
  }): Promise<TaskTemplate[]> {
    const templatesCollection = await this.getTemplatesCollection()
    const query: any = {}
    
    if (filters?.type) query.type = filters.type
    if (filters?.category) query.category = filters.category
    if (filters?.isPublic !== undefined) query.isPublic = filters.isPublic
    if (filters?.createdBy) query.createdBy = filters.createdBy

    return await templatesCollection.find(query).toArray()
  }

  static async createTaskFromTemplate(
    templateId: string, 
    userId: string, 
    customConfig: Record<string, unknown> = {},
    customName?: string
  ): Promise<Task> {
    const templatesCollection = await this.getTemplatesCollection()
    const template = await templatesCollection.findOne({ _id: new ObjectId(templateId) })
    
    if (!template) {
      throw new Error('Task template not found')
    }

    const tasksCollection = await this.getTasksCollection()
    const now = new Date()
    
    const task: Task = {
      userId,
      name: customName || template.name,
      description: template.description,
      status: 'active',
      type: template.type,
      frequency: template.defaultFrequency,
      priority: 'normal',
      templateId: template._id!.toString(),
      successRate: 100,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      config: { ...template.defaultConfig, ...customConfig },
      createdAt: now,
      updatedAt: now
    }

    const result = await tasksCollection.insertOne(task)
    return { ...task, _id: result.insertedId }
  }

  /**
   * Task Analytics and History
   */
  private static async recordTaskAnalytics(task: Task, execution: TaskExecution): Promise<void> {
    const analyticsCollection = await this.getAnalyticsCollection()
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of day

    const existingAnalytics = await analyticsCollection.findOne({
      userId: task.userId,
      taskId: task._id!,
      date: today
    })

    if (existingAnalytics) {
      // Update existing analytics
      const updates: any = {
        $inc: {
          executions: 1,
          totalExecutionTime: execution.duration || 0
        },
        $set: {
          averageExecutionTime: (
            existingAnalytics.totalExecutionTime + (execution.duration || 0)
          ) / (existingAnalytics.executions + 1)
        }
      }

      if (execution.success) {
        updates.$inc.successes = 1
        if (execution.isCached) {
          updates.$inc.cacheHits = 1
        } else {
          updates.$inc.cacheMisses = 1
        }
      } else {
        updates.$inc.failures = 1
        if (execution.error && !existingAnalytics.uniqueErrors.includes(execution.error)) {
          updates.$addToSet = { uniqueErrors: execution.error }
        }
      }

      if (execution.retryCount && execution.retryCount > 0) {
        updates.$inc.retries = execution.retryCount
      }

      await analyticsCollection.updateOne(
        { _id: existingAnalytics._id },
        updates
      )
    } else {
      // Create new analytics record
      const analytics: TaskAnalytics = {
        userId: task.userId,
        taskId: task._id!,
        date: today,
        executions: 1,
        successes: execution.success ? 1 : 0,
        failures: execution.success ? 0 : 1,
        totalExecutionTime: execution.duration || 0,
        averageExecutionTime: execution.duration || 0,
        cacheHits: execution.isCached ? 1 : 0,
        cacheMisses: execution.isCached ? 0 : 1,
        retries: execution.retryCount || 0,
        uniqueErrors: execution.error ? [execution.error] : [],
        performanceMetrics: execution.performance
      }

      await analyticsCollection.insertOne(analytics)
    }
  }

  /**
   * Get comprehensive task analytics
   */
  static async getTaskAnalytics(
    userId: string, 
    options?: {
      taskId?: string
      startDate?: Date
      endDate?: Date
      taskType?: TaskType
    }
  ): Promise<{
    summary: {
      totalExecutions: number
      successRate: number
      averageExecutionTime: number
      totalRetries: number
      cacheHitRate: number
    }
    daily: TaskAnalytics[]
    topErrors: { error: string, count: number }[]
    performanceTrends: { date: Date, avgExecutionTime: number, successRate: number }[]
  }> {
    const analyticsCollection = await this.getAnalyticsCollection()
    const query: any = { userId }
    
    if (options?.taskId) {
      query.taskId = new ObjectId(options.taskId)
    }
    
    if (options?.startDate || options?.endDate) {
      query.date = {}
      if (options.startDate) query.date.$gte = options.startDate
      if (options.endDate) query.date.$lte = options.endDate
    }

    const analytics = await analyticsCollection.find(query).sort({ date: -1 }).toArray()
    
    // Calculate summary statistics
    const summary = {
      totalExecutions: analytics.reduce((sum, a) => sum + a.executions, 0),
      successRate: 0,
      averageExecutionTime: 0,
      totalRetries: analytics.reduce((sum, a) => sum + a.retries, 0),
      cacheHitRate: 0
    }

    if (summary.totalExecutions > 0) {
      const totalSuccesses = analytics.reduce((sum, a) => sum + a.successes, 0)
      const totalCacheHits = analytics.reduce((sum, a) => sum + a.cacheHits, 0)
      const totalExecutionTime = analytics.reduce((sum, a) => sum + a.totalExecutionTime, 0)
      
      summary.successRate = (totalSuccesses / summary.totalExecutions) * 100
      summary.averageExecutionTime = totalExecutionTime / summary.totalExecutions
      summary.cacheHitRate = (totalCacheHits / summary.totalExecutions) * 100
    }

    // Get top errors
    const errorCounts = new Map<string, number>()
    analytics.forEach(a => {
      a.uniqueErrors.forEach(error => {
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1)
      })
    })
    
    const topErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Performance trends
    const performanceTrends = analytics.map(a => ({
      date: a.date,
      avgExecutionTime: a.averageExecutionTime,
      successRate: a.executions > 0 ? (a.successes / a.executions) * 100 : 0
    }))

    return {
      summary,
      daily: analytics,
      topErrors,
      performanceTrends
    }
  }

  /**
   * Cron Job Management
   */
  static async scheduleCronJob(task: Task): Promise<void> {
    if (!task.cronExpression || !cron.validate(task.cronExpression)) {
      console.warn(`Invalid or missing cron expression for task ${task._id}: ${task.cronExpression}`)
      return
    }

    const taskId = task._id!.toString()
    
    // Destroy existing cron job if it exists
    if (this.cronJobs.has(taskId)) {
      this.cronJobs.get(taskId).destroy()
    }

    // Create new cron job
    const cronJob = cron.schedule(task.cronExpression, async () => {
      try {
        console.log(`Executing cron job for task: ${task.name} (${taskId})`)
        await this.executeTask(taskId, { triggeredBy: 'cron' })
      } catch (error) {
        console.error(`Cron job execution failed for task ${taskId}:`, error)
      }
    }, {
      scheduled: task.status === 'active',
      timezone: 'UTC'
    })

    this.cronJobs.set(taskId, cronJob)
    console.log(`Scheduled cron job for task ${task.name}: ${task.cronExpression}`)
  }

  static async unscheduleCronJob(taskId: string): Promise<void> {
    if (this.cronJobs.has(taskId)) {
      this.cronJobs.get(taskId).destroy()
      this.cronJobs.delete(taskId)
      console.log(`Unscheduled cron job for task ${taskId}`)
    }
  }

  /**
   * Batch Operations
   */
  static async executeBatch(
    taskIds: string[], 
    options?: {
      maxParallel?: number
      userId?: string
      waitForCompletion?: boolean
    }
  ): Promise<{
    batchId: string
    results: TaskExecution[]
  }> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const maxParallel = Math.min(options?.maxParallel || 3, taskIds.length)
    
    console.log(`Starting batch execution of ${taskIds.length} tasks (batch: ${batchId})`)
    
    const results: TaskExecution[] = []
    const chunks = this.chunkArray(taskIds, maxParallel)
    
    for (const chunk of chunks) {
      const promises = chunk.map(taskId => 
        this.executeTask(taskId, {
          triggeredBy: 'api',
          batchId
        }).catch(error => {
          console.error(`Batch execution failed for task ${taskId}:`, error)
          return null
        })
      )
      
      const chunkResults = await Promise.all(promises)
      results.push(...chunkResults.filter(r => r !== null) as TaskExecution[])
    }

    return { batchId, results }
  }

  /**
   * Utility Methods
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Cleanup and Maintenance
   */
  static async cleanupExpiredCache(): Promise<void> {
    const cacheCollection = await this.getCacheCollection()
    const result = await cacheCollection.deleteMany({ 
      expiresAt: { $lt: new Date() } 
    })
    
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} expired cache entries`)
    }
  }

  static async cleanupOldExecutions(daysToKeep: number = 90): Promise<void> {
    const executionsCollection = await this.getExecutionsCollection()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const result = await executionsCollection.deleteMany({
      startTime: { $lt: cutoffDate }
    })
    
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} old execution records`)
    }
  }

  static async cleanupOldAnalytics(daysToKeep: number = 365): Promise<void> {
    const analyticsCollection = await this.getAnalyticsCollection()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const result = await analyticsCollection.deleteMany({
      date: { $lt: cutoffDate }
    })
    
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} old analytics records`)
    }
  }

  /**
   * System Health and Monitoring
   */
  static async getSystemHealth(): Promise<{
    activeJobs: number
    runningTasks: number
    cacheSize: number
    pendingTasks: number
    systemLoad: {
      memoryUsage: NodeJS.MemoryUsage
      uptime: number
    }
  }> {
    const tasksCollection = await this.getTasksCollection()
    const cacheCollection = await this.getCacheCollection()
    
    const [activeTasks, pendingTasks, cacheCount] = await Promise.all([
      tasksCollection.countDocuments({ status: 'active' }),
      tasksCollection.countDocuments({ 
        status: 'active',
        nextRun: { $lte: new Date() }
      }),
      cacheCollection.countDocuments({ expiresAt: { $gt: new Date() } })
    ])

    return {
      activeJobs: this.cronJobs.size,
      runningTasks: this.runningTasks.size,
      cacheSize: this.resultCache.size + cacheCount,
      pendingTasks,
      systemLoad: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    }
  }
}
