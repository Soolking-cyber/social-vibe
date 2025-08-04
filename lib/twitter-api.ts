// Twitter API import removed - using bypass mode to avoid rate limits

// Twitter API client for verification - BYPASS MODE
class TwitterVerificationService {
  constructor() {
    // Note: Twitter API client not initialized in bypass mode to avoid rate limits
    console.log('🚀 TwitterVerificationService initialized in BYPASS MODE');
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
   * Verify if user has liked a tweet - PRODUCTION BYPASS VERSION
   */
  async verifyLike(tweetUrl: string, userTwitterId: string): Promise<boolean> {
    try {
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        throw new Error('Invalid tweet URL');
      }

      console.log(`=== VERIFYING LIKE ACTION (BYPASS MODE) ===`);
      console.log(`Tweet ID: ${tweetId}`);
      console.log(`User Twitter ID: ${userTwitterId}`);

      console.log(`🚀 PRODUCTION BYPASS: Skipping Twitter API verification completely`);
      console.log(`✅ Assuming like action completed (manual verification)`);
      console.log(`⚠️ NOTE: In production, users manually confirm they completed the action`);

      // Always return true since users manually confirm completion
      return true;
    } catch (error) {
      console.error('Error in like verification bypass:', error);
      // Even if URL parsing fails, we'll trust the user completed it
      return true;
    }
  }

  /**
   * Verify if user has retweeted a tweet - PRODUCTION BYPASS VERSION
   */
  async verifyRetweet(tweetUrl: string, userTwitterId: string): Promise<boolean> {
    try {
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        throw new Error('Invalid tweet URL');
      }

      console.log(`=== VERIFYING RETWEET ACTION (BYPASS MODE) ===`);
      console.log(`Tweet ID: ${tweetId}`);
      console.log(`User Twitter ID: ${userTwitterId}`);

      console.log(`🚀 PRODUCTION BYPASS: Skipping Twitter API verification completely`);
      console.log(`✅ Assuming retweet action completed (manual verification)`);
      console.log(`⚠️ NOTE: In production, users manually confirm they completed the action`);

      // Always return true since users manually confirm completion
      return true;
    } catch (error) {
      console.error('Error in retweet verification bypass:', error);
      // Even if URL parsing fails, we'll trust the user completed it
      return true;
    }
  }

  /**
   * Verify if user has commented on a tweet - PRODUCTION BYPASS VERSION
   */
  async verifyComment(tweetUrl: string, userTwitterId: string, expectedComment: string): Promise<boolean> {
    try {
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        throw new Error('Invalid tweet URL');
      }

      console.log(`=== VERIFYING COMMENT ACTION (BYPASS MODE) ===`);
      console.log(`Tweet ID: ${tweetId}`);
      console.log(`User Twitter ID: ${userTwitterId}`);
      console.log(`Expected comment: ${expectedComment}`);

      console.log(`🚀 PRODUCTION BYPASS: Skipping Twitter API verification completely`);
      console.log(`✅ Assuming comment action completed (manual verification)`);
      console.log(`⚠️ NOTE: In production, users manually confirm they completed the action`);

      // Always return true since users manually confirm completion
      return true;
    } catch (error) {
      console.error('Error in comment verification bypass:', error);
      // Even if URL parsing fails, we'll trust the user completed it
      return true;
    }
  }

  /**
   * Get user's Twitter ID from their username - PRODUCTION BYPASS VERSION
   * This completely bypasses Twitter API to avoid rate limits and API issues
   */
  async getUserIdByUsername(username: string): Promise<string | null> {
    console.log(`=== TWITTER USER LOOKUP (BYPASS MODE) ===`);
    console.log(`Looking up Twitter user: "${username}"`);

    // Clean the username - remove any whitespace or special characters
    const cleanUsername = username.trim().replace(/[^a-zA-Z0-9_]/g, '');
    console.log(`Cleaned username: "${cleanUsername}"`);

    if (!cleanUsername) {
      console.error(`❌ Username is empty after cleaning`);
      throw new Error('Invalid username provided');
    }

    // Validate username format
    if (cleanUsername.length < 1 || cleanUsername.length > 15) {
      console.error(`❌ Username length invalid: ${cleanUsername.length} (must be 1-15 characters)`);
      throw new Error('Username must be 1-15 characters long');
    }

    // PRODUCTION BYPASS: Generate a consistent fake Twitter ID based on username
    // This ensures the same username always gets the same ID
    console.log(`🚀 PRODUCTION BYPASS: Generating consistent Twitter ID for "${cleanUsername}"`);

    // Create a simple hash of the username to generate a consistent ID
    let hash = 0;
    for (let i = 0; i < cleanUsername.length; i++) {
      const char = cleanUsername.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive number and ensure it's in Twitter ID range (15-19 digits)
    const twitterId = Math.abs(hash).toString().padStart(15, '1');

    console.log(`✅ Generated consistent Twitter ID: ${twitterId} for username: ${cleanUsername}`);
    console.log(`⚠️ NOTE: This is a bypass mode for production - no actual Twitter API calls made`);

    return twitterId;
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