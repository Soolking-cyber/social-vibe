/**
 * Simple Universal Verification System
 * Works on all platforms (mobile, desktop, all browsers) without installations
 */

export interface SimpleVerificationResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  details: string;
}

export class SimpleVerifier {
  private static instance: SimpleVerifier;

  static getInstance(): SimpleVerifier {
    if (!SimpleVerifier.instance) {
      SimpleVerifier.instance = new SimpleVerifier();
    }
    return SimpleVerifier.instance;
  }

  /**
   * Start a verification session
   */
  startVerification(actionType: string, tweetUrl: string): string {
    const verificationId = `simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const verificationData = {
        id: verificationId,
        actionType,
        tweetUrl,
        startTime: Date.now(),
        status: 'pending'
      };

      localStorage.setItem(`verification_${verificationId}`, JSON.stringify(verificationData));
    } catch (error) {
      // If localStorage fails, continue without it
      console.warn('localStorage not available, using memory-only verification');
    }

    return verificationId;
  }

  /**
   * Verify action completion using time-based analysis and user confirmation
   */
  async verifyCompletion(verificationId: string, userConfirmed: boolean): Promise<SimpleVerificationResult> {
    if (!userConfirmed) {
      return {
        success: false,
        confidence: 'high',
        method: 'user_denied',
        details: 'User confirmed they did not complete the action'
      };
    }

    let verificationData;
    try {
      const stored = localStorage.getItem(`verification_${verificationId}`);
      if (stored) {
        verificationData = JSON.parse(stored);
      }
    } catch (error) {
      // Continue without stored data
    }

    // Time-based verification
    if (verificationData) {
      const timeSpent = Date.now() - verificationData.startTime;
      const minTimeRequired = this.getMinTimeForAction(verificationData.actionType);
      const maxTimeAllowed = this.getMaxTimeForAction(verificationData.actionType);

      // Check if user spent reasonable time
      if (timeSpent < minTimeRequired) {
        return {
          success: false,
          confidence: 'high',
          method: 'time_too_short',
          details: `Action completed too quickly (${Math.round(timeSpent/1000)}s). Minimum time required: ${Math.round(minTimeRequired/1000)}s`
        };
      }

      if (timeSpent > maxTimeAllowed) {
        return {
          success: false,
          confidence: 'medium',
          method: 'time_too_long',
          details: `Action took too long (${Math.round(timeSpent/1000)}s). This might indicate the action wasn't completed.`
        };
      }

      // Time is reasonable - accept the verification
      return {
        success: true,
        confidence: 'medium',
        method: 'time_based_verification',
        details: `User confirmed completion after ${Math.round(timeSpent/1000)}s (reasonable time for ${verificationData.actionType})`
      };
    }

    // Fallback: Accept user confirmation without time data
    return {
      success: true,
      confidence: 'low',
      method: 'manual_confirmation_only',
      details: 'User manually confirmed action completion'
    };
  }

  /**
   * Get minimum time required for different actions (in milliseconds)
   */
  private getMinTimeForAction(actionType: string): number {
    switch (actionType.toLowerCase()) {
      case 'like':
        return 3000; // 3 seconds minimum
      case 'retweet':
        return 4000; // 4 seconds minimum
      case 'comment':
        return 10000; // 10 seconds minimum (time to type)
      default:
        return 5000; // 5 seconds default
    }
  }

  /**
   * Get maximum reasonable time for different actions (in milliseconds)
   */
  private getMaxTimeForAction(actionType: string): number {
    switch (actionType.toLowerCase()) {
      case 'like':
        return 60000; // 1 minute maximum
      case 'retweet':
        return 60000; // 1 minute maximum
      case 'comment':
        return 300000; // 5 minutes maximum
      default:
        return 120000; // 2 minutes default
    }
  }

  /**
   * Clean up old verification sessions
   */
  cleanup(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('verification_'));
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      keys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.startTime && (now - data.startTime) > maxAge) {
            localStorage.removeItem(key);
          }
        } catch (error) {
          // Remove invalid data
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

export const simpleVerifier = SimpleVerifier.getInstance();