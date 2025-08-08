// Simple Twitter Verification Example
// This demonstrates the clean tweet engagement count approach

const TWEET_ID = '1234567890'; // Replace with actual tweet ID
const API_BASE = '/api/twitterapi-io-proxy';

async function verifyLike() {
  console.log('🔄 Starting like verification...');
  
  try {
    // Step 1: Get before counts
    console.log('📊 Getting before counts...');
    const beforeResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getTweetCounts',
        tweetId: TWEET_ID
      })
    });
    
    const beforeData = await beforeResponse.json();
    if (!beforeData.success) {
      throw new Error(beforeData.error);
    }
    
    const beforeCounts = beforeData.counts;
    console.log('📊 Before counts:', beforeCounts);
    console.log(`💙 Current likes: ${beforeCounts.likes}`);
    
    // Step 2: User instruction
    console.log('👆 Please like the tweet now!');
    console.log('⏳ Waiting 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 3: Get after counts and verify
    console.log('🔍 Verifying like action...');
    const verifyResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verifyLike',
        tweetId: TWEET_ID,
        beforeCounts: beforeCounts
        // afterCounts will be fetched automatically
      })
    });
    
    const verifyData = await verifyResponse.json();
    if (!verifyData.success) {
      throw new Error(verifyData.error);
    }
    
    // Step 4: Show results
    console.log('\n🎉 Verification Results:');
    console.log(`✅ Verified: ${verifyData.verified}`);
    console.log(`📈 Message: ${verifyData.message}`);
    console.log(`🎯 Confidence: ${verifyData.confidence}`);
    console.log(`📊 Likes: ${verifyData.counts.before.likes} → ${verifyData.counts.after.likes} (+${verifyData.counts.difference})`);
    
    return verifyData.verified;
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

async function verifyRetweet() {
  console.log('🔄 Starting retweet verification...');
  
  try {
    // Get before counts
    const beforeResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getTweetCounts',
        tweetId: TWEET_ID
      })
    });
    
    const beforeData = await beforeResponse.json();
    const beforeCounts = beforeData.counts;
    console.log(`🔄 Current retweets: ${beforeCounts.retweets}`);
    
    console.log('👆 Please retweet the tweet now!');
    console.log('⏳ Waiting 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verify retweet
    const verifyResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verifyRetweet',
        tweetId: TWEET_ID,
        beforeCounts: beforeCounts
      })
    });
    
    const verifyData = await verifyResponse.json();
    console.log(`✅ Retweet verified: ${verifyData.verified}`);
    console.log(`📊 Retweets: ${verifyData.counts.before.retweets} → ${verifyData.counts.after.retweets} (+${verifyData.counts.difference})`);
    
    return verifyData.verified;
    
  } catch (error) {
    console.error('❌ Retweet verification failed:', error.message);
    return false;
  }
}

async function verifyReply() {
  console.log('🔄 Starting reply verification...');
  
  try {
    // Get before counts
    const beforeResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getTweetCounts',
        tweetId: TWEET_ID
      })
    });
    
    const beforeData = await beforeResponse.json();
    const beforeCounts = beforeData.counts;
    console.log(`💬 Current replies: ${beforeCounts.replies}`);
    
    console.log('👆 Please reply to the tweet now!');
    console.log('⏳ Waiting 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Verify reply
    const verifyResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verifyReply',
        tweetId: TWEET_ID,
        beforeCounts: beforeCounts
      })
    });
    
    const verifyData = await verifyResponse.json();
    console.log(`✅ Reply verified: ${verifyData.verified}`);
    console.log(`📊 Replies: ${verifyData.counts.before.replies} → ${verifyData.counts.after.replies} (+${verifyData.counts.difference})`);
    
    return verifyData.verified;
    
  } catch (error) {
    console.error('❌ Reply verification failed:', error.message);
    return false;
  }
}

// Example usage:
// verifyLike();
// verifyRetweet();
// verifyReply();

export { verifyLike, verifyRetweet, verifyReply };