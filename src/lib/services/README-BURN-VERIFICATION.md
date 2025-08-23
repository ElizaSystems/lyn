# LYN Token Burn Verification System

This document describes the comprehensive on-chain burn verification system implemented for the LYN token.

## Overview

The burn verification system provides real-time monitoring and verification of LYN token burn transactions on the Solana blockchain. It includes:

- Real-time blockchain monitoring
- Transaction signature verification
- Automated burn discovery and recording
- Background job processing
- Comprehensive APIs for querying verified burns
- Error handling and retry logic for network issues

## Architecture

### Core Services

#### 1. SolanaConfigService (`solana-config.ts`)
- Manages Solana RPC configuration
- Provides connection pooling and retry settings
- Handles token mint and burn address configuration

#### 2. SolanaVerificationService (`solana-verification.ts`)
- Verifies individual transaction signatures
- Extracts burn details from blockchain transactions
- Monitors burn addresses for new transactions
- Handles RPC rate limiting and network failures

#### 3. BurnMonitorService (`burn-monitor.ts`)
- Continuously monitors for new burn transactions
- Manages pending burn verifications
- Stores verified burns in MongoDB
- Provides monitoring statistics and health checks

#### 4. BurnJobService (`burn-job-service.ts`)
- Executes scheduled burn verification jobs
- Handles batch processing of pending verifications
- Manages cleanup of old records
- Provides job execution statistics

#### 5. JobSchedulerService (`job-scheduler.ts`)
- Generic job scheduling framework
- Manages cron-like job execution
- Logs job results and failures
- Provides job management APIs

## API Endpoints

### Burn Verification
- `POST /api/burn/verify` - Submit a transaction for verification
- `GET /api/burn/verify?signature=<sig>` - Check verification status

### Monitoring
- `GET /api/burn/monitoring` - Get monitoring statistics
- `POST /api/burn/monitoring` - Trigger manual monitoring actions

### Querying Verified Burns
- `GET /api/burn/verified` - Query verified burns with filters
- `POST /api/burn/verified` - Bulk query multiple signatures

### Cron Jobs
- `GET /api/cron/burn-verification` - Execute scheduled jobs
- `POST /api/cron/burn-verification` - Manual job control

## Database Schema

### Burns Collection
```typescript
interface BurnRecord {
  _id?: ObjectId
  walletAddress: string
  username?: string
  userId?: ObjectId | string
  amount: number
  type: 'username_registration' | 'feature_unlock' | 'community_event' | 'manual' | 'other'
  transactionSignature: string
  description?: string
  metadata?: {
    blockTime?: string
    slot?: number
    confirmations?: number
    fee?: number
    burnAddress?: string
    tokenMint?: string
    verifiedAt?: string
    manual?: boolean
  }
  timestamp: Date
  blockHeight?: number
  verified: boolean
  verificationStatus?: 'pending' | 'verified' | 'failed'
  verificationAttempts?: number
  lastVerificationAttempt?: Date
  onChainAmount?: number
}
```

### Pending Verifications Collection
```typescript
interface PendingBurnVerification {
  _id?: ObjectId
  transactionSignature: string
  walletAddress: string
  expectedAmount?: number
  retryCount: number
  lastAttempt: Date
  status: 'pending' | 'verifying' | 'verified' | 'failed'
  error?: string
  createdAt: Date
  updatedAt: Date
}
```

