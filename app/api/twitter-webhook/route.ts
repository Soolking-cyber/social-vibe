import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Environment variables for webhook security
const WEBHOOK_SECRET = process.env.TWITTER_WEBHOOK_SECRET;
const TWITTERAPI_IO_API_KEY = process.env.TWITTERAPI_IO_API_KEY;

// In-memory store for pending verifications (use Redis in production)
const pendingVerifications = new Map<string, {
  userId: string;
  username: string;
  tweetId: string;
  action: 'like' | 'retweet' | 'reply';
  timestamp: number;
  callback?: string;
}>();

// Webhook event types from TwitterAPI.io
interface TwitterWebhookEvent {
  event_type: 'tweet_liked' | 'tweet_retweeted' | 'tweet_replied' | 'user_followed';
  user_id: string;
  username: string;
  tweet_id?: string;
  original_tweet_id?: string;
  timestamp: string;
  data: any;
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature for security
    const signature = request.headers.get('x-twitterapi-signature');
    const body = await request.text();
    
    if (!verifyWebhookSignature(body, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event: TwitterWebhookEvent = JSON.parse(body);
    console.log('📨 Received Twitter webhook event:', event);

    // Process the webhook event
    await processWebhookEvent(event);

    return NextResponse.json({ success: true, processed: true });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Register a verification request to wait for webhook
export async function PUT(request: NextRequest) {
  try {
    const { userId, username, tweetId, action, callback } = await request.json();

    if (!userId || !username || !tweetId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, username, tweetId, action' },
        { status: 400 }
      );
    }

    const verificationId = `${userId}_${tweetId}_${action}_${Date.now()}`;
    
    pendingVerifications.set(verificationId, {
      userId,
      username,
      tweetId,
      action,
      timestamp: Date.now(),
      callback
    });

    // Set expiration (5 minutes)
    setTimeout(() => {
      pendingVerifications.delete(verificationId);
    }, 5 * 60 * 1000);

    console.log(`📝 Registered verification request: ${verificationId}`);

    return NextResponse.json({
      success: true,
      verificationId,
      message: 'Verification request registered. Waiting for webhook...',
      expiresIn: 300 // 5 minutes
    });

  } catch (error) {
    console.error('❌ Error registering verification:', error);
    return NextResponse.json(
      { error: 'Failed to register verification', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Check verification status
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const verificationId = url.searchParams.get('verificationId');

  if (!verificationId) {
    return NextResponse.json({ error: 'Missing verificationId parameter' }, { status: 400 });
  }

  const verification = pendingVerifications.get(verificationId);
  
  if (!verification) {
    return NextResponse.json({
      success: false,
      status: 'expired_or_not_found',
      message: 'Verification request not found or expired'
    });
  }

  return NextResponse.json({
    success: true,
    status: 'pending',
    verification,
    waitingTime: Date.now() - verification.timestamp
  });
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) {
    console.warn('⚠️ Webhook signature verification skipped (no secret configured)');
    return true; // Allow in development
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

async function processWebhookEvent(event: TwitterWebhookEvent) {
  console.log(`🔄 Processing ${event.event_type} event for @${event.username}`);

  // Find matching pending verifications
  const matchingVerifications = Array.from(pendingVerifications.entries()).filter(([id, verification]) => {
    const userMatch = verification.userId === event.user_id || verification.username === event.username;
    const tweetMatch = verification.tweetId === event.tweet_id || verification.tweetId === event.original_tweet_id;
    const actionMatch = getActionFromEventType(event.event_type) === verification.action;

    return userMatch && tweetMatch && actionMatch;
  });

  console.log(`📊 Found ${matchingVerifications.length} matching verifications`);

  // Process each matching verification
  for (const [verificationId, verification] of matchingVerifications) {
    try {
      console.log(`✅ Verification confirmed: ${verificationId}`);

      // Remove from pending list
      pendingVerifications.delete(verificationId);

      // Call callback if provided
      if (verification.callback) {
        await notifyCallback(verification.callback, {
          verificationId,
          verified: true,
          event,
          timestamp: new Date().toISOString()
        });
      }

      // Store successful verification (you might want to save to database)
      await storeVerificationResult(verificationId, verification, event);

    } catch (error) {
      console.error(`❌ Error processing verification ${verificationId}:`, error);
    }
  }
}

function getActionFromEventType(eventType: string): 'like' | 'retweet' | 'reply' | null {
  switch (eventType) {
    case 'tweet_liked':
      return 'like';
    case 'tweet_retweeted':
      return 'retweet';
    case 'tweet_replied':
      return 'reply';
    default:
      return null;
  }
}

async function notifyCallback(callbackUrl: string, data: any) {
  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`❌ Callback failed: ${response.status} ${response.statusText}`);
    } else {
      console.log(`✅ Callback successful: ${callbackUrl}`);
    }
  } catch (error) {
    console.error('❌ Callback error:', error);
  }
}

async function storeVerificationResult(verificationId: string, verification: any, event: TwitterWebhookEvent) {
  // In a real application, you'd store this in a database
  console.log(`💾 Storing verification result: ${verificationId}`, {
    verification,
    event,
    timestamp: new Date().toISOString()
  });
  
  // You could integrate with your existing database here
  // For example, update a verification_results table
}