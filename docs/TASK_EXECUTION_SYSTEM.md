# Enhanced Task Execution System

The LYN Security Platform now features a comprehensive, enterprise-grade automated task execution system designed to handle complex security monitoring, threat detection, and portfolio management workflows.

## 🚀 Key Features

### Advanced Scheduling
- **Cron Expression Support**: Full cron expression support for precise scheduling
- **Frequency-Based Scheduling**: Simple frequency strings like "Every 5 minutes"
- **Real-time Execution**: Continuous monitoring capabilities
- **Time Zone Support**: UTC-based scheduling with timezone awareness

### Task Dependencies & Chains
- **Dependency Conditions**: Tasks can depend on success, failure, or completion of other tasks
- **Execution Delays**: Configurable delays between dependent task executions
- **Chain Execution**: Automatic triggering of dependent tasks
- **Custom Conditions**: Extensible custom dependency logic

### Performance & Scalability
- **Parallel Execution**: Configurable parallel task processing
- **Result Caching**: Intelligent caching to avoid redundant work
- **Memory Management**: In-memory + database caching layers
- **Load Balancing**: Chunked batch processing for large task sets

### Retry & Error Handling
- **Exponential Backoff**: Configurable retry strategies
- **Error Classification**: Network, timeout, rate-limit specific retries
- **Maximum Retry Limits**: Prevent infinite retry loops
- **Failure Analysis**: Detailed error tracking and categorization

### Templates & Quick Setup
- **Built-in Templates**: Pre-configured templates for common scenarios
- **Custom Templates**: Create and share custom task templates
- **Guided Configuration**: Step-by-step task creation with validation
- **Template Library**: Categorized templates for different use cases

### Analytics & Monitoring
- **Execution Metrics**: Detailed performance and success rate tracking
- **Daily Analytics**: Aggregated daily statistics
- **Performance Trends**: Historical performance analysis
- **Error Analytics**: Top errors and failure pattern analysis
- **System Health**: Real-time system monitoring

## 📋 Supported Task Types

### Security Tasks
- **security-scan**: Comprehensive security scanning for URLs, wallets, and contracts
- **threat-hunter**: Active threat intelligence gathering across multiple sources
- **smart-contract-audit**: Automated smart contract vulnerability detection
- **wallet-monitor**: Real-time wallet activity and transaction monitoring

### Financial Tasks
- **price-alert**: Token price monitoring with customizable thresholds
- **portfolio-tracker**: Portfolio value and performance tracking
- **defi-monitor**: DeFi protocol monitoring for yields and risks

### Asset Tracking
- **nft-tracker**: NFT collection floor price and volume monitoring
- **governance-monitor**: DAO governance proposal and voting tracking

## 🔧 API Endpoints

### Core Task Management
```
GET    /api/tasks                    # List user tasks
POST   /api/tasks                    # Create, update, delete tasks
POST   /api/tasks (action: execute)  # Execute task immediately
POST   /api/tasks (action: history)  # Get execution history
POST   /api/tasks (action: analytics) # Get task analytics
```

### Template Management
```
GET    /api/tasks/templates          # List available templates
POST   /api/tasks/templates          # Create custom templates
POST   /api/tasks/templates (action: create-task-from-template) # Create task from template
```

### Cron & Scheduling
```
GET    /api/cron/tasks              # Execute due tasks (cron endpoint)
POST   /api/cron/tasks              # Manual execution with options
```

### Advanced Operations
```
POST   /api/tasks (action: batch-execute)     # Execute multiple tasks
POST   /api/tasks (action: schedule-cron)     # Schedule cron job
POST   /api/tasks (action: system-health)     # System health check
POST   /api/tasks (action: cleanup)           # Cleanup old data
```

## 📊 Task Configuration Schema

### Basic Task Structure
```typescript
interface Task {
  name: string
  description: string
  type: TaskType
  frequency?: string            // "Every 5 minutes", "Daily", etc.
  cronExpression?: string       // "0 */5 * * * *" for every 5 minutes
  priority: 'low' | 'normal' | 'high' | 'critical'
  status: 'active' | 'paused' | 'scheduled'
  config: TaskConfig           // Type-specific configuration
  dependencies?: TaskDependency[]
  retryConfig?: TaskRetryConfig
}
```

### Dependency Configuration
```typescript
interface TaskDependency {
  taskId: string
  condition: 'success' | 'failure' | 'completion' | 'custom'
  delay?: number              // Milliseconds to wait after dependency
}
```

### Retry Configuration
```typescript
interface TaskRetryConfig {
  maxRetries: number
  initialDelay: number        // Initial delay in milliseconds
  maxDelay: number           // Maximum delay in milliseconds
  backoffMultiplier: number  // Exponential backoff multiplier
  retryConditions?: ('network_error' | 'timeout' | 'rate_limit' | 'temporary_failure')[]
}
```

## 🎯 Usage Examples

### 1. Price Alert with Dependencies
```javascript
// Create a price monitoring task
const priceTask = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create',
    name: 'LYN Price Monitor',
    type: 'price-alert',
    frequency: 'Every 5 minutes',
    priority: 'normal',
    config: {
      tokenSymbol: 'LYN',
      tokenMint: process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS,
      priceThreshold: {
        above: 0.05,
        below: 0.03,
        percentChange: 10
      }
    },
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    }
  })
})

// Create a dependent notification task
const notificationTask = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create',
    name: 'Price Alert Notification',
    type: 'security-scan', // Custom notification task
    dependencies: [{
      taskId: priceTask.id,
      condition: 'success',
      delay: 5000 // Wait 5 seconds after price check
    }]
  })
})
```

