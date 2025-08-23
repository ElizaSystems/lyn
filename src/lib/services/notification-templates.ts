import { NotificationService, NotificationTemplate, NotificationEventType, NotificationChannel } from './notification-service'

// Default notification templates
export const defaultTemplates: Omit<NotificationTemplate, '_id' | 'createdAt' | 'updatedAt'>[] = [
  // Task Completed Templates
  {
    name: 'Task Completed - Email',
    eventType: 'task-completed',
    channel: 'email',
    subject: 'LYN Security: Task "{{taskName}}" Completed Successfully',
    content: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Task Completed Successfully</h1>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
            <h2 style="color: #28a745; margin-top: 0;">✅ {{taskName}}</h2>
            <p><strong>Description:</strong> {{taskDescription}}</p>
            <p><strong>Execution Time:</strong> {{executionTime}}</p>
            <p><strong>Success Rate:</strong> {{successRate}}%</p>
            {{#if result}}
            <div style="background: white; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #28a745;">Results:</h3>
              <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto;">{{result}}</pre>
            </div>
            {{/if}}
            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px;">
              This is an automated notification from LYN Security Platform.<br>
              Manage your notification preferences in your <a href="{{dashboardUrl}}" style="color: #667eea;">dashboard</a>.
            </p>
          </div>
        </body>
      </html>
    `,
    variables: ['taskName', 'taskDescription', 'executionTime', 'successRate', 'result', 'dashboardUrl'],
    isActive: true,
  },

  {
    name: 'Task Completed - Webhook',
    eventType: 'task-completed',
    channel: 'webhook',
    content: `{
  "event": "task_completed",
  "task": {
    "name": "{{taskName}}",
    "description": "{{taskDescription}}",
    "execution_time": "{{executionTime}}",
    "success_rate": "{{successRate}}",
    "result": {{result}}
  },
  "user_id": "{{userId}}",
  "timestamp": "{{timestamp}}"
}`,
    variables: ['taskName', 'taskDescription', 'executionTime', 'successRate', 'result', 'userId', 'timestamp'],
    isActive: true,
  },

  {
    name: 'Task Completed - In-App',
    eventType: 'task-completed',
    channel: 'in-app',
    content: 'Task "{{taskName}}" completed successfully with {{successRate}}% success rate. Results: {{result}}',
    variables: ['taskName', 'successRate', 'result'],
    isActive: true,
  },

  // Task Failed Templates
  {
    name: 'Task Failed - Email',
    eventType: 'task-failed',
    channel: 'email',
    subject: 'LYN Security: Task "{{taskName}}" Failed',
    content: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #bd2130 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Task Execution Failed</h1>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
            <h2 style="color: #dc3545; margin-top: 0;">❌ {{taskName}}</h2>
            <p><strong>Description:</strong> {{taskDescription}}</p>
            <p><strong>Failed At:</strong> {{failureTime}}</p>
            <p><strong>Success Rate:</strong> {{successRate}}%</p>
            {{#if error}}
            <div style="background: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #dc3545;">Error Details:</h3>
              <pre style="background: white; padding: 10px; border-radius: 4px; overflow-x: auto;">{{error}}</pre>
            </div>
            {{/if}}
            <p style="margin-top: 20px;">
              <strong>Next Steps:</strong><br>
              • Check your task configuration<br>
              • Review the error details above<br>
              • Update task settings if needed<br>
              • Contact support if the issue persists
            </p>
            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px;">
              This is an automated notification from LYN Security Platform.<br>
              Manage your notification preferences in your <a href="{{dashboardUrl}}" style="color: #667eea;">dashboard</a>.
            </p>
          </div>
        </body>
      </html>
    `,
    variables: ['taskName', 'taskDescription', 'failureTime', 'successRate', 'error', 'dashboardUrl'],
    isActive: true,
  },

  {
    name: 'Task Failed - Webhook',
    eventType: 'task-failed',
    channel: 'webhook',
    content: `{
  "event": "task_failed",
  "task": {
    "name": "{{taskName}}",
    "description": "{{taskDescription}}",
    "failure_time": "{{failureTime}}",
    "success_rate": "{{successRate}}",
    "error": "{{error}}"
  },
  "user_id": "{{userId}}",
  "timestamp": "{{timestamp}}"
}`,
    variables: ['taskName', 'taskDescription', 'failureTime', 'successRate', 'error', 'userId', 'timestamp'],
    isActive: true,
  },

  {
    name: 'Task Failed - In-App',
    eventType: 'task-failed',
    channel: 'in-app',
    content: 'Task "{{taskName}}" failed to execute. Error: {{error}} Please check your task configuration.',
    variables: ['taskName', 'error'],
    isActive: true,
  },

  // Security Alert Templates
  {
    name: 'Security Alert - Email',
    eventType: 'security-alert',
    channel: 'email',
    subject: 'LYN Security: {{alertType}} Alert - {{severity}}',
    content: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #fd7e14 0%, #dc3545 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🚨 Security Alert</h1>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
            <h2 style="color: #dc3545; margin-top: 0;">{{alertType}} - {{severity}}</h2>
            <p><strong>Target:</strong> {{target}}</p>
            <p><strong>Detected At:</strong> {{detectionTime}}</p>
            <p><strong>Risk Level:</strong> <span style="color: {{severityColor}}; font-weight: bold;">{{severity}}</span></p>
            
            <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #856404;">Detected Threats:</h3>
              <div>{{threatsList}}</div>
            </div>

            <div style="background: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #155724;">Recommendations:</h3>
              <div>{{recommendationsList}}</div>
            </div>

            <div style="background: #e2e3e5; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Immediate Actions:</h3>
              <p>1. Review the security scan results in detail<br>
              2. Implement recommended security measures<br>
              3. Monitor the target for additional threats<br>
              4. Consider restricting access if necessary</p>
            </div>

            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px;">
              This is an automated security notification from LYN Security Platform.<br>
              View detailed results in your <a href="{{securityDashboardUrl}}" style="color: #667eea;">security dashboard</a>.
            </p>
          </div>
        </body>
      </html>
    `,
    variables: ['alertType', 'severity', 'severityColor', 'target', 'detectionTime', 'threatsList', 'recommendationsList', 'securityDashboardUrl'],
    isActive: true,
  },

  {
    name: 'Security Alert - Webhook',
    eventType: 'security-alert',
    channel: 'webhook',
    content: `{
  "event": "security_alert",
  "alert": {
    "type": "{{alertType}}",
    "severity": "{{severity}}",
    "target": "{{target}}",
    "detection_time": "{{detectionTime}}",
    "threats": "{{threatsJson}}",
    "recommendations": "{{recommendationsJson}}",
    "score": "{{score}}"
  },
  "user_id": "{{userId}}",
  "timestamp": "{{timestamp}}"
}`,
    variables: ['alertType', 'severity', 'target', 'detectionTime', 'threatsJson', 'recommendationsJson', 'score', 'userId', 'timestamp'],
    isActive: true,
  },

  {
    name: 'Security Alert - In-App',
    eventType: 'security-alert',
    channel: 'in-app',
    content: '{{alertType}} security alert detected for {{target}}. Risk level: {{severity}}. Threats: {{threatsList}}',
    variables: ['alertType', 'target', 'severity', 'threatsList'],
    isActive: true,
  },

  // Price Alert Templates
  {
    name: 'Price Alert - Email',
    eventType: 'price-alert',
    channel: 'email',
    subject: 'LYN Security: Price Alert for {{tokenSymbol}}',
    content: [
      '<html>',
      '  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">',
      '    <div style="background: linear-gradient(135deg, #20c997 0%, #0056b3 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">',
      '      <h1 style="margin: 0; font-size: 24px;">📈 Price Alert</h1>',
      '    </div>',
      '    <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">',
      '      <h2 style="color: {{changeColor}}; margin-top: 0;">',
      '        {{tokenSymbol}} Price Alert',
      '      </h2>',
      '      <div style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0;">',
      '        <div style="text-align: center; flex: 1;">',
      '          <h3 style="margin: 0; font-size: 28px; color: #0056b3;">' + '${{currentPrice}}</h3>',
      '          <p style="margin: 5px 0; color: #6c757d;">Current Price</p>',
      '        </div>',
      '        <div style="text-align: center; flex: 1;">',
      '          <h3 style="margin: 0; font-size: 24px; color: {{changeColor}};">',
      '            {{changeSign}}{{changePercent}}%',
      '          </h3>',
      '          <p style="margin: 5px 0; color: #6c757d;">24h Change</p>',
      '        </div>',
      '      </div>',
      '      ',
      '      <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">',
      '        <p><strong>Alert Condition:</strong> {{alertCondition}}</p>',
      '        <p><strong>Previous Price:</strong> ' + '${{previousPrice}}</p>',
      '        <p><strong>Price Change:</strong> ' + '${{priceChange}}</p>',
      '        <p><strong>Volume (24h):</strong> {{volume24h}}</p>',
      '        <p><strong>Market Cap:</strong> {{marketCap}}</p>',
      '      </div>',
      '',
      '      <hr style="border: 1px solid #e9ecef; margin: 20px 0;">',
      '      <p style="color: #6c757d; font-size: 12px;">',
      '        This is an automated price notification from LYN Security Platform.<br>',
      '        View detailed charts in your <a href="{{portfolioUrl}}" style="color: #667eea;">portfolio dashboard</a>.',
      '      </p>',
      '    </div>',
      '  </body>',
      '</html>'
    ].join('\n'),
    variables: ['tokenSymbol', 'currentPrice', 'changePercent', 'changeColor', 'changeSign', 'alertCondition', 'previousPrice', 'priceChange', 'volume24h', 'marketCap', 'portfolioUrl'],
    isActive: true,
  },

  {
    name: 'Price Alert - Webhook',
    eventType: 'price-alert',
    channel: 'webhook',
    content: `{
  "event": "price_alert",
  "token": {
    "symbol": "{{tokenSymbol}}",
    "current_price": "{{currentPrice}}",
    "previous_price": "{{previousPrice}}",
    "change_percent": "{{changePercent}}",
    "price_change": "{{priceChange}}",
    "volume_24h": "{{volume24h}}",
    "market_cap": "{{marketCap}}"
  },
  "alert_condition": "{{alertCondition}}",
  "user_id": "{{userId}}",
  "timestamp": "{{timestamp}}"
}`,
    variables: ['tokenSymbol', 'currentPrice', 'previousPrice', 'changePercent', 'priceChange', 'volume24h', 'marketCap', 'alertCondition', 'userId', 'timestamp'],
    isActive: true,
  },

  {
    name: 'Price Alert - In-App',
    eventType: 'price-alert',
    channel: 'in-app',
    content: '{{tokenSymbol}} price alert: ' + '${{currentPrice}} ({{changeSign}}{{changePercent}}%). Condition: {{alertCondition}}',
    variables: ['tokenSymbol', 'currentPrice', 'changePercent', 'changeSign', 'alertCondition'],
    isActive: true,
  },

  // Wallet Activity Templates
  {
    name: 'Wallet Activity - Email',
    eventType: 'wallet-activity',
    channel: 'email',
    subject: 'LYN Security: Wallet Activity Detected',
    content: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6f42c1 0%, #0056b3 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">👛 Wallet Activity</h1>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
            <h2 style="color: #6f42c1; margin-top: 0;">{{activityType}} Transaction</h2>
            
            <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p><strong>Wallet:</strong> <code style="background: #f8f9fa; padding: 2px 4px;">{{walletAddress}}</code></p>
              <p><strong>Transaction:</strong> <code style="background: #f8f9fa; padding: 2px 4px;">{{transactionHash}}</code></p>
              <p><strong>Amount:</strong> {{amount}} {{tokenSymbol}}</p>
              <p><strong>Timestamp:</strong> {{timestamp}}</p>
              {{#if from}}
              <p><strong>From:</strong> <code style="background: #f8f9fa; padding: 2px 4px;">{{from}}</code></p>
              {{/if}}
              {{#if to}}
              <p><strong>To:</strong> <code style="background: #f8f9fa; padding: 2px 4px;">{{to}}</code></p>
              {{/if}}
            </div>

            {{#if riskLevel}}
            <div style="background: {{#if (eq riskLevel 'high')}}#f8d7da{{else}}{{#if (eq riskLevel 'medium')}}#fff3cd{{else}}#d4edda{{/if}}{{/if}}; padding: 15px; border-left: 4px solid {{#if (eq riskLevel 'high')}}#dc3545{{else}}{{#if (eq riskLevel 'medium')}}#ffc107{{else}}#28a745{{/if}}{{/if}}; margin: 15px 0;">
              <h3 style="margin-top: 0; color: {{#if (eq riskLevel 'high')}}#721c24{{else}}{{#if (eq riskLevel 'medium')}}#856404{{else}}#155724{{/if}}{{/if}};">Risk Assessment: {{riskLevel}}</h3>
              {{#if riskDetails}}
              <p>{{riskDetails}}</p>
              {{/if}}
            </div>
            {{/if}}

            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px;">
              This is an automated wallet monitoring notification from LYN Security Platform.<br>
              View transaction details in your <a href="{{walletDashboardUrl}}" style="color: #667eea;">wallet dashboard</a>.
            </p>
          </div>
        </body>
      </html>
    `,
    variables: ['activityType', 'walletAddress', 'transactionHash', 'amount', 'tokenSymbol', 'timestamp', 'from', 'to', 'riskLevel', 'riskDetails', 'walletDashboardUrl'],
    isActive: true,
  },

  {
    name: 'Wallet Activity - Webhook',
    eventType: 'wallet-activity',
    channel: 'webhook',
    content: `{
  "event": "wallet_activity",
  "transaction": {
    "type": "{{activityType}}",
    "wallet_address": "{{walletAddress}}",
    "transaction_hash": "{{transactionHash}}",
    "amount": "{{amount}}",
    "token_symbol": "{{tokenSymbol}}",
    "from": "{{from}}",
    "to": "{{to}}",
    "risk_level": "{{riskLevel}}",
    "risk_details": "{{riskDetails}}"
  },
  "user_id": "{{userId}}",
  "timestamp": "{{timestamp}}"
}`,
    variables: ['activityType', 'walletAddress', 'transactionHash', 'amount', 'tokenSymbol', 'from', 'to', 'riskLevel', 'riskDetails', 'userId', 'timestamp'],
    isActive: true,
  },

  {
    name: 'Wallet Activity - In-App',
    eventType: 'wallet-activity',
    channel: 'in-app',
    content: '{{activityType}} transaction detected: {{amount}} {{tokenSymbol}} (Risk: {{riskLevel}})',
    variables: ['activityType', 'amount', 'tokenSymbol', 'riskLevel'],
    isActive: true,
  },

  // System Alert Templates
  {
    name: 'System Alert - Email',
    eventType: 'system-alert',
    channel: 'email',
    subject: 'LYN Security: System Alert - {{alertType}}',
    content: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #17a2b8 0%, #0056b3 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ System Alert</h1>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
            <h2 style="color: #17a2b8; margin-top: 0;">{{alertType}}</h2>
            <p><strong>Severity:</strong> {{severity}}</p>
            <p><strong>Detected At:</strong> {{detectionTime}}</p>
            
            <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <h3 style="margin-top: 0;">Description:</h3>
              <p>{{description}}</p>
            </div>

            {{#if affectedServices}}
            <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #856404;">Affected Services:</h3>
              <ul>
                {{#each affectedServices}}
                <li>{{this}}</li>
                {{/each}}
              </ul>
            </div>
            {{/if}}

            {{#if actions}}
            <div style="background: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #155724;">Actions Taken:</h3>
              <ul>
                {{#each actions}}
                <li>{{this}}</li>
                {{/each}}
              </ul>
            </div>
            {{/if}}

            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px;">
              This is an automated system notification from LYN Security Platform.<br>
              Check system status at <a href="{{statusPageUrl}}" style="color: #667eea;">{{statusPageUrl}}</a>.
            </p>
          </div>
        </body>
      </html>
    `,
    variables: ['alertType', 'severity', 'detectionTime', 'description', 'affectedServices', 'actions', 'statusPageUrl'],
    isActive: true,
  },

  {
    name: 'System Alert - Webhook',
    eventType: 'system-alert',
    channel: 'webhook',
    content: `{
  "event": "system_alert",
  "alert": {
    "type": "{{alertType}}",
    "severity": "{{severity}}",
    "detection_time": "{{detectionTime}}",
    "description": "{{description}}",
    "affected_services": "{{affectedServicesJson}}",
    "actions": "{{actionsJson}}"
  },
  "timestamp": "{{timestamp}}"
}`,
    variables: ['alertType', 'severity', 'detectionTime', 'description', 'affectedServicesJson', 'actionsJson', 'timestamp'],
    isActive: true,
  },

  {
    name: 'System Alert - In-App',
    eventType: 'system-alert',
    channel: 'in-app',
    content: 'System alert: {{alertType}} ({{severity}}). {{description}}',
    variables: ['alertType', 'severity', 'description'],
    isActive: true,
  },

  // Account Activity Templates
  {
    name: 'Account Activity - Email',
    eventType: 'account-activity',
    channel: 'email',
    subject: 'LYN Security: Account Activity - {{activityType}}',
    content: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #e83e8c 0%, #6f42c1 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">👤 Account Activity</h1>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
            <h2 style="color: #e83e8c; margin-top: 0;">{{activityType}}</h2>
            
            <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p><strong>Activity:</strong> {{activityDescription}}</p>
              <p><strong>Time:</strong> {{timestamp}}</p>
              <p><strong>IP Address:</strong> {{ipAddress}}</p>
              <p><strong>User Agent:</strong> {{userAgent}}</p>
              {{#if location}}
              <p><strong>Location:</strong> {{location}}</p>
              {{/if}}
            </div>

            {{#if requiresAction}}
            <div style="background: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #721c24;">Action Required</h3>
              <p>{{actionRequired}}</p>
            </div>
            {{/if}}

            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px;">
              This is an automated account security notification from LYN Security Platform.<br>
              If you did not perform this action, please <a href="{{securityUrl}}" style="color: #667eea;">secure your account</a> immediately.
            </p>
          </div>
        </body>
      </html>
    `,
    variables: ['activityType', 'activityDescription', 'timestamp', 'ipAddress', 'userAgent', 'location', 'requiresAction', 'actionRequired', 'securityUrl'],
    isActive: true,
  },

  {
    name: 'Account Activity - Webhook',
    eventType: 'account-activity',
    channel: 'webhook',
    content: `{
  "event": "account_activity",
  "activity": {
    "type": "{{activityType}}",
    "description": "{{activityDescription}}",
    "ip_address": "{{ipAddress}}",
    "user_agent": "{{userAgent}}",
    "location": "{{location}}",
    "requires_action": "{{requiresAction}}"
  },
  "user_id": "{{userId}}",
  "timestamp": "{{timestamp}}"
}`,
    variables: ['activityType', 'activityDescription', 'ipAddress', 'userAgent', 'location', 'requiresAction', 'userId', 'timestamp'],
    isActive: true,
  },

  {
    name: 'Account Activity - In-App',
    eventType: 'account-activity',
    channel: 'in-app',
    content: 'Account activity: {{activityType}} from {{ipAddress}}{{actionSuffix}}',
    variables: ['activityType', 'ipAddress', 'actionSuffix'],
    isActive: true,
  },
]

// Template initialization service
export class NotificationTemplateService {
  /**
   * Initialize all default templates in the database
   */
  static async initializeDefaultTemplates(): Promise<void> {
    console.log('Initializing notification templates...')
    
    let created = 0
    let skipped = 0
    
    for (const template of defaultTemplates) {
      try {
        // Check if template already exists
        const existing = await NotificationService.getTemplate(
          template.eventType as NotificationEventType, 
          template.channel as NotificationChannel
        )
        
        if (existing) {
          console.log(`Template already exists: ${template.name}`)
          skipped++
          continue
        }
        
        await NotificationService.createTemplate(template)
        console.log(`Created template: ${template.name}`)
        created++
      } catch (error) {
        console.error(`Failed to create template ${template.name}:`, error)
      }
    }
    
    console.log(`Template initialization complete. Created: ${created}, Skipped: ${skipped}`)
  }
  
  /**
   * Update existing templates with new content
   */
  static async updateTemplates(): Promise<void> {
    console.log('Updating notification templates...')
    
    let updated = 0
    
    for (const template of defaultTemplates) {
      try {
        const existing = await NotificationService.getTemplate(
          template.eventType as NotificationEventType,
          template.channel as NotificationChannel
        )
        
        if (existing && existing._id) {
          await NotificationService.updateTemplate(existing._id.toString(), {
            content: template.content,
            subject: template.subject,
            variables: template.variables,
            updatedAt: new Date()
          })
          console.log(`Updated template: ${template.name}`)
          updated++
        }
      } catch (error) {
        console.error(`Failed to update template ${template.name}:`, error)
      }
    }
    
    console.log(`Template update complete. Updated: ${updated}`)
  }
}