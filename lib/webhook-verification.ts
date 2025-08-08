// Client-side webhook verification utilities

export interface WebhookVerificationRequest {
  userId: string;
  username: string;
  tweetId: string;
  action: 'like' | 'retweet' | 'reply';
  callback?: string;
}

export interface WebhookVerificationResponse {
  success: boolean;
  verificationId?: string;
  status?: 'pending' | 'verified' | 'expired_or_not_found';
  message?: string;
  expiresIn?: number;
  waitingTime?: number;
}

export class WebhookVerificationManager {
  private baseUrl: string;
  private pollInterval: number;
  private maxPollTime: number;

  constructor(baseUrl = '/api/twitter-webhook', pollInterval = 2000, maxPollTime = 300000) {
    this.baseUrl = baseUrl;
    this.pollInterval = pollInterval;
    this.maxPollTime = maxPollTime;
  }

  /**
   * Register a verification request and wait for webhook confirmation
   */
  async registerAndWaitForVerification(request: WebhookVerificationRequest): Promise<{
    verified: boolean;
    method: 'webhook' | 'timeout';
    waitTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Register the verification request
      const registerResponse = await fetch(this.baseUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        throw new Error(error.message || 'Failed to register verification');
      }

      const { verificationId } = await registerResponse.json();
      console.log(`📝 Registered webhook verification: ${verificationId}`);

      // Poll for verification result
      return await this.pollForVerification(verificationId, startTime);

    } catch (error) {
      console.error('❌ Webhook verification error:', error);
      return {
        verified: false,
        method: 'timeout',
        waitTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Poll for verification status
   */
  private async pollForVerification(verificationId: string, startTime: number): Promise<{
    verified: boolean;
    method: 'webhook' | 'timeout';
    waitTime: number;
    error?: string;
  }> {
    const endTime = startTime + this.maxPollTime;

    while (Date.now() < endTime) {
      try {
        const response = await fetch(`${this.baseUrl}?verificationId=${verificationId}`);
        
        if (!response.ok) {
          console.warn('⚠️ Polling request failed, continuing...');
          await this.sleep(this.pollInterval);
          continue;
        }

        const result: WebhookVerificationResponse = await response.json();

        if (result.status === 'verified') {
          return {
            verified: true,
            method: 'webhook',
            waitTime: Date.now() - startTime
          };
        }

        if (result.status === 'expired_or_not_found') {
          return {
            verified: false,
            method: 'timeout',
            waitTime: Date.now() - startTime,
            error: 'Verification request expired'
          };
        }

        // Still pending, continue polling
        console.log(`⏳ Webhook verification pending... (${Math.round((Date.now() - startTime) / 1000)}s)`);
        await this.sleep(this.pollInterval);

      } catch (error) {
        console.warn('⚠️ Polling error, continuing...', error);
        await this.sleep(this.pollInterval);
      }
    }

    // Timeout reached
    return {
      verified: false,
      method: 'timeout',
      waitTime: Date.now() - startTime,
      error: 'Webhook verification timeout'
    };
  }

  /**
   * Check if webhooks are available/configured
   */
  async isWebhookAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}?health=true`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Enhanced verification function that tries webhook first, then falls back to polling
 */
export async function verifyWithWebhookFallback(
  username: string,
  tweetId: string,
  action: 'like' | 'retweet' | 'reply',
  userId?: string
): Promise<{
  verified: boolean;
  method: 'webhook' | 'polling' | 'error';
  waitTime: number;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}> {
  const webhookManager = new WebhookVerificationManager();
  const startTime = Date.now();

  // Try webhook verification first if available
  if (await webhookManager.isWebhookAvailable() && userId) {
    console.log('🔄 Attempting webhook verification...');
    
    const webhookResult = await webhookManager.registerAndWaitForVerification({
      userId,
      username,
      tweetId,
      action
    });

    if (webhookResult.verified) {
      return {
        verified: true,
        method: 'webhook',
        waitTime: webhookResult.waitTime,
        confidence: 'high' // Webhooks provide real-time, accurate data
      };
    }

    console.log('⚠️ Webhook verification failed, falling back to polling...');
  }

  // Fallback to traditional polling method
  console.log('🔄 Using polling verification method...');
  
  try {
    const response = await fetch('/api/twitterapi-io-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        tweetId,
        action: action === 'like' ? 'verifyLike' : action === 'retweet' ? 'verifyRetweet' : 'verifyReply'
      }),
    });

    if (!response.ok) {
      throw new Error(`Polling verification failed: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      verified: result.verified || false,
      method: 'polling',
      waitTime: Date.now() - startTime,
      confidence: result.verified ? 'medium' : 'low',
      error: result.verified ? undefined : result.message
    };

  } catch (error) {
    return {
      verified: false,
      method: 'error',
      waitTime: Date.now() - startTime,
      confidence: 'low',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}