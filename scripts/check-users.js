// Script to check users in the database
// Run with: node scripts/check-users.js

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lyn-hacker';

async function checkUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Check users collection
    const usersCollection = db.collection('users');
    const totalUsers = await usersCollection.countDocuments();
    const usersWithUsername = await usersCollection.countDocuments({ username: { $exists: true, $ne: null } });
    
    console.log(`\n📊 Users Collection:`);
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with usernames: ${usersWithUsername}`);
    
    // List first 5 users with usernames
    if (usersWithUsername > 0) {
      const sampleUsers = await usersCollection.find(
        { username: { $exists: true, $ne: null } },
        { projection: { username: 1, walletAddress: 1, usernameRegisteredAt: 1 } }
      ).limit(5).toArray();
      
      console.log(`\n   Sample users with usernames:`);
      sampleUsers.forEach(user => {
        console.log(`   - @${user.username} (${user.walletAddress?.slice(0, 8)}...)`);
      });
    }
    
    // Check all users (not just those with usernames)
    const allUsers = await usersCollection.find({}, { 
      projection: { 
        _id: 1, 
        username: 1, 
        walletAddress: 1,
        createdAt: 1
      } 
    }).limit(10).toArray();
    
    console.log(`\n📋 All users (first 10):`);
    if (allUsers.length === 0) {
      console.log('   No users found in database');
    } else {
      allUsers.forEach(user => {
        console.log(`   - ID: ${user._id}`);
        console.log(`     Username: ${user.username || 'none'}`);
        console.log(`     Wallet: ${user.walletAddress || 'none'}`);
        console.log(`     Created: ${user.createdAt || 'unknown'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error checking users:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
checkUsers().catch(console.error);