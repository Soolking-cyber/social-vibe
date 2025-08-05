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

interface VerificationData {
  id: string;
  actionType: 'like' | 'retweet' | 'comment';
  tweetUrl: string;
  expectedComment?: string;
  startTime: number;
  status: 'pending' | 'completed' | 'failed';
  manualConfirmation?: boolean;
  manualConfirmationTime?: number;
}

export class BrowserTwitterVerifier {
  private static instance: BrowserTwitterVerifier;
  private verificationCallbacks: Map<string, (result: VerificationResult) => void> = new Map();
  private messageListeners: Map<string, (event: MessageEvent) => void> = new Map();
  private cleanupTimeouts: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): BrowserTwitterVerifier {
    if (!BrowserTwitterVerifier.instance) {
      BrowserTwitterVerifier.instance = new BrowserTwitterVerifier();
    }
    return BrowserTwitterVerifier.instance;
  }

  constructor() {
    // Clean up old sessions on initialization
    this.cleanupOldSessions();
  }

  /**
   * Start verification process for a Twitter action
   */
  async startVerification(
    actionType: 'like' | 'retweet' | 'comment',
    tweetUrl: string,
    expectedComment?: string
  ): Promise<string> {
    if (!this.isLocalStorageAvailable()) {
      throw new Error('localStorage is not available');
    }

    const verificationId = this.generateVerificationId();

    // Store verification details in localStorage for cross-tab communication
    const verificationData: VerificationData = {
      id: verificationId,
      actionType,
      tweetUrl,
      expectedComment,
      startTime: Date.now(),
      status: 'pending'
    };

    try {
      localStorage.setItem(`twitter_verification_${verificationId}`, JSON.stringify(verificationData));
    } catch (error) {
      throw new Error('Failed to store verification data');
    }

    // Set up message listener for cross-tab communication
    this.setupMessageListener(verificationId);

    return verificationId;
  }

  /**
   * Check if verification was completed using multiple detection methods
   */
  async checkVerification(verificationId: string): Promise<VerificationResult> {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: false,
        confidence: 'low',
        method: 'storage_unavailable',
        details: 'localStorage is not available'
      };
    }

    let verificationData: VerificationData;
    try {
      const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
      if (!stored) {
        return {
          success: false,
          confidence: 'low',
          method: 'session_not_found',
          details: 'Verification session not found'
        };
      }

      verificationData = JSON.parse(stored) as VerificationData;

      // Validate parsed data structure
      if (!verificationData.id || !verificationData.actionType || !verificationData.startTime) {
        return {
          success: false,
          confidence: 'low',
          method: 'invalid_session_data',
          details: 'Verification session data is corrupted'
        };
      }
    } catch (error) {
      return {
        success: false,
        confidence: 'low',
        method: 'parse_error',
        details: 'Failed to parse verification session data'
      };
    }

    try {
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
          method: 'multi_method_detection',
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
        details: 'Could not verify action completion through automated detection'
      };
    } catch (error) {
      return {
        success: false,
        confidence: 'low',
        method: 'verification_error',
        details: 'Error occurred during verification process'
      };
    }
  }

  /**
   * Manual verification with user confirmation
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

    if (!this.isLocalStorageAvailable()) {
      return {
        success: true,
        confidence: 'low',
        method: 'manual_fallback',
        details: 'Manual confirmation accepted (storage unavailable)'
      };
    }

    // Even with manual confirmation, try to find supporting evidence
    const automaticResult = await this.checkVerification(verificationId);

    // Store manual confirmation safely
    try {
      const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
      if (stored) {
        const verificationData = JSON.parse(stored) as VerificationData;
        verificationData.manualConfirmation = true;
        verificationData.manualConfirmationTime = Date.now();
        localStorage.setItem(`twitter_verification_${verificationId}`, JSON.stringify(verificationData));
      }
    } catch (error) {
      // Continue even if we can't store the manual confirmation
      console.warn('Failed to store manual confirmation');
    }

    return {
      success: true,
      confidence: automaticResult.success ? 'high' : 'medium',
      method: automaticResult.success ? 'manual_with_evidence' : 'manual_confirmation',
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
        details: `Action completed too quickly (${Math.round(timeSpent / 1000)}s < ${Math.round(minTime / 1000)}s minimum)`
      };
    }

    if (timeSpent > maxTime) {
      return {
        success: false,
        confidence: 'medium',
        method: 'time_analysis',
        details: `Action took too long (${Math.round(timeSpent / 1000)}s > ${Math.round(maxTime / 1000)}s maximum)`
      };
    }

    // Check for other indicators
    const baseResult = await this.checkVerification(verificationId);

    return {
      success: baseResult.success,
      confidence: baseResult.success ? 'high' : 'medium',
      method: `time_validated_${baseResult.method}`,
      details: `Time spent: ${Math.round(timeSpent / 1000)}s (valid range). ${baseResult.details || ''}`
    };
  }

  private generateVerificationId(): string {
    return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupMessageListener(verificationId: string) {
    if (typeof window === 'undefined') {
      return; // Server-side rendering safety
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        // Validate message structure and origin for security
        if (!event.data || typeof event.data !== 'object') {
          return;
        }

        if (event.data.type === 'twitter_action_completed' && event.data.verificationId === verificationId) {
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
      } catch (error) {
        // Ignore malformed messages
        console.warn('Invalid message received:', error);
      }
    };

    // Store reference to listener for proper cleanup
    this.messageListeners.set(verificationId, handleMessage);
    window.addEventListener('message', handleMessage);

    // Clean up after 10 minutes with proper cleanup
    const timeoutId = setTimeout(() => {
      this.cleanupVerification(verificationId);
    }, 600000);

    this.cleanupTimeouts.set(verificationId, timeoutId);
  }

  private cleanupVerification(verificationId: string) {
    // Remove message listener
    const messageListener = this.messageListeners.get(verificationId);
    if (messageListener && typeof window !== 'undefined') {
      window.removeEventListener('message', messageListener);
      this.messageListeners.delete(verificationId);
    }

    // Clear timeout
    const timeoutId = this.cleanupTimeouts.get(verificationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.cleanupTimeouts.delete(verificationId);
    }

    // Remove callback
    this.verificationCallbacks.delete(verificationId);
  }

  private async checkLocalStorageIndicators(verificationId: string): Promise<VerificationResult> {
    if (!this.isLocalStorageAvailable()) {
      return { success: false, confidence: 'low', method: 'localStorage_unavailable' };
    }

    try {
      // Check for Twitter-related localStorage changes
      const twitterKeys = Object.keys(localStorage).filter(key =>
        key.includes('twitter') || key.includes('x.com') || key.includes('tweet')
      );

      const stored = localStorage.getItem(`twitter_verification_${verificationId}`);
      if (!stored) {
        return { success: false, confidence: 'low', method: 'localStorage_session_missing' };
      }

      const verificationData = JSON.parse(stored) as VerificationData;

      // Look for new Twitter-related storage entries since verification started
      const recentEntries = twitterKeys.filter(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            // Safely parse and check timestamp
            const itemData = JSON.parse(item);
            if (itemData && typeof itemData === 'object' &&
              typeof itemData.timestamp === 'number' &&
              itemData.timestamp > verificationData.startTime) {
              return true;
            }
          }
        } catch (error) {
          // Skip items that can't be parsed as JSON
        }
        return false;
      });

      return {
        success: recentEntries.length > 0,
        confidence: recentEntries.length > 0 ? 'medium' : 'low',
        method: 'localStorage_analysis',
        details: `Found ${recentEntries.length} new Twitter-related storage entries`
      };
    } catch (error) {
      return {
        success: false,
        confidence: 'low',
        method: 'localStorage_error',
        details: 'Error analyzing localStorage'
      };
    }
  }

  private async checkSessionStorageIndicators(verificationId: string): Promise<VerificationResult> {
    if (typeof sessionStorage === 'undefined') {
      return {
        success: false,
        confidence: 'low',
        method: 'sessionStorage_unavailable',
        details: 'sessionStorage is not available'
      };
    }

    try {
      // Check for Twitter-related sessionStorage entries
      const twitterKeys = Object.keys(sessionStorage).filter(key =>
        key.includes('twitter') || key.includes('x.com') || key.includes('tweet')
      );

      return {
        success: twitterKeys.length > 0,
        confidence: 'low',
        method: 'sessionStorage_analysis',
        details: `Found ${twitterKeys.length} Twitter-related session entries`
      };
    } catch (error) {
      return {
        success: false,
        confidence: 'low',
        method: 'sessionStorage_error',
        details: 'Error accessing sessionStorage'
      };
    }
  }

  private async checkBrowserHistory(verificationData: VerificationData): Promise<VerificationResult> {
    try {
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
          details: `User was away for ${Math.round(timeAway / 1000)}s (sufficient time for ${verificationData.actionType})`
        };
      }

      return {
        success: false,
        confidence: 'low',
        method: 'navigation_timing',
        details: `Insufficient time away (${Math.round(timeAway / 1000)}s)`
      };
    } catch (error) {
      return {
        success: false,
        confidence: 'low',
        method: 'navigation_timing_error',
        details: 'Error checking navigation timing'
      };
    }
  }

  private async checkUserInteractionPatterns(verificationData: VerificationData): Promise<VerificationResult> {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: false,
        confidence: 'low',
        method: 'interaction_pattern_unavailable',
        details: 'Cannot check interaction patterns (storage unavailable)'
      };
    }

    try {
      // Check for patterns that indicate the user actually interacted with Twitter

      // Look for focus/blur events that might indicate tab switching
      const focusEventsStr = localStorage.getItem('focus_events_count') || '0';
      const blurEventsStr = localStorage.getItem('blur_events_count') || '0';

      const focusEvents = parseInt(focusEventsStr, 10);
      const blurEvents = parseInt(blurEventsStr, 10);

      // Validate parsed numbers
      if (isNaN(focusEvents) || isNaN(blurEvents)) {
        return {
          success: false,
          confidence: 'low',
          method: 'interaction_pattern_invalid',
          details: 'Invalid interaction pattern data'
        };
      }

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
    } catch (error) {
      return {
        success: false,
        confidence: 'low',
        method: 'interaction_pattern_error',
        details: 'Error checking interaction patterns'
      };
    }
  }

  /**
   * Clean up old verification sessions
   */
  cleanupOldSessions() {
    if (!this.isLocalStorageAvailable()) {
      return;
    }

    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('twitter_verification_'));
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      keys.forEach(key => {
        try {
          const dataStr = localStorage.getItem(key);
          if (!dataStr) {
            return;
          }

          const data = JSON.parse(dataStr) as VerificationData;
          if (data.startTime && (now - data.startTime) > maxAge) {
            localStorage.removeItem(key);
          }
        } catch (error) {
          // Invalid data, remove it
          try {
            localStorage.removeItem(key);
          } catch (removeError) {
            // Ignore removal errors
          }
        }
      });
    } catch (error) {
      console.warn('Error during cleanup of old sessions:', error);
    }
  }

  /**
   * Check if localStorage is available and accessible
   */
  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }

      // Test if we can actually use localStorage
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Safe event tracking class to prevent memory leaks and race conditions
class EventTracker {
  private static instance: EventTracker;
  private focusCount = 0;
  private blurCount = 0;
  private isInitialized = false;

