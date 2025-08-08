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
    const { username, action, tweetId } = body;

    if (!username || !action) {
      return NextResponse.json(
        { error: 'Missing username or action' },
        { status: 400 }
      );
    }

    console.log('🔍 TwitterAPI.io proxy request:', { username, action, tweetId });

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

    // Handle different actions
    switch (action) {
      case 'getUserCounts':
        return await getUserCounts(username);

      case 'verifyLike':
        if (!tweetId) {
          return NextResponse.json({ error: 'Tweet ID required for like verification' }, { status: 400 });
        }
        return await verifyTweetInteraction(username, tweetId, 'like');

      case 'verifyRetweet':
        if (!tweetId) {
          return NextResponse.json({ error: 'Tweet ID required for retweet verification' }, { status: 400 });
        }
        return await verifyTweetInteraction(username, tweetId, 'retweet');

      case 'verifyReply':
        if (!tweetId) {
          return NextResponse.json({ error: 'Tweet ID required for reply verification' }, { status: 400 });
        }
        return await verifyReplyInteraction(username, tweetId);

      default:
        return NextResponse.json(
          { error: 'Unsupported action. Supported: getUserCounts, verifyLike, verifyRetweet, verifyReply' },
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

async function getUserCounts(username: string) {
  try {
    console.log(`🔍 Fetching user counts for @${username} via TwitterAPI.io...`);

    // Use the correct TwitterAPI.io endpoint
    console.log(`🔄 Fetching user data for: ${username}`);
    console.log(`🔑 Using API key: ${TWITTERAPI_IO_API_KEY ? 'SET' : 'NOT SET'}`);

    const userInfoResponse = await fetch(
      `https://api.twitterapi.io/twitter/user/last_tweets?userName=${username}&count=1`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': TWITTERAPI_IO_API_KEY!,
        },
      }
    );

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.text();
      console.error('❌ TwitterAPI.io user lookup failed:', {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        errorData,
        headers: Object.fromEntries(userInfoResponse.headers.entries())
      });

      if (userInfoResponse.status === 401) {
        return NextResponse.json(
          { error: 'TwitterAPI.io authentication failed. API key may be invalid.' },
          { status: 401 }
        );
      }

      if (userInfoResponse.status === 429) {
        return NextResponse.json(
          { error: 'TwitterAPI.io rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `TwitterAPI.io error: ${errorData || userInfoResponse.status}` },
        { status: userInfoResponse.status }
      );
    }

    const userData = await userInfoResponse.json();
    console.log('📊 TwitterAPI.io user data:', userData);

    if (!userData.data || !Array.isArray(userData.data) || userData.data.length === 0) {
      console.error('❌ No tweets found for user:', username);
      return NextResponse.json(
        { error: `No tweets found for user @${username}. User may not exist or have no tweets.` },
        { status: 404 }
      );
    }

    // Get user info from the first tweet's author data
    const firstTweet = userData.data[0];
    const user = firstTweet.author;

    if (!user) {
      console.error('❌ No user data found in tweets');
      return NextResponse.json(
        { error: 'Unable to extract user data from tweets' },
        { status: 404 }
      );
    }

    // Extract counts from user data (TwitterAPI.io tweets endpoint format)
    const counts = {
      tweets: user.statusesCount || user.tweetsCount || 0,
      likes: user.favouritesCount || user.likesCount || 0,
      retweets: 0, // TwitterAPI.io doesn't provide user's retweet count directly
      following: user.followingCount || user.friendsCount || user.following || 0,
      followers: user.followersCount || user.followers || 0
    };

    console.log('✅ Successfully fetched user counts via TwitterAPI.io:', counts);

    return NextResponse.json({
      success: true,
      counts,
      username,
      userId: user.id || user.userId,
      service: 'twitterapi.io'
    });

  } catch (error) {
    console.error('❌ Error fetching user counts via TwitterAPI.io:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user counts',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Verify if a user has replied to a specific tweet
 */
async function verifyReplyInteraction(username: string, tweetId: string) {
  try {
    console.log(`🔍 Verifying reply for @${username} on tweet ${tweetId}`);

    // Method 1: Check tweet replies directly
    const repliesResponse = await fetch(
      `https://api.twitterapi.io/twitter/tweet/replies?tweetId=${tweetId}&count=100`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': TWITTERAPI_IO_API_KEY!,
        },
      }
    );

    let foundInReplies = false;
    if (repliesResponse.ok) {
      const repliesData = await repliesResponse.json();
      console.log(`📊 Tweet replies data:`, repliesData);

      if (repliesData.data && Array.isArray(repliesData.data)) {
        foundInReplies = repliesData.data.some((reply: any) => {
          return reply.author?.userName === username || 
                 reply.author?.screenName === username ||
                 reply.user?.screen_name === username;
        });
      }
    }

    // Method 2: Check user's recent tweets for replies to this tweet
    const userTweetsResponse = await fetch(
      `https://api.twitterapi.io/twitter/user/last_tweets?userName=${username}&count=50`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': TWITTERAPI_IO_API_KEY!,
        },
      }
    );

    let foundInUserTweets = false;
    if (userTweetsResponse.ok) {
      const userTweetsData = await userTweetsResponse.json();
      console.log(`📊 User tweets data:`, userTweetsData);

      if (userTweetsData.data && Array.isArray(userTweetsData.data)) {
        foundInUserTweets = userTweetsData.data.some((tweet: any) => {
          return tweet.inReplyToId === tweetId || 
                 tweet.in_reply_to_status_id_str === tweetId ||
                 tweet.conversationId === tweetId ||
                 (tweet.isReply && tweet.text?.includes(tweetId));
        });
      }
    }

    const verified = foundInReplies || foundInUserTweets;

    return NextResponse.json({
      success: true,
      verified,
      action: 'reply',
      username,
      tweetId,
      message: verified
        ? `✅ Verified: User @${username} has replied to the tweet`
        : `❌ Not verified: User @${username} has not replied to the tweet`,
      methods: {
        foundInReplies,
        foundInUserTweets
      },
      service: 'twitterapi.io'
    });

  } catch (error) {
    console.error(`❌ Error verifying reply:`, error);
    return NextResponse.json(
      {
        error: `Failed to verify reply`,
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Verify if a user has interacted with a specific tweet
 * This is a verification-only approach - we don't perform actions, just verify them
 */
async function verifyTweetInteraction(username: string, tweetId: string, actionType: 'like' | 'retweet') {
  try {
    console.log(`🔍 Verifying ${actionType} for @${username} on tweet ${tweetId}`);

    // Get user's recent activity to check if they interacted with the tweet
    let endpoint = '';
    if (actionType === 'like') {
      // Check user's recent likes
      endpoint = `https://api.twitterapi.io/twitter/user/likes?userName=${username}&count=50`;
    } else if (actionType === 'retweet') {
      // Check user's recent tweets (including retweets)
      endpoint = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${username}&count=50`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': TWITTERAPI_IO_API_KEY!,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Failed to fetch user ${actionType}s:`, errorData);
      return NextResponse.json(
        { error: `Failed to verify ${actionType}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`📊 User ${actionType}s data:`, data);

    // Check if the specific tweet is in the user's recent activity
    let found = false;
    if (data.data && Array.isArray(data.data)) {
      found = data.data.some((item: any) => {
        // For likes, check if the liked tweet ID matches
        if (actionType === 'like') {
          return item.id === tweetId || item.tweetId === tweetId;
        }
        // For retweets, check if it's a retweet of the target tweet
        if (actionType === 'retweet') {
          return (item.retweeted_tweet && item.retweeted_tweet.id === tweetId) ||
            (item.quoted_tweet && item.quoted_tweet.id === tweetId) ||
            item.text?.includes(tweetId);
        }
        return false;
      });
    }

    return NextResponse.json({
      success: true,
      verified: found,
      action: actionType,
      username,
      tweetId,
      message: found
        ? `✅ Verified: User @${username} has ${actionType}d the tweet`
        : `❌ Not verified: User @${username} has not ${actionType}d the tweet`,
      service: 'twitterapi.io'
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

  return NextResponse.json({
    status: isConfigured ? 'healthy' : 'misconfigured',
    service: 'twitterapi-io-proxy',
    configured: isConfigured,
    userId: TWITTERAPI_IO_USER_ID || 'not_set',
    hasApiKey: !!TWITTERAPI_IO_API_KEY,
    timestamp: new Date().toISOString(),
    supportedActions: ['getUserCounts', 'verifyLike', 'verifyRetweet', 'verifyReply']
  });
}