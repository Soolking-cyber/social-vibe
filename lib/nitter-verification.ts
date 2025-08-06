/**
 * Nitter-based Twitter Verification System
 * Uses nitter.net to verify Twitter actions by checking user stats
 */

export interface NitterVerificationResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  details: string;
  beforeCount?: number;
  afterCount?: number;
}

export class NitterVerifier {
  private static instance: NitterVerifier;
  private verificationSessions: Map<string, NitterVerificationSession> = new Map();

  static getInstance(): NitterVerifier {
    if (!NitterVerifier.instance) {
      NitterVerifier.instance = new NitterVerifier();
    }
    return NitterVerifier.instance;
  }

  /**
   * Start verification by capturing initial counts
   */
  async startVerification(
    tweetUrl: string,
    userTwitterHandle: string,
    actionType: 'like' | 'retweet' | 'reply'
  ): Promise<string> {
    const verificationId = `nitter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get initial counts from user's profile
      const initialCounts = await this.getUserCounts(userTwitterHandle);

      const session: NitterVerificationSession = {
        id: verificationId,
        tweetUrl,
        userTwitterHandle,
        actionType,
        initialLikeCount: initialCounts.likes,
        initialRetweetCount: initialCounts.retweets,
        initialTweetCount: initialCounts.tweets, // For replies/comments
        startTime: Date.now(),
        status: 'pending'
      };

      this.verificationSessions.set(verificationId, session);

      // Store in localStorage as backup
      try {
        localStorage.setItem(`nitter_verification_${verificationId}`, JSON.stringify(session));
      } catch (error) {
        console.warn('localStorage not available');
      }

      return verificationId;
    } catch (error) {
      console.error('Failed to start Nitter verification:', error);
      throw new Error('Failed to initialize verification');
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async startLikeVerification(
    tweetUrl: string,
    userTwitterHandle: string
  ): Promise<string> {
    return this.startVerification(tweetUrl, userTwitterHandle, 'like');
  }

  /**
   * Verify action completion by checking if counts increased
   */
  async verifyCompletion(verificationId: string): Promise<NitterVerificationResult> {
    const session = this.verificationSessions.get(verificationId) || this.getSessionFromStorage(verificationId);

    if (!session) {
      return {
        success: false,
        confidence: 'low',
        method: 'no_session',
        details: 'Verification session not found'
      };
    }

    try {
      // Get current counts
      const currentCounts = await this.getUserCounts(session.userTwitterHandle);

      switch (session.actionType) {
        case 'like':
          return this.verifyLikeAction(session, currentCounts.likes);

        case 'retweet':
          return this.verifyRetweetAction(session, currentCounts.retweets);

        case 'reply':
          return this.verifyReplyAction(session, currentCounts.tweets);

        default:
          return {
            success: false,
            confidence: 'low',
            method: 'unsupported_action',
            details: `Action type ${session.actionType} is not supported`
          };
      }
    } catch (error) {
      console.error('Nitter verification failed:', error);
      return {
        success: false,
        confidence: 'low',
        method: 'nitter_error',
        details: 'Failed to verify action via Nitter'
      };
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async verifyLikeCompletion(verificationId: string): Promise<NitterVerificationResult> {
    return this.verifyCompletion(verificationId);
  }

  /**
   * Verify like action
   */
  private verifyLikeAction(session: NitterVerificationSession, currentLikeCount: number): NitterVerificationResult {
    const likeCountDifference = currentLikeCount - session.initialLikeCount;

    if (likeCountDifference === 1) {
      return {
        success: true,
        confidence: 'high',
        method: 'nitter_like_count_verification',
        details: `Like count increased from ${session.initialLikeCount} to ${currentLikeCount}`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    } else if (likeCountDifference > 1) {
      return {
        success: true,
        confidence: 'medium',
        method: 'nitter_like_count_multiple',
        details: `Like count increased by ${likeCountDifference} (expected 1, but user may have liked other tweets)`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    } else if (likeCountDifference === 0) {
      return {
        success: false,
        confidence: 'high',
        method: 'nitter_no_like_increase',
        details: `Like count unchanged (${session.initialLikeCount}). Tweet was not liked.`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    } else {
      return {
        success: false,
        confidence: 'medium',
        method: 'nitter_like_count_decreased',
        details: `Like count decreased by ${Math.abs(likeCountDifference)}. This is unexpected.`,
        beforeCount: session.initialLikeCount,
        afterCount: currentLikeCount
      };
    }
  }

  /**
   * Verify retweet action
   */
  private verifyRetweetAction(session: NitterVerificationSession, currentRetweetCount: number): NitterVerificationResult {
    const retweetCountDifference = currentRetweetCount - (session.initialRetweetCount || 0);

    if (retweetCountDifference === 1) {
      return {
        success: true,
        confidence: 'high',
        method: 'nitter_retweet_count_verification',
        details: `Retweet count increased from ${session.initialRetweetCount} to ${currentRetweetCount}`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    } else if (retweetCountDifference > 1) {
      return {
        success: true,
        confidence: 'medium',
        method: 'nitter_retweet_count_multiple',
        details: `Retweet count increased by ${retweetCountDifference} (expected 1, but user may have retweeted other tweets)`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    } else if (retweetCountDifference === 0) {
      return {
        success: false,
        confidence: 'high',
        method: 'nitter_no_retweet_increase',
        details: `Retweet count unchanged (${session.initialRetweetCount}). Tweet was not retweeted.`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    } else {
      return {
        success: false,
        confidence: 'medium',
        method: 'nitter_retweet_count_decreased',
        details: `Retweet count decreased by ${Math.abs(retweetCountDifference)}. This is unexpected.`,
        beforeCount: session.initialRetweetCount,
        afterCount: currentRetweetCount
      };
    }
  }

  /**
   * Verify reply/comment action
   */
  private verifyReplyAction(session: NitterVerificationSession, currentTweetCount: number): NitterVerificationResult {
    const tweetCountDifference = currentTweetCount - (session.initialTweetCount || 0);

    if (tweetCountDifference === 1) {
      return {
        success: true,
        confidence: 'high',
        method: 'nitter_tweet_count_verification',
        details: `Tweet count increased from ${session.initialTweetCount} to ${currentTweetCount} (reply posted)`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    } else if (tweetCountDifference > 1) {
      return {
        success: true,
        confidence: 'medium',
        method: 'nitter_tweet_count_multiple',
        details: `Tweet count increased by ${tweetCountDifference} (expected 1, but user may have posted other tweets)`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    } else if (tweetCountDifference === 0) {
      return {
        success: false,
        confidence: 'high',
        method: 'nitter_no_tweet_increase',
        details: `Tweet count unchanged (${session.initialTweetCount}). No reply was posted.`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    } else {
      return {
        success: false,
        confidence: 'medium',
        method: 'nitter_tweet_count_decreased',
        details: `Tweet count decreased by ${Math.abs(tweetCountDifference)}. This is unexpected.`,
        beforeCount: session.initialTweetCount,
        afterCount: currentTweetCount
      };
    }
  }

  /**
   * Get user's counts from Nitter profile
   */
  private async getUserCounts(twitterHandle: string): Promise<{
    tweets: number;
    likes: number;
    retweets: number;
  }> {
    try {
      // Remove @ if present
      const cleanHandle = twitterHandle.replace('@', '');

      // Use Nitter instance to get user profile
      const nitterUrl = `https://nitter.net/${cleanHandle}`;

      // We'll use a proxy approach since direct fetch might be blocked by CORS
      const response = await this.fetchWithProxy(nitterUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch Nitter profile: ${response.status}`);
      }

      const html = await response.text();

      // Parse the HTML to extract all counts
      const counts = this.parseCountsFromHTML(html);

      if (!counts) {
        throw new Error('Could not parse counts from Nitter profile');
      }

      return counts;
    } catch (error) {
      console.error('Failed to get user counts:', error);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  private async getUserLikeCount(twitterHandle: string): Promise<number> {
    const counts = await this.getUserCounts(twitterHandle);
    return counts.likes;
  }

  /**
   * Fetch with proxy to avoid CORS issues
   */
  private async fetchWithProxy(url: string): Promise<Response> {
    // Try direct fetch first
    try {
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response;
    } catch (error) {
      // If direct fetch fails, try through our API proxy
      const proxyResponse = await fetch('/api/nitter-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!proxyResponse.ok) {
        throw new Error('Proxy request failed');
      }

      const data = await proxyResponse.json();

      // Create a mock Response object
      return {
        ok: true,
        status: 200,
        text: async () => data.html
      } as Response;
    }
  }

  /**
   * Parse all counts from Nitter HTML
   */
  private parseCountsFromHTML(html: string): {
    tweets: number;
    likes: number;
    retweets: number;
  } | null {
    try {
      // Nitter shows stats in order: "Tweets Following Followers Likes"
      // Look for the profile stats section

      const counts = {
        tweets: 0,
        likes: 0,
        retweets: 0
      };

      // Try to find the stats section with multiple patterns
      const statsPatterns = [
        // Pattern 1: Look for the profile stats container
        /<div[^>]*class="[^"]*profile-stat[^"]*"[^>]*>(.*?)<\/div>/gi,
        // Pattern 2: Look for stat items
        /<span[^>]*class="[^"]*stat-num[^"]*"[^>]*>([0-9,]+)<\/span>\s*<span[^>]*class="[^"]*stat-header[^"]*"[^>]*>([^<]+)<\/span>/gi,
        // Pattern 3: Simple pattern for numbers followed by labels
        /([0-9,]+)\s*<[^>]*>\s*(Tweets|Following|Followers|Likes)/gi
      ];

      // Try each pattern
      for (const pattern of statsPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match.length >= 3) {
            const count = parseInt(match[1].replace(/,/g, ''), 10);
            const label = match[2].toLowerCase().trim();

            if (!isNaN(count)) {
              if (label.includes('tweet')) {
                counts.tweets = count;
              } else if (label.includes('like')) {
                counts.likes = count;
              }
              // Note: Nitter doesn't show retweet count separately, so we'll estimate
            }
          }
        }
      }

      // Fallback: Try to extract individual counts with specific patterns
      if (counts.tweets === 0 || counts.likes === 0) {
        // Try specific patterns for each count type
        const tweetPattern = /Tweets[^0-9]*([0-9,]+)/i;
        const likePattern = /Likes[^0-9]*([0-9,]+)/i;

        const tweetMatch = html.match(tweetPattern);
        if (tweetMatch) {
          const tweetCount = parseInt(tweetMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(tweetCount)) counts.tweets = tweetCount;
        }

        const likeMatch = html.match(likePattern);
        if (likeMatch) {
          const likeCount = parseInt(likeMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(likeCount)) counts.likes = likeCount;
        }
      }

      // For retweets, we'll need to check the user's recent tweets for retweet indicators
      // This is more complex and might not be 100% accurate
      counts.retweets = this.estimateRetweetCount(html);

      // Validate that we got at least some counts
      if (counts.tweets === 0 && counts.likes === 0) {
        return null;
      }

      return counts;
    } catch (error) {
      console.error('Error parsing counts from HTML:', error);
      return null;
    }
  }

  /**
   * Estimate retweet count from user's timeline
   */
  private estimateRetweetCount(html: string): number {
    try {
      // Look for retweet indicators in the user's timeline
      // Nitter shows "RT @username" for retweets
      const retweetPattern = /RT\s+@\w+/gi;
      const retweetMatches = html.match(retweetPattern);

      return retweetMatches ? retweetMatches.length : 0;
    } catch (error) {
      console.warn('Could not estimate retweet count:', error);
      return 0;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  private parseLikeCountFromHTML(html: string): number | null {
    const counts = this.parseCountsFromHTML(html);
    return counts ? counts.likes : null;
  }

  /**
   * Get session from localStorage if not in memory
   */
  private getSessionFromStorage(verificationId: string): NitterVerificationSession | null {
    try {
      const stored = localStorage.getItem(`nitter_verification_${verificationId}`);
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
      const keys = Object.keys(localStorage).filter(key => key.startsWith('nitter_verification_'));
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
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

interface NitterVerificationSession {
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

export const nitterVerifier = NitterVerifier.getInstance();