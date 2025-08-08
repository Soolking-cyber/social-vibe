// Test script for tweet verification
// Tweet: https://x.com/socialimpactfun/status/1946556347337633914

const TWEET_ID = '1875776331495154148';
const API_BASE = 'http://localhost:3000/api/twitterapi-io-proxy';

async function testGetTweetCounts() {
  console.log('🔄 Testing getTweetCounts...');
  console.log(`📍 Tweet: https://x.com/koklauncher/status/${TWEET_ID}`);
  
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getTweetCounts',
        tweetId: TWEET_ID
      }),
    });

    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Request failed:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('📊 Raw response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Tweet counts retrieved successfully:');
      console.log(`💙 Likes: ${data.counts.likes}`);
      console.log(`🔄 Retweets: ${data.counts.retweets}`);
      console.log(`💬 Replies: ${data.counts.replies}`);
      console.log(`📝 Quotes: ${data.counts.quotes}`);
      console.log(`⏰ Timestamp: ${data.timestamp}`);
      
      return data.counts;
    } else {
      console.error('❌ API returned error:', data.error);
      return null;
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
    return null;
  }
}

async function testLikeVerification() {
  console.log('\n🔄 Starting like verification test...');
  
  try {
    // Step 1: Get initial counts
    console.log('📊 Step 1: Getting initial tweet counts...');
    const beforeCounts = await testGetTweetCounts();
    
    if (!beforeCounts) {
      console.error('❌ Failed to get initial counts');
      return;
    }

    console.log(`\n📋 Initial state:`);
    console.log(`💙 Current likes: ${beforeCounts.likes}`);
    
    // Step 2: Wait for user action
    console.log('\n👆 Please like the tweet now!');
    console.log('🔗 Tweet URL: https://x.com/koklauncher/status/1875776331495154148');
    console.log('⏳ Waiting 15 seconds for you to like the tweet...');
    
    // Countdown
    for (let i = 15; i > 0; i--) {
      process.stdout.write(`\r⏳ ${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n');

    // Step 3: Verify the like
    console.log('🔍 Step 3: Verifying like action...');
    const verifyResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'verifyLike',
        tweetId: TWEET_ID,
        beforeCounts: beforeCounts
        // afterCounts will be fetched automatically
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('❌ Verification request failed:', errorText);
      return;
    }

    const verifyData = await verifyResponse.json();
    console.log('📊 Verification response:', JSON.stringify(verifyData, null, 2));

    if (verifyData.success) {
      console.log('\n🎉 Verification Results:');
      console.log(`✅ Verified: ${verifyData.verified ? 'YES' : 'NO'}`);
      console.log(`📈 Message: ${verifyData.message}`);
      console.log(`🎯 Confidence: ${verifyData.confidence}`);
      console.log(`📊 Like count change: ${verifyData.counts.before.likes} → ${verifyData.counts.after.likes} (${verifyData.counts.difference > 0 ? '+' : ''}${verifyData.counts.difference})`);
      
      if (verifyData.verified) {
        console.log('🎊 SUCCESS: Like action was verified!');
      } else {
        console.log('😞 FAILED: Like action was not detected');
        console.log('💡 This could mean:');
        console.log('   - You didn\'t like the tweet');
        console.log('   - The like hasn\'t been processed yet');
        console.log('   - There was an API delay');
      }
    } else {
      console.error('❌ Verification failed:', verifyData.error);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
async function runTest() {
  console.log('🚀 Starting Tweet Verification Test');
  console.log('=====================================');
  
  // First, just get the current counts
  await testGetTweetCounts();
  
  // Ask if user wants to test verification
  console.log('\n❓ Do you want to test like verification?');
  console.log('   This will ask you to like the tweet and then verify the action.');
  console.log('   Press Ctrl+C to exit, or wait 5 seconds to continue...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Run the full verification test
  await testLikeVerification();
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testGetTweetCounts, testLikeVerification, runTest };
}

// Run if called directly
if (typeof require !== 'undefined' && require.main === module) {
  runTest().catch(console.error);
}