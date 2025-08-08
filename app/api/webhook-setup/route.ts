import { NextRequest, NextResponse } from 'next/server';

const TWITTERAPI_IO_API_KEY = process.env.TWITTERAPI_IO_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/twitter-webhook`
  : 'http://localhost:3000/api/twitter-webhook';

export async function POST(request: NextRequest) {
  try {
    if (!TWITTERAPI_IO_API_KEY) {
      return NextResponse.json(
        { error: 'TwitterAPI.io API key not configured' },
        { status: 500 }
      );
    }

    const { action } = await request.json();

    switch (action) {
      case 'register':
        return await registerWebhook();
      case 'list':
        return await listWebhooks();
      case 'delete':
        const { webhookId } = await request.json();
        return await deleteWebhook(webhookId);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: register, list, delete' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Webhook setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup webhook', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function registerWebhook() {
  try {
    console.log('🔄 Registering webhook with TwitterAPI.io...');
    console.log('📍 Webhook URL:', WEBHOOK_URL);

    const response = await fetch('https://api.twitterapi.io/webhooks', {
      method: 'POST',
      headers: {
        'X-API-Key': TWITTERAPI_IO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        events: [
          'tweet_liked',
          'tweet_retweeted', 
          'tweet_replied',
          'user_followed'
        ],
        description: 'Twitter verification webhook for real-time action tracking'
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Webhook registration failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });

      return NextResponse.json(
        { 
          error: 'Failed to register webhook',
          details: errorData,
          status: response.status
        },
        { status: response.status }
      );
    }

    const webhookData = await response.json();
    console.log('✅ Webhook registered successfully:', webhookData);

    return NextResponse.json({
      success: true,
      webhook: webhookData,
      message: 'Webhook registered successfully',
      url: WEBHOOK_URL
    });

  } catch (error) {
    console.error('❌ Error registering webhook:', error);
    return NextResponse.json(
      { error: 'Failed to register webhook', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function listWebhooks() {
  try {
    console.log('🔄 Listing webhooks...');

    const response = await fetch('https://api.twitterapi.io/webhooks', {
      method: 'GET',
      headers: {
        'X-API-Key': TWITTERAPI_IO_API_KEY!,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Failed to list webhooks:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });

      return NextResponse.json(
        { 
          error: 'Failed to list webhooks',
          details: errorData,
          status: response.status
        },
        { status: response.status }
      );
    }

    const webhooksData = await response.json();
    console.log('📋 Current webhooks:', webhooksData);

    return NextResponse.json({
      success: true,
      webhooks: webhooksData,
      count: Array.isArray(webhooksData) ? webhooksData.length : 0
    });

  } catch (error) {
    console.error('❌ Error listing webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to list webhooks', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function deleteWebhook(webhookId: string) {
  try {
    if (!webhookId) {
      return NextResponse.json(
        { error: 'Webhook ID is required for deletion' },
        { status: 400 }
      );
    }

    console.log(`🔄 Deleting webhook: ${webhookId}`);

    const response = await fetch(`https://api.twitterapi.io/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': TWITTERAPI_IO_API_KEY!,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Failed to delete webhook:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });

      return NextResponse.json(
        { 
          error: 'Failed to delete webhook',
          details: errorData,
          status: response.status
        },
        { status: response.status }
      );
    }

    console.log('✅ Webhook deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
      webhookId
    });

  } catch (error) {
    console.error('❌ Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    service: 'webhook-setup',
    webhookUrl: WEBHOOK_URL,
    configured: !!TWITTERAPI_IO_API_KEY,
    actions: ['register', 'list', 'delete'],
    timestamp: new Date().toISOString()
  });
}