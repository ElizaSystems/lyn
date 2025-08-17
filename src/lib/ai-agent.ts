export interface AIResponse {
  message: string
  suggestedAction?: 'analyze_link' | 'scan_document' | 'general_help'
  extractedUrl?: string
  confidence?: number
}

export class SecurityAIAgent {
  private conversationContext: string[] = []
  
  private securityPhrases = {
    linkAnalysis: [
      'check', 'scan', 'analyze', 'verify', 'suspicious', 'phishing', 'scam',
      'link', 'url', 'website', 'site', 'domain', 'click', 'safe', 'legitimate',
      'fake', 'malicious', 'dangerous', 'risk', 'threat'
    ],
    documentAnalysis: [
      'file', 'document', 'pdf', 'doc', 'upload', 'scan', 'malware', 'virus',
      'trojan', 'infected', 'code', 'script', 'executable', 'attachment',
      'download', 'email attachment', 'macro'
    ],
    generalHelp: [
      'help', 'what can you do', 'how', 'guide', 'assist', 'support',
      'features', 'capabilities', 'explain'
    ]
  }

  private conversationalResponses = [
    {
      intent: 'greeting',
      patterns: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
      responses: [
        "Hello! I'm your cybersecurity assistant. I'm here to help you stay safe online by checking suspicious links and scanning documents for potential threats. How can I help protect you today?",
        "Hi there! I specialize in detecting phishing attempts and malicious documents. Do you have a suspicious link or file you'd like me to analyze?",
        "Welcome! I'm here to keep you secure online. I can check if links are phishing attempts or scan documents for malicious code. What would you like me to help with?"
      ]
    },
    {
      intent: 'thanks',
      patterns: ['thank you', 'thanks', 'appreciate', 'grateful', 'thx'],
      responses: [
        "You're welcome! Stay safe online. If you encounter any more suspicious links or files, I'm here to help.",
        "Happy to help! Remember, it's always better to check before clicking. Feel free to ask if you need anything else.",
        "My pleasure! Cybersecurity is important. Don't hesitate to return if you have more links or documents to verify."
      ]
    },
    {
      intent: 'concern',
      patterns: ['worried', 'concerned', 'scared', 'afraid', 'nervous', 'anxious', 'hacked', 'compromised'],
      responses: [
        "I understand your concern. Let's check any suspicious links or files you've encountered. Can you share the link or upload the document you're worried about?",
        "Your caution is smart. Many cyber threats can be avoided by verifying before clicking. Do you have a specific link or file you'd like me to examine?",
        "It's good that you're being careful. I'm here to help verify if something is safe. Please share the suspicious link or upload the document, and I'll analyze it for you."
      ]
    },
    {
      intent: 'education',
      patterns: ['how do I know', 'what should I look for', 'teach', 'learn', 'understand', 'explain'],
      responses: [
        "Great question! Common phishing signs include misspelled domains, urgent language, requests for sensitive info, and suspicious attachments. Want me to check a specific link or document?",
        "Key red flags include: unexpected emails asking for passwords, links with strange characters, attachments from unknown senders, and websites without HTTPS. Have something specific you'd like me to analyze?",
        "Look for: legitimate sender addresses, proper spelling in URLs, secure HTTPS connections, and be wary of urgent requests. If you have a suspicious link or file, I can analyze it for you right now."
      ]
    }
  ]

  analyzeUserIntent(message: string): AIResponse {
    const lowerMessage = message.toLowerCase()
    
    // Check for URLs in the message
    const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.(com|org|net|edu|gov|mil|biz|info|name|museum|us|ca|uk|eu|io|xyz|app|dev|co|me|tv|link|site|online|tech|store|shop|club|fun|space|live|life|world|today|email))/gi
    const urlMatch = message.match(urlPattern)
    
    if (urlMatch) {
      let extractedUrl = urlMatch[0]
      if (!extractedUrl.startsWith('http')) {
        extractedUrl = 'https://' + extractedUrl
      }
      return {
        message: `I found a URL in your message: ${extractedUrl}. Let me analyze it for potential security threats. This will check for phishing indicators, suspicious domains, and other red flags.`,
        suggestedAction: 'analyze_link',
        extractedUrl: extractedUrl,
        confidence: 0.95
      }
    }

    // Check for document/file mentions
    const hasDocumentKeywords = this.securityPhrases.documentAnalysis.some(keyword => 
      lowerMessage.includes(keyword)
    )
    
    if (hasDocumentKeywords && (lowerMessage.includes('scan') || lowerMessage.includes('check') || lowerMessage.includes('analyze') || lowerMessage.includes('upload'))) {
      return {
        message: "I can help you scan documents for malicious code, hidden scripts, and potential malware. Please use the upload button to select your file, and I'll perform a comprehensive security analysis.",
        suggestedAction: 'scan_document',
        confidence: 0.85
      }
    }

    // Check for link analysis request without URL
    const hasLinkKeywords = this.securityPhrases.linkAnalysis.some(keyword => 
      lowerMessage.includes(keyword)
    )
    
