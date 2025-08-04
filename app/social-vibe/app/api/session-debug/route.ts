import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Look for NextAuth cookies
    const nextAuthCookies = allCookies.filter(cookie => 
      cookie.name.includes('next-auth') || 
      cookie.name.includes('__Secure-next-auth') ||
      cookie.name.includes('__Host-next-auth')
    );
    
    return NextResponse.json({
      totalCookies: allCookies.length,
      allCookieNames: allCookies.map(c => c.name),
      nextAuthCookies: nextAuthCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value,
        valueLength: c.value?.length || 0
      })),
      requestHeaders: {
        cookie: request.headers.get('cookie')?.substring(0, 100) + '...',
        userAgent: request.headers.get('user-agent')?.substring(0, 50)
      }
    });
  } catch (error) {
    console.error('Session debug error:', error);
    return NextResponse.json({ 
      error: 'Session debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}