### Scheduled Jobs Collection
```typescript
interface ScheduledJob {
  _id?: ObjectId
  name: string
  type: 'burn_monitor' | 'burn_verification' | 'cleanup'
  schedule: string // cron expression
  enabled: boolean
  lastRun?: Date
  nextRun: Date
  runCount: number
  failureCount: number
  lastError?: string
  config?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

## Configuration

### Environment Variables

Required:
- `NEXT_PUBLIC_SOLANA_RPC` - Public Solana RPC endpoint
- `SOLANA_PRIVATE_RPC` - Private/paid RPC endpoint for better performance
- `NEXT_PUBLIC_TOKEN_MINT_ADDRESS` - LYN token mint address
- `BURN_ADDRESS` - Address where tokens are burned

Optional:
- `SOLANA_MAX_RETRIES` (default: 3) - Max retry attempts for RPC calls
- `SOLANA_RETRY_DELAY_MS` (default: 1000) - Delay between retries
- `SOLANA_REQUEST_TIMEOUT_MS` (default: 30000) - Request timeout
- `CRON_SECRET` - Secret for authenticating cron jobs

### Job Schedule

Default scheduled jobs:
- **Burn Monitor**: Every 5 minutes - Scans for new burns and verifies pending ones
- **Burn Verification**: Every 10 minutes - Batch verifies unverified burns
- **Cleanup**: Every hour - Removes old pending verifications and job logs

## Usage Examples

### Submit a Burn for Verification
```typescript
const response = await fetch('/api/burn/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionSignature: '5J...',
    walletAddress: 'ABC123...',
    expectedAmount: 1000
  })
})

const result = await response.json()
if (result.success && result.verified) {
  console.log('Burn verified:', result.burnRecord)
}
```

### Query Verified Burns
```typescript
const response = await fetch('/api/burn/verified?wallet=ABC123&verified=true&limit=50')
const { burns, pagination, summary } = await response.json()
```

### Trigger Manual Monitoring
```typescript
await fetch('/api/burn/monitoring', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'scan' })
})
```

### Check Monitoring Status
```typescript
const response = await fetch('/api/burn/monitoring?detailed=true')
const { stats } = await response.json()
console.log('Monitoring status:', stats)
```

## Error Handling

The system includes comprehensive error handling:

1. **RPC Failures**: Automatic retry with exponential backoff
2. **Network Issues**: Connection health checks and fallback mechanisms  
3. **Transaction Not Found**: Marks as pending for later retry
4. **Invalid Signatures**: Immediate rejection with clear error messages
5. **Database Errors**: Transaction rollback and error logging

## Monitoring and Observability

### Metrics Available
- Total verified burns
- Pending verifications count
- Failed verification count
- RPC call success rates
- Job execution statistics
- System health checks

### Logging
All operations are logged with structured data including:
- Transaction signatures
- Wallet addresses
- Amounts verified
- Error details
- Performance metrics

## Security Considerations

1. **RPC Endpoint Security**: Uses private RPC endpoints for sensitive operations
2. **Input Validation**: All transaction signatures and addresses are validated
3. **Rate Limiting**: Built-in rate limiting to prevent abuse
4. **Cron Security**: Cron endpoints require authentication tokens
5. **Data Integrity**: Cross-references on-chain data with database records

## Performance Optimizations

1. **Batch Processing**: Processes multiple verifications concurrently
2. **Caching**: Caches frequently accessed blockchain data
3. **Connection Pooling**: Reuses Solana RPC connections
4. **Selective Monitoring**: Only monitors relevant addresses
5. **Background Processing**: Non-blocking verification jobs

## Deployment

### Production Checklist
- [ ] Set up private Solana RPC endpoint
- [ ] Configure MongoDB with appropriate indexes
- [ ] Set up cron job scheduling (every 5 minutes)
- [ ] Configure monitoring and alerting
- [ ] Set secure environment variables
- [ ] Test burn verification with real transactions

### Monitoring Setup
Set up alerts for:
- Failed job executions
- High pending verification counts
- RPC endpoint failures
- Database connection issues

## Troubleshooting

### Common Issues

**Verifications Failing**
- Check RPC endpoint health
- Verify token mint address is correct
- Ensure burn address is properly configured

**Jobs Not Running**
- Check cron job authentication
- Verify MongoDB connection
- Check job enable/disable status

**Slow Performance**
- Upgrade to premium RPC endpoint
- Adjust batch sizes
- Check database indexes

### Debug Endpoints
- `GET /api/burn/monitoring?detailed=true` - Detailed monitoring stats
- `POST /api/cron/burn-verification` with `{"action": "test_connection"}` - Test RPC connection
- `POST /api/cron/burn-verification` with `{"action": "status"}` - Job status

This system provides a robust, scalable solution for verifying LYN token burns with high reliability and comprehensive monitoring capabilities.