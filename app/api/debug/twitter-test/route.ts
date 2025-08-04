import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { twitterVerificationService } from '@/lib/twitter-api';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const userIdentifier = session.user.name;
    if (!userIdentifier) {
      return NextResponse.json({
        error: 'No Twitter username found'
      }, { status: 400 });
    }

    // Clean the username
    const cleanUsername = userIdentifier.replace('@', '').replace(/[^a-zA-Z0-9_]/g, '');
    
    console.log(`Testing Twitter API for username: ${cleanUsername}`);

    // Test Twitter API connection
    const results: any = {
      username: cleanUsername,
      bearer_token_configured: !!process.env.TWITTER_BEARER_TOKEN,
      tests: {}
    };

    // Test 1: Get user ID
    try {
      const userId = await twitterVerificationService.getUserIdByUsername(cleanUsername);
      results.tests.user_lookup = {
        success: !!userId,
        user_id: userId,
        error: userId ? null : 'User not found'
      };
    } catch (error) {
      results.tests.user_lookup = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Test with a known public account (Twitter's own account)
    try {
      const twitterUserId = await twitterVerificationService.getUserIdByUsername('twitter');
      results.tests.known_account_test = {
        success: !!twitterUserId,
        twitter_user_id: twitterUserId,
        note: 'Testing with @twitter account to verify API works'
      };
    } catch (error) {
      results.tests.known_account_test = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Twitter test error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}