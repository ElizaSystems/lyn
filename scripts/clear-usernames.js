// Script to clear usernames from the database
// Run with: node scripts/clear-usernames.js

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lyn-hacker';

async function clearUsernames() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Clear username fields from users collection
    const usersCollection = db.collection('users');
    const updateResult = await usersCollection.updateMany(
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
    
    console.log(`Cleared usernames from ${updateResult.modifiedCount} user records`);
    
    // Also clear user_reputation records that have usernames
    const reputationCollection = db.collection('user_reputation');
    const reputationResult = await reputationCollection.updateMany(
      { username: { $exists: true } },
      { $unset: { username: "" } }
    );
    
    console.log(`Cleared usernames from ${reputationResult.modifiedCount} reputation records`);
    
    // Clear username-related audit logs
    const auditCollection = db.collection('audit_logs');
    const auditResult = await auditCollection.deleteMany({
      action: 'username_registered'
    });
    
    console.log(`Deleted ${auditResult.deletedCount} username registration audit logs`);
    
    // Optional: Clear daily_usage records related to username burns
    const usageCollection = db.collection('daily_usage');
    const usageResult = await usageCollection.deleteMany({
      $or: [
        { 'metadata.action': 'username_registration' },
        { 'metadata.burnType': 'username_registration' }
      ]
    });
    
    console.log(`Deleted ${usageResult.deletedCount} usage records related to username registration`);
    
    console.log('\n✅ Successfully cleared all username data from the database');
    
  } catch (error) {
    console.error('Error clearing usernames:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
clearUsernames().catch(console.error);