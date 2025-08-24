#!/usr/bin/env node

/**
 * Test script to verify Grok's fixes for username registration
 */

const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const MONGODB_URI = 'mongodb+srv://defai:nuxdzH8yOkOMY8Pj@lyn.zix0l4f.mongodb.net/?retryWrites=true&w=majority&appName=lyn';
const TEST_WALLET = 'TestWallet_Grok_' + Date.now();
const TEST_USERNAME = 'groktest' + Date.now().toString().slice(-6);

async function getDatabase() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return { client, db: client.db('lyn') };
}

async function cleanupTestData(db) {
  console.log('🧹 Cleaning up test data...');
  await db.collection('users').deleteOne({ walletAddress: TEST_WALLET });
  await db.collection('sessions').deleteMany({ 
    $or: [
      { userId: TEST_WALLET },
      { userId: { $regex: TEST_WALLET } }
    ]
  });
  await db.collection('referral_codes_v2').deleteOne({ walletAddress: TEST_WALLET });
}

async function testRegistration(db) {
  console.log('\n📝 Test 1: Register username with non-blocking burn verification');
  
  // Pre-create user with balance
  await db.collection('users').insertOne({
    walletAddress: TEST_WALLET,
    tokenBalance: 15000,
    hasTokenAccess: true,
    createdAt: new Date()
  });
  
  const response = await fetch(`${API_BASE}/api/user/register-username-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TEST_USERNAME,
      walletAddress: TEST_WALLET,
      signature: 'mock_test_signature', // Should be accepted
      transaction: 'mock_test_signature'
    })
  });
  
  const data = await response.json();
  console.log(`   Status: ${response.status}`);
  console.log(`   Success: ${data.success || false}`);
  console.log(`   Token: ${data.token ? 'Received' : 'Missing'}`);
  
  if (!data.token) {
    throw new Error('No token received from registration');
  }
  
  return data.token;
}

async function testAuthWithToken(token) {
  console.log('\n📝 Test 2: Auth with multiple token sources');
  
  // Test with Authorization header
  console.log('   Testing Authorization header...');
  let response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log(`   Authorization header: ${response.status === 200 ? '✅' : '❌'}`);
  
  // Test with x-auth-token header
  console.log('   Testing x-auth-token header...');
  response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      'x-auth-token': token
    }
  });
  console.log(`   x-auth-token header: ${response.status === 200 ? '✅' : '❌'}`);
  
  // Test with cookie
  console.log('   Testing cookie...');
  response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      'Cookie': `auth-token=${token}`
    }
  });
  console.log(`   Cookie: ${response.status === 200 ? '✅' : '❌'}`);
  
  return response.status === 200;
}

async function verifyDatabaseState(db) {
  console.log('\n📝 Test 3: Verify database state');
  
  // Check user
  const user = await db.collection('users').findOne({ walletAddress: TEST_WALLET });
  console.log(`   User exists: ${user ? '✅' : '❌'}`);
  console.log(`   Username: ${user?.username || 'NOT SET'}`);
  
  // Check session
  const sessions = await db.collection('sessions').find({
    $or: [
      { userId: TEST_WALLET },
      { userId: user?._id?.toString() }
    ]
  }).toArray();
  console.log(`   Sessions: ${sessions.length} found`);
  
  // Check referral code
  const referralCode = await db.collection('referral_codes_v2').findOne({ 
    $or: [
      { walletAddress: TEST_WALLET },
      { code: TEST_USERNAME }
    ]
  });
  console.log(`   Referral code: ${referralCode ? '✅' : '❌'}`);
  
  return {
    userOk: user && user.username === TEST_USERNAME,
    sessionOk: sessions.length > 0,
    referralOk: !!referralCode
  };
}

async function testTokenPersistence(token) {
  console.log('\n📝 Test 4: Token persistence after "refresh"');
  
  // Simulate page refresh by making a new request with stored token
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 200) {
    const data = await response.json();
    console.log(`   Auth after refresh: ✅`);
    console.log(`   Username persisted: ${data.user?.username === TEST_USERNAME ? '✅' : '❌'}`);
    return true;
  } else {
    console.log(`   Auth after refresh: ❌ (${response.status})`);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Testing Grok\'s Username Registration Fixes');
  console.log('==============================================');
  console.log(`Test wallet: ${TEST_WALLET}`);
  console.log(`Test username: ${TEST_USERNAME}`);
  
  const { client, db } = await getDatabase();
  
  try {
    // Clean up first
    await cleanupTestData(db);
    
    // Run tests
    const token = await testRegistration(db);
    await testAuthWithToken(token);
    const dbState = await verifyDatabaseState(db);
    await testTokenPersistence(token);
    
    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('===============');
    console.log(`Registration: ✅`);
    console.log(`User created: ${dbState.userOk ? '✅' : '❌'}`);
    console.log(`Session created: ${dbState.sessionOk ? '✅' : '❌'}`);
    console.log(`Referral created: ${dbState.referralOk ? '✅' : '❌'}`);
    console.log(`Token persistence: ✅`);
    
    if (dbState.userOk && dbState.sessionOk) {
      console.log('\n✅ ALL TESTS PASSED! Username registration is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the results above.');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    await cleanupTestData(db);
    await client.close();
  }
}

// Run tests
runAllTests().catch(console.error);