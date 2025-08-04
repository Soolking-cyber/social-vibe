import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('next-auth.session-token');
    
    console.log('Cookie debug:', {
      hasSessionToken: !!sessionToken,
      sessionTokenValue: sessionToken?.value?.substring(0, 20) + '...',
      allCookies: cookieStore.getAll().map(c => c.name)
    });
    
    const session = await getServerSession(authOptions);
    
    return NextResponse.json({
      hasSession: !!session,
      hasUser: !!session?.user,
      hasEmail: !!session?.user?.email,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      hasSessionToken: !!sessionToken,
      cookieNames: cookieStore.getAll().map(c => c.name),
      sessionData: session
    });
  } catch (error) {
    console.error('Auth test error:', error);
    return NextResponse.json({ 
      error: 'Auth test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}