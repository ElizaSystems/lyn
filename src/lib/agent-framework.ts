/**
 * Core Agent Framework for Autonomous AI Operations
 * Implements perceive-reason-act-learn loop for crypto cybersecurity
 */

import OpenAI from 'openai'
import { Connection, PublicKey } from '@solana/web3.js'
import { getDatabase } from './mongodb'
import { config } from './config'
import { getConnectionWithFallback, getAICompletionWithFallback, openaiCircuitBreaker } from './api-fallbacks'

// Initialize OpenAI with proper error handling
const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
  if (!apiKey || apiKey === '') {
    console.warn('[Agent] OpenAI API key not configured')
    return null
  }
  return new OpenAI({ apiKey })
}

// Get Solana connection with fallback support
let solanaConnection: Connection | null = null
const getSolanaConnection = async () => {
  if (!solanaConnection) {
    solanaConnection = await getConnectionWithFallback()
  }
  return solanaConnection
}

export interface AgentTask {
  id: string
  type: 'fraud_detection' | 'contract_audit' | 'threat_hunt' | 'compliance' | 'referral_optimize'
  priority: 'low' | 'medium' | 'high' | 'critical'
  data: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}

export interface AgentDecision {
  action: string
  confidence: number
  reasoning: string
  risks: string[]
  requirements: string[]
}

export interface AgentOutcome {
  success: boolean
  threat?: boolean
  decision: AgentDecision
  executedActions: string[]
  metrics: Record<string, any>
  learnings: string[]
}

/**
 * Main agent loop implementing autonomous decision-making
 */
export async function runAgentLoop(
  task: string, 
  data: any,
  agentType: AgentTask['type'] = 'threat_hunt'
): Promise<AgentOutcome> {
  const startTime = Date.now()
  const db = await getDatabase()
  
  try {
    // 1. PERCEIVE: Gather and enrich data from multiple sources
    console.log(`[Agent] Perceiving: ${task}`)
    const perceivedData = await perceive(data, agentType)
    
    // 2. REASON: Use LLM to analyze and plan actions
    console.log(`[Agent] Reasoning about perceived data`)
    const decision = await reason(task, perceivedData, agentType)
    
    // 3. ACT: Execute planned actions with safety checks
    console.log(`[Agent] Acting on decision: ${decision.action}`)
    const executedActions = await act(decision, perceivedData, agentType)
    
    // 4. LEARN: Log outcomes for continuous improvement
    const outcome: AgentOutcome = {
      success: true,
      threat: decision.reasoning.includes('threat') || decision.reasoning.includes('anomaly'),
      decision,
      executedActions,
      metrics: {
        processingTime: Date.now() - startTime,
        dataPoints: Object.keys(perceivedData).length,
        confidence: decision.confidence
      },
      learnings: extractLearnings(decision, executedActions)
    }
    
    await learn(task, perceivedData, decision, outcome, agentType)
    
    return outcome
  } catch (error) {
    console.error(`[Agent] Error in loop:`, error)
    
    // Log failure for learning
    await db.collection('agent_logs').insertOne({
      task,
      agentType,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
      status: 'failed'
    })
    
    return {
      success: false,
      decision: {
        action: 'error_recovery',
        confidence: 0,
        reasoning: 'Agent loop failed',
        risks: ['execution_failure'],
        requirements: []
      },
      executedActions: [],
      metrics: { processingTime: Date.now() - startTime },
      learnings: []
    }
  }
}

/**
 * PERCEIVE: Gather data from blockchain, APIs, and databases
 */
