/**
 * Test script for security API endpoints
 * Run with: node test-security-api.js
 */

async function testLinkAnalysis() {
  console.log('\n🔍 Testing Link Analysis...\n');
  
  const testUrls = [
    'htps://facebook.com',  // Typo in protocol
    'htp://google.com',     // Another typo
    'facebook.com',         // No protocol
    'https://google.com',   // Valid URL
    'http://192.168.1.1',   // IP address
    'bit.ly/test123'        // URL shortener
  ];
  
  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/security/analyze-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': 'test-session-123'
        },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Success: ${data.safe ? 'Safe' : 'Unsafe'} (Score: ${data.confidence_score}/100)`);
        if (data.checked_url !== url) {
          console.log(`   Corrected URL: ${data.checked_url}`);
        }
      } else {
        console.log(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    
    console.log('---');
  }
}

async function testDocumentAnalysis() {
  console.log('\n📄 Testing Document Analysis...\n');
  
  // Create a test text file
  const fs = require('fs');
  const path = require('path');
  const FormData = require('form-data');
  
  // Create test file if it doesn't exist
  const testFilePath = path.join(__dirname, 'test-document.txt');
  fs.writeFileSync(testFilePath, 'This is a test document for security scanning.');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(testFilePath), {
    filename: 'test-document.txt',
    contentType: 'text/plain'
  });
  
  try {
    const response = await fetch('http://localhost:3000/api/security/analyze-document', {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'X-Session-Id': 'test-session-123'
      },
      body: form
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Document scan successful`);
      console.log(`   Safe: ${data.safe}`);
      console.log(`   Score: ${data.confidence_score}/100`);
      console.log(`   Risk Level: ${data.risk_level}`);
    } else {
      console.log(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
  
  // Clean up test file
  fs.unlinkSync(testFilePath);
}

async function runTests() {
  console.log('========================================');
  console.log('LYN AI Security API Test Suite');
  console.log('========================================');
  
  console.log('\n⚠️  Note: Make sure the app is running on http://localhost:3000\n');
  
  // Check if server is running
  try {
    await fetch('http://localhost:3000/api/health');
    console.log('✅ Server is running\n');
  } catch (error) {
    console.log('❌ Server is not running. Please start the app first with: npm run dev\n');
    return;
  }
  
  await testLinkAnalysis();
  await testDocumentAnalysis();
  
  console.log('\n========================================');
  console.log('Test suite completed');
  console.log('========================================\n');
}

// Run tests
runTests().catch(console.error);
