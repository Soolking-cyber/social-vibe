// Client-side tweet verification utilities using engagement counts

export interface TweetCounts {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  action: 'like' | 'retweet' | 'reply';
  tweetId: string;
  message: string;
  counts: {
    before: TweetCounts;
    after: TweetCounts;
    difference: number;
    countType: string;
  };
  confidence: 'high' | 'medium' | 'low';
  service: string;
  timestamp: string;
  error?: string;
}

export class TweetVerificationManager {
  private baseUrl: string;

  constructor(baseUrl = '/api/twitterapi-io-proxy') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current tweet engagement counts
   */
  async getTweetCounts(tweetId: string): Promise<{ success: boolean; counts?: TweetCounts; error?: string }> {
    try {
      console.log(`📊 Fetching counts for tweet: ${tweetId}`);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getTweetCounts',
          tweetId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch tweet counts');
      }

      console.log(`✅ Tweet counts fetched:`, data.counts);
      return { success: true, counts: data.counts };

    } catch (error) {
      console.error('❌ Error fetching tweet counts:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Verify a user action by comparing before and after counts
   */
  async verifyAction(
    tweetId: string,
    action: 'like' | 'retweet' | 'reply',
    beforeCounts: TweetCounts,
    afterCounts?: TweetCounts
  ): Promise<VerificationResult> {
    try {
      console.log(`🔍 Verifying ${action} on tweet: ${tweetId}`);

      // If no after counts provided, fetch them
      let finalAfterCounts = afterCounts;
      if (!finalAfterCounts) {
        const countsResult = await this.getTweetCounts(tweetId);
        if (!countsResult.success || !countsResult.counts) {
          throw new Error(countsResult.error || 'Failed to fetch current tweet counts');
        }
        finalAfterCounts = countsResult.counts;
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action === 'like' ? 'verifyLike' : action === 'retweet' ? 'verifyRetweet' : 'verifyReply',
          tweetId,
          beforeCounts,
          afterCounts: finalAfterCounts
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Verification failed');
      }

      console.log(`${result.verified ? '✅' : '❌'} Verification result:`, result.message);
      return result;

    } catch (error) {
      console.error(`❌ Error verifying ${action}:`, error);
      return {
        success: false,
        verified: false,
        action,
        tweetId,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        counts: {
          before: beforeCounts,
          after: afterCounts || beforeCounts,
          difference: 0,
          countType: action === 'like' ? 'likes' : action === 'retweet' ? 'retweets' : 'replies'
        },
        confidence: 'low',
        service: 'twitterapi.io',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Optimized verification workflow: minimal API calls
   * Only 2 API calls total: before counts + verification (which fetches after counts)
   */
  async completeVerificationWorkflow(
    tweetId: string,
    action: 'like' | 'retweet' | 'reply',
    onBeforeCountsFetched?: (counts: TweetCounts) => void,
    onWaitingForAction?: () => void,
    waitTimeMs: number = 10000 // 10 seconds default wait
  ): Promise<VerificationResult> {
    try {
      // Step 1: Get before counts (1 API call)
      console.log(`🔄 Step 1: Getting before counts for ${action} verification (1 API call)...`);
      const beforeResult = await this.getTweetCounts(tweetId);
      
      if (!beforeResult.success || !beforeResult.counts) {
        throw new Error(beforeResult.error || 'Failed to get initial tweet counts');
      }

      const beforeCounts = beforeResult.counts;
      console.log(`📊 Before counts:`, beforeCounts);
      
      if (onBeforeCountsFetched) {
        onBeforeCountsFetched(beforeCounts);
      }

      // Step 2: Wait for user to complete action
      console.log(`⏳ Step 2: Waiting ${waitTimeMs}ms for user to complete ${action}...`);
      
      if (onWaitingForAction) {
        onWaitingForAction();
      }

      await this.sleep(waitTimeMs);

      // Step 3: Verify action (1 API call - fetches after counts internally)
      console.log(`🔄 Step 3: Verifying ${action} (1 API call)...`);
      return await this.verifyAction(tweetId, action, beforeCounts);

    } catch (error) {
      console.error(`❌ Verification workflow error:`, error);
      return {
        success: false,
        verified: false,
        action,
        tweetId,
        message: `Workflow error: ${error instanceof Error ? error.message : String(error)}`,
        counts: {
          before: { likes: 0, retweets: 0, replies: 0, quotes: 0 },
          after: { likes: 0, retweets: 0, replies: 0, quotes: 0 },
          difference: 0,
          countType: action === 'like' ? 'likes' : action === 'retweet' ? 'retweets' : 'replies'
        },
        confidence: 'low',
        service: 'twitterapi.io',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Convenience functions for easy usage
export const tweetVerification = new TweetVerificationManager();

/**
 * Quick verification function - gets before counts, waits, then verifies
 */
export async function quickVerifyAction(
  tweetId: string,
  action: 'like' | 'retweet' | 'reply',
  waitTimeMs: number = 10000
): Promise<VerificationResult> {
  return tweetVerification.completeVerificationWorkflow(
    tweetId,
    action,
    (counts) => console.log(`📊 Initial ${action} count:`, counts[action === 'like' ? 'likes' : action === 'retweet' ? 'retweets' : 'replies']),
    () => console.log(`⏳ Please complete the ${action} action now...`),
    waitTimeMs
  );
}

/**
 * Manual verification - you provide both before and after counts
 */
export async function manualVerifyAction(
  tweetId: string,
  action: 'like' | 'retweet' | 'reply',
  beforeCounts: TweetCounts,
  afterCounts: TweetCounts
): Promise<VerificationResult> {
  return tweetVerification.verifyAction(tweetId, action, beforeCounts, afterCounts);
}