#!/usr/bin/env node

/**
 * Test script for security chat functionality
 */

const testCases = [
  {
    name: 'URL Detection',
    message: 'Can you check this link: https://google.com',
    expected: 'URL analysis'
  },
  {
    name: 'Greeting',
    message: 'Hello',
    expected: 'Lyn, your AI space agent'
  },
  {
    name: 'Help Request',
    message: 'What can you do?',
    expected: 'URL Analysis'
  },
  {
    name: 'Phishing Query',
    message: 'How can I identify phishing emails?',
    expected: 'phishing'
  },
  {
    name: 'Security Concern',
    message: 'Is this website safe?',
    expected: 'security'
  }
]

async function testSecurityChat() {
  console.log('Testing Security Chat API...\n')
  
  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`)
    console.log(`Message: "${testCase.message}"`)
    
    try {
      const response = await fetch('http://localhost:3005/api/security/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testCase.message,
          sessionId: `test-${Date.now()}`
        })
      })
      
      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
        const error = await response.text()
        console.error(`Error: ${error}`)
      } else {
        const data = await response.json()
        const responseText = data.message || data.error || 'No response'
        
        // Check if response contains expected content
        const passed = responseText.toLowerCase().includes(testCase.expected.toLowerCase())
        
        if (passed) {
          console.log(`✅ Response contains expected: "${testCase.expected}"`)
        } else {
          console.log(`⚠️ Response might not match expected`)
        }
        
        console.log(`Response (first 200 chars): ${responseText.substring(0, 200)}...`)
        console.log(`Intent: ${data.intent || 'N/A'}`)
        console.log(`Confidence: ${data.confidence || 'N/A'}`)
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`)
    }
    
    console.log('-'.repeat(60) + '\n')
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Test URL analysis
  console.log('Testing URL Analysis API...\n')
  
  const testUrls = [
    'https://google.com',
    'amazon.com',
    'htps://suspicious-site.com', // Typo in protocol
    'http://192.168.1.1' // Local IP
  ]
  
  for (const url of testUrls) {
    console.log(`Testing URL: ${url}`)
    
    try {
      const response = await fetch('http://localhost:3005/api/security/analyze-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      })
      
      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
      } else {
        const data = await response.json()
        console.log(`✅ Analysis complete`)
        console.log(`   Safe: ${data.safe}`)
        console.log(`   Risk Level: ${data.risk_level}`)
        console.log(`   Confidence: ${data.confidence_score}`)
        console.log(`   Sources checked: ${data.threat_sources?.length || 0}`)
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`)
    }
    
    console.log('-'.repeat(60) + '\n')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('Testing complete!')
}

// Run tests
testSecurityChat().catch(console.error)