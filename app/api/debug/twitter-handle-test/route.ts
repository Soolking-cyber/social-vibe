import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { twitterVerificationService } from '@/lib/twitter-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;
    
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, twitter_handle, email')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user) {
      return NextResponse.json({ 
        error: 'User not found',
        debug: { userIdentifier, userError }
      }, { status: 404 });
    }

    // Test the secure Twitter handle system
    const testResults = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        twitterHandle: user.twitter_handle
      },
      session: {
        hasSession: !!session,
        userName: session.user.name,
        userEmail: session.user.email,
        sessionTwitterHandle: (session.user as any).twitterHandle
      },
      verification: {
        hasStoredHandle: !!user.twitter_handle,
        canGenerateId: false,
        generatedId: null,
        error: null
      }
    };

    // Test ID generation if handle exists
    if (user.twitter_handle) {
      try {
        const generatedId = await twitterVerificationService.getUserIdByUsername(user.twitter_handle);
        testResults.verification.canGenerateId = true;
        testResults.verification.generatedId = generatedId;
      } catch (error) {
        testResults.verification.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Twitter handle system test completed',
      results: testResults,
      recommendations: {
        hasSecureHandle: !!user.twitter_handle,
        needsHandleUpdate: !user.twitter_handle,
        systemReady: !!user.twitter_handle && testResults.verification.canGenerateId,
        apiCallsNeeded: 0 // Zero API calls needed!
      }
    });

  } catch (error) {
    console.error('Error in Twitter handle test:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      debug: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}