import OpenAI from 'openai'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OpenAIService {
  private static client: OpenAI | null = null
  private static isConfigured = false

  /**
   * Initialize OpenAI client
   */
  private static getClient(): OpenAI | null {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        console.warn('[OpenAI] API key not configured - using fallback responses')
        return null
      }
      
      this.client = new OpenAI({
        apiKey,
        maxRetries: 3,
      })
      this.isConfigured = true
    }
    return this.client
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
    }
  ): Promise<string> {
    const client = this.getClient()
    
    // If OpenAI is not configured, use intelligent fallback
    if (!client) {
      return this.generateFallbackResponse(userMessage)
    }

    try {
      // Build the conversation with system prompt
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are LYN AI, an advanced cybersecurity assistant specializing in protecting users from online threats. Your primary capabilities include:

1. **Phishing Detection**: Analyzing URLs for phishing indicators using multiple threat intelligence sources (VirusTotal, Google Safe Browsing, URLVoid, IPQualityScore, PhishTank, AbuseIPDB)
2. **Malware Scanning**: Scanning documents and files for malware using antivirus engines
3. **Security Education**: Teaching users about cybersecurity best practices
4. **Threat Analysis**: Explaining security threats in clear, understandable terms

Key behaviors:
- Be professional but friendly and approachable
- Use emojis sparingly to make security less intimidating (🔒 for secure, ⚠️ for warnings, ✅ for safe)
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

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini', // Fast and cost-effective
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      })

      return completion.choices[0]?.message?.content || this.generateFallbackResponse(userMessage)
    } catch (error) {
      console.error('[OpenAI] API call failed:', error)
      return this.generateFallbackResponse(userMessage)
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  static async generateEmbedding(text: string): Promise<number[] | null> {
    const client = this.getClient()
    if (!client) return null

    try {
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      })
      
      return response.data[0].embedding
    } catch (error) {
      console.error('[OpenAI] Embedding generation failed:', error)
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

    // If no OpenAI, use pattern matching
    if (!client) {
      return this.analyzeIntentFallback(message)
    }

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Analyze the user message and return a JSON object with: intent (check_url/scan_file/ask_security/general_chat), confidence (0-1), and sentiment (positive/neutral/negative/concerned)'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 100,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}')
      return {
        intent: result.intent || 'general_chat',
        confidence: result.confidence || 0.5,
        sentiment: result.sentiment || 'neutral'
      }
    } catch (error) {
      console.error('[OpenAI] Intent analysis failed:', error)
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
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate a brief, actionable security tip (max 100 characters) relevant to the context. Include an appropriate emoji at the start.'
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
   * Fallback response generation when OpenAI is not available
   */
  private static generateFallbackResponse(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    // Check if message contains a URL - if so, provide analysis guidance
    const urlPatterns = [
      /https?:\/\/[^\s]+/i,
      /www\.[^\s]+/i,
      /[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.(com|org|net|edu|gov|mil|biz|info|name|museum|us|ca|uk|eu|io|xyz|app|dev|co|me|tv|link|site|online|tech|store|shop|club|fun|space|live|life|world|today|email|ai|cloud|digital)/i
    ]
    
    const hasUrl = urlPatterns.some(pattern => pattern.test(message))
    if (hasUrl) {
      return "I've detected a URL in your message. I'll analyze it for potential security threats using multiple threat intelligence sources including VirusTotal, Google Safe Browsing, URLVoid, and more. Starting the analysis now..."
    }
    
    // Check for greetings
    if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))/.test(lowerMessage)) {
      return "Hello! I'm LYN AI, your cybersecurity assistant. I can help you check suspicious links for phishing attempts and scan documents for malware using real-time threat intelligence. How can I help protect you today?"
    }

    // Check for help requests
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      return `I'm equipped with real security capabilities to keep you safe online:

🔍 **URL Analysis**: I check links against multiple threat databases including VirusTotal, Google Safe Browsing, and PhishTank to detect phishing and malicious sites.

📄 **Malware Scanning**: I can scan documents up to 32MB using professional antivirus engines to detect viruses, trojans, and other malware.

🛡️ **Real-Time Protection**: All my scans use live threat intelligence APIs, not simulations. I check against the same databases used by major security companies.

Simply paste a suspicious link or upload a document to get started!`
    }

    // Check for thanks
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      return "You're welcome! Stay safe online, and don't hesitate to check any suspicious links or files with me. Prevention is the best protection!"
    }

    // URL-related queries
    if (lowerMessage.includes('url') || lowerMessage.includes('link') || lowerMessage.includes('website')) {
      return "I can analyze any URL for security threats using multiple threat intelligence sources. Just paste the suspicious link in the chat, and I'll check it against databases like VirusTotal, Google Safe Browsing, and more to determine if it's safe."
    }

    // File-related queries
    if (lowerMessage.includes('file') || lowerMessage.includes('document') || lowerMessage.includes('scan')) {
      return "I can scan files up to 32MB for malware using professional antivirus engines. Use the upload button to select your file, and I'll analyze it for viruses, trojans, and other threats. The scan typically takes 5-15 seconds."
    }

    // Security concerns
    if (lowerMessage.includes('safe') || lowerMessage.includes('dangerous') || lowerMessage.includes('risk')) {
      return "Your security is my priority. I use real-time threat intelligence from multiple sources to assess risks. Whether it's a suspicious link or an unknown file, I'll give you a detailed analysis with clear recommendations on whether it's safe to proceed."
    }

    // Default response
    return "I'm here to help protect you from online threats. You can paste any suspicious URL or upload a document (up to 32MB) for security analysis. I use real threat intelligence APIs to provide accurate, real-time security assessments. What would you like me to check?"
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