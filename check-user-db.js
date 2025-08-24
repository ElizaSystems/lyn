const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://defai:nuxdzH8yOkOMY8Pj@lyn.zix0l4f.mongodb.net/?retryWrites=true&w=majority&appName=lyn';

async function checkUser() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('lyn');
    
    // Check user by wallet
    const user = await db.collection('users').findOne({ 
      walletAddress: 'XRYBQ8JQLemiXxzw88M3Yd4JroeqKQxJmq1WGA5cAim' 
    });
    
    console.log('=== USER RECORD ===');
    if (user) {
      console.log('Username:', user.username || 'NOT SET');
      console.log('Profile username:', user.profile?.username || 'NOT SET');
      console.log('Wallet:', user.walletAddress);
      console.log('Username registered at:', user.usernameRegisteredAt || 'NOT SET');
      console.log('User ID:', user._id);
    } else {
      console.log('User not found!');
    }
    
    // Check sessions
    console.log('\n=== SESSIONS ===');
    const sessions = await db.collection('sessions').find({
      $or: [
        { userId: user?._id?.toString() },
        { userId: 'XRYBQ8JQLemiXxzw88M3Yd4JroeqKQxJmq1WGA5cAim' }
      ]
    }).toArray();
    
    console.log('Sessions found:', sessions.length);
    sessions.forEach(s => {
      const expired = s.expiresAt < new Date();
      console.log(`- Session ${s._id}: ${expired ? 'EXPIRED' : 'ACTIVE'} (expires: ${s.expiresAt})`);
    });
    
    // Check if username 'admin' exists
    console.log('\n=== USERNAME CHECK ===');
    const adminUser = await db.collection('users').findOne({ username: 'admin' });
    if (adminUser) {
      console.log('Username "admin" is taken by wallet:', adminUser.walletAddress);
    } else {
      console.log('Username "admin" is available');
    }
    
  } finally {
    await client.close();
  }
}

checkUser().catch(console.error);