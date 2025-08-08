/**
 * Simple in-memory cache for verification results
 * Helps avoid repeated API calls for same user/tweet combinations
 */

interface VerificationCacheEntry {
  verified: boolean;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class VerificationCache {
  private cache = new Map<string, VerificationCacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private getKey(username: string, tweetId: string, action: string): string {
    return `${username}:${tweetId}:${action}`;
  }

  set(username: string, tweetId: string, action: string, verified: boolean, ttl?: number): void {
    const key = this.getKey(username, tweetId, action);
    this.cache.set(key, {
      verified,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    });
  }

  get(username: string, tweetId: string, action: string): boolean | null {
    const key = this.getKey(username, tweetId, action);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.verified;
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const verificationCache = new VerificationCache();

// Clean up every 10 minutes
setInterval(() => {
  verificationCache.cleanup();
}, 10 * 60 * 1000);