# API Credit Optimization Guide

## Overview
This system is optimized to minimize TwitterAPI.io credit usage while maintaining reliable verification.

## API Usage Patterns

### ✅ Optimized Workflow (2 API calls total)
```javascript
// 1. Get before counts (1 API call)
const beforeCounts = await getTweetCounts(tweetId);

// 2. User completes action (like/retweet/reply)

// 3. Verify action (1 API call - fetches after counts internally)
const result = await verifyAction(tweetId, 'like', beforeCounts);
```

### ❌ Inefficient Pattern (3+ API calls)
```javascript
// Don't do this - wastes API credits
const beforeCounts = await getTweetCounts(tweetId);
const afterCounts = await getTweetCounts(tweetId); // Unnecessary!
const result = await verifyAction(tweetId, 'like', beforeCounts, afterCounts);
```

## Credit-Saving Features

### 1. Smart Caching (30-second cache)
- Prevents duplicate API calls for the same tweet
- Automatically used for `getTweetCounts`
- Bypassed during verification for accuracy

### 2. Minimal Endpoints
- **Primary**: `getTweetCounts` - Gets engagement counts
- **Verification**: `verifyLike/verifyRetweet/verifyReply` - Compares counts
- **Removed**: All user profile endpoints (saves credits)

### 3. Efficient Verification
- Only fetches after counts when needed
- Reuses provided counts when available
- Tracks API usage in response

## Usage Examples

### Like Verification (2 API calls)
```javascript
// Step 1: Get baseline (1 API call)
const before = await fetch('/api/twitterapi-io-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'getTweetCounts',
    tweetId: '1234567890'
  })
});

// Step 2: User likes the tweet

// Step 3: Verify (1 API call)
const verification = await fetch('/api/twitterapi-io-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'verifyLike',
    tweetId: '1234567890',
    beforeCounts: before.counts
    // afterCounts automatically fetched
  })
});
```

### Retweet Verification (2 API calls)
```javascript
const before = await getTweetCounts('1234567890');
// User retweets
const result = await verifyRetweet('1234567890', before.counts);
```

### Reply Verification (2 API calls)
```javascript
const before = await getTweetCounts('1234567890');
// User replies
const result = await verifyReply('1234567890', before.counts);
```

## API Response Tracking

Each response includes API usage information:
```json
{
  "success": true,
  "verified": true,
  "apiCallsUsed": 1,
  "cached": false,
  "service": "twitterapi.io"
}
```

## Best Practices

### ✅ Do This
- Use the automated workflow functions
- Let the system handle after counts
- Cache before counts in your app
- Use the 30-second cache window

### ❌ Avoid This
- Making redundant `getTweetCounts` calls
- Fetching after counts manually
- Bypassing the cache unnecessarily
- Using removed user profile endpoints

## Credit Usage Estimates

### Per Verification Job
- **Like verification**: 2 credits (before + verify)
- **Retweet verification**: 2 credits (before + verify)
- **Reply verification**: 2 credits (before + verify)

### With Caching Benefits
- **Multiple verifications same tweet**: 1 credit (cached before + verify)
- **Health checks**: 0 credits (no external API calls)

## Monitoring API Usage

### Response Headers
Check for rate limit information in responses:
```javascript
const response = await fetch('/api/twitterapi-io-proxy', ...);
console.log('Rate limit remaining:', response.headers.get('x-rate-limit-remaining'));
```

### Error Handling
```javascript
if (response.status === 429) {
  console.log('Rate limit exceeded - wait before retrying');
}
```

## Production Recommendations

1. **Implement request queuing** for high-volume applications
2. **Monitor daily credit usage** via TwitterAPI.io dashboard
3. **Use caching strategically** - 30 seconds for before counts
4. **Batch verifications** when possible
5. **Set up alerts** for approaching credit limits

## Cost Comparison

### Before Optimization
- User profile lookup: 1 credit
- Tweet details: 1 credit  
- User activity: 1 credit
- Verification logic: 1 credit
- **Total**: 4 credits per verification

### After Optimization
- Tweet counts (before): 1 credit
- Tweet counts (verify): 1 credit
- **Total**: 2 credits per verification

**50% reduction in API credit usage!**

This optimized system provides the same verification accuracy while using half the API credits, making it more cost-effective for production use.