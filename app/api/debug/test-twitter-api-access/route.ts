import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

export async function GET() {
  try {
    const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);

    console.log(`=== TWITTER API ACCESS TEST ===`);
    
    const results = {
      bearer_token_configured: !!process.env.TWITTER_BEARER_TOKEN,
      tests: {} as any,
      access_level: 'unknown',
      recommendations: [] as string[]
    };

    // Test 1: Basic user lookup (should work with basic access)
    try {
      console.log(`\n--- Test 1: Basic User Lookup ---`);
      const testUser = await client.v2.userByUsername('twitter');
      results.tests.user_lookup = {
        success: true,
        endpoint: 'userByUsername',
        access_required: 'Basic',
        result: `Found user: ${testUser.data?.username}`
      };
      console.log(`✅ User lookup works`);
    } catch (error) {
      results.tests.user_lookup = {
        success: false,
        endpoint: 'userByUsername',
        access_required: 'Basic',
        error: (error as any).code || 'Unknown error'
      };
      console.log(`❌ User lookup failed: ${(error as any).code}`);
    }

    // Test 2: User timeline (should work with basic access)
    try {
      console.log(`\n--- Test 2: User Timeline ---`);
      const timeline = await client.v2.userTimeline('44196397', { // Twitter's official account
        max_results: 5
      });
      results.tests.user_timeline = {
        success: true,
        endpoint: 'userTimeline',
        access_required: 'Basic',
        result: `Retrieved ${timeline.data?.data?.length || 0} tweets`
      };
      console.log(`✅ User timeline works`);
    } catch (error) {
      results.tests.user_timeline = {
        success: false,
        endpoint: 'userTimeline',
        access_required: 'Basic',
        error: (error as any).code || 'Unknown error'
      };
      console.log(`❌ User timeline failed: ${(error as any).code}`);
    }

    // Test 3: Tweet liked by (requires elevated access)
    try {
      console.log(`\n--- Test 3: Tweet Liked By (Elevated Access) ---`);
      const likers = await client.v2.tweetLikedBy('1946556347337633914', {
        max_results: 5
      });
      results.tests.tweet_liked_by = {
        success: true,
        endpoint: 'tweetLikedBy',
        access_required: 'Elevated',
        result: `Retrieved ${likers.data?.length || 0} likers`
      };
      console.log(`✅ Tweet liked by works - you have elevated access!`);
    } catch (error) {
      results.tests.tweet_liked_by = {
        success: false,
        endpoint: 'tweetLikedBy',
        access_required: 'Elevated',
        error: (error as any).code || 'Unknown error'
      };
      console.log(`❌ Tweet liked by failed: ${(error as any).code} (expected with basic access)`);
    }

    // Test 4: User liked tweets (requires elevated access)
    try {
      console.log(`\n--- Test 4: User Liked Tweets (Elevated Access) ---`);
      const likes = await client.v2.userLikedTweets('44196397', {
        max_results: 5
      });
      results.tests.user_liked_tweets = {
        success: true,
        endpoint: 'userLikedTweets',
        access_required: 'Elevated',
        result: `Retrieved ${likes.data?.data?.length || 0} liked tweets`
      };
      console.log(`✅ User liked tweets works - you have elevated access!`);
    } catch (error) {
      results.tests.user_liked_tweets = {
        success: false,
        endpoint: 'userLikedTweets',
        access_required: 'Elevated',
        error: (error as any).code || 'Unknown error'
      };
      console.log(`❌ User liked tweets failed: ${(error as any).code} (expected with basic access)`);
    }

    // Test 5: Tweet retweeted by (requires elevated access)
    try {
      console.log(`\n--- Test 5: Tweet Retweeted By (Elevated Access) ---`);
      const retweeters = await client.v2.tweetRetweetedBy('1946556347337633914', {
        max_results: 5
      });
      results.tests.tweet_retweeted_by = {
        success: true,
        endpoint: 'tweetRetweetedBy',
        access_required: 'Elevated',
        result: `Retrieved ${retweeters.data?.length || 0} retweeters`
      };
      console.log(`✅ Tweet retweeted by works - you have elevated access!`);
    } catch (error) {
      results.tests.tweet_retweeted_by = {
        success: false,
        endpoint: 'tweetRetweetedBy',
        access_required: 'Elevated',
        error: (error as any).code || 'Unknown error'
      };
      console.log(`❌ Tweet retweeted by failed: ${(error as any).code} (expected with basic access)`);
    }

    // Determine access level
    const elevatedEndpoints = ['tweet_liked_by', 'user_liked_tweets', 'tweet_retweeted_by'];
    const hasElevatedAccess = elevatedEndpoints.some(endpoint => results.tests[endpoint]?.success);
    const hasBasicAccess = results.tests.user_lookup?.success || results.tests.user_timeline?.success;

    if (hasElevatedAccess) {
      results.access_level = 'Elevated';
      results.recommendations = [
        '🎉 You have Elevated Twitter API access!',
        'All verification methods should work',
        'Like and retweet verification will work properly'
      ];
    } else if (hasBasicAccess) {
      results.access_level = 'Basic';
      results.recommendations = [
        '⚠️ You have Basic Twitter API access',
        'Like/retweet verification requires elevated access',
        'Using development fallback for verification',
        'To get full verification, upgrade to Elevated access at developer.twitter.com'
      ];
    } else {
      results.access_level = 'None/Invalid';
      results.recommendations = [
        '❌ Twitter API access is not working',
        'Check your TWITTER_BEARER_TOKEN in .env.local',
        'Verify the token is valid at developer.twitter.com'
      ];
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error testing Twitter API access:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}