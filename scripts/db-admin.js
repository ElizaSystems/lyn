#!/usr/bin/env node
// Database administration script for LYN Hacker
// Run with: node scripts/db-admin.js [command]

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lyn-hacker';

const commands = {
  'list-users': listUsers,
  'clear-usernames': clearUsernames,
  'clear-all-users': clearAllUsers,
  'clear-scans': clearScans,
  'clear-all': clearAll,
  'stats': showStats,
  'help': showHelp
};

async function runCommand(command) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    
    const db = client.db();
    
    if (commands[command]) {
      await commands[command](db);
    } else {
      console.log(`❌ Unknown command: ${command}`);
      showHelp();
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

async function listUsers(db) {
  const users = await db.collection('users').find({}).toArray();
  console.log(`📋 Found ${users.length} users:\n`);
  
  users.forEach(user => {
    console.log(`ID: ${user._id}`);
    console.log(`  Username: ${user.username || 'none'}`);
    console.log(`  Wallet: ${user.walletAddress || 'none'}`);
    console.log(`  Has Token Access: ${user.hasTokenAccess || false}`);
    console.log(`  Created: ${user.createdAt || 'unknown'}`);
    if (user.registrationBurnTx) {
      console.log(`  Burn TX: ${user.registrationBurnTx.slice(0, 20)}...`);
    }
    console.log('');
  });
}

async function clearUsernames(db) {
  const result = await db.collection('users').updateMany(
    { username: { $exists: true } },
    { 
      $unset: { 
        username: "",
        usernameRegisteredAt: "",
        registrationBurnAmount: "",
        registrationBurnTx: "",
        registrationFee: ""
      } 
    }
  );
  
  console.log(`✅ Cleared usernames from ${result.modifiedCount} users`);
  
  // Also clear reputation
  const repResult = await db.collection('user_reputation').updateMany(
    { username: { $exists: true } },
    { $unset: { username: "" } }
  );
  
  console.log(`✅ Cleared ${repResult.modifiedCount} reputation records`);
}

async function clearAllUsers(db) {
  const result = await db.collection('users').deleteMany({});
  console.log(`✅ Deleted ${result.deletedCount} users`);
  
  const repResult = await db.collection('user_reputation').deleteMany({});
  console.log(`✅ Deleted ${repResult.deletedCount} reputation records`);
}

async function clearScans(db) {
  const scansResult = await db.collection('security_scans').deleteMany({});
  console.log(`✅ Deleted ${scansResult.deletedCount} security scans`);
  
  const statsResult = await db.collection('scan_statistics').deleteMany({});
  console.log(`✅ Deleted ${statsResult.deletedCount} scan statistics`);
  
  const usageResult = await db.collection('daily_usage').deleteMany({});
  console.log(`✅ Deleted ${usageResult.deletedCount} daily usage records`);
}

async function clearAll(db) {
  console.log('⚠️  Clearing ALL data from database...\n');
  
  await clearAllUsers(db);
  await clearScans(db);
  
  const auditResult = await db.collection('audit_logs').deleteMany({});
  console.log(`✅ Deleted ${auditResult.deletedCount} audit logs`);
  
  const analyticsResult = await db.collection('analytics_events').deleteMany({});
  console.log(`✅ Deleted ${analyticsResult.deletedCount} analytics events`);
  
  console.log('\n✨ Database completely cleared!');
}

async function showStats(db) {
  const collections = [
    'users',
    'user_reputation',
    'security_scans',
    'scan_statistics',
    'daily_usage',
    'audit_logs',
    'analytics_events'
  ];
  
  console.log('📊 Database Statistics:\n');
  
  for (const collection of collections) {
    const count = await db.collection(collection).countDocuments();
    console.log(`  ${collection}: ${count} documents`);
  }
  
  // User breakdown
  const usersWithUsername = await db.collection('users').countDocuments({ 
    username: { $exists: true, $ne: null } 
  });
  
  console.log(`\n  Users with usernames: ${usersWithUsername}`);
}

function showHelp() {
  console.log(`
📚 Database Admin Commands:

  node scripts/db-admin.js [command]

Commands:
  list-users      - List all users in the database
  clear-usernames - Clear only usernames (keep user records)
  clear-all-users - Delete all user records
  clear-scans     - Clear all security scan data
  clear-all       - Clear entire database
  stats           - Show database statistics
  help            - Show this help message

Examples:
  node scripts/db-admin.js stats
  node scripts/db-admin.js clear-usernames
  node scripts/db-admin.js list-users
`);
}

// Main execution
const command = process.argv[2] || 'help';
runCommand(command).catch(console.error);