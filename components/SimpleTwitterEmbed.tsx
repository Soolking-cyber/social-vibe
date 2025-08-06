'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Twitter, Eye } from 'lucide-react';
import { widgetVerifier } from '@/lib/widget-verification';
import { nitterVerifier } from '@/lib/nitter-verification';
import { useSession } from 'next-auth/react';

interface SimpleTwitterEmbedProps {
  tweetUrl: string;
  actionType: 'like' | 'retweet' | 'reply' | 'comment';
  onInteraction?: (type: 'like' | 'retweet' | 'reply' | 'comment') => void;
  onVerificationReady?: (verificationId: string) => void;
}

export function SimpleTwitterEmbed({
  tweetUrl,
  actionType,
  onInteraction,
  onVerificationReady
}: SimpleTwitterEmbedProps) {
  const [mounted, setMounted] = useState(false);
  const [interactionCompleted, setInteractionCompleted] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [nitterVerificationId, setNitterVerificationId] = useState<string | null>(null);
  const [isInitializingNitter, setIsInitializingNitter] = useState(false);
  const [nitterError, setNitterError] = useState<string | null>(null);
  const [userTwitterHandle, setUserTwitterHandle] = useState<string>('');
  const [isLoadingHandle, setIsLoadingHandle] = useState(true);

  const { data: session } = useSession();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's Twitter handle from database
  useEffect(() => {
    const fetchTwitterHandle = async () => {
      if (!session?.user?.email) {
        setIsLoadingHandle(false);
        return;
      }

      try {
        const response = await fetch('/api/user/twitter-handle');
        if (response.ok) {
          const data = await response.json();
          if (data.twitterHandle) {
            setUserTwitterHandle(data.twitterHandle);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Twitter handle:', error);
      } finally {
        setIsLoadingHandle(false);
      }
    };

    if (mounted && session) {
      fetchTwitterHandle();
    }
  }, [mounted, session]);

  // Use ref to track if verification was already initialized
  const verificationInitialized = useRef(false);

  // Reset verification when key props change
  useEffect(() => {
    verificationInitialized.current = false;
    setVerificationId(null);
    setInteractionCompleted(false);
    setNitterVerificationId(null);
    setNitterError(null);
  }, [tweetUrl, actionType]);

  // Initialize verification session on mount - only once
  useEffect(() => {
    if (!mounted || verificationInitialized.current) return;

    const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
    const vId = widgetVerifier.startVerification(normalizedActionType, tweetUrl);
    setVerificationId(vId);
    onVerificationReady?.(vId);
    verificationInitialized.current = true;
  }, [mounted, tweetUrl, actionType]); // Removed onVerificationReady from deps

  const handleOpenTwitter = async () => {
    // Automatically initialize Nitter verification if Twitter handle is available
    if (userTwitterHandle.trim() && typeof window !== 'undefined') {
      setIsInitializingNitter(true);
      setNitterError(null);

      try {
        const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;
        const nitterActionType = normalizedActionType as 'like' | 'retweet' | 'reply';
        const nitterId = await nitterVerifier.startVerification(tweetUrl, userTwitterHandle, nitterActionType);
        setNitterVerificationId(nitterId);
        console.log(`✓ Nitter verification initialized for @${userTwitterHandle} - ${actionType} count captured`);
      } catch (error) {
        console.error('Failed to initialize Nitter verification:', error);
        setNitterError('Failed to initialize automatic verification. You can still complete manually.');
      } finally {
        setIsInitializingNitter(false);
      }
    }

    // Open Twitter in a new tab (client-side only)
    if (typeof window !== 'undefined') {
      window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleConfirmInteraction = async () => {
    // Normalize action type once at the beginning
    const normalizedActionType = actionType === 'comment' ? 'reply' : actionType;

    // SECURITY: NO VERIFICATION WITHOUT TWITTER HANDLE - PERIOD!
    if (!userTwitterHandle) {
      setNitterError('🔒 Twitter handle required for verification. Please log out and log back in with Twitter to set up your handle.');
      return;
    }

    // SECURITY: NO VERIFICATION WITHOUT NITTER INITIALIZATION - PERIOD!
    if (!nitterVerificationId) {
      setNitterError('🔒 Please click "Open Twitter" first to initialize verification before confirming.');
      return;
    }

    // ONLY ALLOW NITTER VERIFICATION - NO MANUAL BYPASS
    try {
      const nitterResult = await nitterVerifier.verifyCompletion(nitterVerificationId);

      if (nitterResult.success) {
        console.log('✓ Nitter verification successful:', nitterResult.details);

        // Record in widget verifier as well
        if (verificationId) {
          widgetVerifier.recordInteraction(verificationId, normalizedActionType);

          const tweetId = extractTweetId(tweetUrl);
          if (tweetId) {
            widgetVerifier.recordInteractionHistory(tweetId, normalizedActionType);
          }
        }

        setInteractionCompleted(true);
        onInteraction?.(actionType);
        return;
      } else {
        console.warn('Nitter verification failed:', nitterResult.details);
        setNitterError(`🔒 Verification failed: ${nitterResult.details}. You must actually complete the ${actionType} action on Twitter.`);
        return;
      }
    } catch (error) {
      console.error('Nitter verification error:', error);
      setNitterError('🔒 Verification error. Please try again or contact support.');
      return;
    }
  };

  // Extract tweet ID from URL
  const extractTweetId = (url: string): string | null => {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  };

  const actionEmojis = {
    like: '❤️',
    retweet: '🔄',
    reply: '💬',
    comment: '💬'
  };

  const actionLabels = {
    like: 'Like',
    retweet: 'Retweet',
    reply: 'Reply',
    comment: 'Comment'
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
          <div className="animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Simple Tweet Preview */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Twitter className="h-5 w-5 text-blue-400" />
          <span className="text-slate-300 text-sm">Twitter Action Required</span>
        </div>

        <div className="text-center py-6">
          <div className="text-4xl mb-2">{actionEmojis[actionType]}</div>
          <p className="text-white font-medium mb-2">
            {actionLabels[actionType]} this Tweet
          </p>
          <p className="text-slate-400 text-sm">
            Click below to open Twitter and complete the action
          </p>
        </div>
      </div>

      {/* Twitter Handle Status */}
      {!interactionCompleted && (
        <div className="mb-4">
          {isLoadingHandle ? (
            <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <span className="text-slate-300 text-sm">Loading your Twitter handle...</span>
              </div>
            </div>
          ) : userTwitterHandle ? (
            <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-300">
                <Twitter className="h-4 w-4" />
                <span className="text-sm font-medium">
                  ✓ Using your Twitter handle: @{userTwitterHandle}
                </span>
              </div>
              <p className="text-green-200 text-xs mt-1">
                We'll verify your {actionType} by checking your profile on Nitter (no API costs)
              </p>
            </div>
          ) : (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-300">
                <Twitter className="h-4 w-4" />
                <span className="text-sm font-medium">
                  🔒 Twitter handle required for verification
                </span>
              </div>
              <p className="text-red-200 text-xs mt-1">
                <strong>Verification blocked:</strong> Your Twitter handle should be automatically detected from your login. Please log out and log back in with Twitter, or contact support if this persists.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Nitter Status */}
      {nitterVerificationId && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2 text-green-300">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">
              ✓ {actionType.charAt(0).toUpperCase() + actionType.slice(1)} count captured - ready for verification
            </span>
          </div>
        </div>
      )}

      {/* Nitter Error */}
      {nitterError && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-300 text-sm">
            ⚠️ {nitterError}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {!interactionCompleted ? (
          <>
            <Button
              onClick={handleOpenTwitter}
              disabled={isLoadingHandle}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {isLoadingHandle ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : isInitializingNitter ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Capturing {actionType} count...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Twitter & {actionLabels[actionType]}
                  {userTwitterHandle && ' (Auto-verify)'}
                </>
              )}
            </Button>

            <Button
              onClick={handleConfirmInteraction}
              variant="outline"
              disabled={!userTwitterHandle || !nitterVerificationId}
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {!userTwitterHandle ? (
                <>
                  🔒 Twitter handle required for verification
                </>
              ) : !nitterVerificationId ? (
                <>
                  🔒 Click "Open Twitter" first to verify
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Verify {actionLabels[actionType]} (Check Count)
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-green-400 text-lg mb-2">
              ✅ Action Completed!
            </div>
            <p className="text-slate-400 text-sm">
              Your {actionType} has been verified
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-slate-800/30 border border-slate-700 rounded-lg">
        <div>
          <p className="text-slate-400 text-xs">
            <strong>🔒 Mandatory Verification Process:</strong>
          </p>
          <ol className="text-slate-400 text-xs mt-1 space-y-1">
            <li>1. Twitter handle must be detected from your login</li>
            <li>2. Click "Open Twitter" to capture your current {actionType} count</li>
            <li>3. Complete the {actionType} action on Twitter</li>
            <li>4. Return and click "Verify" to confirm the count increased</li>
          </ol>
          <p className="text-red-300 text-xs mt-2">
            🚫 <strong>No manual verification:</strong> All actions must be verified through count changes
          </p>
        </div>
      </div>
    </div>
  );
}