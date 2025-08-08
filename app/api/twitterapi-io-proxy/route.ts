import { NextRequest, NextResponse } from 'next/server';

// TwitterAPI.io credentials from environment variables
const TWITTERAPI_IO_USER_ID = process.env.TWITTERAPI_IO_USER_ID;
const TWITTERAPI_IO_API_KEY = process.env.TWITTERAPI_IO_API_KEY;

// Debug logging
console.log('🔧 Environment variables check:', {
  hasUserId: !!TWITTERAPI_IO_USER_ID,
  hasApiKey: !!TWITTERAPI_IO_API_KEY,
  userIdLength: TWITTERAPI_IO_USER_ID?.length || 0,
  apiKeyLength: TWITTERAPI_IO_API_KEY?.length || 0,
  nodeEnv: process.env.NODE_ENV
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tweetId, username } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    console.log('🔍 TwitterAPI.io proxy request:', { action, tweetId, username });

    // Check if credentials are configured
    if (!TWITTERAPI_IO_USER_ID || !TWITTERAPI_IO_API_KEY) {
      console.error('❌ TwitterAPI.io credentials not configured', {
        hasUserId: !!TWITTERAPI_IO_USER_ID,
        hasApiKey: !!TWITTERAPI_IO_API_KEY,
        userIdValue: TWITTERAPI_IO_USER_ID,
        apiKeyValue: TWITTERAPI_IO_API_KEY ? `${TWITTERAPI_IO_API_KEY.substring(0, 8)}...` : 'null'
      });
      return NextResponse.json(
        { error: 'TwitterAPI.io credentials not configured. Please set TWITTERAPI_IO_USER_ID and TWITTERAPI_IO_API_KEY environment variables.' },
        { status: 500 }
      );
    }

    // Handle different actions - optimized for minimal API usage
    switch (action) {
      case 'getTweetCounts':
        if (!tweetId) {
          return NextResponse.json({ error: 'Tweet ID required for getting tweet counts' }, { status: 400 });
        }
        return await getTweetCounts(tweetId);

      case 'verifyLike':
        if (!tweetId) {
          return NextResponse.json({ error: 'Tweet ID required for like verification' }, { status: 400 });
        }
        const { beforeCounts: beforeLike, afterCounts: afterLike } = body;
        return await verifyTweetEngagement(tweetId, 'like', beforeLike, afterLike);

      case 'verifyRetweet':
        if (!tweetId) {
          return NextResponse.json({ error: 'Tweet ID required for retweet verification' }, { status: 400 });
        }
        const { beforeCounts: beforeRetweet, afterCounts: afterRetweet } = body;
        return await verifyTweetEngagement(tweetId, 'retweet', beforeRetweet, afterRetweet);

      case 'verifyReply':
        if (!tweetId) {
          return NextResponse.json({ error: 'Tweet ID required for reply verification' }, { status: 400 });
        }
        const { beforeCounts: beforeReply, afterCounts: afterReply } = body;
        return await verifyTweetEngagement(tweetId, 'reply', beforeReply, afterReply);

      default:
        return NextResponse.json(
          { error: 'Unsupported action. Primary actions: getTweetCounts, verifyLike, verifyRetweet, verifyReply' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('TwitterAPI.io proxy error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process TwitterAPI.io request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Simple in-memory cache to prevent duplicate API calls within a short timeframe
const tweetCountsCache = new Map<string, { counts: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds cache

/**
 * Get tweet engagement counts with caching to minimize API usage
 */

async function getTweetCounts(tweetId: string, skipCache = false) {
  try {
    // Check cache first to avoid unnecessary API calls
    if (!skipCache) {
      const cached = tweetCountsCache.get(tweetId);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log(`📋 Using cached tweet counts for ${tweetId}`);
        return NextResponse.json({
          success: true,
          counts: cached.counts,
          tweetId,
          service: 'twitterapi.io',
          timestamp: new Date(cached.timestamp).toISOString(),
          cached: true
        });
      }
    }

    console.log(`🔍 Fetching fresh tweet counts for tweet ${tweetId}`);

    const response = await fetch(
      `https://api.twitterapi.io/twitter/tweets?tweet_ids=${tweetId}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': TWITTERAPI_IO_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ TwitterAPI.io tweet lookup failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        tweetId
      });

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'TwitterAPI.io authentication failed. API key may be invalid.' },
          { status: 401 }
        );
      }

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'TwitterAPI.io rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `TwitterAPI.io error: ${errorData || response.status}` },
        { status: response.status }
      );
    }

    const tweetData = await response.json();

    if (!tweetData.tweets || !Array.isArray(tweetData.tweets) || tweetData.tweets.length === 0) {
      console.error('❌ Tweet not found:', tweetId);
      return NextResponse.json(
        { error: 'Tweet not found or is private' },
        { status: 404 }
      );
    }

    const tweet = tweetData.tweets[0];
    const counts = {
      likes: tweet.likeCount || tweet.favorite_count || 0,
      retweets: tweet.retweetCount || tweet.retweet_count || 0,
      replies: tweet.replyCount || tweet.reply_count || 0,
      quotes: tweet.quoteCount || tweet.quote_count || 0
    };

    // Cache the result to minimize future API calls
    tweetCountsCache.set(tweetId, {
      counts,
      timestamp: Date.now()
    });

    console.log('✅ Successfully fetched and cached tweet counts:', counts);

    return NextResponse.json({
      success: true,
      counts,
      tweetId,
      service: 'twitterapi.io',
      timestamp: new Date().toISOString(),
      cached: false
    });

  } catch (error) {
    console.error('❌ Error fetching tweet counts:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tweet counts',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Optimized verification - only fetches after counts when needed
 */
async function verifyTweetEngagement(
  tweetId: string,
  actionType: 'like' | 'retweet' | 'reply',
  beforeCounts?: any,
  afterCounts?: any
) {
  try {
    console.log(`🔍 Verifying ${actionType} on tweet ${tweetId} (API-optimized)`);

    // If no before counts, we can't verify (need baseline)
    if (!beforeCounts) {
      return NextResponse.json({
        success: false,
        error: 'Before counts required for verification',
        message: 'Please provide beforeCounts to compare against. Call getTweetCounts first.',
        tweetId,
        service: 'twitterapi.io'
      }, { status: 400 });
    }

    // Only fetch after counts if not provided (saves API calls)
    let currentCounts = afterCounts;
    if (!currentCounts) {
      console.log('📡 Fetching after counts (1 API call)...');
      const countsResponse = await getTweetCounts(tweetId, true); // Skip cache for verification
      const countsData = await countsResponse.json();

      if (!countsData.success) {
        return countsData; // Return the error response
      }

      currentCounts = countsData.counts;
    } else {
      console.log('📋 Using provided after counts (0 API calls)');
    }

    // Compare counts based on action type
    let verified = false;
    let difference = 0;
    let countType = '';

    switch (actionType) {
      case 'like':
        countType = 'likes';
        difference = (currentCounts.likes || 0) - (beforeCounts.likes || 0);
        verified = difference > 0;
        break;

      case 'retweet':
        countType = 'retweets';
        difference = (currentCounts.retweets || 0) - (beforeCounts.retweets || 0);
        verified = difference > 0;
        break;

      case 'reply':
        countType = 'replies';
        difference = (currentCounts.replies || 0) - (beforeCounts.replies || 0);
        verified = difference > 0;
        break;
    }

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (difference === 1) {
      confidence = 'high'; // Exactly one increase - most likely the user's action
    } else if (difference > 1) {
      confidence = 'medium'; // Multiple increases - user's action plus others
    }

    const message = verified
      ? `✅ Verified: ${countType} increased by ${difference} (${beforeCounts[countType]} → ${currentCounts[countType]})`
      : `❌ Not verified: ${countType} did not increase (${beforeCounts[countType]} → ${currentCounts[countType]})`;

    console.log(message);

    return NextResponse.json({
      success: true,
      verified,
      action: actionType,
      tweetId,
      message,
      counts: {
        before: beforeCounts,
        after: currentCounts,
        difference,
        countType
      },
      confidence,
      service: 'twitterapi.io',
      timestamp: new Date().toISOString(),
      apiCallsUsed: afterCounts ? 0 : 1 // Track API usage
    });

  } catch (error) {
    console.error(`❌ Error verifying ${actionType}:`, error);
    return NextResponse.json(
      {
        error: `Failed to verify ${actionType}`,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  const isConfigured = !!(TWITTERAPI_IO_USER_ID && TWITTERAPI_IO_API_KEY);

  console.log('🔍 TwitterAPI.io proxy health check called');
  console.log('Environment check:', {
    hasUserId: !!TWITTERAPI_IO_USER_ID,
    hasApiKey: !!TWITTERAPI_IO_API_KEY,
    nodeEnv: process.env.NODE_ENV
  });

  return NextResponse.json({
    status: isConfigured ? 'healthy' : 'misconfigured',
    service: 'twitterapi-io-proxy',
    configured: isConfigured,
    userId: TWITTERAPI_IO_USER_ID || 'not_set',
    hasApiKey: !!TWITTERAPI_IO_API_KEY,
    timestamp: new Date().toISOString(),
    supportedActions: ['getTweetCounts', 'verifyLike', 'verifyRetweet', 'verifyReply'],
    primaryMethod: 'tweet-engagement-counts',
    optimization: 'api-credit-minimized',
    cacheEnabled: true,
    deployment: 'active'
  });
}