import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing session...');
    
    // Debug request
    console.log('Request cookies:', request.headers.get('cookie'));
    
    const session = await getServerSession(authOptions);
    
    console.log('Session result:', session);
    
    return NextResponse.json({
      success: true,
      hasSession: !!session,
      sessionData: session,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session test error:', error);
    return NextResponse.json({ 
      error: 'Session test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Same logic for POST to test with credentials
  return GET(request);
}