### 2. Using Templates
```javascript
// Get available templates
const templates = await fetch('/api/tasks/templates?category=Security')
const { templates: securityTemplates } = await templates.json()

// Create task from template
const result = await fetch('/api/tasks/templates', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create-task-from-template',
    templateId: 'wallet-security-monitor-template',
    taskName: 'My Wallet Monitor',
    config: {
      walletAddress: 'EPCzpDDs4dNJvBEmJ1pvBN4tfCVNxZqJ7sTcHcepHdKT',
      alertOnTransaction: true,
      minTransactionAmount: 0.5
    },
    frequency: 'Every 30 minutes',
    priority: 'high'
  })
})
```

### 3. Cron Expression Scheduling
```javascript
// Schedule task with cron expression
const cronTask = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create',
    name: 'Daily Security Audit',
    type: 'smart-contract-audit',
    cronExpression: '0 0 9 * * *', // Every day at 9 AM UTC
    config: {
      contractAddresses: ['contract1', 'contract2']
    }
  })
})
```

### 4. Batch Operations
```javascript
// Execute multiple tasks in parallel
const batchResult = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    action: 'batch-execute',
    taskIds: ['task1', 'task2', 'task3'],
    maxParallel: 2
  })
})
```

## 📈 Analytics & Monitoring

### Task Analytics
```javascript
// Get comprehensive task analytics
const analytics = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    action: 'analytics',
    id: taskId,
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  })
})

const { analytics: data } = await analytics.json()
/*
Returns:
{
  summary: {
    totalExecutions: 150,
    successRate: 98.5,
    averageExecutionTime: 2500,
    totalRetries: 5,
    cacheHitRate: 65.2
  },
  daily: [...], // Daily analytics
  topErrors: [...], // Most common errors
  performanceTrends: [...] // Performance over time
}
*/
```

### System Health
```javascript
// Check system health
const health = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    action: 'system-health'
  })
})

const { health: systemHealth } = await health.json()
/*
Returns:
{
  activeJobs: 15,
  runningTasks: 3,
  cacheSize: 247,
  pendingTasks: 8,
  systemLoad: {
    memoryUsage: {...},
    uptime: 86400
  }
}
*/
```

## 🛠️ Built-in Templates

### Security Templates
- **Basic Website Security Scan**: Comprehensive vulnerability scanning
- **Smart Contract Security Audit**: Automated contract analysis
- **Wallet Security Monitor**: Suspicious activity detection
- **Comprehensive Threat Hunter**: Multi-source threat intelligence

### Price & Portfolio Templates
- **LYN Token Price Alert**: Pre-configured for LYN token
- **Custom Token Price Alert**: For any Solana token
- **Solana Portfolio Tracker**: Multi-token portfolio monitoring

### DeFi & NFT Templates
- **DeFi Protocol Monitor**: Yield and risk monitoring
- **Solana NFT Collection Tracker**: Floor price and volume tracking
- **DAO Governance Monitor**: Proposal and voting tracking

## ⚡ Performance Features

### Caching Strategy
- **Memory Cache**: Fast in-memory results for recent executions
- **Database Cache**: Persistent cache with TTL and hit tracking
- **Smart Invalidation**: Automatic cache invalidation based on content changes
- **Cache Analytics**: Hit rates and performance metrics

### Parallel Processing
- **Configurable Concurrency**: Set maximum parallel executions
- **Chunked Processing**: Large task sets processed in manageable chunks
- **Resource Management**: Prevent system overload
- **Batch Tracking**: Monitor batch execution progress

### Error Recovery
- **Automatic Retries**: Configurable retry strategies
- **Error Classification**: Different retry logic for different error types
- **Circuit Breakers**: Prevent cascade failures
- **Graceful Degradation**: Continue execution even with partial failures

## 🔧 Maintenance & Cleanup

### Automated Cleanup
```javascript
// Run cleanup operations
await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    action: 'cleanup',
    cleanupCache: true,
    cleanupExecutions: true,
    cleanupAnalytics: true,
    daysToKeep: 90 // Keep 90 days of execution history
  })
})
```

### Manual Operations
- **Cache Management**: Clear expired cache entries
- **Execution History**: Remove old execution records
- **Analytics Cleanup**: Archive old analytics data
- **System Optimization**: Memory and storage optimization

## 🚦 Production Deployment

### Environment Variables
```bash
# Cron job security
CRON_SECRET=your-secure-cron-secret

# Database configuration
MONGODB_URI=mongodb://localhost:27017/lyn

# Notification settings
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@lyn.security
```

### Cron Job Setup (Vercel)
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/tasks",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Monitoring Setup
- Set up alerts for failed task executions
- Monitor system health metrics
- Track cache hit rates and performance
- Set up log aggregation for error analysis

## 🔍 Troubleshooting

### Common Issues
1. **Tasks Not Executing**: Check cron job configuration and system health
2. **High Memory Usage**: Run cleanup operations and check cache sizes
3. **Slow Performance**: Review parallel execution settings and cache hit rates
4. **Failed Dependencies**: Check dependency configurations and execution order

### Debug Information
- Use execution history for detailed debugging
- Check system health for resource constraints
- Review error analytics for common failure patterns
- Monitor batch execution for performance bottlenecks

This enhanced task execution system provides enterprise-level automation capabilities while maintaining simplicity for basic use cases. The system is designed to scale with your security monitoring needs and provides comprehensive observability for production deployments.