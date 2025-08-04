import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { twitterVerificationService } from '@/lib/twitter-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, twitter_handle')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tests = {
      user_info: {
        display_name: user.name,
        twitter_handle: user.twitter_handle,
        session_twitter_handle: (session.user as any).twitterHandle || null
      },
      twitter_handle_lookup: null as any,
      display_name_lookup: null as any
    };

    // Test Twitter handle lookup if available
    if (user.twitter_handle) {
      try {
        const twitterId = await twitterVerificationService.getUserIdByUsername(user.twitter_handle);
        tests.twitter_handle_lookup = {
          username: user.twitter_handle,
          success: !!twitterId,
          twitter_id: twitterId,
          error: twitterId ? null : 'User not found'
        };
      } catch (error) {
        tests.twitter_handle_lookup = {
          username: user.twitter_handle,
          success: false,
          twitter_id: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Test display name lookup for comparison
    if (user.name) {
      try {
        const cleanName = user.name.replace('@', '').replace(/[^a-zA-Z0-9_]/g, '');
        const twitterId = await twitterVerificationService.getUserIdByUsername(cleanName);
        tests.display_name_lookup = {
          username: cleanName,
          success: !!twitterId,
          twitter_id: twitterId,
          error: twitterId ? null : 'User not found'
        };
      } catch (error) {
        tests.display_name_lookup = {
          username: user.name,
          success: false,
          twitter_id: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      success: true,
      tests,
      recommendation: user.twitter_handle 
        ? 'Twitter handle is set and will be used for verification'
        : 'No Twitter handle set. Please set your Twitter handle in the dashboard for proper verification.'
    });

  } catch (error) {
    console.error('Error in Twitter handle test:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}