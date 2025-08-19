# Automated Tasks System

## Overview

The LYN AI platform includes a powerful automated task execution system that can run various types of tasks on schedules or in real-time. This system provides true automation for security monitoring, wallet tracking, price alerts, and simulated trading strategies.

## Features

### Task Types

1. **Security Scan** (`security-scan`)
   - Automated scanning of URLs for phishing and malware
   - Wallet security monitoring
   - Smart contract vulnerability checks
   - Configurable targets and scan intervals

2. **Wallet Monitor** (`wallet-monitor`)
   - Real-time transaction tracking
   - Balance change alerts
   - Token balance monitoring
   - Large transaction detection

3. **Price Alert** (`price-alert`)
   - Token price monitoring
   - Threshold-based alerts (above/below price points)
   - Percentage change notifications
   - Market data tracking

4. **Auto Trade** (`auto-trade`)
   - Simulated trading strategies (DCA, Grid, Arbitrage)
   - Market analysis and signals
   - Performance tracking
   - **Note:** This is simulation only, no real trades are executed

### Task Management

- **Create Tasks**: Define custom automated tasks with specific configurations
- **Schedule Execution**: Set frequencies from real-time to weekly
- **Manual Execution**: Run tasks on-demand with the "Execute Now" button
- **Pause/Resume**: Control task execution without deletion
- **Execution History**: View past execution results and performance
- **Success Metrics**: Track success rates and execution counts

## Setup Instructions

### 1. Environment Variables

Add these to your `.env.local`:

```env
# Task Executor API Key (for manual execution)
TASK_EXECUTOR_API_KEY=your-secret-api-key

# Cron Job Secret (for automated execution)
CRON_SECRET=your-cron-secret

# Optional: Notification Services
SENDGRID_API_KEY=your-sendgrid-key
DISCORD_WEBHOOK_URL=your-discord-webhook
TELEGRAM_BOT_TOKEN=your-telegram-bot
```

### 2. Database Setup

The system automatically creates these MongoDB collections:
- `tasks` - Stores task configurations
- `task_executions` - Stores execution history

### 3. Automated Execution

#### Option A: Vercel Cron Jobs (Recommended for Vercel deployments)

The `vercel.json` file is already configured to run tasks every 5 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/tasks",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Deploy to Vercel and cron jobs will automatically start.

#### Option B: External Cron Service

Use any external cron service to call:
```
GET https://your-domain.com/api/cron/tasks
Headers: Authorization: Bearer YOUR_CRON_SECRET
```

Popular services:
- [cron-job.org](https://cron-job.org) (free)
- [EasyCron](https://www.easycron.com)
- [Cronitor](https://cronitor.io)

#### Option C: GitHub Actions

Create `.github/workflows/task-runner.yml`:

```yaml
name: Run Automated Tasks
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  run-tasks:
    runs-on: ubuntu-latest
    steps:
      - name: Execute Tasks
        run: |
          curl -X GET https://your-domain.com/api/cron/tasks \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

#### Option D: Local Development

For local testing, manually trigger execution:
```bash
# Execute all due tasks
curl -X POST http://localhost:3000/api/tasks/execute

# Execute specific task
curl -X POST http://localhost:3000/api/tasks/execute \
  -H "Content-Type: application/json" \
  -d '{"taskId": "your-task-id"}'
```

## API Endpoints

### Task Management

**GET /api/tasks**
- Fetch all user tasks
- Returns task list with execution status

**POST /api/tasks**
- Actions: `create`, `update`, `delete`, `toggle`, `execute`, `history`
- Manage task lifecycle

### Task Execution

**POST /api/tasks/execute**
- Execute tasks immediately
- Optional: specify taskId for single task

**GET /api/tasks/execute**
- Get tasks due for execution
- View execution statistics

### Cron Endpoint

**GET /api/cron/tasks**
- Called by cron services
- Executes all due tasks
- Returns execution summary

## Task Configuration Examples

### Security Scan Task
```json
{
  "name": "Daily Security Scan",
  "type": "security-scan",
  "frequency": "Every 24 hours",
  "config": {
    "urls": ["https://example.com", "https://mysite.com"],
    "wallets": ["wallet-address-1", "wallet-address-2"],
    "scanInterval": 86400000
  }
}
```

### Wallet Monitor Task
```json
{
  "name": "Wallet Activity Tracker",
  "type": "wallet-monitor",
  "frequency": "Every 5 minutes",
  "config": {
    "walletAddress": "your-wallet-address",
    "trackTokens": ["SOL", "USDC"],
    "alertOnTransaction": true,
    "minTransactionAmount": 100
  }
}
```

### Price Alert Task
```json
{
  "name": "LYN Price Monitor",
  "type": "price-alert",
  "frequency": "Every 30 minutes",
  "config": {
    "tokenMint": "token-mint-address",
    "tokenSymbol": "LYN",
    "priceThreshold": {
      "above": 0.10,
      "below": 0.03,
      "percentChange": 10
    }
  }
}
```

### Auto Trade Task (Simulated)
```json
{
  "name": "DCA Strategy",
  "type": "auto-trade",
  "frequency": "Daily",
  "config": {
    "strategy": "dca",
    "amount": 100,
    "interval": "daily"
  }
}
```

## Monitoring & Debugging

### View Logs

Tasks log execution details:
```bash
# Vercel logs
vercel logs --filter="[CRON]"

# Local logs
tail -f logs/tasks.log
```

### Check Task Status

```bash
# Get due tasks
curl http://localhost:3000/api/tasks/execute

# Get task history
curl http://localhost:3000/api/tasks/execute?taskId=TASK_ID

# Get user statistics
curl http://localhost:3000/api/tasks/execute?userId=USER_ID
```

### Common Issues

1. **Tasks not executing**
   - Check if task status is "active"
   - Verify nextRun time is in the past
   - Check cron job is configured correctly

2. **High failure rate**
   - Review task configuration
   - Check API rate limits
   - Verify external service availability

3. **Performance issues**
   - Reduce task frequency
   - Optimize task configurations
   - Use batch processing for multiple targets

## Security Considerations

1. **API Keys**: Always use environment variables for sensitive data
2. **Rate Limiting**: Implement rate limits to prevent abuse
3. **Input Validation**: Validate all task configurations
4. **Error Handling**: Gracefully handle failures without exposing sensitive data
5. **Monitoring**: Set up alerts for failed executions

## Future Enhancements

- [ ] Email/Discord/Telegram notifications
- [ ] Advanced scheduling (specific times, days)
- [ ] Task dependencies and workflows
- [ ] Real trading integration (with proper risk controls)
- [ ] Custom task types via plugins
- [ ] Task result webhooks
- [ ] Performance analytics dashboard

## Support

For issues or questions about the automated tasks system, please:
1. Check the logs for error messages
2. Verify your configuration
3. Test manual execution first
4. Open an issue with details about your setup