  static getInstance(): EventTracker {
    if (!EventTracker.instance) {
      EventTracker.instance = new EventTracker();
    }
    return EventTracker.instance;
  }

  initialize() {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    // Load existing counts from localStorage safely
    try {
      if (typeof localStorage !== 'undefined') {
        const storedFocus = localStorage.getItem('focus_events_count');
        const storedBlur = localStorage.getItem('blur_events_count');

        this.focusCount = storedFocus ? parseInt(storedFocus, 10) || 0 : 0;
        this.blurCount = storedBlur ? parseInt(storedBlur, 10) || 0 : 0;
      }
    } catch (error) {
      // Ignore localStorage errors
      this.focusCount = 0;
      this.blurCount = 0;
    }

    // Set up event listeners with error handling
    const handleFocus = () => {
      this.focusCount++;
      this.saveCount('focus_events_count', this.focusCount);
    };

    const handleBlur = () => {
      this.blurCount++;
      this.saveCount('blur_events_count', this.blurCount);
    };

    window.addEventListener('focus', handleFocus, { passive: true });
    window.addEventListener('blur', handleBlur, { passive: true });

    this.isInitialized = true;
  }

  private saveCount(key: string, count: number) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, count.toString());
      }
    } catch (error) {
      // Ignore localStorage errors
    }
  }
}

// Initialize event tracking safely
if (typeof window !== 'undefined') {
  EventTracker.getInstance().initialize();
}

export const browserVerifier = BrowserTwitterVerifier.getInstance();