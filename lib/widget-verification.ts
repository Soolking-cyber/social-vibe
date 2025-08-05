/**
 * Widget-based Twitter Verification System
 * Detects interactions with embedded Twitter widgets
 */

export interface WidgetVerificationResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  details: string;
  interactionDetected?: boolean;
}

export class WidgetVerifier {
  private static instance: WidgetVerifier;
  private verificationSessions: Map<string, VerificationSession> = new Map();

  static getInstance(): WidgetVerifier {
    if (!WidgetVerifier.instance) {
      WidgetVerifier.instance = new WidgetVerifier();
    }
    return WidgetVerifier.instance;
  }

  /**
   * Start a verification session for widget interaction
   */
  startVerification(actionType: string, tweetUrl: string): string {
    const verificationId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: VerificationSession = {
      id: verificationId,
      actionType,
      tweetUrl,
      startTime: Date.now(),
      interactionDetected: false,
      interactionTime: null,
      status: 'pending'
    };

    this.verificationSessions.set(verificationId, session);
    
    // Store in localStorage as backup
    try {
      localStorage.setItem(`widget_verification_${verificationId}`, JSON.stringify(session));
    } catch (error) {
      console.warn('localStorage not available');
    }

    return verificationId;
  }

  /**
   * Record that an interaction was detected
   */
  recordInteraction(verificationId: string, interactionType: string): void {
    const session = this.verificationSessions.get(verificationId);
    if (session) {
      session.interactionDetected = true;
      session.interactionTime = Date.now();
      session.detectedInteractionType = interactionType;
      
      // Update localStorage
      try {
        localStorage.setItem(`widget_verification_${verificationId}`, JSON.stringify(session));
      } catch (error) {
        console.warn('Failed to update localStorage');
      }
    }
  }

  /**
   * Enhanced verification with multiple detection methods
   */
  async verifyCompletion(verificationId: string, userConfirmed: boolean): Promise<WidgetVerificationResult> {
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

    // Enhanced interaction detection with multiple verification layers
    if (session.interactionDetected && session.interactionTime) {
      const interactionDelay = session.interactionTime - session.startTime;
      
      // Additional browser-side verification
      const browserVerification = await this.performBrowserVerification(session.tweetUrl, session.actionType);
      
      // Verify the interaction type matches what was requested
      if (session.detectedInteractionType === session.actionType) {
        return {
          success: true,
          confidence: browserVerification.detected ? 'high' : 'medium',
          method: 'widget_interaction_detected',
          details: `${session.actionType} interaction detected after ${Math.round(interactionDelay/1000)}s${browserVerification.detected ? ' (browser verified)' : ''}`,
          interactionDetected: true
        };
      } else {
        return {
          success: true,
          confidence: 'medium',
          method: 'widget_interaction_partial',
          details: `Interaction detected (${session.detectedInteractionType}) but requested ${session.actionType}`,
          interactionDetected: true
        };
      }
    }

    // No interaction detected, but user confirmed - use time-based analysis
    const timeSpent = Date.now() - session.startTime;
    const minTime = this.getMinTimeForAction(session.actionType);
    const maxTime = this.getMaxTimeForAction(session.actionType);

    if (timeSpent < minTime) {
      return {
        success: false,
        confidence: 'high',
        method: 'time_too_short',
        details: `Action completed too quickly (${Math.round(timeSpent/1000)}s). Minimum: ${Math.round(minTime/1000)}s`,
        interactionDetected: false
      };
    }

    if (timeSpent > maxTime) {
      return {
        success: false,
        confidence: 'medium',
        method: 'time_too_long',
        details: `Action took too long (${Math.round(timeSpent/1000)}s). Maximum: ${Math.round(maxTime/1000)}s`,
        interactionDetected: false
      };
    }

    // Time is reasonable, accept manual confirmation
    return {
      success: true,
      confidence: 'medium',
      method: 'manual_with_timing',
      details: `User confirmed after ${Math.round(timeSpent/1000)}s (reasonable time)`,
      interactionDetected: false
    };
  }

  /**
   * Get session from localStorage if not in memory
   */
  private getSessionFromStorage(verificationId: string): VerificationSession | null {
    try {
      const stored = localStorage.getItem(`widget_verification_${verificationId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get minimum time required for different actions
   */
  private getMinTimeForAction(actionType: string): number {
    switch (actionType.toLowerCase()) {
      case 'like':
        return 2000; // 2 seconds (faster with embedded widget)
      case 'retweet':
        return 3000; // 3 seconds
      case 'comment':
      case 'reply':
        return 8000; // 8 seconds (time to type)
      default:
        return 3000;
    }
  }

  /**
   * Get maximum reasonable time for different actions
   */
  private getMaxTimeForAction(actionType: string): number {
    switch (actionType.toLowerCase()) {
      case 'like':
        return 30000; // 30 seconds
      case 'retweet':
        return 45000; // 45 seconds
      case 'comment':
      case 'reply':
        return 180000; // 3 minutes
      default:
        return 60000;
    }
  }

  /**
   * Perform additional browser-side verification
   */
  private async performBrowserVerification(tweetUrl: string, actionType: string): Promise<{detected: boolean, details: string}> {
    try {
      // Extract tweet ID from URL
      const tweetId = this.extractTweetId(tweetUrl);
      if (!tweetId) {
        return { detected: false, details: 'Invalid tweet URL' };
      }

      // Check for visual indicators in the DOM
      const indicators = this.checkDOMIndicators(tweetId, actionType);
      
      // Check localStorage for interaction history
      const historyCheck = this.checkInteractionHistory(tweetId, actionType);
      
      return {
        detected: indicators || historyCheck,
        details: indicators ? 'DOM indicators found' : historyCheck ? 'Interaction history found' : 'No verification found'
      };
    } catch (error) {
      return { detected: false, details: 'Verification error' };
    }
  }

  /**
   * Extract tweet ID from URL
   */
  private extractTweetId(url: string): string | null {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Check DOM for interaction indicators
   */
  private checkDOMIndicators(tweetId: string, actionType: string): boolean {
    try {
      // Look for Twitter widget iframes
      const iframes = document.querySelectorAll('iframe[src*="twitter.com"]');
      
      for (const iframe of iframes) {
        const src = iframe.getAttribute('src');
        if (src && src.includes(tweetId)) {
          // Found the relevant tweet iframe
          // Check for interaction indicators in the parent container
          const container = iframe.closest('[data-tweet-id], .twitter-tweet');
          if (container) {
            // Look for interaction state changes
            const interactionElements = container.querySelectorAll('[aria-pressed="true"], .liked, .retweeted, .replied');
            if (interactionElements.length > 0) {
              return true;
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      console.warn('DOM verification failed:', error);
      return false;
    }
  }

  /**
   * Check interaction history in localStorage
   */
  private checkInteractionHistory(tweetId: string, actionType: string): boolean {
    try {
      const historyKey = `twitter_interaction_${tweetId}_${actionType}`;
      const history = localStorage.getItem(historyKey);
      return history !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Record interaction in history
   */
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

  /**
   * Clean up old sessions
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
      const keys = Object.keys(localStorage).filter(key => key.startsWith('widget_verification_'));
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

interface VerificationSession {
  id: string;
  actionType: string;
  tweetUrl: string;
  startTime: number;
  interactionDetected: boolean;
  interactionTime: number | null;
  detectedInteractionType?: string;
  status: 'pending' | 'completed' | 'failed';
}

export const widgetVerifier = WidgetVerifier.getInstance();