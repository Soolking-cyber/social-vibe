import { NextRequest, NextResponse } from 'next/server';

// Test endpoint to verify TwitterAPI.io is working
export async function GET() {
  try {
    const TWITTERAPI_IO_API_KEY = process.env.TWITTERAPI_IO_API_KEY;
    
    if (!TWITTERAPI_IO_API_KEY) {
      return NextResponse.json({
        error: 'TwitterAPI.io API key not configured'
      }, { status: 500 });
    }

    // Test with a known good account (Twitter's official account)
    const response = await fetch(
      'https://api.twitterapi.io/twitter/user/profile?userName=twitter',
      {
        method: 'GET',
        headers: {
          'X-API-Key': TWITTERAPI_IO_API_KEY,
        },
      }
    );

    const data = await response.json();

    return NextResponse.json({
      status: response.ok ? 'working' : 'error',
      statusCode: response.status,
      data: data,
      apiKeyConfigured: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}