import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { ScanService } from './scan-service'
import { ThreatIntelligenceService } from './threat-intelligence'
import { getWalletBalance, getTokenBalance, getRecentTransactions } from '@/lib/solana'
import { fetchTokenPrice, fetchMarketData } from './price-service'

export interface Task {
  _id?: ObjectId
  userId: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed' | 'failed' | 'scheduled'
  type: 'security-scan' | 'wallet-monitor' | 'price-alert' | 'auto-trade' | 'threat-hunter' | 'portfolio-tracker' | 'smart-contract-audit' | 'defi-monitor' | 'nft-tracker' | 'governance-monitor'
  frequency: string
  lastRun?: Date
  nextRun?: Date | null
  successRate: number
  executionCount?: number
  successCount?: number
  failureCount?: number
  lastResult?: {
    success: boolean
    message: string
    data?: Record<string, unknown>
    error?: string
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
  taskId: ObjectId
  userId: string
  startTime: Date
  endTime?: Date
  success: boolean
  result?: Record<string, unknown>
  error?: string
  duration?: number
}

export class TaskExecutor {
  private static async getTasksCollection() {
    const db = await getDatabase()
    return db.collection<Task>('tasks')
  }

  private static async getExecutionsCollection() {
    const db = await getDatabase()
    return db.collection<TaskExecution>('task_executions')
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
    const notifications = task.config?.notifications as Record<string, string>
    
    if (!notifications || !result.alert) return

    // In a real implementation, you would integrate with notification services
    console.log(`[NOTIFICATION] Task "${task.name}" alert:`, result.alerts || result.message)
    
    // TODO: Integrate with real notification services:
    // - Email via SendGrid/AWS SES
    // - Discord via webhook
    // - Telegram via bot API
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
}
