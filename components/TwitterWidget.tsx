'use client';

import { useEffect, useRef, useState } from 'react';
import { widgetVerifier } from '@/lib/widget-verification';
import { ErrorBoundary } from './ErrorBoundary';

interface TwitterWidgetProps {
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'reply' | 'comment';
  onInteraction?: (type: 'like' | 'retweet' | 'reply' | 'comment') => void;
  onVerificationReady?: (verificationId: string) => void;
}

declare global {
  interface Window {
    twttr: any;
  }
}

function TwitterWidgetCore({ tweetUrl, actionType, onInteraction, onVerificationReady }: TwitterWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [interactionDetected, setInteractionDetected] = useState(false);

  // Normalize action type (comment -> reply for Twitter API consistency)
  const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;

  // Extract tweet ID from URL
  const extractTweetId = (url: string): string | null => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      setError('Invalid tweet URL');
      return;
    }

    // Load Twitter widgets script if not already loaded
    const loadTwitterScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.twttr) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Twitter script'));
        document.head.appendChild(script);
      });
    };

    const initializeWidget = async () => {
      try {
        await loadTwitterScript();
        
        if (containerRef.current && window.twttr) {
          // Clear previous content
          containerRef.current.innerHTML = '';

          // Create embedded tweet
          await window.twttr.widgets.createTweet(tweetId, containerRef.current, {
            theme: 'dark',
            width: 400,
            conversation: 'none',
            cards: 'visible'
          });

          setIsLoaded(true);
          
          // Start verification session
          const vId = widgetVerifier.startVerification(normalizedActionType, tweetUrl);
          setVerificationId(vId);
          onVerificationReady?.(vId);
          
          // Emit global event
          window.dispatchEvent(new CustomEvent('widget-verification-start'));
          
          // Set up interaction detection
          setupInteractionDetection(vId);
        }
      } catch (err) {
        console.error('Error loading Twitter widget:', err);
        setError('Failed to load tweet');
      }
    };

    const setupInteractionDetection = (vId: string) => {
      if (!containerRef.current) return;

      // Monitor for clicks on Twitter widget buttons
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' || mutation.type === 'childList') {
            // Check for interaction indicators in the widget
            const widget = containerRef.current?.querySelector('iframe');
            if (widget) {
              // We can detect some interactions through iframe content changes
              // This is limited due to cross-origin restrictions, but we can detect some patterns
              detectInteractionFromWidget();
            }
          }
        });
      });

      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-pressed', 'data-*']
      });

      // Also listen for click events
      containerRef.current.addEventListener('click', (event) => {
        // Detect which type of interaction based on click target
        const target = event.target as HTMLElement;
        const clickedElement = target.closest('[data-testid], [role="button"], button');
        
        if (clickedElement) {
          // Try to determine interaction type from element attributes
          const testId = clickedElement.getAttribute('data-testid');
          const ariaLabel = clickedElement.getAttribute('aria-label');
          
          let detectedType: 'like' | 'retweet' | 'reply' | 'comment' | null = null;
          
          if (testId?.includes('like') || ariaLabel?.toLowerCase().includes('like')) {
            detectedType = 'like';
          } else if (testId?.includes('retweet') || ariaLabel?.toLowerCase().includes('retweet')) {
            detectedType = 'retweet';
          } else if (testId?.includes('reply') || ariaLabel?.toLowerCase().includes('reply') || 
                     testId?.includes('comment') || ariaLabel?.toLowerCase().includes('comment')) {
            // Map both reply and comment to the original action type
            detectedType = actionType === 'comment' ? 'comment' : 'reply';
          }
          
          if (detectedType) {
            // Extract tweet ID for history recording
            const tweetId = extractTweetId(tweetUrl);
            
            // Use normalized type for internal tracking but original type for callback
            const trackingType = detectedType === 'comment' ? 'reply' : detectedType;
            
            // Record the interaction
            widgetVerifier.recordInteraction(vId, trackingType);
            if (tweetId) {
              widgetVerifier.recordInteractionHistory(tweetId, trackingType);
            }
            
            setInteractionDetected(true);
            onInteraction?.(detectedType);
            
            // Emit global event
            window.dispatchEvent(new CustomEvent('widget-interaction-detected'));
            
            // Show visual feedback
            showInteractionFeedback(detectedType);
          }
        }
      });
    };

    const detectInteractionFromWidget = () => {
      // Enhanced detection for iframe content changes
      // Look for visual changes that indicate interaction completion
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe) {
        // Monitor for changes in iframe content that suggest interaction
        // This is limited by cross-origin restrictions but can catch some patterns
        console.log('Widget content changed - possible interaction');
      }
    };

    const showInteractionFeedback = (type: string) => {
      // Use React-friendly approach with a portal-like pattern
      const feedbackId = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create feedback element
      const feedback = document.createElement('div');
      feedback.id = feedbackId;
      feedback.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 ease-in-out';
      feedback.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 bg-white rounded-full flex items-center justify-center">
            <div class="w-2 h-2 bg-green-600 rounded-full"></div>
          </div>
          <span>✓ ${type.charAt(0).toUpperCase() + type.slice(1)} detected!</span>
        </div>
      `;
      
      // Safe DOM manipulation with error handling
      const safeAppend = () => {
        try {
          // Check if document.body exists and is ready
          if (document.body && document.readyState !== 'loading') {
            document.body.appendChild(feedback);
            return true;
          }
          return false;
        } catch (error) {
          console.warn('Failed to append feedback element:', error);
          return false;
        }
      };
      
      // Safe removal function
      const safeRemove = () => {
        try {
          const element = document.getElementById(feedbackId);
          if (element && element.parentNode && document.body.contains(element)) {
            element.parentNode.removeChild(element);
          }
        } catch (error) {
          // Silently handle removal errors
        }
      };
      
      // Try to append the element
      if (safeAppend()) {
        // Animate in after a brief delay
        requestAnimationFrame(() => {
          const element = document.getElementById(feedbackId);
          if (element) {
            element.style.transform = 'translateX(0)';
          }
        });
        
        // Schedule removal
        setTimeout(() => {
          const element = document.getElementById(feedbackId);
          if (element) {
            element.style.transform = 'translateX(100%)';
            // Remove after animation completes
            setTimeout(safeRemove, 300);
          }
        }, 3000);
      }
    };

    initializeWidget();

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      // Clean up any remaining feedback elements
      try {
        const feedbackElements = document.querySelectorAll('[id^="feedback-"]');
        feedbackElements.forEach(element => {
          try {
            // Remove element safely with multiple checks
            if (element && element.parentNode && document.body.contains(element)) {
              element.parentNode.removeChild(element);
            }
          } catch (removeError) {
            // Silently handle individual element removal errors
          }
        });
      } catch (error) {
        // Silently handle cleanup errors to prevent app crashes
      }
      
      // Emit cleanup event
      if (verificationId) {
        window.dispatchEvent(new CustomEvent('widget-verification-end'));
      }
    };
  }, [tweetUrl, onInteraction]);

  // Additional cleanup effect for component unmounting
  useEffect(() => {
    return () => {
      // Clean up any pending feedback elements when component unmounts
      try {
        const feedbackElements = document.querySelectorAll('[id^="feedback-"]');
        feedbackElements.forEach(element => {
          try {
            if (element && element.parentNode && document.body.contains(element)) {
              element.parentNode.removeChild(element);
            }
          } catch (error) {
            // Silently handle cleanup errors
          }
        });
      } catch (error) {
        // Silently handle cleanup errors
      }
    };
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
        <p className="text-red-300 text-sm">
          ⚠️ {error}
        </p>
        <p className="text-red-400 text-xs mt-1">
          Please check the tweet URL and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        ref={containerRef} 
        className="flex justify-center min-h-[200px] bg-slate-800/50 rounded-lg p-4"
      >
        {!isLoaded && (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-slate-400">Loading tweet...</span>
          </div>
        )}
      </div>
      
      {isLoaded && (
        <div className={`mt-4 p-3 rounded-lg border ${
          interactionDetected 
            ? 'bg-green-900/20 border-green-700' 
            : 'bg-blue-900/20 border-blue-700'
        }`}>
          {interactionDetected ? (
            <p className="text-green-300 text-sm">
              ✅ <strong>Interaction detected!</strong> Your {actionType === 'comment' ? 'reply' : actionType} action was recorded.
            </p>
          ) : (
            <p className="text-blue-300 text-sm">
              💡 <strong>Please {actionType === 'comment' ? 'reply to' : actionType} the tweet above</strong> to complete this action and earn USDC!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Export wrapped component with error boundary
export function TwitterWidget(props: TwitterWidgetProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-300 text-sm">
            ⚠️ Twitter widget failed to load
          </p>
          <p className="text-yellow-400 text-xs mt-1">
            Please refresh the page to try again.
          </p>
        </div>
      }
    >
      <TwitterWidgetCore {...props} />
    </ErrorBoundary>
  );
}