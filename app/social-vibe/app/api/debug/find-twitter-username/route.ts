import { NextRequest, NextResponse } from 'next/server';
import { twitterVerificationService } from '@/lib/twitter-api';

export async function POST(request: NextRequest) {
    try {
        const { username } = await request.json();

        if (!username) {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        console.log(`Testing Twitter username: ${username}`);

        // Test the username lookup
        const twitterId = await twitterVerificationService.getUserIdByUsername(username);

        if (twitterId) {
            return NextResponse.json({
                success: true,
                username,
                twitter_id: twitterId,
                message: `Found Twitter account: @${username} (ID: ${twitterId})`
            });
        } else {
            // Try some common variations
            const variations = [
                username.toLowerCase(),
                username.toUpperCase(),
                `${username}_`,
                `_${username}`,
                `${username}1`,
                username.replace(/[^a-zA-Z0-9_]/g, ''),
            ];

            const results = [];

            for (const variation of variations) {
                if (variation !== username) {
                    try {
                        const varId = await twitterVerificationService.getUserIdByUsername(variation);
                        if (varId) {
                            results.push({
                                username: variation,
                                twitter_id: varId,
                                found: true
                            });
                        } else {
                            results.push({
                                username: variation,
                                found: false
                            });
                        }
                    } catch (error) {
                        results.push({
                            username: variation,
                            found: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }
            }

            return NextResponse.json({
                success: false,
                username,
                message: `Could not find Twitter account for @${username}`,
                variations_tested: results,
                suggestions: [
                    'Check if your Twitter username is spelled correctly',
                    'Make sure your Twitter account is public',
                    'Try variations of your username',
                    'Check if your account was recently created or suspended'
                ]
            });
        }

    } catch (error) {
        console.error('Error testing Twitter username:', error);
        return NextResponse.json({
            error: 'Failed to test username',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}