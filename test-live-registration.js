#!/usr/bin/env node

/**
 * Live test for username registration on production
 * Tests the complete flow including persistence
 */

const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const API_BASE = 'https://app.lynai.xyz';
const MONGODB_URI = 'mongodb+srv://defai:nuxdzH8yOkOMY8Pj@lyn.zix0l4f.mongodb.net/?retryWrites=true&w=majority&appName=lyn';
const TEST_WALLET = 'XRYBQ8JQLemiXxzw88M3Yd4JroeqKQxJmq1WGA5cAim';
const TEST_USERNAME = 'admin';

async function getDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return { client, db: client.db('lyn') };
}

async function checkDatabase() {
  const { client, db } = await getDatabase();
  
  try {
    console.log('\n📊 DATABASE CHECK');
    console.log('=================');
    
    // Check user
    const user = await db.collection('users').findOne({ walletAddress: TEST_WALLET });
    if (user) {
      console.log('✅ User exists in database');
      console.log('   Username:', user.username || 'NOT SET');
      console.log('   Profile username:', user.profile?.username || 'NOT SET');
      console.log('   Registered at:', user.usernameRegisteredAt || 'NOT SET');
      console.log('   User ID:', user._id);
      
      // Check sessions
      const sessions = await db.collection('sessions').find({
        $or: [
          { userId: user._id?.toString() },
          { userId: TEST_WALLET }
        ]
      }).toArray();
      
      console.log(`   Sessions: ${sessions.length} found`);
      sessions.forEach(s => {
        const expired = s.expiresAt < new Date();
        console.log(`   - ${expired ? '❌ EXPIRED' : '✅ ACTIVE'} (expires: ${s.expiresAt.toISOString()})`);
      });
      
      return user;
    } else {
      console.log('❌ User NOT found in database');
      return null;
    }
  } finally {
    await client.close();
  }
}

async function testRegistrationAPI() {
  console.log('\n🔧 TESTING REGISTRATION API');
  console.log('===========================');
  
  // Test username availability
  console.log('\n1️⃣ Checking username availability...');
  const checkResponse = await fetch(`${API_BASE}/api/user/register-username?username=${TEST_USERNAME}`);
  const checkData = await checkResponse.json();
  console.log(`   Username "${TEST_USERNAME}" available: ${checkData.available}`);
  
  // Test registration (will fail if username already taken, which is fine)
  console.log('\n2️⃣ Testing registration endpoint...');
  const registerResponse = await fetch(`${API_BASE}/api/user/register-username-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TEST_USERNAME,
      walletAddress: TEST_WALLET,
      signature: 'mock_signature',
      transaction: 'mock_signature'
    })
  });
  
  const registerData = await registerResponse.json();
  console.log(`   Status: ${registerResponse.status}`);
  console.log(`   Response:`, registerData);
  
  if (registerResponse.status === 200 || registerResponse.status === 202) {
    console.log('   ✅ Registration successful or pending');
    return registerData.token;
  } else if (registerResponse.status === 409) {
    console.log('   ℹ️ Username already registered (expected if user exists)');
    return null;
  } else {
    console.log(`   ⚠️ Unexpected status: ${registerResponse.status}`);
    return null;
  }
}

async function testAuthEndpoint(token) {
  console.log('\n🔐 TESTING AUTH ENDPOINT');
  console.log('========================');
  
  // Test with token if available
  if (token) {
    console.log('Testing with token...');
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `auth-token=${token}`
      }
    });
    
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    if (response.status === 200) {
      console.log('   ✅ Auth successful');
      console.log('   Username:', data.user?.username || 'NOT SET');
      console.log('   Wallet:', data.user?.walletAddress || 'NOT SET');
    } else {
      console.log('   ❌ Auth failed:', data.error);
    }
  }
  
  // Test with wallet header
  console.log('\nTesting with wallet header...');
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      'x-wallet-address': TEST_WALLET
    }
  });
  
  const data = await response.json();
  console.log(`   Status: ${response.status}`);
  if (response.status === 200) {
    console.log('   ✅ Auth successful');
    console.log('   Username:', data.user?.username || 'NOT SET');
    console.log('   Wallet:', data.user?.walletAddress || 'NOT SET');
  } else {
    console.log('   ❌ Auth failed:', data.error);
  }
}

async function testProfileEndpoint() {
  console.log('\n👤 TESTING PROFILE ENDPOINTS');
  console.log('=============================');
  
  // Test user info
  const infoResponse = await fetch(`${API_BASE}/api/user/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: TEST_WALLET })
  });
  
  if (infoResponse.status === 200) {
    const data = await infoResponse.json();
    console.log('   ✅ User info retrieved');
    console.log('   Username:', data.username || 'NOT SET');
    console.log('   Reputation:', data.reputationScore || 0);
  } else {
    console.log(`   ❌ Failed to get user info: ${infoResponse.status}`);
  }
  
  // Test profile by username
  const profileResponse = await fetch(`${API_BASE}/api/user/profile/${TEST_USERNAME}`);
  if (profileResponse.status === 200) {
    const data = await profileResponse.json();
    console.log('   ✅ Profile retrieved by username');
    console.log('   Wallet:', data.walletAddress);
  } else {
    console.log(`   ℹ️ Profile not found by username: ${profileResponse.status}`);
  }
}

async function runAllTests() {
  console.log('🚀 LIVE PRODUCTION TEST - USERNAME REGISTRATION');
  console.log('================================================');
  console.log(`Wallet: ${TEST_WALLET}`);
  console.log(`Username: ${TEST_USERNAME}`);
  console.log(`API: ${API_BASE}`);
  
  try {
    // Check deployment status
    console.log('\n📦 DEPLOYMENT STATUS');
    console.log('====================');
    const deployResponse = await fetch(`${API_BASE}/api/deployment-status`);
    const deployData = await deployResponse.json();
    console.log('   Version:', deployData.version);
    console.log('   Fixes deployed:', deployData.fixes.usernameRegistration ? '✅' : '❌');
    console.log('   Deployed at:', deployData.fixes.deployedAt);
    
    // Run tests
    const user = await checkDatabase();
    const token = await testRegistrationAPI();
    await testAuthEndpoint(token);
    await testProfileEndpoint();
    
    // Final database check
    console.log('\n📊 FINAL DATABASE CHECK');
    await checkDatabase();
    
    console.log('\n✅ TEST COMPLETE');
    console.log('=================');
    
    if (user && user.username) {
      console.log('✅ Username registration is working!');
      console.log(`   User "${user.username}" is properly registered`);
    } else {
      console.log('⚠️ Username registration needs attention');
      console.log('   Check the results above for issues');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);