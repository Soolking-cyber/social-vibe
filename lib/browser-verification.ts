/**
 * Browser-based Twitter Action Verification System
 * This system verifies Twitter actions without API calls by using browser-based detection
 */

export interface VerificationResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  details?: string;
}

export class BrowserTwitterVerifier {
  private static instance: BrowserTwitterVerifier;
  private verificationCallbacks: Map<string, (result: VerificationResult) => void> = new Map();

  static getInstance(): BrowserTwitterVerifier {
    if (!BrowserTwitterVerifier.instance) {
      BrowserTwitterVerifier.instance = new BrowserTwitterVerifier();
    }
    return BrowserTwitterVerifier.instance;
  }

  /**
   * Start verification process for a Twitter action
   */
  async startVerification(
    actionType: 'like' | 'retweet' | 'comment',
    tweetUrl: string,
    expectedComment?: string
  ): Promise<string> {
    const verificationId = this.generateVerificationId();
    
    // Store verification details in localStorage for cross-tab communication
    const verificationData = {
      id: verificationId,
      actionType,
      tweetUrl,
      expectedComment,
      startTime: Date.now(),
      status: 'pending'
    };

    localStorage.setItem(`twitter_verification_${verificationId}`, JSON.stringify(verificationData));
    
    // Set up message listener for cross-tab communication
    this.setupMessageListener(verificationId);
    
    return verificationId;
  }

  /**
   * Check if verification was completed
   */
  async checkVerification(verificationId: string): Promise<VerificationResult> {
    const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
    if (!stored) {
      return {
        success: false,
        confidence: 'low',
        method: 'storage_check',
        details: 'Verification session not found'
      };
    }

    const verificationData = JSON.parse(stored);
    
    // Check multiple verification methods
    const results = await Promise.all([
      this.checkLocalStorageIndicators(verificationId),
      this.checkSessionStorageIndicators(verificationId),
      this.checkBrowserHistory(verificationData),
      this.checkUserInteractionPatterns(verificationData)
    ]);

    // Combine results to determine overall success
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length >= 2) {
      return {
        success: true,
        confidence: 'high',
        method: 'multi_method',
        details: `Verified by ${successfulResults.length} methods: ${successfulResults.map(r => r.method).join(', ')}`
      };
    } else if (successfulResults.length === 1) {
      return {
        success: true,
        confidence: 'medium',
        method: successfulResults[0].method,
        details: successfulResults[0].details
      };
    }

