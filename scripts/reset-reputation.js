const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const WALLET_ADDRESS = 'ABHVsoEg22fo69mxu12VAEseVdpfRR9uW9jyVoZ9v1di';

async function resetReputation() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'lyn-hacker');
    
    // Reset reputation to 0
    const result = await db.collection('user_reputation').updateOne(
      { walletAddress: WALLET_ADDRESS },
      {
        $set: {
          reputationScore: 0,
          tier: 'novice',
          feedbackCount: 0,
          votesReceived: 0,
          accuracyScore: 0,
          consistencyScore: 0,
          participationScore: 0,
          moderatorBonus: 0,
          penaltyPoints: 0,
          badges: [],
          statistics: {
            totalFeedbackSubmitted: 0,
            totalVotesCast: 0,
            accurateReports: 0,
            inaccurateReports: 0,
            spamReports: 0,
            lastActivityAt: new Date()
          },
          updatedAt: new Date()
        }
      }
    );
    
    console.log('Reputation reset result:', {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
    
    // Verify the reset
    const user = await db.collection('user_reputation').findOne({ walletAddress: WALLET_ADDRESS });
    console.log('\nCurrent reputation:', {
      walletAddress: user?.walletAddress,
      reputationScore: user?.reputationScore,
      tier: user?.tier,
      badges: user?.badges
    });
    
    console.log('\n✅ Reputation has been reset to 0!');
    console.log('You now start from the beginning and must earn reputation through:');
    console.log('- Performing security scans');
    console.log('- Submitting accurate reports');
    console.log('- Contributing to the community');
    console.log('- Staking tokens');
    console.log('- Participating in governance');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

resetReputation();
