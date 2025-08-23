const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const WALLET_ADDRESS = 'ABHVsoEg22fo69mxu12VAEseVdpfRR9uW9jyVoZ9v1di';
const USERNAME = 'defai';

async function fixUsername() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'lyn-hacker');
    
    // 1. Check current user state
    const currentUser = await db.collection('users').findOne({ walletAddress: WALLET_ADDRESS });
    console.log('\nCurrent user state:', currentUser ? {
      _id: currentUser._id,
      walletAddress: currentUser.walletAddress,
      username: currentUser.username,
      profile: currentUser.profile
    } : 'USER NOT FOUND');
    
    // 2. Force update/insert the user with username
    const userResult = await db.collection('users').replaceOne(
      { walletAddress: WALLET_ADDRESS },
      {
        walletAddress: WALLET_ADDRESS,
        username: USERNAME,
        profile: { username: USERNAME },
        usernameRegisteredAt: new Date(),
        registrationBurnAmount: 10,
        createdAt: currentUser?.createdAt || new Date(),
        updatedAt: new Date(),
        tokenBalance: 16349920,
        hasTokenAccess: true
      },
      { upsert: true }
    );
    
    console.log('\nUser update result:', {
      matched: userResult.matchedCount,
      modified: userResult.modifiedCount,
      upserted: userResult.upsertedCount
    });
    
    // 3. Verify the update
    const updatedUser = await db.collection('users').findOne({ walletAddress: WALLET_ADDRESS });
    console.log('\nUpdated user:', {
      _id: updatedUser._id,
      walletAddress: updatedUser.walletAddress,
      username: updatedUser.username,
      profile: updatedUser.profile
    });
    
    // 4. Force create/update referral code
    const referralResult = await db.collection('referral_codes_v2').replaceOne(
      { walletAddress: WALLET_ADDRESS },
      {
        walletAddress: WALLET_ADDRESS,
        code: USERNAME,
        username: USERNAME,
        isVanity: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        stats: {
          totalReferrals: 0,
          totalBurned: 0,
          totalRewards: 0
        }
      },
      { upsert: true }
    );
    
    console.log('\nReferral code update result:', {
      matched: referralResult.matchedCount,
      modified: referralResult.modifiedCount,
      upserted: referralResult.upsertedCount
    });
    
    // 5. Verify referral code
    const referralCode = await db.collection('referral_codes_v2').findOne({ walletAddress: WALLET_ADDRESS });
    console.log('\nReferral code:', {
      code: referralCode?.code,
      isVanity: referralCode?.isVanity,
      username: referralCode?.username
    });
    
    // 6. Check if username is taken
    const usernameCheck = await db.collection('users').findOne({ username: USERNAME });
    console.log('\nUsername "defai" is taken by wallet:', usernameCheck?.walletAddress);
    
    console.log('\n✅ Username and referral code have been forcefully set!');
    console.log('Your profile should now show:');
    console.log('- Username: @defai');
    console.log('- Referral link: https://app.lynai.xyz?ref=defai');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixUsername();
