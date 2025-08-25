import OpenAI from 'openai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class VeniceAIService {
  private static client: OpenAI | null = null
  private static isConfigured = false

  /**
   * Initialize Venice AI client using OpenAI SDK
   */
  private static getClient(): OpenAI | null {
    if (!this.client) {
      const apiKey = process.env.VENICE_API_KEY
      if (!apiKey) {
        console.warn('[Venice AI] API key not configured - using fallback responses')
        return null
      }
      
      // Validate API key format (basic check)
      if (apiKey.length < 10 || !apiKey.startsWith('vn-')) {
        console.error('[Venice AI] Invalid API key format detected')
        return null
      }
      
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.venice.ai/api/v1',
        maxRetries: 3,
        timeout: 30000, // 30 second timeout
      })
      this.isConfigured = true
      console.log('[Venice AI] Client initialized successfully')
    }
    return this.client
  }

  /**
   * Get available models from Venice AI
   */
  static async getModels(): Promise<string[]> {
    const client = this.getClient()
    if (!client) return []
    
    try {
      const response = await client.models.list()
      return response.data.map(model => model.id)
    } catch (error) {
      console.error('[Venice AI] Failed to fetch models:', error)
      return []
    }
  }

  /**
   * Generate a response for security-related chat
   */
  static async generateSecurityResponse(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    context?: {
      hasUrlToAnalyze?: boolean
      hasFileToScan?: boolean
      previousAnalysisResult?: Record<string, unknown>
      username?: string
    }
  ): Promise<string> {
    const client = this.getClient()
    
    // If Venice AI is not configured, use enhanced contextual fallback
    if (!client) {
      return this.generateEnhancedFallbackResponse(userMessage, conversationHistory, context)
    }

    try {
      // Build the conversation with Lyn AI space agent system prompt
      const userIdentity = context?.username ? `The user's name is ${context.username}. Address them by their name when appropriate, making the conversation more personal and friendly.` : ''
      
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `I'm Lyn, your AI space agent. I specialize in cybersecurity and protecting users from online threats in the digital space. ${userIdentity} My capabilities include:

1. **Phishing Detection**: Analyzing URLs for phishing indicators using multiple threat intelligence sources (VirusTotal, Google Safe Browsing, URLVoid, IPQualityScore, PhishTank, AbuseIPDB)
2. **Malware Scanning**: Scanning documents and files for malware using antivirus engines
3. **Security Education**: Teaching users about cybersecurity best practices
4. **Threat Analysis**: Explaining security threats in clear, understandable terms

Key behaviors:
- Be helpful, friendly, and approachable like a space companion
- Use space and security metaphors when appropriate
- Explain technical concepts in simple terms
- Always prioritize user safety - err on the side of caution
- Provide actionable recommendations
- If a user shares a URL, acknowledge it and explain you'll analyze it
- If a user mentions a file, explain how to upload it for scanning

Current capabilities status:
- Real-time threat intelligence: ACTIVE
- Multiple security API integrations: ACTIVE
- File scanning up to 32MB: ACTIVE
- Response time: Near instant for URLs, 5-15 seconds for files

Remember: You have REAL security scanning capabilities through integrated APIs. You're not simulating - you're actually checking against real threat databases.`
        },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        {
          role: 'user',
          content: userMessage
        }
      ]

      // Add context if available
      if (context?.previousAnalysisResult) {
        messages.push({
          role: 'system',
          content: `Previous analysis result: ${JSON.stringify(context.previousAnalysisResult, null, 2)}`
        })
      }

      // Retry logic for resilient API calls
      let completion
      let retries = 0
      const maxRetries = 3
      
      while (retries < maxRetries) {
        try {
          completion = await client.chat.completions.create({
            model: 'llama-3.3-70b', // Venice AI's most capable model - fine-tuned model not available through Venice
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            temperature: 0.7,
            max_tokens: 500,
            presence_penalty: 0.1,
            frequency_penalty: 0.1,
            // Venice-specific parameters to maintain uncensored responses
            // @ts-expect-error Venice-specific parameter
            venice_parameters: {
              include_venice_system_prompt: false // We're using our own system prompt
            }
          })
          break // Success, exit retry loop
        } catch (retryError) {
          retries++
          if (retries >= maxRetries) {
            throw retryError // Final retry failed, throw the error
          }
          console.warn(`[Venice AI] Retry ${retries}/${maxRetries} after error:`, retryError)
          await new Promise(resolve => setTimeout(resolve, 1000 * retries)) // Exponential backoff
        }
      }

      const response = completion.choices[0]?.message?.content
      if (!response) {
        console.warn('[Venice AI] Empty response from API, using enhanced fallback')
        return this.generateEnhancedFallbackResponse(userMessage, conversationHistory, context)
      }
      
      return response
    } catch (error) {
      console.error('[Venice AI] API call failed:', error)
      // Use enhanced fallback that maintains context
      return this.generateEnhancedFallbackResponse(userMessage, conversationHistory, context)
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  static async generateEmbedding(text: string): Promise<number[] | null> {
    const client = this.getClient()
    if (!client) return null

    try {
      // Venice AI may support embeddings - check their models
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small', // May need to check Venice AI's embedding models
        input: text,
      })
      
      return response.data[0].embedding
    } catch (error) {
      console.error('[Venice AI] Embedding generation failed:', error)
      return null
    }
  }

  /**
   * Analyze sentiment and intent from user message
   */
  static async analyzeIntent(message: string): Promise<{
    intent: 'check_url' | 'scan_file' | 'ask_security' | 'general_chat'
    confidence: number
    extractedUrl?: string
    sentiment: 'positive' | 'neutral' | 'negative' | 'concerned'
  }> {
    const client = this.getClient()
    
    // Enhanced URL pattern matching - matches various URL formats
    const urlPatterns = [
      // Full URLs with protocol
      /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*(\/[^\s]*)*/gi,
      // URLs starting with www
      /www\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*(\/[^\s]*)*/gi,
      // Domain names without protocol (common domains)
      /([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.(com|org|net|edu|gov|mil|biz|info|name|museum|us|ca|uk|eu|io|xyz|app|dev|co|me|tv|link|site|online|tech|store|shop|club|fun|space|live|life|world|today|email|ai|cloud|digital))(\/[^\s]*)*/gi
    ]
    
    let urlMatch = null
    for (const pattern of urlPatterns) {
      const match = message.match(pattern)
      if (match) {
        urlMatch = match
        break
      }
    }
    
    if (urlMatch) {
      let extractedUrl = urlMatch[0]
      // Add protocol if missing
      if (!extractedUrl.startsWith('http://') && !extractedUrl.startsWith('https://')) {
        extractedUrl = 'https://' + extractedUrl
      }
      
      return {
        intent: 'check_url',
        confidence: 0.95,
        extractedUrl,
        sentiment: 'concerned'
      }
    }

    // If no Venice AI, use pattern matching
    if (!client) {
      return this.analyzeIntentFallback(message)
    }

    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b', // Venice AI model
        messages: [
          {
            role: 'system',
            content: 'You are Lyn AI. Analyze the user message and respond with ONLY one of these words: check_url, scan_file, ask_security, or general_chat. No other text.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 10
      })

      const response = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'general_chat'
      
      // Map the response to valid intents
      let intent: 'check_url' | 'scan_file' | 'ask_security' | 'general_chat' = 'general_chat'
      if (response.includes('check_url')) intent = 'check_url'
      else if (response.includes('scan_file')) intent = 'scan_file'
      else if (response.includes('ask_security')) intent = 'ask_security'
      
      return {
        intent,
        confidence: 0.85,
        sentiment: 'neutral' as const
      }
    } catch (error) {
      console.error('[Venice AI] Intent analysis failed:', error)
      return this.analyzeIntentFallback(message)
    }
  }

  /**
   * Generate security tips based on context
   */
  static async generateSecurityTip(context?: string): Promise<string> {
    const tips = [
      "💡 Security Tip: Enable two-factor authentication (2FA) on all important accounts for an extra layer of protection.",
      "🔒 Pro Tip: Use a password manager to generate and store unique, strong passwords for each account.",
      "⚠️ Stay Alert: Legitimate companies never ask for passwords or sensitive info via email or text.",
      "🛡️ Safe Browsing: Look for HTTPS (padlock icon) before entering any personal information online.",
      "📧 Email Safety: Hover over links to preview the URL before clicking - scammers often use lookalike domains.",
      "🎯 Phishing Defense: Be suspicious of urgent messages claiming your account will be closed or suspended.",
      "🔍 Quick Check: Typos and poor grammar in official-looking emails are major red flags for scams.",
      "💻 Software Updates: Keep your OS and apps updated - patches fix security vulnerabilities hackers exploit.",
      "🚨 Data Breach Response: If a service you use is breached, change that password immediately and any others like it.",
      "📱 Mobile Security: Only install apps from official stores and check permissions before accepting."
    ]

    const client = this.getClient()
    if (!client || !context) {
      return tips[Math.floor(Math.random() * tips.length)]
    }

    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b', // Venice AI model
        messages: [
          {
            role: 'system',
            content: "I'm Lyn, your AI space agent. Generate a brief, actionable security tip (max 100 characters) relevant to the context. Include an appropriate emoji at the start."
          },
          {
            role: 'user',
            content: `Context: ${context}`
          }
        ],
        temperature: 0.8,
        max_tokens: 50,
      })

      return completion.choices[0]?.message?.content || tips[Math.floor(Math.random() * tips.length)]
    } catch {
      return tips[Math.floor(Math.random() * tips.length)]
    }
  }

  /**
   * Generate a response for security challenge interactions
   */
  static async generateChallengeResponse(
    userMessage: string,
    challengeContext: {
      title: string
      scenario: string
      objectives: string[]
      hintsUsed: number
      timeSpent: number
    },
    conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    const client = this.getClient()
    
    // If Venice AI is not configured, use intelligent fallback
    if (!client) {
      return this.generateChallengeFallback(userMessage, challengeContext)
    }

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are Lyn, an expert cybersecurity instructor guiding a student through a security challenge. 

Challenge: "${challengeContext.title}"
Scenario: ${challengeContext.scenario}
Learning Objectives: ${challengeContext.objectives.join(', ')}
Progress: ${challengeContext.timeSpent} seconds elapsed, ${challengeContext.hintsUsed} hints used

Your role:
1. Guide the student through the challenge interactively
2. Ask probing questions to test understanding
3. Provide feedback on their security reasoning
4. Help them learn from mistakes without giving away answers
5. Encourage critical thinking about security implications
6. Score their understanding based on responses

Be encouraging but educational. Focus on helping them understand WHY certain security practices matter.`
        },
        ...conversationHistory.slice(-8),
        { role: 'user', content: userMessage }
      ]

      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b',
        messages,
        temperature: 0.7,
        max_tokens: 400,
      })

      return completion.choices[0]?.message?.content || this.generateChallengeFallback(userMessage, challengeContext)
    } catch (error) {
      console.error('[Venice AI] Challenge response error:', error)
      return this.generateChallengeFallback(userMessage, challengeContext)
    }
  }

  /**
   * Fallback for challenge responses
   */
  private static generateChallengeFallback(message: string, context: any): string {
    const lowerMessage = message.toLowerCase()
    
    // Provide contextual fallback based on common security keywords
    if (lowerMessage.includes('phishing') || lowerMessage.includes('email')) {
      return "Good thinking about phishing! Key indicators include: urgent language, generic greetings, suspicious sender addresses, and requests for sensitive information. How would you verify if an email is legitimate?"
    }
    
    if (lowerMessage.includes('password') || lowerMessage.includes('credential')) {
      return "Excellent point about credentials! Never share passwords over phone or email. Legitimate IT support has ways to help without needing your password. What other red flags might indicate a social engineering attempt?"
    }
    
    if (lowerMessage.includes('verify') || lowerMessage.includes('check')) {
      return "Verification is crucial! Always verify through official channels - call back using a known number, not one provided in the suspicious communication. What official channels would you use in this scenario?"
    }
    
    if (lowerMessage.includes('report') || lowerMessage.includes('incident')) {
      return "Reporting is an important step! Document everything: time, date, what was said/asked, and any contact information. This helps protect others. Who else might need to know about this incident?"
    }
    
    // Generic encouraging response
    return `Interesting approach! Let's think about this scenario: ${context.scenario.substring(0, 100)}... What security principles apply here? Consider: verification, documentation, and protecting sensitive information.`
  }

  /**
   * Enhanced fallback response with context awareness
   */
  private static generateEnhancedFallbackResponse(
    message: string,
    conversationHistory: ChatMessage[] = [],
    context?: {
      hasUrlToAnalyze?: boolean
      hasFileToScan?: boolean
      previousAnalysisResult?: Record<string, unknown>
      username?: string
    }
  ): string {
    const lowerMessage = message.toLowerCase()
    const username = context?.username
    
    // Check if message contains a URL - if so, provide analysis guidance
    const urlPatterns = [
      /https?:\/\/[^\s]+/i,
      /www\.[^\s]+/i,
      /[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.(com|org|net|edu|gov|mil|biz|info|name|museum|us|ca|uk|eu|io|xyz|app|dev|co|me|tv|link|site|online|tech|store|shop|club|fun|space|live|life|world|today|email|ai|cloud|digital)/i
    ]
    
    const hasUrl = urlPatterns.some(pattern => pattern.test(message))
    if (hasUrl) {
      const greeting = username ? `${username}, ` : ''
      return `${greeting}I've detected a URL in your message. I'm now analyzing it for potential security threats using our comprehensive threat intelligence system. This includes checking against:

• VirusTotal's database of known malicious sites
• Google Safe Browsing threat lists
• URLVoid reputation engine
• IPQualityScore fraud detection
• PhishTank phishing database
• AbuseIPDB malicious IP database

The analysis will complete in just a moment...`
    }
    
    // Check for greetings
    if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))/.test(lowerMessage)) {
      const greeting = username ? `Hello ${username}!` : 'Hello!'
      return `${greeting} I'm Lyn, your AI space agent. I'm here to protect you in the digital space by:

🔍 Checking suspicious links for phishing and malware
📄 Scanning documents for viruses and trojans
🛡️ Providing real-time security guidance

All my capabilities use real threat intelligence APIs - the same databases used by major security companies. How can I help secure your digital journey today?`
    }

    // Check for help requests
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      const greeting = username ? `${username}, here's what ` : "Here's what "
      return `${greeting}I can do to keep you safe:

🔍 **URL Analysis**: I check links against 6+ threat databases including VirusTotal, Google Safe Browsing, and PhishTank to detect phishing and malicious sites.

📄 **Malware Scanning**: I scan documents up to 32MB using professional antivirus engines to detect viruses, trojans, and other malware.

🛡️ **Real-Time Protection**: All scans use live threat intelligence APIs. I check against the same databases used by enterprise security tools.

💡 **Security Education**: I explain threats in clear terms and provide actionable recommendations.

Simply paste a suspicious link or upload a document to get started!`
    }

    // Check for security questions
    if (lowerMessage.includes('phish') || lowerMessage.includes('scam')) {
      return this.getPhishingAdvice(username)
    }

    if (lowerMessage.includes('malware') || lowerMessage.includes('virus')) {
      return this.getMalwareAdvice(username)
    }

    if (lowerMessage.includes('password') || lowerMessage.includes('2fa')) {
      return this.getPasswordAdvice(username)
    }

    // Default response
    const greeting = username ? `${username}, ` : ''
    return `${greeting}I'm here to help with your cybersecurity concerns. You can:

• Paste a suspicious link for instant security analysis
• Upload a document to scan for malware
• Ask me about phishing, scams, or security best practices

What would you like me to help you with?`
  }

  /**
   * Get phishing-specific advice
   */
  private static getPhishingAdvice(username?: string): string {
    const greeting = username ? `${username}, here's ` : "Here's "
    return `${greeting}how to identify and avoid phishing attacks:

🎣 **Common Phishing Signs**:
• Urgent language ("Act now!" or "Account will be closed!")
• Generic greetings ("Dear customer" instead of your name)
• Mismatched URLs (hover to see the real destination)
• Poor grammar and spelling errors
• Requests for passwords or sensitive info

🛡️ **Protection Tips**:
• Never click links in suspicious emails - go directly to the website
• Verify sender addresses carefully (look for slight misspellings)
• Enable 2FA on all important accounts
• When in doubt, contact the company directly

Paste any suspicious link here and I'll analyze it for you immediately!`
  }

  /**
   * Get malware-specific advice
   */
  private static getMalwareAdvice(username?: string): string {
    const greeting = username ? `${username}, here's ` : "Here's "
    return `${greeting}what you need to know about malware protection:

🦠 **Common Malware Types**:
• **Trojans**: Disguised as legitimate software
• **Ransomware**: Encrypts your files for ransom
• **Spyware**: Steals your personal information
• **Adware**: Bombards you with unwanted ads
• **Rootkits**: Hides deep in your system

🔒 **Prevention Strategies**:
• Keep all software updated with latest patches
• Only download from official sources
• Use reputable antivirus software
• Be cautious with email attachments
• Regular backups protect against ransomware

Upload any suspicious file (up to 32MB) and I'll scan it with multiple antivirus engines!`
  }

  /**
   * Get password security advice
   */
  private static getPasswordAdvice(username?: string): string {
    const greeting = username ? `${username}, let's ` : "Let's "
    return `${greeting}strengthen your password security:

🔐 **Strong Password Rules**:
• Minimum 12 characters (longer is better)
• Mix uppercase, lowercase, numbers, and symbols
• Avoid dictionary words and personal info
• Unique password for each account
• Consider passphrases: "Coffee@7Makes$Me&Happy!"

🛡️ **Additional Security**:
• **2FA is essential**: Add an extra verification step
• **Password managers**: Generate and store unique passwords
• **Security keys**: Physical devices for ultimate protection
• **Regular updates**: Change passwords after breaches

Need me to check if a specific website is safe before creating an account? Just share the link!`
  }

  /**
   * Fallback response generation when Venice AI is not available
   */
  private static generateFallbackResponse(message: string): string {
    // Use the enhanced version for consistency
    return this.generateEnhancedFallbackResponse(message, [], undefined)
  }

  /**
   * Fallback intent analysis
   */
  private static analyzeIntentFallback(message: string): {
    intent: 'check_url' | 'scan_file' | 'ask_security' | 'general_chat'
    confidence: number
    sentiment: 'positive' | 'neutral' | 'negative' | 'concerned'
  } {
    const lower = message.toLowerCase()
    
    if (lower.includes('file') || lower.includes('document') || lower.includes('scan') || lower.includes('upload')) {
      return { intent: 'scan_file', confidence: 0.8, sentiment: 'concerned' }
    }
    
    if (lower.includes('phish') || lower.includes('scam') || lower.includes('malware') || lower.includes('virus')) {
      return { intent: 'ask_security', confidence: 0.85, sentiment: 'concerned' }
    }
    
    if (lower.includes('help') || lower.includes('how') || lower.includes('what')) {
      return { intent: 'ask_security', confidence: 0.7, sentiment: 'neutral' }
    }
    
    return { intent: 'general_chat', confidence: 0.6, sentiment: 'neutral' }
  }
}