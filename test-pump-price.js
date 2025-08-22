// Test script to check LYN token price from pump.fun API

const LYN_MINT = '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump';

async function testPumpFunPrice() {
  console.log('Testing pump.fun API for LYN token price...');
  console.log('Mint address:', LYN_MINT);
  console.log('---');
  
  try {
    // Test pump.fun API endpoint
    const pumpUrl = `https://frontend-api.pump.fun/coins/${LYN_MINT}`;
    console.log('Fetching from pump.fun:', pumpUrl);
    
    const response = await fetch(pumpUrl, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0'
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\nToken Data from pump.fun:');
      console.log('  Name:', data.name);
      console.log('  Symbol:', data.symbol);
      console.log('  Market Cap (SOL):', data.market_cap);
      console.log('  Price (SOL):', data.price);
      console.log('  USD Market Cap:', data.usd_market_cap);
      console.log('  Volume 24h:', data.volume);
      console.log('  Created:', new Date(data.created_timestamp).toLocaleString());
      
      // Calculate USD price if we have SOL price
      if (data.price) {
        // Assuming SOL = $120 for calculation
        const solPrice = 120;
        const usdPrice = parseFloat(data.price) * solPrice;
        console.log(`\n💰 Calculated USD Price: $${usdPrice.toFixed(6)}`);
      }
      
      console.log('\nFull response:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('Response:', text);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n---');
  console.log('Testing alternative DexScreener API...');
  
  try {
    const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${LYN_MINT}`;
    console.log('Fetching from:', dexUrl);
    
    const response = await fetch(dexUrl);
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        console.log('\n✅ Found on DexScreener:');
        data.pairs.forEach((pair, idx) => {
          console.log(`\nPair ${idx + 1}:`);
          console.log('  DEX:', pair.dexId);
          console.log('  Price USD:', pair.priceUsd);
          console.log('  Liquidity USD:', pair.liquidity?.usd);
          console.log('  Volume 24h:', pair.volume?.h24);
        });
      } else {
        console.log('⚠️ No pairs found on DexScreener');
      }
    }
  } catch (error) {
    console.error('DexScreener error:', error.message);
  }
}

testPumpFunPrice();