/**
 * Smart Contract Auditing Agent
 * Analyzes Solana programs for vulnerabilities and optimization opportunities
 */

import { runAgentLoop } from './agent-framework'
import { Connection, PublicKey } from '@solana/web3.js'
import { config } from './config'

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || config.solana.rpcUrl
)

export interface AuditResult {
  vulnerabilities: Vulnerability[]
  optimizations: Optimization[]
  score: number // 0-100 security score
  fixes: Fix[]
  gasEstimate?: number
  complexity: 'low' | 'medium' | 'high'
}

export interface Vulnerability {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location?: string
  impact: string
}

export interface Optimization {
  type: string
  description: string
  estimatedSavings?: string
}

export interface Fix {
  vulnerability: string
  suggestion: string
  code?: string
}

/**
 * Audit a smart contract for security vulnerabilities
 */
export async function auditContract(
  contractAddress: string,
  code?: string
): Promise<AuditResult> {
  console.log(`[Auditor] Starting audit for contract: ${contractAddress}`)
  
  try {
    // Fetch on-chain data if address provided
    let contractData: any = { address: contractAddress }
    
    if (contractAddress && !code) {
      const pubkey = new PublicKey(contractAddress)
      const accountInfo = await connection.getAccountInfo(pubkey)
      
      if (accountInfo) {
        contractData = {
          ...contractData,
          owner: accountInfo.owner.toString(),
          executable: accountInfo.executable,
          dataLength: accountInfo.data.length,
          lamports: accountInfo.lamports,
          rentEpoch: accountInfo.rentEpoch
        }
      }
    }
    
    if (code) {
      contractData.sourceCode = code
    }
    
    // Run audit agent
    const outcome = await runAgentLoop(
      'Audit smart contract for vulnerabilities and optimizations',
      contractData,
      'contract_audit'
    )
    
    // Parse agent decision into structured audit result
    const auditResult = parseAuditOutcome(outcome)
    
    // Calculate security score
    auditResult.score = calculateSecurityScore(auditResult.vulnerabilities)
    
    // Determine complexity based on contract size and vulnerability count
    auditResult.complexity = determineComplexity(contractData, auditResult)
    
    return auditResult
    
  } catch (error) {
    console.error(`[Auditor] Audit failed:`, error)
    
    // Return basic audit with error info
    return {
      vulnerabilities: [{
        type: 'audit_error',
        severity: 'low',
        description: 'Audit could not be completed',
        impact: error instanceof Error ? error.message : 'Unknown error'
      }],
      optimizations: [],
      score: 0,
      fixes: [],
      complexity: 'high'
    }
  }
}

/**
 * Parse agent outcome into structured audit result
 */
function parseAuditOutcome(outcome: any): AuditResult {
  const result: AuditResult = {
    vulnerabilities: [],
    optimizations: [],
    score: 0,
    fixes: [],
    complexity: 'medium'
  }
  
  // Extract vulnerabilities from reasoning
  const reasoning = outcome.decision.reasoning || ''
  
  // Common vulnerability patterns to check
  const vulnPatterns = [
    { pattern: /reentrancy/gi, type: 'reentrancy', severity: 'critical' as const },
    { pattern: /overflow|underflow/gi, type: 'integer_overflow', severity: 'high' as const },
    { pattern: /access control/gi, type: 'access_control', severity: 'high' as const },
    { pattern: /uninitialized/gi, type: 'uninitialized_storage', severity: 'medium' as const },
    { pattern: /front.?run/gi, type: 'frontrunning', severity: 'medium' as const },
    { pattern: /timestamp/gi, type: 'timestamp_dependency', severity: 'low' as const }
  ]
  
  vulnPatterns.forEach(({ pattern, type, severity }) => {
    if (pattern.test(reasoning)) {
      result.vulnerabilities.push({
        type,
        severity,
        description: `Potential ${type.replace('_', ' ')} vulnerability detected`,
        impact: `Could lead to ${severity === 'critical' ? 'fund loss' : 'unexpected behavior'}`
      })
      
      // Add corresponding fix
      result.fixes.push({
        vulnerability: type,
        suggestion: getFixSuggestion(type)
      })
    }
  })
  
  // Extract optimizations
  if (reasoning.includes('optimize') || reasoning.includes('gas')) {
    result.optimizations.push({
      type: 'gas_optimization',
      description: 'Contract can be optimized for lower transaction costs',
      estimatedSavings: '10-20%'
    })
  }
  
  // If agent flagged as threat, add as critical vulnerability
  if (outcome.threat) {
    result.vulnerabilities.push({
      type: 'critical_issue',
      severity: 'critical',
      description: outcome.decision.reasoning,
      impact: 'Contract may be malicious or severely flawed'
    })
  }
  
  return result
}