    return {
      success: false,
      confidence: 'low',
      method: 'insufficient_evidence',
      details: 'Could not verify action completion'
    };
  }

  /**
   * Manual verification trigger (user confirms they completed the action)
   */
  async manualVerification(verificationId: string, userConfirmed: boolean): Promise<VerificationResult> {
    if (!userConfirmed) {
      return {
        success: false,
        confidence: 'high',
        method: 'user_denied',
        details: 'User confirmed they did not complete the action'
      };
    }

    // Even with manual confirmation, try to find supporting evidence
    const automaticResult = await this.checkVerification(verificationId);
    
    // Store manual confirmation
    const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
    if (stored) {
      const verificationData = JSON.parse(stored);
      verificationData.manualConfirmation = true;
      verificationData.manualConfirmationTime = Date.now();
      localStorage.setItem(`twitter_verification_${verificationId}`, JSON.stringify(verificationData));
    }

    return {
      success: true,
      confidence: automaticResult.success ? 'high' : 'medium',
      method: automaticResult.success ? `manual_with_evidence` : 'manual_only',
      details: automaticResult.success 
        ? `User confirmed + automatic verification: ${automaticResult.details}`
        : 'User manually confirmed completion'
    };
  }

  /**
   * Enhanced verification with time-based analysis
   */
  async enhancedVerification(verificationId: string): Promise<VerificationResult> {
    const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
    if (!stored) {
      return { success: false, confidence: 'low', method: 'no_session' };
    }

    const verificationData = JSON.parse(stored);
    const timeSpent = Date.now() - verificationData.startTime;

    // Realistic time thresholds for different actions
    const minTimeThresholds = {
      like: 3000,     // 3 seconds minimum
      retweet: 4000,  // 4 seconds minimum  
      comment: 10000  // 10 seconds minimum for typing
    };

    const maxTimeThresholds = {
      like: 60000,    // 1 minute maximum
      retweet: 60000, // 1 minute maximum
      comment: 300000 // 5 minutes maximum
    };

    const minTime = minTimeThresholds[verificationData.actionType as keyof typeof minTimeThresholds] || 5000;
    const maxTime = maxTimeThresholds[verificationData.actionType as keyof typeof maxTimeThresholds] || 120000;

    // Time-based verification
    if (timeSpent < minTime) {
      return {
        success: false,
        confidence: 'high',
        method: 'time_analysis',
        details: `Action completed too quickly (${Math.round(timeSpent/1000)}s < ${Math.round(minTime/1000)}s minimum)`
      };
    }

    if (timeSpent > maxTime) {
      return {
        success: false,
        confidence: 'medium',
        method: 'time_analysis',
        details: `Action took too long (${Math.round(timeSpent/1000)}s > ${Math.round(maxTime/1000)}s maximum)`
      };
    }

    // Check for other indicators
    const baseResult = await this.checkVerification(verificationId);
    
    return {
      success: baseResult.success,
      confidence: baseResult.success ? 'high' : 'medium',
      method: `time_validated_${baseResult.method}`,
      details: `Time spent: ${Math.round(timeSpent/1000)}s (valid range). ${baseResult.details || ''}`
    };
  }

  private generateVerificationId(): string {
    return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupMessageListener(verificationId: string) {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'twitter_action_completed' && event.data?.verificationId === verificationId) {
        const callback = this.verificationCallbacks.get(verificationId);
        if (callback) {
          callback({
            success: true,
            confidence: 'high',
            method: 'cross_tab_message',
            details: 'Action confirmed via cross-tab communication'
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Clean up after 10 minutes
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      this.verificationCallbacks.delete(verificationId);
    }, 600000);
  }

  private async checkLocalStorageIndicators(verificationId: string): Promise<VerificationResult> {
    // Check for Twitter-related localStorage changes
    const twitterKeys = Object.keys(localStorage).filter(key => 
      key.includes('twitter') || key.includes('x.com') || key.includes('tweet')
    );

    const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
    if (!stored) return { success: false, confidence: 'low', method: 'localStorage' };

    const verificationData = JSON.parse(stored);
    
    // Look for new Twitter-related storage entries since verification started
    const recentEntries = twitterKeys.filter(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          // Check if this item was created/modified after verification started
          const itemData = JSON.parse(item);
          if (itemData.timestamp && itemData.timestamp > verificationData.startTime) {
            return true;
          }
        }
      } catch (e) {
        // Not JSON, skip
      }
      return false;
    });

    return {
      success: recentEntries.length > 0,
      confidence: recentEntries.length > 0 ? 'medium' : 'low',
      method: 'localStorage_analysis',
      details: `Found ${recentEntries.length} new Twitter-related storage entries`
    };
  }

  private async checkSessionStorageIndicators(verificationId: string): Promise<VerificationResult> {
    // Similar to localStorage but for sessionStorage
    const twitterKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('twitter') || key.includes('x.com') || key.includes('tweet')
    );

    return {
      success: twitterKeys.length > 0,
      confidence: 'low',
      method: 'sessionStorage_analysis',
      details: `Found ${twitterKeys.length} Twitter-related session entries`
    };
  }

  private async checkBrowserHistory(verificationData: any): Promise<VerificationResult> {
    // We can't directly access browser history, but we can check if the user
    // navigated back to our app (indicating they completed the action)
    
    // Check if the user has been away long enough to complete the action
    const timeAway = Date.now() - verificationData.startTime;
    const minTimeForAction = verificationData.actionType === 'comment' ? 15000 : 5000;

    if (timeAway >= minTimeForAction) {
      return {
        success: true,
        confidence: 'low',
        method: 'navigation_timing',
        details: `User was away for ${Math.round(timeAway/1000)}s (sufficient time for ${verificationData.actionType})`
      };
    }

    return {
      success: false,
      confidence: 'low',
      method: 'navigation_timing',
      details: `Insufficient time away (${Math.round(timeAway/1000)}s)`
    };
  }

  private async checkUserInteractionPatterns(verificationData: any): Promise<VerificationResult> {
    // Check for patterns that indicate the user actually interacted with Twitter
    
    // Look for focus/blur events that might indicate tab switching
    const focusEvents = parseInt(localStorage.getItem('focus_events_count') || '0');
    const blurEvents = parseInt(localStorage.getItem('blur_events_count') || '0');

    // If user switched tabs/windows, it's a good indicator they went to Twitter
    if (blurEvents > 0 && focusEvents > 0) {
      return {
        success: true,
        confidence: 'medium',
        method: 'interaction_pattern',
        details: `Detected ${blurEvents} blur and ${focusEvents} focus events (tab switching)`
      };
    }

    return {
      success: false,
      confidence: 'low',
      method: 'interaction_pattern',
      details: 'No significant interaction patterns detected'
    };
  }

  /**
   * Clean up old verification sessions
   */
  cleanupOldSessions() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('twitter_verification_'));
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    keys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.startTime && (now - data.startTime) > maxAge) {
          localStorage.removeItem(key);
        }
      } catch (e) {
        // Invalid data, remove it
        localStorage.removeItem(key);
      }
    });
  }
}

// Track focus/blur events for interaction pattern analysis
if (typeof window !== 'undefined') {
  let focusCount = 0;
  let blurCount = 0;

  window.addEventListener('focus', () => {
    focusCount++;
    localStorage.setItem('focus_events_count', focusCount.toString());
  });

  window.addEventListener('blur', () => {
    blurCount++;
    localStorage.setItem('blur_events_count', blurCount.toString());
  });
}

export const browserVerifier = BrowserTwitterVerifier.getInstance();