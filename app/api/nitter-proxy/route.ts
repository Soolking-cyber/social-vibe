import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let url = '';
  try {
    const body = await request.json();
    url = body.url;
    
    if (!url || !url.includes('nitter.net')) {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Fetch from Nitter with proper headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Nitter request failed: ${response.status}` },
        { status: response.status }
      );
    }

    const html = await response.text();

    return NextResponse.json({
      success: true,
      html
    });

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