async function perceive(data: any, agentType: AgentTask['type']): Promise<any> {
  const enrichedData: any = { ...data }
  
  try {
    switch (agentType) {
      case 'fraud_detection':
        // Enrich with blockchain data
        if (data.walletAddress) {
          const pubkey = new PublicKey(data.walletAddress)
          const balance = await solanaConnection.getBalance(pubkey)
          const signatures = await solanaConnection.getSignaturesForAddress(pubkey, { limit: 10 })
          enrichedData.onChainData = {
            balance: balance / 1e9, // Convert to SOL
            recentTxCount: signatures.length,
            signatures: signatures.map(s => s.signature)
          }
        }
        break
        
      case 'contract_audit':
        // Fetch contract bytecode and metadata
        if (data.contractAddress) {
          const accountInfo = await solanaConnection.getAccountInfo(new PublicKey(data.contractAddress))
          enrichedData.contractData = {
            owner: accountInfo?.owner.toString(),
            executable: accountInfo?.executable,
            dataLength: accountInfo?.data.length
          }
        }
        break
        
      case 'threat_hunt':
        // Aggregate threat intelligence
        const db = await getDatabase()
        const recentThreats = await db.collection('threats')
          .find({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
          .limit(10)
          .toArray()
        enrichedData.threatContext = recentThreats
        break
        
      case 'compliance':
        // Fetch user history and compliance records
        if (data.userId) {
          const db = await getDatabase()
          const user = await db.collection('users').findOne({ _id: data.userId })
          enrichedData.userCompliance = {
            hasUsername: !!user?.username,
            tokenBalance: user?.tokenBalance || 0,
            accountAge: user?.createdAt ? Date.now() - new Date(user.createdAt).getTime() : 0
          }
        }
        break
        
      case 'referral_optimize':
        // Get referral network data
        const db2 = await getDatabase()
        const referralStats = await db2.collection('referral_codes_v2')
          .aggregate([
            { $match: { walletAddress: data.walletAddress } },
            { $lookup: {
              from: 'users',
              localField: 'referredUsers',
              foreignField: 'walletAddress',
              as: 'referredUserDetails'
            }}
          ])
          .toArray()
        enrichedData.referralNetwork = referralStats
        break
    }
    
    // Add current blockchain state with fallback
    try {
      const connection = await getSolanaConnection()
      const slot = await connection.getSlot()
      enrichedData.blockchainState = {
        currentSlot: slot,
        timestamp: new Date().toISOString()
      }
    } catch (connError) {
      console.warn('[Agent] Could not get blockchain state:', connError)
      enrichedData.blockchainState = {
        currentSlot: 0,
        timestamp: new Date().toISOString(),
        error: 'Connection failed'
      }
    }
    
  } catch (error) {
    console.error(`[Agent] Perception error:`, error)
    enrichedData.perceptionError = error instanceof Error ? error.message : 'Unknown'
  }
  
  return enrichedData
}

/**
 * REASON: Use LLM to analyze data and plan actions
 */
async function reason(
  task: string, 
  perceivedData: any, 
  agentType: AgentTask['type']
): Promise<AgentDecision> {
  const systemPrompt = getSystemPrompt(agentType)
  
  const openai = getOpenAI()
  if (!openai) {
    // Fallback decision without LLM
    return {
      action: 'monitor',
      confidence: 0.5,
      reasoning: 'LLM not available - defaulting to monitoring',
      risks: ['no_llm'],
      requirements: []
    }
  }
  
  try {
    // Try OpenAI with circuit breaker
    const content = await openaiCircuitBreaker.execute(async () => {
      if (!openai) {
        // Use fallback if OpenAI not configured
        const prompt = `${systemPrompt}\n\nTask: ${task}\n\nData: ${JSON.stringify(perceivedData, null, 2)}\n\nProvide a decision in JSON format with: action, confidence (0-1), reasoning, risks[], and requirements[].`
        return await getAICompletionWithFallback(prompt, 'gpt-4')
      }
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Task: ${task}\n\nData: ${JSON.stringify(perceivedData, null, 2)}\n\nProvide a decision in JSON format with: action, confidence (0-1), reasoning, risks[], and requirements[].`
          }
        ],
        temperature: 0.3, // Lower temperature for more deterministic decisions
        max_tokens: 1000
      })
      
      return response.choices[0].message.content || '{}'
    })
    
    // Parse LLM response
    try {
      const decision = JSON.parse(content) as AgentDecision
      
      // Validate decision structure
      if (!decision.action || typeof decision.confidence !== 'number') {
        throw new Error('Invalid decision structure')
      }
      
      return decision
    } catch {
      // Fallback if JSON parsing fails
      return {
        action: 'monitor',
        confidence: 0.5,
        reasoning: content,
        risks: ['parsing_error'],
        requirements: []
      }
    }
  } catch (error) {
    console.error(`[Agent] Reasoning error:`, error)
    
    // Fallback decision
    return {
      action: 'defer_to_human',
      confidence: 0,
      reasoning: 'LLM reasoning failed',
      risks: ['reasoning_failure'],
      requirements: ['human_review']
    }
  }
}

/**
 * ACT: Execute planned actions with safety guardrails
 */
async function act(
  decision: AgentDecision,
  data: any,
  agentType: AgentTask['type']
): Promise<string[]> {
  const executedActions: string[] = []
  const db = await getDatabase()
  
  // Safety check: Don't execute low-confidence critical actions
  if (decision.confidence < 0.7 && decision.risks.includes('high_impact')) {
    executedActions.push('deferred_to_human_review')
    await db.collection('agent_decisions').insertOne({
      ...decision,
      status: 'pending_review',
      timestamp: new Date()
    })
    return executedActions
  }
  
  try {
    switch (decision.action) {
      case 'flag_threat':
        await db.collection('threats').insertOne({
          type: agentType,
          data,
          severity: decision.confidence > 0.8 ? 'critical' : 'medium',
          reasoning: decision.reasoning,
          createdAt: new Date(),
          agentDetected: true
        })
        executedActions.push('threat_flagged')
        break
        
      case 'block_wallet':
        await db.collection('blocked_wallets').insertOne({
          walletAddress: data.walletAddress,
          reason: decision.reasoning,
          blockedAt: new Date(),
          agentAction: true
        })
        executedActions.push('wallet_blocked')
        break
        
      case 'alert_user':
        // Queue notification
        await db.collection('notifications').insertOne({
          userId: data.userId,
          type: 'agent_alert',
          message: decision.reasoning,
          priority: decision.confidence > 0.8 ? 'high' : 'medium',
          createdAt: new Date()
        })
        executedActions.push('user_alerted')
        break
        
      case 'optimize_referral':
        // Update referral strategy
        await db.collection('referral_optimizations').insertOne({
          walletAddress: data.walletAddress,
          strategy: decision.reasoning,
          expectedImprovement: decision.confidence,
          createdAt: new Date()
        })
        executedActions.push('referral_optimized')
        break
        
      case 'approve_compliance':
        await db.collection('users').updateOne(
          { _id: data.userId },
          { $set: { complianceVerified: true, verifiedAt: new Date() } }
        )
        executedActions.push('compliance_approved')
        break
        
      case 'monitor':
        // Log for continued monitoring
        await db.collection('agent_monitoring').insertOne({
          target: data,
          reason: decision.reasoning,
          nextCheckAt: new Date(Date.now() + 60 * 60 * 1000), // Check in 1 hour
          createdAt: new Date()
        })
        executedActions.push('monitoring_scheduled')
        break
        
      default:
        executedActions.push('no_action_taken')
    }
    
    // Log all actions for audit trail
    await db.collection('agent_actions').insertOne({
      agentType,
      decision,
      executedActions,
      timestamp: new Date()
    })
    
  } catch (error) {
    console.error(`[Agent] Action execution error:`, error)
    executedActions.push('action_failed')
  }
  
  return executedActions
}

/**
 * LEARN: Store outcomes for continuous improvement
 */
async function learn(
  task: string,
  perceivedData: any,
  decision: AgentDecision,
  outcome: AgentOutcome,
  agentType: AgentTask['type']
): Promise<void> {
  const db = await getDatabase()
  
  try {
    // Store in learning database
    await db.collection('agent_learning').insertOne({
      task,
      agentType,
      perceivedData: summarizeData(perceivedData),
      decision,
      outcome: {
        success: outcome.success,
        threat: outcome.threat,
        metrics: outcome.metrics
      },
      learnings: outcome.learnings,
      timestamp: new Date()
    })
    
    // Update agent performance metrics
    await db.collection('agent_metrics').updateOne(
      { agentType },
      {
        $inc: {
          totalRuns: 1,
          successfulRuns: outcome.success ? 1 : 0,
          threatsDetected: outcome.threat ? 1 : 0
        },
        $push: {
          recentConfidence: {
            $each: [decision.confidence],
            $slice: -100 // Keep last 100 confidence scores
          }
        }
      },
      { upsert: true }
    )
    
    // Schedule retraining if performance drops
    const metrics = await db.collection('agent_metrics').findOne({ agentType })
    if (metrics && metrics.successfulRuns / metrics.totalRuns < 0.7) {
      console.log(`[Agent] Performance below threshold, scheduling retraining`)
      await scheduleRetraining(agentType)
    }
    
  } catch (error) {
    console.error(`[Agent] Learning storage error:`, error)
  }
}

/**
 * Helper: Get appropriate system prompt for agent type
 */
function getSystemPrompt(agentType: AgentTask['type']): string {
  const prompts = {
    fraud_detection: `You are a fraud detection agent for crypto transactions. Analyze blockchain data to identify suspicious patterns, wash trading, rug pulls, and other fraudulent activities. Be conservative - flag potential threats for human review rather than missing real threats.`,
    
    contract_audit: `You are a smart contract auditing agent. Analyze contract code and bytecode for vulnerabilities like reentrancy, integer overflow, access control issues, and other security risks. Provide specific recommendations for fixes.`,
    
    threat_hunt: `You are a proactive threat hunting agent. Identify emerging threats, anomalies, and attack patterns across the crypto ecosystem. Correlate multiple data sources to detect sophisticated attacks.`,
    
    compliance: `You are a compliance verification agent. Ensure users meet KYC/AML requirements, detect money laundering patterns, and verify regulatory compliance. Balance security with user experience.`,
    
    referral_optimize: `You are a referral network optimization agent. Analyze referral patterns to identify growth opportunities, detect referral fraud, and suggest improvements to maximize legitimate network growth.`
  }
  
  return prompts[agentType] || prompts.threat_hunt
}

/**
 * Helper: Extract learnings from outcomes
 */
function extractLearnings(decision: AgentDecision, actions: string[]): string[] {
  const learnings: string[] = []
  
  if (decision.confidence > 0.8 && actions.includes('threat_flagged')) {
    learnings.push('High-confidence threat detection successful')
  }
  
  if (decision.confidence < 0.5 && actions.includes('deferred_to_human_review')) {
    learnings.push('Low-confidence decision correctly deferred')
  }
  
  if (decision.risks.length > 3) {
    learnings.push('Multiple risk factors identified - requires pattern analysis')
  }
  
  return learnings
}

/**
 * Helper: Summarize data for storage
 */
function summarizeData(data: any): any {
  // Reduce data size for storage while keeping key information
  const summary: any = {}
  
  if (data.walletAddress) summary.walletAddress = data.walletAddress
  if (data.userId) summary.userId = data.userId
  if (data.blockchainState) summary.slot = data.blockchainState.currentSlot
  if (data.onChainData) summary.balance = data.onChainData.balance
  if (data.threatContext) summary.threatCount = data.threatContext.length
  
  return summary
}

/**
 * Schedule model retraining
 */
async function scheduleRetraining(agentType: AgentTask['type']): Promise<void> {
  const db = await getDatabase()
  
  await db.collection('agent_retraining').insertOne({
    agentType,
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
    status: 'pending',
    createdAt: new Date()
  })
}

/**
 * Run multiple agents in parallel (swarm mode)
 */
export async function runAgentSwarm(tasks: Array<{ task: string; data: any; type: AgentTask['type'] }>): Promise<AgentOutcome[]> {
  console.log(`[Agent] Running swarm with ${tasks.length} agents`)
  
  const promises = tasks.map(({ task, data, type }) => 
    runAgentLoop(task, data, type)
  )
  
  return Promise.all(promises)
}

/**
 * Get agent status and metrics
 */
export async function getAgentStatus(): Promise<any> {
  const db = await getDatabase()
  
  const [metrics, recentLogs, pendingTasks] = await Promise.all([
    db.collection('agent_metrics').find({}).toArray(),
    db.collection('agent_logs')
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray(),
    db.collection('agent_monitoring')
      .find({ nextCheckAt: { $gte: new Date() } })
      .count()
  ])
  
  return {
    agents: metrics.map(m => ({
      type: m.agentType,
      totalRuns: m.totalRuns || 0,
      successRate: m.totalRuns ? (m.successfulRuns / m.totalRuns) : 0,
      threatsDetected: m.threatsDetected || 0,
      avgConfidence: m.recentConfidence?.reduce((a: number, b: number) => a + b, 0) / (m.recentConfidence?.length || 1) || 0
    })),
    recentActivity: recentLogs,
    pendingTasks
  }
}