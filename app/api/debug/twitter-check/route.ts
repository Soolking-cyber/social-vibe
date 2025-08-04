import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { twitterVerificationService } from '@/lib/twitter-api';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, twitter_handle')
      .eq('name', userIdentifier)
      .single();

    const twitterCheck = {
      bearerToken: !!process.env.TWITTER_BEARER_TOKEN,
      bearerTokenLength: process.env.TWITTER_BEARER_TOKEN?.length || 0,
      user: {
        name: user?.name,
        twitter_handle: user?.twitter_handle,
        userError: userError?.message
      }
    };

    // Test Twitter API access
    let apiTest = null;
    if (process.env.TWITTER_BEARER_TOKEN) {
      try {
        // Test with a known good username
        const testUserId = await twitterVerificationService.getUserIdByUsername('twitter');
        apiTest = {
          success: !!testUserId,
          testUserId,
          message: testUserId ? 'Twitter API working' : 'Twitter API not responding'
        };
      } catch (error) {
        apiTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Test user's Twitter username if available
    let userTwitterTest = null;
    if (user?.twitter_handle && process.env.TWITTER_BEARER_TOKEN) {
      try {
        const cleanUsername = user.twitter_handle.replace('@', '').replace(/[^a-zA-Z0-9_]/g, '');
        const userTwitterId = await twitterVerificationService.getUserIdByUsername(cleanUsername);
        userTwitterTest = {
          username: cleanUsername,
          success: !!userTwitterId,
          twitterId: userTwitterId,
          message: userTwitterId ? 'User Twitter account found' : 'User Twitter account not found'
        };
      } catch (error) {
        userTwitterTest = {
          username: user.twitter_handle,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      success: true,
      twitter: twitterCheck,
      apiTest,
      userTwitterTest,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}