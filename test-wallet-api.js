// Test the wallet tokens API endpoint

const LYN_MINT = '3hFEAFfPBgquhPcuQYJWufENYg9pjMDvgEEsv4jxpump';
const AGENT_WALLET = 'rF1vBfJSzPfBRquWVWQYr9u5krKeFQYt2367kaiXLkK';

async function testWalletTokens() {
  console.log('Testing wallet tokens API...');
  console.log('Agent wallet:', AGENT_WALLET);
  console.log('---\n');
  
  try {
    const response = await fetch('http://localhost:3003/api/wallet/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress: AGENT_WALLET
      })
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('\n📊 Wallet Summary:');
      console.log('  Total Value: $' + data.totalValue?.toFixed(2));
      console.log('  Number of tokens:', data.tokens?.length || 0);
      
      if (data.tokens && data.tokens.length > 0) {
        console.log('\n💰 Token Holdings:');
        data.tokens.forEach(token => {
          console.log(`\n  ${token.symbol} (${token.name}):`);
          console.log(`    Balance: ${token.balance}`);
          console.log(`    Value: ${token.value}`);
          console.log(`    24h Change: ${token.change}`);
          if (token.mint === LYN_MINT) {
            console.log(`    ✅ This is the LYN token!`);
            console.log(`    Mint: ${token.mint}`);
          }
        });
      }
      
      // Look specifically for LYN token
      const lynToken = data.tokens?.find(t => 
        t.mint === LYN_MINT || 
        t.symbol === 'LYN' || 
        t.mint?.includes('pump')
      );
      
      if (lynToken) {
        console.log('\n🎯 LYN Token Details:');
        console.log('  Symbol:', lynToken.symbol);
        console.log('  Balance:', lynToken.balance);
        console.log('  Value:', lynToken.value);
        console.log('  UI Amount:', lynToken.uiAmount);
        
        // Calculate implied price
        if (lynToken.uiAmount && lynToken.value) {
          const valueNum = parseFloat(lynToken.value.replace('$', '').replace(',', ''));
          const impliedPrice = valueNum / lynToken.uiAmount;
          console.log('  Implied Price: $' + impliedPrice.toFixed(6));
        }
      } else {
        console.log('\n⚠️ LYN token not found in wallet');
      }
      
    } else {
      const error = await response.text();
      console.error('API Error:', error);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

// Run the test
testWalletTokens();