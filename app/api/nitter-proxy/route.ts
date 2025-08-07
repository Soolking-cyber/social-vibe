import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let url = '';
  try {
    const body = await request.json();
    url = body.url;
    
    if (!url || !url.includes('nitter')) {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    console.log('🔍 Nitter proxy request for:', url);

    // Working Nitter instances (verified active)
    const nitterInstances = [
      'nitter.poast.org',
      'nitter.privacydev.net', 
      'nitter.it',
      'nitter.net'
    ];

    // Extract username from URL
    const username = url.split('/').pop();
    console.log('👤 Extracted username:', username);

    let lastError = null;
    
    // Try each Nitter instance with proper error handling
    for (const instance of nitterInstances) {
      const testUrl = `https://${instance}/${username}`;
      console.log(`🔄 Trying ${instance}...`);
      
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(testUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          console.log(`✅ Success with ${instance}`);
          
          // Validate that we got actual profile data
          if (html.includes('profile') || html.includes('Tweets') || html.includes('Following')) {
            return NextResponse.json({
              success: true,
              html,
              instance: instance
            });
          } else {
            console.warn(`❌ ${instance} returned invalid profile data`);
            lastError = `${instance}: Invalid profile data`;
            continue;
          }
        } else {
          console.warn(`❌ ${instance} returned ${response.status}`);
          lastError = `${instance}: ${response.status}`;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`❌ ${instance} failed:`, errorMsg);
        lastError = `${instance}: ${errorMsg}`;
        continue;
      }
    }

    // If all instances failed, return proper error
    console.error('❌ All Nitter instances failed');
    return NextResponse.json(
      { 
        error: 'All Nitter instances are currently unavailable',
        details: lastError,
        triedInstances: nitterInstances,
        suggestion: 'Please try again later or contact support'
      },
      { status: 503 }
    );

  } catch (error) {
    console.error('Nitter proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch from Nitter',
        details: error instanceof Error ? error.message : String(error),
        url: url
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'nitter-proxy',
    timestamp: new Date().toISOString()
  });
}