import { NextRequest, NextResponse } from 'next/server';

// TwitterAPI.io credentials
const TWITTERAPI_IO_USER_ID = '344176544479072260';
const TWITTERAPI_IO_API_KEY = '344176544479072260';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, action } = body;
    
    if (!username || !action) {
      return NextResponse.json(
        { error: 'Missing username or action' },
        { status: 400 }
      );
    }

    console.log('🔍 TwitterAPI.io proxy request:', { username, action });

    if (action === 'getUserCounts') {
      return await getUserCounts(username);
    }

    return NextResponse.json(
      { error: 'Unsupported action' },
      { status: 400 }
    );

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

    // First, get user info by username
    const userInfoResponse = await fetch(
      `https://api.twitterapi.io/v1/users/by/username/${username}`,
      {
        headers: {
          'Authorization': `Bearer ${TWITTERAPI_IO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.text();
      console.error('❌ TwitterAPI.io user lookup failed:', errorData);
      
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

    if (!userData.data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userData.data;
    
    // Extract counts from user data
    const counts = {
      tweets: user.public_metrics?.tweet_count || 0,
      likes: user.public_metrics?.like_count || 0,
      retweets: 0, // TwitterAPI.io doesn't provide user's retweet count directly
      following: user.public_metrics?.following_count || 0,
      followers: user.public_metrics?.followers_count || 0
    };

    console.log('✅ Successfully fetched user counts via TwitterAPI.io:', counts);

    return NextResponse.json({
      success: true,
      counts,
      username,
      userId: user.id,
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

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'twitterapi-io-proxy',
    configured: true,
    userId: TWITTERAPI_IO_USER_ID,
    timestamp: new Date().toISOString()
  });
}