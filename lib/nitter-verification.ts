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
   * Verify action completion by checking if counts increased - ROBUST VERSION
   */
  async verifyCompletion(verificationId: string): Promise<NitterVerificationResult> {
    console.log('🔍 Starting Nitter verification for ID:', verificationId);
    
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
          console.log(`🔄 Fetching current counts (attempt ${retryCount + 1}/${maxRetries})...`);
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
          method: 'nitter_fetch_failed',
          details: 'Failed to fetch current counts from Nitter after multiple attempts'
        };
      }

      console.log('📊 Current counts:', currentCounts);

      // Perform verification based on action type
      let result: NitterVerificationResult;
      
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

      console.log('✅ Verification result:', result);
      return result;

    } catch (error) {
      console.error('❌ Nitter verification failed:', error);
      return {
        success: false,
        confidence: 'low',
        method: 'nitter_error',
        details: `Failed to verify action via Nitter: ${error instanceof Error ? error.message : String(error)}`
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
    console.log('🔍 Fetching Nitter data for:', url);
    
    // Skip direct fetch since it will always fail due to CORS, go straight to proxy
    try {
      const proxyResponse = await fetch('/api/nitter-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!proxyResponse.ok) {
        const errorData = await proxyResponse.json();
        console.error('❌ Proxy request failed:', errorData);
        throw new Error(`Proxy request failed: ${errorData.error || proxyResponse.status}`);
      }

      const data = await proxyResponse.json();
      console.log('✅ Proxy response received:', { 
        success: data.success, 
        instance: data.instance,
        hasHtml: !!data.html,
        htmlLength: data.html?.length 
      });

      if (!data.success || !data.html) {
        throw new Error('Invalid proxy response: missing HTML data');
      }

      // Create a mock Response object with the proxy data
      return {
        ok: true,
        status: 200,
        text: async () => data.html
      } as Response;
      
    } catch (error) {
      console.error('❌ Nitter proxy error:', error);
      throw new Error(`Failed to fetch Nitter data: ${error instanceof Error ? error.message : String(error)}`);
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
      console.log('🔍 Parsing Nitter HTML for counts...');
      
      const counts = {
        tweets: 0,
        likes: 0,
        retweets: 0
      };

      // ROBUST PARSING: Try multiple patterns in order of reliability
      
      // Pattern 1: Modern Nitter profile stats (most reliable)
      const profileStatsPattern = /<div[^>]*class="[^"]*profile-statlist[^"]*"[^>]*>(.*?)<\/div>/gi;
      const profileStatsMatch = profileStatsPattern.exec(html);
      
      if (profileStatsMatch) {
        const statsSection = profileStatsMatch[1];
        console.log('📊 Found profile stats section');
        
        // Extract individual stats
        const statPattern = /<div[^>]*class="[^"]*profile-stat[^"]*"[^>]*>.*?<span[^>]*class="[^"]*profile-stat-num[^"]*"[^>]*>([0-9,]+)<\/span>.*?<span[^>]*class="[^"]*profile-stat-header[^"]*"[^>]*>([^<]+)<\/span>/gi;
        
        let statMatch;
        while ((statMatch = statPattern.exec(statsSection)) !== null) {
          const count = parseInt(statMatch[1].replace(/,/g, ''), 10);
          const label = statMatch[2].toLowerCase().trim();
          
          console.log(`📈 Found stat: ${label} = ${count}`);
          
          if (!isNaN(count)) {
            if (label.includes('tweet')) {
              counts.tweets = count;
            } else if (label.includes('like')) {
              counts.likes = count;
            }
          }
        }
      }

      // Pattern 2: Alternative stat parsing (fallback)
      if (counts.tweets === 0 || counts.likes === 0) {
        console.log('🔄 Trying alternative parsing patterns...');
        
        // Look for any number followed by "Tweets" or "Likes"
        const patterns = [
          { regex: /([0-9,]+)\s*Tweets/i, type: 'tweets' },
          { regex: /([0-9,]+)\s*Likes/i, type: 'likes' },
          { regex: /Tweets[^0-9]*([0-9,]+)/i, type: 'tweets' },
          { regex: /Likes[^0-9]*([0-9,]+)/i, type: 'likes' }
        ];

        for (const pattern of patterns) {
          const match = html.match(pattern.regex);
          if (match) {
            const count = parseInt(match[1].replace(/,/g, ''), 10);
            if (!isNaN(count)) {
              if (pattern.type === 'tweets' && counts.tweets === 0) {
                counts.tweets = count;
                console.log(`📈 Found tweets via fallback: ${count}`);
              } else if (pattern.type === 'likes' && counts.likes === 0) {
                counts.likes = count;
                console.log(`📈 Found likes via fallback: ${count}`);
              }
            }
          }
        }
      }

      // Pattern 3: Extract from any stat-like structure
      if (counts.tweets === 0 || counts.likes === 0) {
        console.log('🔄 Trying generic stat extraction...');
        
        const genericStatPattern = /<span[^>]*>([0-9,]+)<\/span>[^<]*<span[^>]*>(Tweets|Likes)/gi;
        let genericMatch;
        
        while ((genericMatch = genericStatPattern.exec(html)) !== null) {
          const count = parseInt(genericMatch[1].replace(/,/g, ''), 10);
          const label = genericMatch[2].toLowerCase();
          
          if (!isNaN(count)) {
            if (label === 'tweets' && counts.tweets === 0) {
              counts.tweets = count;
              console.log(`📈 Found tweets via generic: ${count}`);
            } else if (label === 'likes' && counts.likes === 0) {
              counts.likes = count;
              console.log(`📈 Found likes via generic: ${count}`);
            }
          }
        }
      }

      // For retweets, estimate from timeline
      counts.retweets = this.estimateRetweetCount(html);

      console.log('📊 Final parsed counts:', counts);

      // Validate that we got meaningful data
      if (counts.tweets === 0 && counts.likes === 0) {
        console.error('❌ No valid counts found in HTML');
        // Log a sample of the HTML for debugging
        console.log('HTML sample:', html.substring(0, 1000));
        return null;
      }

      return counts;
    } catch (error) {
      console.error('❌ Error parsing counts from HTML:', error);
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