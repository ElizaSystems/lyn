const fetch = require('node-fetch')
require('dotenv').config({ path: '.env.local' })

async function testReferralAPI() {
  console.log('🧪 Testing Referral API V2...')
  
  const walletAddress = 'GxkXGe3YcqBdEgBrBh19X3wkLkgJXK2jA4k4nioW2Yg'
  const testUrls = [
    `http://localhost:3003/api/referral/v2/code?walletAddress=${walletAddress}`,
    `https://app.lynai.xyz/api/referral/v2/code?walletAddress=${walletAddress}`
  ]
  
  for (const url of testUrls) {
    console.log(`\n🌐 Testing: ${url}`)
    
    try {
      const response = await fetch(url)
      console.log(`📊 Status: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Response data:', JSON.stringify(data, null, 2))
      } else {
        const errorText = await response.text()
        console.log('❌ Error response:', errorText)
      }
    } catch (error) {
      console.error('❌ Request failed:', error.message)
    }
  }
}

testReferralAPI()