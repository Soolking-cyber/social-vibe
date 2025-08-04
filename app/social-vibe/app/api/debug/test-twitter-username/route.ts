import { NextRequest, NextResponse } from 'next/server';
import { twitterVerificationService } from '@/lib/twitter-api';

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    console.log(`=== COMPREHENSIVE TWITTER USERNAME TEST ===`);
    console.log(`Testing username: "${username}"`);

    const results = {
      original_username: username,
      tests: [] as any[],
      recommendations: [] as string[]
    };

    // Test 1: Original username
    console.log(`\n--- Test 1: Original Username ---`);
    try {
      const result1 = await twitterVerificationService.getUserIdByUsername(username);
      results.tests.push({
        test: 'original',
        username: username,
        success: !!result1,
        twitter_id: result1,
        error: null
      });
    } catch (error) {
      results.tests.push({
        test: 'original',
        username: username,
        success: false,
        twitter_id: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: Lowercase
    const lowercase = username.toLowerCase();
    if (lowercase !== username) {
      console.log(`\n--- Test 2: Lowercase ---`);
      try {
        const result2 = await twitterVerificationService.getUserIdByUsername(lowercase);
        results.tests.push({
          test: 'lowercase',
          username: lowercase,
          success: !!result2,
          twitter_id: result2,
          error: null
        });
      } catch (error) {
        results.tests.push({
          test: 'lowercase',
          username: lowercase,
          success: false,
          twitter_id: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test 3: Remove special characters
    const cleaned = username.replace(/[^a-zA-Z0-9_]/g, '');
    if (cleaned !== username && cleaned.length > 0) {
      console.log(`\n--- Test 3: Cleaned (alphanumeric + underscore only) ---`);
      try {
        const result3 = await twitterVerificationService.getUserIdByUsername(cleaned);
        results.tests.push({
          test: 'cleaned',
          username: cleaned,
          success: !!result3,
          twitter_id: result3,
          error: null
        });
      } catch (error) {
        results.tests.push({
          test: 'cleaned',
          username: cleaned,
          success: false,
          twitter_id: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test 4: Common variations
    const variations = [
      `${username}1`,
      `${username}_`,
      `_${username}`,
      username.replace(/[0-9]/g, ''), // Remove numbers
      username.replace(/_/g, ''), // Remove underscores
    ].filter(v => v !== username && v.length > 0);

    for (let i = 0; i < Math.min(variations.length, 3); i++) {
      const variation = variations[i];
      console.log(`\n--- Test ${4 + i}: Variation "${variation}" ---`);
      try {
        const result = await twitterVerificationService.getUserIdByUsername(variation);
        results.tests.push({
          test: `variation_${i + 1}`,
          username: variation,
          success: !!result,
          twitter_id: result,
          error: null
        });
      } catch (error) {
        results.tests.push({
          test: `variation_${i + 1}`,
          username: variation,
          success: false,
          twitter_id: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Generate recommendations
    const successfulTests = results.tests.filter(t => t.success);
    
    if (successfulTests.length === 0) {
      results.recommendations = [
        'No valid Twitter username found',
        'Check if the account exists and is public',
        'Try searching for the account manually on Twitter',
        'The account might be suspended or deactivated',
        'Double-check the spelling of the username'
      ];
    } else {
      results.recommendations = [
        `Found ${successfulTests.length} working username(s)`,
        `Recommended username: "${successfulTests[0].username}"`,
        'Update your Twitter handle in the dashboard to use the working username'
      ];
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error in Twitter username test:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}