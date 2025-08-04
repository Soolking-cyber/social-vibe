import { NextRequest, NextResponse } from 'next/server';
import { twitterVerificationService } from '@/lib/twitter-api';

export async function POST(request: NextRequest) {
  try {
    const { tweetUrl } = await request.json();

    if (!tweetUrl) {
      return NextResponse.json({ error: 'Tweet URL is required' }, { status: 400 });
    }

    console.log(`=== TWEET URL TEST ===`);
    console.log(`Testing URL: "${tweetUrl}"`);

    // Test the private extractTweetId method by calling it through the service
    // We'll create a temporary method to access it
    const testResults = {
      original_url: tweetUrl,
      url_analysis: {
        length: tweetUrl.length,
        contains_twitter: tweetUrl.includes('twitter.com'),
        contains_x: tweetUrl.includes('x.com'),
        contains_status: tweetUrl.includes('/status/'),
        has_numbers: /\d+/.test(tweetUrl)
      },
      extraction_test: null as any,
      recommendations: [] as string[]
    };

    // Test different URL patterns
    const patterns = [
      { name: 'twitter.com/user/status/ID', regex: /(?:twitter\.com)\/\w+\/status\/(\d+)/ },
      { name: 'x.com/user/status/ID', regex: /(?:x\.com)\/\w+\/status\/(\d+)/ },
      { name: 'any domain with status/ID', regex: /\/status\/(\d+)/ },
      { name: 'direct ID (15-20 digits)', regex: /\/(\d{15,20})(?:\?|$)/ }
    ];

    const matches = [];
    for (const pattern of patterns) {
      const match = tweetUrl.match(pattern.regex);
      if (match && match[1]) {
        matches.push({
          pattern: pattern.name,
          regex: pattern.regex.toString(),
          extracted_id: match[1],
          success: true
        });
      } else {
        matches.push({
          pattern: pattern.name,
          regex: pattern.regex.toString(),
          extracted_id: null,
          success: false
        });
      }
    }

    testResults.extraction_test = {
      patterns_tested: matches,
      successful_extractions: matches.filter(m => m.success),
      total_matches: matches.filter(m => m.success).length
    };

    // Generate recommendations
    const successfulMatches = matches.filter(m => m.success);
    
    if (successfulMatches.length === 0) {
      testResults.recommendations = [
        'No tweet ID could be extracted from this URL',
        'Make sure the URL contains "/status/" followed by numbers',
        'Valid formats:',
        '  • https://twitter.com/username/status/1234567890',
        '  • https://x.com/username/status/1234567890',
        'Check if the URL is complete and not truncated'
      ];
    } else {
      const firstMatch = successfulMatches[0];
      testResults.recommendations = [
        `✅ Tweet ID successfully extracted: ${firstMatch.extracted_id}`,
        `Using pattern: ${firstMatch.pattern}`,
        'This URL should work for verification',
        `Found ${successfulMatches.length} matching pattern(s)`
      ];
    }

    return NextResponse.json({
      success: true,
      results: testResults
    });

  } catch (error) {
    console.error('Error in tweet URL test:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}