import { TwitterApi } from 'twitter-api-v2';

// Twitter API client for verification
class TwitterVerificationService {
  private client: TwitterApi;

  constructor() {
    // Use Twitter API v2 with Bearer Token for read-only operations
    this.client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);
  }

  /**
   * Extract tweet ID from Twitter URL
   */
  private extractTweetId(tweetUrl: string): string | null {
    console.log(`=== EXTRACTING TWEET ID ===`);
    console.log(`Tweet URL: "${tweetUrl}"`);

    // Support multiple Twitter URL formats
    const patterns = [
      /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,  // twitter.com or x.com
      /(?:twitter\.com|x\.com)\/.*\/status\/(\d+)/,   // Any path before status
      /status\/(\d+)/,                                // Just status/ID
      /\/(\d{15,20})(?:\?|$)/                        // Direct ID (15-20 digits)
    ];

    for (const pattern of patterns) {
      const match = tweetUrl.match(pattern);
      if (match && match[1]) {
        console.log(`✅ Extracted tweet ID: ${match[1]} using pattern: ${pattern}`);
        return match[1];
      }
    }

    console.log(`❌ Could not extract tweet ID from URL: "${tweetUrl}"`);
    console.log(`Supported formats:`);
    console.log(`  - https://twitter.com/username/status/1234567890`);
    console.log(`  - https://x.com/username/status/1234567890`);
    console.log(`  - Any URL containing status/1234567890`);

    return null;
  }

  /**
   * Verify if user has liked a tweet
   */
  async verifyLike(tweetUrl: string, userTwitterId: string): Promise<boolean> {
    try {
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        throw new Error('Invalid tweet URL');
      }

      console.log(`=== VERIFYING LIKE ACTION ===`);
      console.log(`Tweet ID: ${tweetId}`);
      console.log(`User Twitter ID: ${userTwitterId}`);

      // Method 1: Try to get users who liked the tweet (requires elevated access)
      try {
        console.log(`Attempting Method 1: tweetLikedBy (elevated access)`);
        const likers = await this.client.v2.tweetLikedBy(tweetId, {
          max_results: 100,
        });

        const hasLiked = likers.data?.some(user => user.id === userTwitterId) || false;
        console.log(`Method 1 result: ${hasLiked}`);
        return hasLiked;
      } catch (elevatedError) {
        console.log(`Method 1 failed (expected with basic access): ${(elevatedError as any).code}`);

        // Method 2: Check user's recent liked tweets (alternative approach)
        try {
          console.log(`Attempting Method 2: User's liked tweets`);
          const userLikes = await this.client.v2.userLikedTweets(userTwitterId, {
            max_results: 100, // Check recent likes
            'tweet.fields': ['id', 'created_at']
          });

          const hasLiked = userLikes.data?.data?.some(tweet => tweet.id === tweetId) || false;
          console.log(`Method 2 result: ${hasLiked}`);
          return hasLiked;
        } catch (likesError) {
          console.log(`Method 2 also failed: ${(likesError as any).code}`);

          // Method 3: Fallback - assume verification passed for development
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚠️ DEVELOPMENT FALLBACK: Assuming like verification passed`);
            console.log(`In production, you would need elevated Twitter API access`);
            return true; // Allow completion in development
          }

          throw new Error(`Twitter API access insufficient. Both tweetLikedBy and userLikedTweets require elevated access.`);
        }
      }
    } catch (error) {
      console.error('Error verifying like:', error);
      return false;
    }
  }

  /**
   * Verify if user has retweeted a tweet
   */
  async verifyRetweet(tweetUrl: string, userTwitterId: string): Promise<boolean> {
    try {
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        throw new Error('Invalid tweet URL');
      }

      console.log(`=== VERIFYING RETWEET ACTION ===`);
      console.log(`Tweet ID: ${tweetId}`);
      console.log(`User Twitter ID: ${userTwitterId}`);

      // Method 1: Try to get users who retweeted the tweet (requires elevated access)
      try {
        console.log(`Attempting Method 1: tweetRetweetedBy (elevated access)`);
        const retweeters = await this.client.v2.tweetRetweetedBy(tweetId, {
          max_results: 100,
        });

        const hasRetweeted = retweeters.data?.some(user => user.id === userTwitterId) || false;
        console.log(`Method 1 result: ${hasRetweeted}`);
        return hasRetweeted;
      } catch (elevatedError) {
        console.log(`Method 1 failed (expected with basic access): ${(elevatedError as any).code}`);

        // Method 2: Check user's recent tweets for retweets
        try {
          console.log(`Attempting Method 2: User's recent tweets`);
          const userTweets = await this.client.v2.userTimeline(userTwitterId, {
            max_results: 100,
            'tweet.fields': ['referenced_tweets', 'created_at']
          });

          const hasRetweeted = userTweets.data?.data?.some(tweet =>
            tweet.referenced_tweets?.some(ref =>
              ref.type === 'retweeted' && ref.id === tweetId
            )
          ) || false;

          console.log(`Method 2 result: ${hasRetweeted}`);
          return hasRetweeted;
        } catch (timelineError) {
          console.log(`Method 2 also failed: ${(timelineError as any).code}`);

          // Method 3: Fallback for development
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚠️ DEVELOPMENT FALLBACK: Assuming retweet verification passed`);
            return true;
          }

          throw new Error(`Twitter API access insufficient for retweet verification.`);
        }
      }
    } catch (error) {
      console.error('Error verifying retweet:', error);
      return false;
    }
  }

  /**
   * Verify if user has commented on a tweet with specific text
   */
  async verifyComment(tweetUrl: string, userTwitterId: string, expectedComment: string): Promise<boolean> {
    try {
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        throw new Error('Invalid tweet URL');
      }

      // Search for recent tweets from the user that are replies to the target tweet
      const userTweets = await this.client.v2.userTimeline(userTwitterId, {
        max_results: 50,
        'tweet.fields': ['in_reply_to_user_id', 'conversation_id', 'text'],
      });

      // Check if any of the user's recent tweets are replies to the target tweet
      // and contain the expected comment text
      const tweets = userTweets.data?.data || [];
      const hasComment = tweets.some(tweet =>
        tweet.conversation_id === tweetId &&
        tweet.text && tweet.text.toLowerCase().includes(expectedComment.toLowerCase())
      );

      return hasComment;
    } catch (error) {
      console.error('Error verifying comment:', error);
      return false;
    }
  }

  /**
   * Get user's Twitter ID from their username
   */
  async getUserIdByUsername(username: string): Promise<string | null> {
    try {
      console.log(`=== TWITTER USER LOOKUP ===`);
      console.log(`Looking up Twitter user: "${username}"`);
      console.log(`Username length: ${username.length}`);
      console.log(`Username characters: ${username.split('').map(c => `'${c}'`).join(', ')}`);

      // Clean the username - remove any whitespace or special characters
      const cleanUsername = username.trim().replace(/[^a-zA-Z0-9_]/g, '');
      console.log(`Cleaned username: "${cleanUsername}"`);

      if (cleanUsername !== username) {
        console.log(`⚠️ Username was cleaned from "${username}" to "${cleanUsername}"`);
      }

      if (!cleanUsername) {
        console.error(`❌ Username is empty after cleaning`);
        return null;
      }

      console.log(`Calling Twitter API for username: "${cleanUsername}"`);
      const user = await this.client.v2.userByUsername(cleanUsername, {
        'user.fields': ['id', 'username', 'name', 'public_metrics', 'verified']
      });

      console.log(`Twitter API response:`, JSON.stringify(user, null, 2));

      if (user.data?.id) {
        console.log(`✅ Found Twitter user:`);
        console.log(`  - ID: ${user.data.id}`);
        console.log(`  - Username: ${user.data.username}`);
        console.log(`  - Display Name: ${user.data.name}`);
        console.log(`  - Verified: ${(user.data as any).verified || false}`);
        return user.data.id;
      } else {
        console.log(`❌ No user data found for username: "${cleanUsername}"`);
        console.log(`API response structure:`, Object.keys(user));
        return null;
      }
    } catch (error) {
      console.error(`❌ Error getting user ID for "${username}":`, error);

      // Enhanced error logging
      if (error && typeof error === 'object') {
        const errorObj = error as any;
        console.error(`Error details:`);
        console.error(`  - Code: ${errorObj.code || 'N/A'}`);
        console.error(`  - Message: ${errorObj.message || 'N/A'}`);
        console.error(`  - Type: ${errorObj.type || 'N/A'}`);
        console.error(`  - Status: ${errorObj.status || 'N/A'}`);

        // Check for specific Twitter API errors
        if (errorObj.code === 50) {
          console.error(`  - This is a "User not found" error`);
        } else if (errorObj.code === 63) {
          console.error(`  - This is a "User has been suspended" error`);
        } else if (errorObj.code === 429) {
          console.error(`  - This is a rate limit error`);
        }
      }

      return null;
    }
  }

  /**
   * Main verification function
   */
  async verifyJobCompletion(
    tweetUrl: string,
    userTwitterId: string,
    actionType: string,
    commentText?: string
  ): Promise<boolean> {
    switch (actionType.toLowerCase()) {
      case 'like':
        return await this.verifyLike(tweetUrl, userTwitterId);
      case 'repost':
      case 'retweet':
        return await this.verifyRetweet(tweetUrl, userTwitterId);
      case 'comment':
        if (!commentText) {
          throw new Error('Comment text is required for comment verification');
        }
        return await this.verifyComment(tweetUrl, userTwitterId, commentText);
      default:
        throw new Error(`Unsupported action type: ${actionType}`);
    }
  }
}

export const twitterVerificationService = new TwitterVerificationService();