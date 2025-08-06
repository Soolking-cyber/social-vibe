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
   * Start verification by capturing initial like count
   */
  async startLikeVerification(
    tweetUrl: string,
    userTwitterHandle: string
  ): Promise<string> {
    const verificationId = `nitter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Get initial like count from user's profile
      const initialLikeCount = await this.getUserLikeCount(userTwitterHandle);
      
      const session: NitterVerificationSession = {
        id: verificationId,
        tweetUrl,
        userTwitterHandle,
        actionType: 'like',
        initialLikeCount,
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
   * Verify like completion by checking if like count increased
   */
  async verifyLikeCompletion(verificationId: string): Promise<NitterVerificationResult> {
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
      // Get current like count
      const currentLikeCount = await this.getUserLikeCount(session.userTwitterHandle);
      
      // Check if like count increased by exactly 1
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
    } catch (error) {
      console.error('Nitter verification failed:', error);
      return {
        success: false,
        confidence: 'low',
        method: 'nitter_error',
        details: 'Failed to verify like count via Nitter'
      };
    }
  }

  /**
   * Get user's total like count from Nitter
   */
  private async getUserLikeCount(twitterHandle: string): Promise<number> {
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
      
      // Parse the HTML to extract like count
      const likeCount = this.parseLikeCountFromHTML(html);
      
      if (likeCount === null) {
        throw new Error('Could not parse like count from Nitter profile');
      }
      
      return likeCount;
    } catch (error) {
      console.error('Failed to get user like count:', error);
      throw error;
    }
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
   * Parse like count from Nitter HTML
   */
  private parseLikeCountFromHTML(html: string): number | null {
    try {
      // Look for the likes count in Nitter's HTML structure
      // Nitter shows stats like: "Tweets Following Followers Likes"
      // We need to find the likes number
      
      // Try multiple patterns to find likes count
      const patterns = [
        /Likes\s*<\/span>\s*<span[^>]*>\s*([0-9,]+)/i,
        /<span[^>]*>\s*Likes\s*<\/span>\s*<span[^>]*>\s*([0-9,]+)/i,
        /class="[^"]*likes[^"]*"[^>]*>\s*([0-9,]+)/i,
        /"likes":\s*([0-9]+)/i
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          // Remove commas and parse as integer
          const likeCountStr = match[1].replace(/,/g, '');
          const likeCount = parseInt(likeCountStr, 10);
          
          if (!isNaN(likeCount)) {
            return likeCount;
          }
        }
      }
      
      // If no pattern matches, try to find any number near "likes" text
      const fallbackPattern = /likes[^0-9]*([0-9,]+)/i;
      const fallbackMatch = html.match(fallbackPattern);
      
      if (fallbackMatch) {
        const likeCountStr = fallbackMatch[1].replace(/,/g, '');
        const likeCount = parseInt(likeCountStr, 10);
        
        if (!isNaN(likeCount)) {
          return likeCount;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing like count from HTML:', error);
      return null;
    }
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
  actionType: 'like';
  initialLikeCount: number;
  startTime: number;
  status: 'pending' | 'completed' | 'failed';
}

export const nitterVerifier = NitterVerifier.getInstance();