/**
 * Calculate overall security score
 */
function calculateSecurityScore(vulnerabilities: Vulnerability[]): number {
  if (vulnerabilities.length === 0) return 100
  
  let score = 100
  
  vulnerabilities.forEach(vuln => {
    switch (vuln.severity) {
      case 'critical':
        score -= 30
        break
      case 'high':
        score -= 20
        break
      case 'medium':
        score -= 10
        break
      case 'low':
        score -= 5
        break
    }
  })
  
  return Math.max(0, score)
}

/**
 * Determine contract complexity
 */
function determineComplexity(contractData: any, auditResult: AuditResult): 'low' | 'medium' | 'high' {
  const dataLength = contractData.dataLength || 0
  const vulnCount = auditResult.vulnerabilities.length
  
  if (dataLength > 10000 || vulnCount > 5) return 'high'
  if (dataLength > 5000 || vulnCount > 2) return 'medium'
  return 'low'
}

/**
 * Get fix suggestion for vulnerability type
 */
function getFixSuggestion(vulnType: string): string {
  const fixes: Record<string, string> = {
    reentrancy: 'Use checks-effects-interactions pattern and add reentrancy guards',
    integer_overflow: 'Use safe math operations or Rust\'s checked arithmetic',
    access_control: 'Implement proper owner checks and role-based access control',
    uninitialized_storage: 'Initialize all storage variables in constructor',
    frontrunning: 'Implement commit-reveal scheme or use flashloan protection',
    timestamp_dependency: 'Avoid using block.timestamp for critical logic',
    critical_issue: 'Contract requires complete security review and potential rewrite'
  }
  
  return fixes[vulnType] || 'Review and fix the identified vulnerability'
}

/**
 * Batch audit multiple contracts
 */
export async function batchAudit(contracts: string[]): Promise<Map<string, AuditResult>> {
  console.log(`[Auditor] Starting batch audit for ${contracts.length} contracts`)
  
  const results = new Map<string, AuditResult>()
  
  // Run audits in parallel with concurrency limit
  const batchSize = 3
  for (let i = 0; i < contracts.length; i += batchSize) {
    const batch = contracts.slice(i, i + batchSize)
    const audits = await Promise.all(
      batch.map(contract => auditContract(contract))
    )
    
    batch.forEach((contract, index) => {
      results.set(contract, audits[index])
    })
  }
  
  return results
}

/**
 * Monitor contracts for changes and re-audit
 */
export async function monitorContract(
  contractAddress: string,
  callback: (result: AuditResult) => void
): Promise<() => void> {
  console.log(`[Auditor] Starting monitoring for contract: ${contractAddress}`)
  
  let previousDataHash = ''
  
  const checkInterval = setInterval(async () => {
    try {
      const pubkey = new PublicKey(contractAddress)
      const accountInfo = await connection.getAccountInfo(pubkey)
      
      if (accountInfo) {
        // Simple hash to detect changes
        const dataHash = accountInfo.data.slice(0, 100).toString('hex')
        
        if (dataHash !== previousDataHash) {
          console.log(`[Auditor] Contract changed, re-auditing`)
          previousDataHash = dataHash
          
          const result = await auditContract(contractAddress)
          callback(result)
        }
      }
    } catch (error) {
      console.error(`[Auditor] Monitoring error:`, error)
    }
  }, 60000) // Check every minute
  
  // Return cleanup function
  return () => clearInterval(checkInterval)
}