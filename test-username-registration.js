#!/usr/bin/env node

/**
 * Test script for username registration functionality
 * Tests the complete flow including persistence after page refresh
 */

const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://defai:nuxdzH8yOkOMY8Pj@lyn.zix0l4f.mongodb.net/?retryWrites=true&w=majority&appName=lyn';
const TEST_WALLET = 'TestWallet' + Date.now();
const TEST_USERNAME = 'testuser' + Date.now().toString().slice(-6);

async function getDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db('lyn');
}

async function cleanupTestData(db) {
  console.log('🧹 Cleaning up test data...');
  await db.collection('users').deleteOne({ walletAddress: TEST_WALLET });
  await db.collection('sessions').deleteMany({ userId: { $regex: TEST_WALLET } });
  await db.collection('user_reputation').deleteOne({ walletAddress: TEST_WALLET });
  await db.collection('referral_codes_v2').deleteOne({ walletAddress: TEST_WALLET });
}

async function testUsernameAvailability() {
  console.log('\n📝 Test 1: Check username availability');
  
  const response = await fetch(`${API_BASE}/api/user/register-username?username=${TEST_USERNAME}`);
  const data = await response.json();
  
  console.log(`   Username: ${TEST_USERNAME}`);
  console.log(`   Available: ${data.available}`);
  console.log(`   ✅ Username availability check passed`);
  
  return data.available;
}

async function testUsernameRegistration(db) {
  console.log('\n📝 Test 2: Register username');
  
  // First, create a user in the database with sufficient balance
  await db.collection('users').insertOne({
    walletAddress: TEST_WALLET,
    tokenBalance: 15000,
    hasTokenAccess: true,
    nonce: '',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Register username
  const response = await fetch(`${API_BASE}/api/user/register-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TEST_USERNAME,
      walletAddress: TEST_WALLET,
      signature: 'mock_signature',
      transaction: 'mock_signature'
    })
  });
  
  const data = await response.json();
  
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`Registration failed: ${data.error}`);
  }
  
  console.log(`   Status: ${response.status}`);
  console.log(`   Username: ${data.username}`);
  console.log(`   Token: ${data.token ? 'Generated' : 'Missing'}`);
  
  // Extract token from cookies
  const cookies = response.headers.get('set-cookie');
  const authToken = cookies ? cookies.match(/auth-token=([^;]+)/)?.[1] : null;
  
  console.log(`   Cookie: ${authToken ? 'Set' : 'Not set'}`);
  console.log(`   ✅ Username registration passed`);
  
  return { token: data.token || authToken, username: data.username };
}

async function testSessionPersistence(db, token) {
  console.log('\n📝 Test 3: Check session persistence');
  
  // Check if session exists in database
  const session = await db.collection('sessions').findOne({ token });
  
  if (!session) {
    throw new Error('Session not found in database');
  }
  
  console.log(`   Session ID: ${session._id}`);
  console.log(`   User ID: ${session.userId}`);
  console.log(`   Expires: ${session.expiresAt}`);
  console.log(`   ✅ Session persistence passed`);
  
  return session;
}

async function testAuthEndpoint(token) {
  console.log('\n📝 Test 4: Test /api/auth/me endpoint');
  
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (response.status !== 200) {
    throw new Error(`Auth check failed: ${data.error}`);
  }
  
  console.log(`   Status: ${response.status}`);
  console.log(`   Username: ${data.user?.username || 'Not found'}`);
  console.log(`   Wallet: ${data.user?.walletAddress || 'Not found'}`);
  
  if (!data.user?.username) {
    throw new Error('Username not returned in auth response');
  }
  
  console.log(`   ✅ Auth endpoint passed`);
  
  return data.user;
}

async function testUsernameInDatabase(db) {
  console.log('\n📝 Test 5: Verify username in database');
  
  const user = await db.collection('users').findOne({ walletAddress: TEST_WALLET });
  
  if (!user) {
    throw new Error('User not found in database');
  }
  
  if (!user.username) {
    throw new Error('Username not saved in database');
  }
  
  console.log(`   Username in DB: ${user.username}`);
  console.log(`   Profile username: ${user.profile?.username || 'Not set'}`);
  console.log(`   Registration date: ${user.usernameRegisteredAt}`);
  console.log(`   ✅ Database verification passed`);
  
  return user;
}

async function testReferralCode(db) {
  console.log('\n📝 Test 6: Verify vanity referral code');
  
  const referralCode = await db.collection('referral_codes_v2').findOne({ walletAddress: TEST_WALLET });
  
  if (!referralCode) {
    console.log('   ⚠️  Referral code not created (non-critical)');
    return null;
  }
  
  console.log(`   Referral code: ${referralCode.code}`);
  console.log(`   Is vanity: ${referralCode.isVanity}`);
  console.log(`   ✅ Referral code verification passed`);
  
  return referralCode;
}

async function testDuplicateRegistration(token) {
  console.log('\n📝 Test 7: Prevent duplicate registration');
  
  const response = await fetch(`${API_BASE}/api/user/register-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'anotheruser',
      walletAddress: TEST_WALLET,
      signature: 'mock_signature',
      transaction: 'mock_signature'
    })
  });
  
  const data = await response.json();
  
  if (response.status !== 409) {
    throw new Error(`Expected 409 status, got ${response.status}`);
  }
  
  console.log(`   Status: ${response.status}`);
  console.log(`   Error: ${data.error}`);
  console.log(`   ✅ Duplicate prevention passed`);
}

async function runTests() {
  console.log('🚀 Starting Username Registration Tests');
  console.log('=====================================');
  
  let db;
  let client;
  
  try {
    // Connect to database
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('lyn');
    console.log('✅ Connected to MongoDB');
    
    // Clean up any existing test data
    await cleanupTestData(db);
    
    // Run tests
    const isAvailable = await testUsernameAvailability();
    if (!isAvailable) {
      throw new Error('Test username is not available');
    }
    
    const { token, username } = await testUsernameRegistration(db);
    if (!token) {
      throw new Error('No auth token received');
    }
    
    await testSessionPersistence(db, token);
    await testAuthEndpoint(token);
    await testUsernameInDatabase(db);
    await testReferralCode(db);
    await testDuplicateRegistration(token);
    
    console.log('\n✅ All tests passed successfully!');
    console.log('=====================================');
    console.log('Username registration is working correctly.');
    console.log('The username persists after page refresh.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (db) {
      await cleanupTestData(db);
    }
    if (client) {
      await client.close();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };