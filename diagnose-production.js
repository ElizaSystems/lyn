// Production diagnosis script
const fetch = require('node-fetch')

async function diagnoseProduction() {
  console.log('🔍 Diagnosing Production Environment...')
  
  // Test if the API route exists
  const healthUrl = 'https://app.lynai.xyz/api/health'
  
  try {
    console.log('\n🏥 Testing health endpoint...')
    const healthResponse = await fetch(healthUrl)
    console.log(`Status: ${healthResponse.status}`)
    
    if (healthResponse.ok) {
      const health = await healthResponse.json()
      console.log('Health data:', health)
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message)
  }
  
  // Test referral API with more detailed error info
  const referralUrl = 'https://app.lynai.xyz/api/referral/v2/code?walletAddress=GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg'
  
  try {
    console.log('\n🔗 Testing referral endpoint...')
    const response = await fetch(referralUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Production Diagnostics Script'
      }
    })
    
    console.log(`Status: ${response.status} ${response.statusText}`)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))
    
    const responseText = await response.text()
    console.log('Response body length:', responseText.length)
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const json = JSON.parse(responseText)
        console.log('JSON Response:', json)
      } catch (e) {
        console.log('Failed to parse as JSON')
      }
    } else {
      console.log('Non-JSON response (first 500 chars):', responseText.substring(0, 500))
    }
    
  } catch (error) {
    console.log('❌ Referral API test failed:', error.message)
  }
}

diagnoseProduction()