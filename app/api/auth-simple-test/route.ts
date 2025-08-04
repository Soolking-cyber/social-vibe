import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Import NextAuth dynamically to avoid any import issues
    const { getServerSession } = await import('next-auth/next');
    const { authOptions } = await import('@/auth');
    
    console.log('Testing NextAuth import...');
    
    const session = await getServerSession(authOptions);
    
    console.log('Session test result:', {
      hasSession: !!session,
      sessionType: typeof session,
      sessionKeys: session ? Object.keys(session) : [],
      userKeys: session?.user ? Object.keys(session.user) : []
    });
    
    return NextResponse.json({
      success: true,
      hasSession: !!session,
      sessionData: session,
      message: 'NextAuth import and session test completed'
    });
  } catch (error) {
    console.error('NextAuth test error:', error);
    return NextResponse.json({ 
      error: 'NextAuth test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}