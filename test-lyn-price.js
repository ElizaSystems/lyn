// Test script to check LYN token price fetching

const LYN_MINT = '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump';

async function testJupiterPrice() {
  console.log('Testing Jupiter API for LYN token price...');
  console.log('Mint address:', LYN_MINT);
  console.log('---');
  
  try {
    // Test Jupiter v2 API
    const jupiterUrl = `https://api.jup.ag/price/v2?ids=${LYN_MINT}`;
    console.log('Fetching from:', jupiterUrl);
    
    const response = await fetch(jupiterUrl);
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Full response:', JSON.stringify(data, null, 2));
      
      const tokenData = data.data?.[LYN_MINT];
      if (tokenData) {
        console.log('\n✅ LYN Token Price Data Found:');
        console.log('  Price: $' + tokenData.price);
        console.log('  24h Change:', tokenData.change24h + '%');
      } else {
        console.log('\n⚠️ No price data found for LYN token');
        console.log('This is expected for new tokens not yet on major DEXes');
      }
    } else {
      console.log('❌ Jupiter API returned error:', response.status);
    }
  } catch (error) {
    console.error('❌ Error fetching from Jupiter:', error.message);
  }
  
  console.log('\n---');
  console.log('Testing Birdeye API for comparison...');
  
  try {
    // Test Birdeye API (alternative)
    const birdeyeUrl = `https://public-api.birdeye.so/defi/price?address=${LYN_MINT}`;
    console.log('Fetching from:', birdeyeUrl);
    
    const response = await fetch(birdeyeUrl, {
      headers: {
        'accept': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Birdeye response:', JSON.stringify(data, null, 2));
    } else {
      console.log('⚠️ Birdeye API returned:', response.status);
    }
  } catch (error) {
    console.error('Birdeye error:', error.message);
  }
  
  console.log('\n---');
  console.log('Note: If no price data is found, the app uses a calculated price based on market cap target');
  console.log('Target Market Cap: $4.2M');
  console.log('Total Supply: 1B tokens');
  console.log('Calculated Price: $0.0042');
}

testJupiterPrice();