    if (hasLinkKeywords && !urlMatch) {
      return {
        message: "I can help you check if a link is safe or potentially a phishing attempt. Please paste the suspicious URL in the chat, and I'll analyze it for security threats.",
        suggestedAction: 'analyze_link',
        confidence: 0.8
      }
    }

    // Check conversational intents
    for (const intentGroup of this.conversationalResponses) {
      const matches = intentGroup.patterns.some(pattern => lowerMessage.includes(pattern))
      if (matches) {
        const response = intentGroup.responses[Math.floor(Math.random() * intentGroup.responses.length)]
        return {
          message: response,
          suggestedAction: 'general_help',
          confidence: 0.7
        }
      }
    }

    // Check for help/capabilities questions
    if (this.securityPhrases.generalHelp.some(keyword => lowerMessage.includes(keyword))) {
      return {
        message: `I'm your cybersecurity assistant with two main capabilities:

🔍 **Link Analysis**: I can detect phishing attempts by checking for:
• Suspicious domains and typosquatting
• URL shorteners hiding malicious sites  
• IP addresses instead of domain names
• Homograph attacks using lookalike characters

📄 **Document Scanning**: I can scan files for:
• Malicious code and scripts
• Hidden malware and viruses
• Dangerous macros in Office documents
• Obfuscated or suspicious code patterns

Simply paste a link or upload a document to get started!`,
        suggestedAction: 'general_help',
        confidence: 0.9
      }
    }

    // Context-aware responses based on conversation history
    if (this.conversationContext.length > 0) {
      const lastContext = this.conversationContext[this.conversationContext.length - 1]
      if (lastContext.includes('phishing') || lastContext.includes('link')) {
        return {
          message: "Following up on link security - if you have any URLs you're unsure about, paste them here and I'll check them immediately. Remember, it's always better to verify before clicking!",
          suggestedAction: 'analyze_link',
          confidence: 0.6
        }
      }
      if (lastContext.includes('document') || lastContext.includes('file')) {
        return {
          message: "Regarding document security - you can upload any suspicious files using the upload button. I'll scan for malware, malicious scripts, and other threats.",
          suggestedAction: 'scan_document',
          confidence: 0.6
        }
      }
    }

    // Default response for unclear inputs
    const defaultResponses = [
      "I'm here to help keep you safe online. You can paste any suspicious link or upload a document, and I'll analyze it for security threats. What would you like me to check?",
      "Your cybersecurity is my priority. Share a link you're unsure about or upload a file you'd like scanned for malware. How can I assist you today?",
      "I specialize in detecting phishing links and malicious documents. Feel free to paste a URL or upload a file for immediate security analysis.",
      "Staying safe online is important. I can verify if links are legitimate or scan documents for hidden threats. What concerns do you have about your digital security?"
    ]

    return {
      message: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
      suggestedAction: 'general_help',
      confidence: 0.5
    }
  }

  updateContext(userMessage: string, aiResponse: string): void {
    this.conversationContext.push(userMessage)
    this.conversationContext.push(aiResponse)
    
    // Keep only last 10 messages for context
    if (this.conversationContext.length > 10) {
      this.conversationContext = this.conversationContext.slice(-10)
    }
  }

  generateSecurityTip(): string {
    const tips = [
      "💡 Security Tip: Always verify the sender's email address before clicking links in emails.",
      "🛡️ Pro Tip: Hover over links to see the actual URL before clicking - legitimate companies use their official domains.",
      "🔒 Remember: Banks and legitimate services never ask for passwords via email.",
      "⚠️ Stay Alert: Be suspicious of emails creating urgency or threatening account closure.",
      "🔍 Quick Check: Look for HTTPS and a padlock icon in your browser when entering sensitive information.",
      "📧 Email Safety: Unexpected attachments, even from known contacts, could be malware if their account was compromised.",
      "🎯 Phishing Alert: Typos and poor grammar in official-looking emails are red flags.",
      "🔐 Password Tip: Use unique passwords for each account to limit damage if one gets compromised.",
      "🚨 Warning Sign: Requests to 'verify' or 'update' account information via email are often scams.",
      "💻 Safe Practice: Keep your software updated - security patches protect against known vulnerabilities."
    ]
    
    return tips[Math.floor(Math.random() * tips.length)]
  }

  generateFollowUpSuggestions(lastAction: string): string[] {
    const suggestions: { [key: string]: string[] } = {
      'analyze_link': [
        "Would you like tips on identifying phishing emails?",
        "Do you have other suspicious links to check?",
        "Want to learn about common phishing techniques?",
        "Should I explain what made this link suspicious/safe?"
      ],
      'scan_document': [
        "Do you have more files to scan?",
        "Would you like to know about safe email attachment practices?",
        "Want tips on identifying malicious documents?",
        "Should I explain the security threats I looked for?"
      ],
      'general_help': [
        "Do you have a specific link you'd like me to check?",
        "Would you like to upload a document for scanning?",
        "Want to learn about common online threats?",
        "How can I help protect your digital security?"
      ]
    }
    
    return suggestions[lastAction] || suggestions['general_help']
  }
}