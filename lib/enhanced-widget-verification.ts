/**
 * Enhanced Widget-based Twitter Verification System
 * Advanced interaction detection with multiple verification layers
 */

export interface EnhancedVerificationResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  details: string;
  interactionDetected?: boolean;
  browserVerified?: boolean;
  timeAnalysis?: {
    timeSpent: number;
    expectedRange: [number, number];
    withinRange: boolean;
  };
}

export class EnhancedWidgetVerifier {
  private static instance: EnhancedWidgetVerifier;
  private verificationSessions: Map<string, EnhancedVerificationSession> = new Map();
  private interactionObservers: Map<string, MutationObserver> = new Map();

  static getInstance(): EnhancedWidgetVerifier {
    if (!EnhancedWidgetVerifier.instance) {
      EnhancedWidgetVerifier.instance = new EnhancedWidgetVerifier();
    }
    return EnhancedWidgetVerifier.instance;
  }

  /**
   * Start enhanced verification with multiple detection methods
   */
  startVerification(actionType: string, tweetUrl: string): string {
    const verificationId = `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: EnhancedVerificationSession = {
      id: verificationId,
      actionType,
      tweetUrl,
      startTime: Date.now(),
      interactionDetected: false,
      interactionTime: null,
      status: 'pending',
      detectionMethods: [],
      browserEvents: []
    };

    this.verificationSessions.set(verificationId, session);
    
    // Start monitoring browser events
    this.startBrowserMonitoring(verificationId);
    
    // Store in localStorage as backup
    try {
      localStorage.setItem(`enhanced_verification_${verificationId}`, JSON.stringify(session));
    } catch (error) {
      console.warn('localStorage not available');
    }

    return verificationId;
  }

  /**
   * Start monitoring browser events for interaction detection
   */
  private startBrowserMonitoring(verificationId: string): void {
    const session = this.verificationSessions.get(verificationId);
    if (!session) return;

    // Monitor for Twitter widget interactions
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' || mutation.type === 'childList') {
          this.analyzeMutation(verificationId, mutation);
        }
      });
    });

    // Start observing the document for Twitter widget changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'data-*', 'style']
    });

    this.interactionObservers.set(verificationId, observer);

    // Also monitor for click events on Twitter widgets
    const clickHandler = (event: Event) => {
      this.analyzeClick(verificationId, event);
    };

    document.addEventListener('click', clickHandler, true);

    // Clean up after 5 minutes
    setTimeout(() => {
      observer.disconnect();
      document.removeEventListener('click', clickHandler, true);
      this.interactionObservers.delete(verificationId);
    }, 5 * 60 * 1000);
  }

  /**
   * Analyze DOM mutations for interaction indicators
   */
  private analyzeMutation(verificationId: string, mutation: MutationRecord): void {
    const session = this.verificationSessions.get(verificationId);
    if (!session || session.interactionDetected) return;

    const target = mutation.target as Element;
    
    // Check for Twitter widget interaction indicators
    if (target.closest('iframe[src*="twitter.com"]') || 
        target.closest('.twitter-tweet') ||
        target.classList?.contains('twitter-tweet')) {
      
      // Look for interaction state changes
      const interactionIndicators = [
        '[aria-pressed="true"]',
        '.liked',
        '.retweeted', 
        '.replied',
        '[data-testid*="like"][aria-pressed="true"]',
        '[data-testid*="retweet"][aria-pressed="true"]',
        '[data-testid*="reply"][aria-pressed="true"]'
      ];

      for (const selector of interactionIndicators) {
        if (target.matches?.(selector) || target.querySelector?.(selector)) {
          this.recordInteraction(verificationId, this.detectInteractionType(selector), 'mutation_observer');
          break;
        }
      }
    }
  }

  /**
   * Analyze click events for Twitter interactions
   */
  private analyzeClick(verificationId: string, event: Event): void {
    const session = this.verificationSessions.get(verificationId);
    if (!session) return;

    const target = event.target as Element;
    const twitterElement = target.closest('iframe[src*="twitter.com"], .twitter-tweet, [data-testid]');
    
    if (twitterElement) {
      // Record the click event
      session.browserEvents.push({
        type: 'click',
        timestamp: Date.now(),
        target: target.tagName,
        testId: target.getAttribute('data-testid'),
        ariaLabel: target.getAttribute('aria-label')
      });

      // Try to detect interaction type
      const testId = target.getAttribute('data-testid') || target.closest('[data-testid]')?.getAttribute('data-testid');
      const ariaLabel = target.getAttribute('aria-label') || target.closest('[aria-label]')?.getAttribute('aria-label');
      
      let detectedType: string | null = null;
      
      if (testId?.includes('like') || ariaLabel?.toLowerCase().includes('like')) {
        detectedType = 'like';
      } else if (testId?.includes('retweet') || ariaLabel?.toLowerCase().includes('retweet')) {
        detectedType = 'retweet';
      } else if (testId?.includes('reply') || ariaLabel?.toLowerCase().includes('reply')) {
        detectedType = 'reply';
      }

      if (detectedType && detectedType === session.actionType) {
        this.recordInteraction(verificationId, detectedType, 'click_detection');
      }
    }
  }

  /**
   * Detect interaction type from selector
   */
  private detectInteractionType(selector: string): string {
    if (selector.includes('like')) return 'like';
    if (selector.includes('retweet')) return 'retweet';
    if (selector.includes('reply')) return 'reply';
    return 'unknown';
  }

  /**
   * Record interaction with enhanced tracking
   */
  recordInteraction(verificationId: string, interactionType: string, method: string): void {
    const session = this.verificationSessions.get(verificationId);
    if (session && !session.interactionDetected) {
      session.interactionDetected = true;
      session.interactionTime = Date.now();
      session.detectedInteractionType = interactionType;
      session.detectionMethods.push(method);
      
      // Record in interaction history
      const tweetId = this.extractTweetId(session.tweetUrl);
      if (tweetId) {
        this.recordInteractionHistory(tweetId, interactionType);
      }
      
      // Update localStorage
      try {
        localStorage.setItem(`enhanced_verification_${verificationId}`, JSON.stringify(session));
      } catch (error) {
        console.warn('Failed to update localStorage');
      }
    }
  }

  /**
   * Enhanced verification with multiple layers
   */
  async verifyCompletion(verificationId: string, userConfirmed: boolean): Promise<EnhancedVerificationResult> {
    const session = this.verificationSessions.get(verificationId) || this.getSessionFromStorage(verificationId);
    
    if (!session) {
      return {
        success: false,
        confidence: 'low',
        method: 'no_session',
        details: 'Verification session not found'
      };
    }

    if (!userConfirmed) {
      return {
        success: false,
        confidence: 'high',
        method: 'user_denied',
        details: 'User confirmed they did not complete the action'
      };
    }

    const timeSpent = Date.now() - session.startTime;
    const expectedRange = this.getTimeRangeForAction(session.actionType);
    const timeAnalysis = {
      timeSpent,
      expectedRange,
      withinRange: timeSpent >= expectedRange[0] && timeSpent <= expectedRange[1]
    };

    // Multi-layer verification
    const browserVerification = await this.performBrowserVerification(session.tweetUrl, session.actionType);
    const historyVerification = this.checkInteractionHistory(this.extractTweetId(session.tweetUrl) || '', session.actionType);

    // High confidence: Interaction detected + browser verified + reasonable time
    if (session.interactionDetected && browserVerification.detected && timeAnalysis.withinRange) {
      return {
        success: true,
        confidence: 'high',
        method: 'multi_layer_verified',
        details: `${session.actionType} verified through ${session.detectionMethods.join(', ')}`,
        interactionDetected: true,
        browserVerified: true,
        timeAnalysis
      };
    }

    // Medium confidence: Interaction detected + reasonable time
    if (session.interactionDetected && timeAnalysis.withinRange) {
      return {
        success: true,
        confidence: 'medium',
        method: 'interaction_and_timing',
        details: `${session.actionType} detected via ${session.detectionMethods.join(', ')}`,
        interactionDetected: true,
        browserVerified: browserVerification.detected,
        timeAnalysis
      };
    }

    // Low confidence: Only history or timing
    if (historyVerification && timeAnalysis.withinRange) {
      return {
        success: true,
        confidence: 'low',
        method: 'history_and_timing',
        details: 'Interaction found in history with reasonable timing',
        interactionDetected: false,
        browserVerified: browserVerification.detected,
        timeAnalysis
      };
    }

    // Failed verification
    return {
      success: false,
      confidence: 'high',
      method: 'insufficient_evidence',
      details: `No sufficient evidence of ${session.actionType} completion`,
      interactionDetected: session.interactionDetected,
      browserVerified: browserVerification.detected,
      timeAnalysis
    };
  }

  /**
   * Get expected time range for actions
   */
  private getTimeRangeForAction(actionType: string): [number, number] {
    switch (actionType.toLowerCase()) {
      case 'like':
        return [1000, 30000]; // 1-30 seconds
      case 'retweet':
        return [2000, 45000]; // 2-45 seconds
      case 'comment':
      case 'reply':
        return [5000, 180000]; // 5 seconds - 3 minutes
      default:
        return [2000, 60000];
    }
  }

  /**
   * Enhanced browser verification
   */
  private async performBrowserVerification(tweetUrl: string, actionType: string): Promise<{detected: boolean, details: string}> {
    try {
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        return { detected: false, details: 'Invalid tweet URL' };
      }

      // Check multiple indicators
      const checks = [
        this.checkDOMIndicators(tweetId, actionType),
        this.checkTwitterWidgetState(tweetId, actionType),
        this.checkLocalStorageIndicators(tweetId, actionType)
      ];

      const detectedCount = checks.filter(Boolean).length;
      
      return {
        detected: detectedCount >= 1,
        details: `${detectedCount}/3 verification methods confirmed interaction`
      };
    } catch (error) {
      return { detected: false, details: 'Verification error' };
    }
  }

  /**
   * Check Twitter widget state
   */
  private checkTwitterWidgetState(tweetId: string, actionType: string): boolean {
    try {
      const iframes = document.querySelectorAll('iframe[src*="twitter.com"]');
      
      for (const iframe of iframes) {
        const src = iframe.getAttribute('src');
        if (src && src.includes(tweetId)) {
          // Check parent container for interaction states
          const container = iframe.closest('[data-interaction-detected="true"]');
          if (container) return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check localStorage for interaction indicators
   */
  private checkLocalStorageIndicators(tweetId: string, actionType: string): boolean {
    try {
      const keys = [
        `twitter_interaction_${tweetId}_${actionType}`,
        `widget_interaction_${tweetId}`,
        `twitter_${actionType}_${tweetId}`
      ];
      
      return keys.some(key => localStorage.getItem(key) !== null);
    } catch (error) {
      return false;
    }
  }

  // ... (include other methods from previous implementation)
  private extractTweetId(url: string): string | null {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  private checkDOMIndicators(tweetId: string, actionType: string): boolean {
    try {
      const selectors = [
        `[data-tweet-id="${tweetId}"] [aria-pressed="true"]`,
        `[data-tweet-id="${tweetId}"] .liked`,
        `[data-tweet-id="${tweetId}"] .retweeted`,
        `[data-tweet-id="${tweetId}"] .replied`
      ];
      
      return selectors.some(selector => document.querySelector(selector) !== null);
    } catch (error) {
      return false;
    }
  }

  private checkInteractionHistory(tweetId: string, actionType: string): boolean {
    try {
      const historyKey = `twitter_interaction_${tweetId}_${actionType}`;
      return localStorage.getItem(historyKey) !== null;
    } catch (error) {
      return false;
    }
  }

  recordInteractionHistory(tweetId: string, actionType: string): void {
    try {
      const historyKey = `twitter_interaction_${tweetId}_${actionType}`;
      localStorage.setItem(historyKey, JSON.stringify({
        timestamp: Date.now(),
        actionType,
        tweetId
      }));
    } catch (error) {
      console.warn('Failed to record interaction history');
    }
  }

  private getSessionFromStorage(verificationId: string): EnhancedVerificationSession | null {
    try {
      const stored = localStorage.getItem(`enhanced_verification_${verificationId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    // Clean memory sessions
    for (const [id, session] of this.verificationSessions.entries()) {
      if (now - session.startTime > maxAge) {
        this.verificationSessions.delete(id);
        
        // Clean up observer
        const observer = this.interactionObservers.get(id);
        if (observer) {
          observer.disconnect();
          this.interactionObservers.delete(id);
        }
      }
    }

    // Clean localStorage
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('enhanced_verification_'));
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

interface EnhancedVerificationSession {
  id: string;
  actionType: string;
  tweetUrl: string;
  startTime: number;
  interactionDetected: boolean;
  interactionTime: number | null;
  detectedInteractionType?: string;
  status: 'pending' | 'completed' | 'failed';
  detectionMethods: string[];
  browserEvents: Array<{
    type: string;
    timestamp: number;
    target: string;
    testId?: string | null;
    ariaLabel?: string | null;
  }>;
}

export const enhancedWidgetVerifier = EnhancedWidgetVerifier.getInstance();