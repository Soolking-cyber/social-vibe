import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    console.log(`=== DEBUG JOB COMPLETION ENDPOINT ===`);
    
    // Check session
    const session = await getServerSession(authOptions);
    console.log(`Session check:`, {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      userName: session?.user?.name
    });

    if (!session?.user) {
      console.log(`❌ No session or user found`);
      return NextResponse.json({ 
        error: 'Unauthorized',
        debug: {
          hasSession: !!session,
          hasUser: !!session?.user
        }
      }, { status: 401 });
    }

    // Check request body
    let body;
    try {
      body = await request.json();
      console.log(`Request body:`, body);
    } catch (parseError) {
      console.log(`❌ Failed to parse request body:`, parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        debug: { parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error' }
      }, { status: 400 });
    }

    const { jobId } = body;
    console.log(`Job ID:`, { jobId, type: typeof jobId });

    if (!jobId) {
      console.log(`❌ No jobId provided`);
      return NextResponse.json({ 
        error: 'Job ID is required',
        debug: { receivedBody: body }
      }, { status: 400 });
    }

    // Test environment variables
    console.log(`Environment check:`, {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasTwitterBearer: !!process.env.TWITTER_BEARER_TOKEN,
      nodeEnv: process.env.NODE_ENV
    });

    return NextResponse.json({
      success: true,
      debug: {
        session: {
          userEmail: session.user.email,
          userName: session.user.name,
          hasImage: !!session.user.image
        },
        request: {
          jobId,
          jobIdType: typeof jobId
        },
        environment: {
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasTwitterBearer: !!process.env.TWITTER_BEARER_TOKEN,
          nodeEnv: process.env.NODE_ENV
        }
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: 'Debug endpoint failed',
      debug: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: typeof error
      }
    }, { status: 500 });
  }
}