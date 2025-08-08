/**
 * TwitterAPI.io Verification System
 * Uses twitterapi.io service for reliable Twitter verification
 */

export interface TwitterAPIIOVerificationResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  details: string;
  beforeCount?: number;
  afterCount?: number;
}

export class TwitterAPIIOVerifier {
  private static instance: TwitterAPIIOVerifier;
  private verificationSessions: Map<string, TwitterAPIIOVerificationSession> = new Map();

  static getInstance(): TwitterAPIIOVerifier {
    if (!TwitterAPIIOVerifier.instance) {
      TwitterAPIIOVerifier.instance = new TwitterAPIIOVerifier();
    }
    return TwitterAPIIOVerifier.instance;
  }

  /**
   * Start verification by capturing initial counts via TwitterAPI.io
   */
  async startVerification(
    tweetUrl: string,
    userTwitterHandle: string,
    actionType: 'like' | 'retweet' | 'reply'
  ): Promise<string> {
    const verificationId = `twitterapi_io_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get initial counts from TwitterAPI.io
      console.log(`🔍 Getting initial counts for @${userTwitterHandle}...`);
      const initialCounts = await this.getUserCounts(userTwitterHandle);
      console.log(`📊 Initial counts:`, initialCounts);

      const session: TwitterAPIIOVerificationSession = {
        id: verificationId,
        tweetUrl,
        userTwitterHandle,
        actionType,
        initialLikeCount: initialCounts.likes,
        initialRetweetCount: initialCounts.retweets,
        initialTweetCount: initialCounts.tweets,
        startTime: Date.now(),
        status: 'pending'
      };

      this.verificationSessions.set(verificationId, session);

      // Store in localStorage as backup
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`twitterapi_io_verification_${verificationId}`, JSON.stringify(session));
        }
      } catch (error) {
        console.warn('localStorage not available');
      }

      return verificationId;
    } catch (error) {
      console.error('Failed to start TwitterAPI.io verification:', error);
      throw new Error('Failed to initialize TwitterAPI.io verification');
    }
  }

  /**
   * Verify action completion by checking if counts increased via TwitterAPI.io
   */
  async verifyCompletion(verificationId: string): Promise<TwitterAPIIOVerificationResult> {
    console.log('🔍 Starting TwitterAPI.io verification for ID:', verificationId);
    
    const session = this.verificationSessions.get(verificationId) || this.getSessionFromStorage(verificationId);

    if (!session) {
      console.error('❌ Verification session not found:', verificationId);
      return {
        success: false,
        confidence: 'low',
        method: 'no_session',
        details: 'Verification session not found'
      };
    }

    console.log('📋 Session found:', {
      actionType: session.actionType,
      userHandle: session.userTwitterHandle,
      initialCounts: {
        likes: session.initialLikeCount,
        retweets: session.initialRetweetCount,
        tweets: session.initialTweetCount
      }
    });

    try {
      // Get current counts with retry logic
      let currentCounts;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 Fetching current counts via TwitterAPI.io (attempt ${retryCount + 1}/${maxRetries})...`);
          currentCounts = await this.getUserCounts(session.userTwitterHandle);
          break;
        } catch (error) {
          retryCount++;
          console.warn(`⚠️ Attempt ${retryCount} failed:`, error);
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          }
        }
      }

      if (!currentCounts) {
        console.error('❌ Failed to get current counts after all retries');
        return {
          success: false,
          confidence: 'low',
          method: 'twitterapi_io_fetch_failed',
          details: 'Failed to fetch current counts from TwitterAPI.io after multiple attempts'
        };
      }

      console.log('📊 Current counts:', currentCounts);

      // Perform verification based on action type
      let result: TwitterAPIIOVerificationResult;
      
      switch (session.actionType) {
        case 'like':
          result = this.verifyLikeAction(session, currentCounts.likes);
          break;

        case 'retweet':
          result = this.verifyRetweetAction(session, currentCounts.retweets);
          break;

        case 'reply':
          result = this.verifyReplyAction(session, currentCounts.tweets);
          break;

        default:
          console.error('❌ Unsupported action type:', session.actionType);
          return {
            success: false,
            confidence: 'low',
            method: 'unsupported_action',
            details: `Action type ${session.actionType} is not supported`
          };
      }

      console.log('✅ TwitterAPI.io verification result:', result);
      return result;

    } catch (error) {
      console.error('❌ TwitterAPI.io verification failed:', error);
      return {
        success: false,
        confidence: 'low',
        method: 'twitterapi_io_error',
        details: `Failed to verify action via TwitterAPI.io: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get user's counts from TwitterAPI.io
   */
  private async getUserCounts(twitterHandle: string): Promise<{
    tweets: number;
    likes: number;
    retweets: number;
  }> {
    try {
      // Remove @ if present
      const cleanHandle = twitterHandle.replace('@', '');

      // Call our TwitterAPI.io proxy endpoint
      const response = await fetch('/api/twitterapi-io-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: cleanHandle,
          action: 'getUserCounts'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle suspended account gracefully
        if (errorData.error && errorData.error.includes('suspended')) {
          throw new Error(`Twitter account suspended: Please ensure your Twitter account is active and not suspended. You may need to log in with a different Twitter account.`);
        }
        
        throw new Error(`TwitterAPI.io request failed: ${errorData.error || response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        // Handle suspended account gracefully
        if (data.error && data.error.includes('suspended')) {
          throw new Error(`Twitter account suspended: Please ensure your Twitter account is active and not suspended. You may need to log in with a different Twitter account.`);
        }
        
        throw new Error(`TwitterAPI.io error: ${data.error}`);
      }

      // SECURITY: Ensure we have valid count data
      if (!data.counts || typeof data.counts.tweets === 'undefined') {
        throw new Error('TwitterAPI.io returned invalid count data');
      }

      return {
        tweets: data.counts.tweets || 0,
        likes: data.counts.likes || 0,
        retweets: data.counts.retweets || 0
      };

    } catch (error) {
      console.error('Failed to get user counts from TwitterAPI.io:', error);
      throw error;
    }
  }

  /**
   * Verify like action
   */
  private verifyLikeAction(session: TwitterAPIIOVerificationSession, currentLikeCount: number): TwitterAPIIOVerificationResult {
    const likeCountDifference = currentLikeCount - session.initialLikeCount;

    if (likeCountDifference === 1) {
      return {
        success: true,
        confidence: 'high',
        method: 'twitterapi_io_like_count_verification',
        details: `Like count increased from ${session.initialLikeCount} to ${currentLikeCount}`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    } else if (likeCountDifference > 1) {
      return {
        success: true,
        confidence: 'medium',
        method: 'twitterapi_io_like_count_multiple',
        details: `Like count increased by ${likeCountDifference} (expected 1, but user may have liked other tweets)`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    } else if (likeCountDifference === 0) {
      return {
        success: false,
        confidence: 'high',
        method: 'twitterapi_io_no_like_increase',
        details: `Like count unchanged (${session.initialLikeCount}). Tweet was not liked.`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    } else {
      return {
        success: false,
        confidence: 'medium',
        method: 'twitterapi_io_like_count_decreased',
        details: `Like count decreased by ${Math.abs(likeCountDifference)}. This is unexpected.`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    }
  }

  /**
   * Verify retweet action
   */
  private verifyRetweetAction(session: TwitterAPIIOVerificationSession, currentRetweetCount: number): TwitterAPIIOVerificationResult {
    const retweetCountDifference = currentRetweetCount - (session.initialRetweetCount || 0);

    if (retweetCountDifference === 1) {
      return {
        success: true,
        confidence: 'high',
        method: 'twitterapi_io_retweet_count_verification',
        details: `Retweet count increased from ${session.initialRetweetCount} to ${currentRetweetCount}`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    } else if (retweetCountDifference > 1) {
      return {
        success: true,
        confidence: 'medium',
        method: 'twitterapi_io_retweet_count_multiple',
        details: `Retweet count increased by ${retweetCountDifference} (expected 1, but user may have retweeted other tweets)`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    } else if (retweetCountDifference === 0) {
      return {
        success: false,
        confidence: 'high',
        method: 'twitterapi_io_no_retweet_increase',
        details: `Retweet count unchanged (${session.initialRetweetCount}). Tweet was not retweeted.`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    } else {
      return {
        success: false,
        confidence: 'medium',
        method: 'twitterapi_io_retweet_count_decreased',
        details: `Retweet count decreased by ${Math.abs(retweetCountDifference)}. This is unexpected.`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    }
  }

  /**
   * Verify reply/comment action
   */
  private verifyReplyAction(session: TwitterAPIIOVerificationSession, currentTweetCount: number): TwitterAPIIOVerificationResult {
    const tweetCountDifference = currentTweetCount - (session.initialTweetCount || 0);

    if (tweetCountDifference === 1) {
      return {
        success: true,
        confidence: 'high',
        method: 'twitterapi_io_tweet_count_verification',
        details: `Tweet count increased from ${session.initialTweetCount} to ${currentTweetCount} (reply posted)`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    } else if (tweetCountDifference > 1) {
      return {
        success: true,
        confidence: 'medium',
        method: 'twitterapi_io_tweet_count_multiple',
        details: `Tweet count increased by ${tweetCountDifference} (expected 1, but user may have posted other tweets)`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    } else if (tweetCountDifference === 0) {
      return {
        success: false,
        confidence: 'high',
        method: 'twitterapi_io_no_tweet_increase',
        details: `Tweet count unchanged (${session.initialTweetCount}). No reply was posted.`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    } else {
      return {
        success: false,
        confidence: 'medium',
        method: 'twitterapi_io_tweet_count_decreased',
        details: `Tweet count decreased by ${Math.abs(tweetCountDifference)}. This is unexpected.`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    }
  }

  /**
   * Get session from localStorage if not in memory
   */
  private getSessionFromStorage(verificationId: string): TwitterAPIIOVerificationSession | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const stored = localStorage.getItem(`twitterapi_io_verification_${verificationId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up old verification sessions
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    // Clean memory sessions
    for (const [id, session] of this.verificationSessions.entries()) {
      if (now - session.startTime > maxAge) {
        this.verificationSessions.delete(id);
      }
    }

    // Clean localStorage sessions
    try {
      if (typeof localStorage !== 'undefined') {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('twitterapi_io_verification_'));
        keys.forEach(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.startTime && (now - data.startTime) > maxAge) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

interface TwitterAPIIOVerificationSession {
  id: string;
  tweetUrl: string;
  userTwitterHandle: string;
  actionType: 'like' | 'retweet' | 'reply';
  initialLikeCount: number;
  initialRetweetCount?: number;
  initialTweetCount?: number;
  startTime: number;
  status: 'pending' | 'completed' | 'failed';
}

export const twitterAPIIOVerifier = TwitterAPIIOVerifier.getInstance();